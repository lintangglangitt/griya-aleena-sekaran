import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

export interface Env {
  DB: D1Database;
  BACKUP_BUCKET: R2Bucket;
  CF_ACCOUNT_ID: string;
  CF_D1_DATABASE_ID: string;
  CF_API_TOKEN: string;
}

// ═══════════════════════════════════════════════════════════
// WORKFLOW: Backup D1 → R2
// ═══════════════════════════════════════════════════════════
export class DatabaseBackupWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
    const { CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN, BACKUP_BUCKET } = this.env;

    if (!CF_ACCOUNT_ID || !CF_D1_DATABASE_ID || !CF_API_TOKEN) {
      throw new Error('Backup belum dikonfigurasi.');
    }

    const exportUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/export`;

    // ─── Step 1: Mulai export ───
    const bookmark = await step.do('Mulai export D1', async () => {
      const res = await fetch(exportUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ output_format: 'polling' }),
      });

      const data: any = await res.json();
      if (!data.success) {
        throw new Error('Gagal start export: ' + (data.errors?.[0]?.message || 'unknown'));
      }
      return data.result.at_bookmark;
    });

    // ─── Step 2: Polling ───
    let signedUrl: string | null = null;
    let filename: string | null = null;

    for (let i = 0; i < 10; i++) {
      const result = await step.do(`Cek status #${i + 1}`, async () => {
        const res = await fetch(exportUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            output_format: 'polling',
            current_bookmark: bookmark,
          }),
        });
        return await res.json();
      });

      const r: any = (result as any).result;
      const nested = r?.result || {};
      const s = r?.status || nested.status;
      const url = nested.signed_url || r?.signed_url;
      const fn = nested.filename || r?.filename;

      if (s === 'complete' && url) {
        signedUrl = url;
        filename = fn || 'backup.sql';
        break;
      }

      if (r?.error === 'Not currently exporting anything.') {
        throw new Error('Export sudah selesai tapi tidak terdeteksi.');
      }

      if (i < 9) {
        await step.sleep(`wait-${i}`, '5 seconds');
      }
    }

    if (!signedUrl) {
      throw new Error('Timeout: signed_url tidak ditemukan');
    }

    // ─── Step 3: Download & simpan ke R2 ───
    const r2Key = await step.do('Download & simpan ke R2', async () => {
      const fileRes = await fetch(signedUrl!);
      if (!fileRes.ok) {
        throw new Error('Gagal download: HTTP ' + fileRes.status);
      }

      const now = new Date();
      const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const yyyy = wib.getUTCFullYear();
      const mm = String(wib.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(wib.getUTCDate()).padStart(2, '0');
      const hh = String(wib.getUTCHours()).padStart(2, '0');
      const mi = String(wib.getUTCMinutes()).padStart(2, '0');

      const dateStr = `${yyyy}${mm}${dd}`;
      const timeStr = `${hh}${mi}`;
      const newFilename = `griya-aleena-db-backup_${dateStr}_${timeStr}.sql`;
      const key = `backups/${yyyy}-${mm}-${dd}/${newFilename}`;

      await BACKUP_BUCKET.put(key, fileRes.body, {
        httpMetadata: { contentType: 'application/sql' },
      });

      return key;
    });

    return { success: true, bookmark, r2_key: r2Key, filename };
  }
}

// ═══════════════════════════════════════════════════════════
// HELPER: JSON Response
// ═══════════════════════════════════════════════════════════
function jsonResponse(data: any, status = 200, origin = '*'): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

// ═══════════════════════════════════════════════════════════
// WORKER: HTTP Handler
// ═══════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        service: 'griya-backup-workflow',
      }, 200, origin);
    }

    // Trigger backup
    if (url.pathname === '/trigger' && request.method === 'POST') {
      try {
        const instance = await env.BACKUP_WORKFLOW.create();
        return jsonResponse({
          ok: true,
          instance_id: instance.id,
          message: 'Backup dimulai.',
        }, 200, origin);
      } catch (err: any) {
        return jsonResponse({ error: 'Gagal trigger: ' + err.message }, 500, origin);
      }
    }

    // List backup
    if (url.pathname === '/list') {
      try {
        const list = await env.BACKUP_BUCKET.list({ prefix: 'backups/' });
        const files = list.objects.map(o => ({
          key: o.key,
          size: o.size,
          uploaded: o.uploaded,
        }));
        return jsonResponse({ ok: true, count: files.length, files }, 200, origin);
      } catch (err: any) {
        return jsonResponse({ error: 'Gagal list: ' + err.message }, 500, origin);
      }
    }

    // Download backup
    if (url.pathname === '/download' && request.method === 'GET') {
      try {
        const key = url.searchParams.get('key');
        if (!key) return jsonResponse({ error: 'Parameter key wajib' }, 400, origin);

        const object = await env.BACKUP_BUCKET.get(key);
        if (!object) return jsonResponse({ error: 'File tidak ditemukan' }, 404, origin);

        return new Response(object.body, {
          headers: {
            'Content-Type': 'application/sql',
            'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
            'Access-Control-Allow-Origin': origin,
          },
        });
      } catch (err: any) {
        return jsonResponse({ error: 'Gagal download: ' + err.message }, 500, origin);
      }
    }

        // Restore database
    if (url.pathname === '/restore' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const key = body.key;
        if (!key) return jsonResponse({ error: 'Parameter key wajib' }, 400, origin);

        const object = await env.BACKUP_BUCKET.get(key);
        if (!object) return jsonResponse({ error: 'File backup tidak ditemukan' }, 404, origin);

        const sql = await object.text();

        // ─── Parser SQL ───
        const statements: string[] = [];
        let current = '';
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < sql.length; i++) {
          const char = sql[i];
          const next = sql[i + 1];

          if (!inString && (char === "'" || char === '"')) {
            inString = true;
            stringChar = char;
            current += char;
            continue;
          }
          if (inString) {
            current += char;
            if (char === stringChar) {
              if (next === stringChar) {
                current += next;
                i++;
                continue;
              }
              inString = false;
            }
            continue;
          }
          if (char === ';') {
            const stmt = current.trim();
            if (stmt) statements.push(stmt);
            current = '';
            continue;
          }
          current += char;
        }
        const last = current.trim();
        if (last) statements.push(last);

        // ─── Kelompokkan statement ───
        const creates: string[] = [];
        const inserts: { table: string; stmt: string }[] = [];
        const others: string[] = [];

        for (const stmt of statements) {
          if (/^PRAGMA\s+/i.test(stmt)) continue;
          if (/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(stmt)) continue;

          const createMatch = stmt.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/i);
          const insertMatch = stmt.match(/^INSERT\s+INTO\s+"?(\w+)"?/i);

          if (createMatch) {
            creates.push(stmt);
          } else if (insertMatch) {
            inserts.push({ table: insertMatch[1].toLowerCase(), stmt });
          } else {
            others.push(stmt);
          }
        }

        // ─── Sort INSERT: parent dulu ───
        const parentFirst = ['rooms', 'admin_users', 'counter', 'login_attempts', 'visitor_logs', 'sessions', 'occupancies'];
        inserts.sort((a, b) => {
          const ai = parentFirst.indexOf(a.table);
          const bi = parentFirst.indexOf(b.table);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });

        // ─── Drop semua tabel dulu ───
        const tableNames: string[] = [];
        for (const stmt of creates) {
          const m = stmt.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/i);
          if (m) tableNames.push(m[1]);
        }
        for (const name of [...tableNames].reverse()) {
          try {
            await env.DB.prepare(`DROP TABLE IF EXISTS "${name}"`).run();
          } catch (e) { /* abaikan */ }
        }

        // ─── Execute CREATE dulu ───
        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const stmt of creates) {
          try {
            const cleanStmt = stmt.replace(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i, 'CREATE TABLE');
            await env.DB.prepare(cleanStmt).run();
            success++;
          } catch (err: any) {
            failed++;
            if (errors.length < 10) errors.push(`CREATE: ${stmt.substring(0, 60)}... → ${err.message}`);
          }
        }

        // ─── Execute INSERT (parent dulu) ───
        for (const item of inserts) {
          try {
            await env.DB.prepare(item.stmt).run();
            success++;
          } catch (err: any) {
            failed++;
            if (errors.length < 20) errors.push(`INSERT [${item.table}]: ${item.stmt.substring(0, 60)}... → ${err.message}`);
          }
        }

        // ─── Execute lain-lain ───
        for (const stmt of others) {
          try {
            await env.DB.prepare(stmt).run();
            success++;
          } catch (err: any) {
            failed++;
            if (errors.length < 25) errors.push(`OTHER: ${stmt.substring(0, 60)}... → ${err.message}`);
          }
        }

        return jsonResponse({
          ok: true,
          message: `Restore selesai. Berhasil: ${success}, Gagal: ${failed}`,
          success,
          failed,
          create_count: creates.length,
          insert_count: inserts.length,
          other_count: others.length,
          errors: errors.slice(0, 10),
        }, 200, origin);
      } catch (err: any) {
        return jsonResponse({ error: 'Gagal restore: ' + err.message }, 500, origin);
      }
    }

    // Hapus file backup dari R2
    if (url.pathname === '/backup' && request.method === 'DELETE') {
      try {
        const key = url.searchParams.get('key');
        if (!key) {
          return jsonResponse({ error: 'Parameter key wajib' }, 400, origin);
        }

        if (!key.startsWith('backups/')) {
          return jsonResponse({ error: 'Hanya file di folder backups/ yang boleh dihapus' }, 403, origin);
        }

        const existing = await env.BACKUP_BUCKET.head(key);
        if (!existing) {
          return jsonResponse({ error: 'File tidak ditemukan' }, 404, origin);
        }

        await env.BACKUP_BUCKET.delete(key);

        return jsonResponse({
          ok: true,
          deleted: key,
          message: 'File backup berhasil dihapus',
        }, 200, origin);
      } catch (err: any) {
        return jsonResponse({ error: 'Gagal hapus: ' + err.message }, 500, origin);
      }
    }

    
    // ═══════════════════════════════════════════════════════
    // DATABASE MANAGER
    // ═══════════════════════════════════════════════════════

    // List semua tabel
    if (url.pathname === '/db/tables' && request.method === 'GET') {
      try {
        const result = await env.DB.prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name`
        ).all();

        const tables = result.results.map((r: any) => r.name);

        // Ambil jumlah baris tiap tabel
        const tablesWithCount = [];
        for (const name of tables) {
          try {
            const countResult = await env.DB.prepare(`SELECT COUNT(*) as c FROM "${name}"`).first();
            tablesWithCount.push({ name, count: (countResult as any)?.c || 0 });
          } catch {
            tablesWithCount.push({ name, count: 0 });
          }
        }

        return jsonResponse({ ok: true, tables: tablesWithCount }, 200, origin);
      } catch (err: any) {
        return jsonResponse({ error: 'Gagal list tabel: ' + err.message }, 500, origin);
      }
    }

    // Ambil data tabel
    if (url.pathname.match(/^\/db\/table\/[a-zA-Z_][a-zA-Z0-9_]*$/) && request.method === 'GET') {
      try {
        const tableName = url.pathname.split('/').pop()!;
        const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
        const offset = Number(url.searchParams.get('offset')) || 0;

        // Validasi nama tabel
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          return jsonResponse({ error: 'Nama tabel tidak valid' }, 400, origin);
        }

        const rows = await env.DB.prepare(
          `SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`
        ).bind(limit, offset).all();

        const countResult = await env.DB.prepare(
          `SELECT COUNT(*) as c FROM "${tableName}"`
        ).first();

        // Ambil kolom
        const columns = rows.results.length > 0
          ? Object.keys(rows.results[0] as object)
          : [];

        return jsonResponse({
          ok: true,
          table: tableName,
          columns,
          rows: rows.results,
          total: (countResult as any)?.c || 0,
          limit,
          offset,
        }, 200, origin);
      } catch (err: any) {
        return jsonResponse({ error: 'Gagal ambil data: ' + err.message }, 500, origin);
      }
    }

    // Tambah baris baru
    if (url.pathname.match(/^\/db\/table\/[a-zA-Z_][a-zA-Z0-9_]*$/) && request.method === 'POST') {
      try {
        const tableName = url.pathname.split('/').pop()!;
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          return jsonResponse({ error: 'Nama tabel tidak valid' }, 400, origin);
        }

        const body: any = await request.json();
        const data = body.data;
        if (!data || typeof data !== 'object') {
          return jsonResponse({ error: 'Data wajib dikirim' }, 400, origin);
        }

        const keys = Object.keys(data);
        const values = keys.map(k => data[k]);
        const placeholders = keys.map(() => '?').join(', ');
        const columns = keys.map(k => `"${k}"`).join(', ');

        const result = await env.DB.prepare(
          `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders})`
        ).bind(...values).run();

        return jsonResponse({ ok: true, id: result.meta.last_row_id }, 200, origin);
      } catch (err: any) {
        return jsonResponse({ error: 'Gagal tambah: ' + err.message }, 500, origin);
      }
    }

    // Update baris
    if (url.pathname.match(/^\/db\/table\/[a-zA-Z_][a-zA-Z0-9_]*\/\d+$/) && request.method === 'PUT') {
      try {
        const parts = url.pathname.split('/');
        const id = parts.pop()!;
        const tableName = parts.pop()!;

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          return jsonResponse({ error: 'Nama tabel tidak valid' }, 400, origin);
        }

        const body: any = await request.json();
        const data = body.data;
        if (!data || typeof data !== 'object') {
          return jsonResponse({ error: 'Data wajib dikirim' }, 400, origin);
        }

        const keys = Object.keys(data);
        const values = keys.map(k => data[k]);
        const setters = keys.map(k => `"${k}" = ?`).join(', ');

        await env.DB.prepare(
          `UPDATE "${tableName}" SET ${setters} WHERE id = ?`
        ).bind(...values, id).run();

        return jsonResponse({ ok: true }, 200, origin);
      } catch (err: any) {
        return jsonResponse({ error: 'Gagal update: ' + err.message }, 500, origin);
      }
    }

    // Hapus baris
    if (url.pathname.match(/^\/db\/table\/[a-zA-Z_][a-zA-Z0-9_]*\/\d+$/) && request.method === 'DELETE') {
      try {
        const parts = url.pathname.split('/');
        const id = parts.pop()!;
        const tableName = parts.pop()!;

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          return jsonResponse({ error: 'Nama tabel tidak valid' }, 400, origin);
        }

        await env.DB.prepare(`DELETE FROM "${tableName}" WHERE id = ?`).bind(id).run();

        return jsonResponse({ ok: true }, 200, origin);
      } catch (err: any) {
        return jsonResponse({ error: 'Gagal hapus: ' + err.message }, 500, origin);
      }
    }

    // Import CSV ke tabel
    if (url.pathname.match(/^\/db\/import\/[a-zA-Z_][a-zA-Z0-9_]*$/) && request.method === 'POST') {
      try {
        const tableName = url.pathname.split('/').pop()!;
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          return jsonResponse({ error: 'Nama tabel tidak valid' }, 400, origin);
        }

        const body: any = await request.json();
        const rows = body.rows;
        if (!Array.isArray(rows) || rows.length === 0) {
          return jsonResponse({ error: 'Data kosong' }, 400, origin);
        }

        if (rows.length > 500) {
          return jsonResponse({ error: 'Maksimal 500 baris per import' }, 400, origin);
        }

        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            const keys = Object.keys(row);
            const values = keys.map(k => row[k]);
            const placeholders = keys.map(() => '?').join(', ');
            const columns = keys.map(k => `"${k}"`).join(', ');

            await env.DB.prepare(
              `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders})`
            ).bind(...values).run();

            success++;
          } catch (err: any) {
            failed++;
            errors.push(`Baris ${i + 1}: ${err.message}`);
          }
        }

        return jsonResponse({
          ok: true,
          success,
          failed,
          errors: errors.slice(0, 20),
        }, 200, origin);
      } catch (err: any) {
        return jsonResponse({ error: 'Gagal import: ' + err.message }, 500, origin);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404, origin);
  },
} satisfies ExportedHandler<Env>;