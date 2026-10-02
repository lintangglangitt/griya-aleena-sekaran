export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);

    const corsHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Path',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (allowedOrigins.includes(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let res;

      if (path === '/increment' && request.method === 'POST') {
        res = await handleIncrement(env);
      } else if (path === '/count' && request.method === 'GET') {
        res = await handleCount(env);
      } else if (path === '/auth/login' && request.method === 'POST') {
        res = await handleLogin(request, env);
      } else if (path === '/auth/logout' && request.method === 'POST') {
        res = await handleLogout(request, env);
      } else if (path === '/auth/me' && request.method === 'GET') {
        res = await handleMe(request, env);
     } else if (path === '/rooms' && request.method === 'GET') {
  res = await withAuth(request, env, () => handleGetRooms(env));
} else if (path === '/rooms' && request.method === 'POST') {
  res = await withAuth(request, env, () => handleCreateRoom(request, env));
      } else if (path === '/occupancies' && request.method === 'GET') {
        res = await withAuth(request, env, () => handleGetOccupancies(env));
      } else if (path === '/occupancies' && request.method === 'POST') {
        res = await withAuth(request, env, () => handleCreateOccupancy(request, env));
      } else if (path === '/occupancies/bulk' && request.method === 'POST') {
        res = await withAuth(request, env, () => handleBulkImport(request, env));
      } else if (path.match(/^\/occupancies\/\d+$/) && request.method === 'PUT') {
        const id = path.split('/').pop();
        res = await withAuth(request, env, () => handleUpdateOccupancy(id, request, env));
      } else if (path.match(/^\/occupancies\/\d+$/) && request.method === 'DELETE') {
        const id = path.split('/').pop();
        res = await withAuth(request, env, () => handleDeleteOccupancy(id, env));
      } else if (path === '/users' && request.method === 'GET') {
        res = await withAuth(request, env, (user) => handleGetUsers(env, user));
      } else if (path === '/users' && request.method === 'POST') {
        res = await withAuth(request, env, (user) => handleCreateUser(request, env, user));
      } else if (path.match(/^\/users\/\d+$/) && request.method === 'DELETE') {
        const id = path.split('/').pop();
        res = await withAuth(request, env, (user) => handleDeleteUser(id, env, user));
      } else if (path === '/stats' && request.method === 'GET') {
        res = await withAuth(request, env, () => handleStats(env));

      // ═══════════════════════════════════════════════════════
      // BACKUP D1 — 2 ENDPOINT BARU
      // ═══════════════════════════════════════════════════════
      } else if (path === '/backup/start' && request.method === 'POST') {
        res = await withAuth(request, env, () => handleBackupStart(env));
      } else if (path === '/backup/status' && request.method === 'GET') {
        res = await withAuth(request, env, () => handleBackupStatus(request, env));

      } else if (path === '/upload' && request.method === 'POST') {
        res = await withAuth(request, env, () => handleUpload(request, env));
      } else if (path === '/delete-file' && request.method === 'POST') {
        res = await withAuth(request, env, () => handleDeleteFile(request, env));
      } else if (path === '/delete-files' && request.method === 'POST') {
        res = await withAuth(request, env, () => handleBulkDeleteFiles(request, env));
      } else if (path === '/check-file' && request.method === 'POST') {
        res = await withAuth(request, env, () => handleCheckFile(request, env));
      } else if (path === '/track' && request.method === 'POST') {
        res = await handleTrack(request, env);
      } else if (path === '/analytics' && request.method === 'GET') {
        res = await withAuth(request, env, () => handleGetAnalytics(request, env));
      } else if (path === '/analytics/logs' && request.method === 'GET') {
        res = await withAuth(request, env, () => handleGetVisitorLogs(request, env));
      } else if (path === '/analytics/logs/mark-viewed' && request.method === 'POST') {
        res = await withAuth(request, env, () => handleMarkLogsViewed(request, env));
      } else if (path === '/analytics/logs/unseen-count' && request.method === 'GET') {
        res = await withAuth(request, env, () => handleUnseenCount(env));
      } else if (path === '/analytics/delete' && request.method === 'DELETE') {
        res = await withAuth(request, env, () => handleDeleteVisitorLogs(request, env));
      } else {
        res = json({ error: 'Not found' }, 404);
      }

      const newHeaders = new Headers(res.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
      return new Response(res.body, { status: res.status, headers: newHeaders });

    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: err.message }, 500, corsHeaders);
    }
  }
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

// ═══════════════════════════════════════════════════════════
// BACKUP D1 — START 1
// ═══════════════════════════════════════════════════════════
async function handleBackupStart(env) {
  if (!env.CF_ACCOUNT_ID || !env.CF_D1_DATABASE_ID || !env.CF_API_TOKEN) {
    return json({
      error: 'Backup belum dikonfigurasi. Set CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN di Worker secrets.'
    }, 501);
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_D1_DATABASE_ID}/export`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ output_format: 'polling' }),
      }
    );

    const data = await res.json();
    if (!data.success) {
      return json({ error: data.errors?.[0]?.message || 'Gagal memulai backup' }, 500);
    }

    return json({
      ok: true,
      bookmark: data.result?.at_bookmark || null,
      status: data.result?.status || 'unknown',
      messages: data.result?.messages || [],
    });
  } catch (err) {
    console.error('Backup start error:', err);
    return json({ error: 'Gagal start backup: ' + err.message }, 500);
  }
}

// ═══════════════════════════════════════════════════════════
// BACKUP D1 — STATUS (polling)
// ═══════════════════════════════════════════════════════════
async function handleBackupStatus(request, env) {
  if (!env.CF_ACCOUNT_ID || !env.CF_D1_DATABASE_ID || !env.CF_API_TOKEN) {
    return json({ error: 'Backup belum dikonfigurasi.' }, 501);
  }

  const url = new URL(request.url);
  const bookmark = url.searchParams.get('bookmark');
  if (!bookmark) {
    return json({ error: 'Parameter bookmark wajib' }, 400);
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_D1_DATABASE_ID}/export`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          output_format: 'polling',
          current_bookmark: bookmark,
        }),
      }
    );

    const data = await res.json();

    if (!data.success) {
      return json({
        error: data.errors?.[0]?.message || 'Gagal cek status',
        cf_errors: data.errors || [],
      }, 500);
    }

    // Handle struktur nested: result.result.signed_url
    const r = data.result || {};
    const nested = r.result || {};
    const status = r.status || nested.status || 'unknown';
    const signed_url = nested.signed_url || r.signed_url || null;
    const filename = nested.filename || r.filename || null;

    return json({
      ok: true,
      status: status,
      signed_url: signed_url,
      filename: filename,
      _raw_result: data.result,   // debug
    });
  } catch (err) {
    return json({ error: 'Gagal cek status: ' + err.message }, 500);
  }
}
// ═══════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════

async function ensureRateLimitTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
}

async function checkRateLimit(env, ip, maxAttempts = 5, windowMinutes = 1) {
  await ensureRateLimitTable(env);
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM login_attempts
     WHERE ip = ?
       AND attempted_at >= datetime('now', '-' || ? || ' minutes')`
  ).bind(ip, windowMinutes).first();
  return row.n < maxAttempts;
}

async function recordLoginAttempt(env, ip) {
  await ensureRateLimitTable(env);
  await env.DB.prepare(
    'INSERT INTO login_attempts (ip) VALUES (?)'
  ).bind(ip).run();
  await env.DB.prepare(
    `DELETE FROM login_attempts
     WHERE attempted_at < datetime('now', '-1 day')`
  ).run();
}

// ─── Password hashing ──────────────────────────────────────
async function hashPassword(password, saltHex = null) {
  const enc = new TextEncoder();
  const salt = saltHex
    ? hexToBytes(saltHex)
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return bytesToHex(salt) + ':' + bytesToHex(new Uint8Array(bits));
}

async function verifyPassword(password, stored) {
  const [saltHex] = stored.split(':');
  const computed = await hashPassword(password, saltHex);
  return timingSafeEqual(computed, stored);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function bytesToHex(bytes) {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}

function generateToken() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function withAuth(request, env, handler) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const row = await env.DB.prepare(
    `SELECT s.user_id, s.expires_at, u.username, u.nama_lengkap, u.role, u.aktif
     FROM sessions s JOIN admin_users u ON u.id = s.user_id
     WHERE s.token = ?`
  ).bind(token).first();

  if (!row) return json({ error: 'Invalid token' }, 401);
  if (new Date(row.expires_at) < new Date()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return json({ error: 'Token expired' }, 401);
  }
  if (!row.aktif) return json({ error: 'User nonaktif' }, 403);

  return handler(row);
}

// ═══════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════

async function handleLogin(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') ||
             request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
             'unknown';

  const allowed = await checkRateLimit(env, ip, 5, 1);
  if (!allowed) {
    return json({
      error: 'Terlalu banyak percobaan login. Coba lagi dalam 1 menit.'
    }, 429);
  }

  const { username, password } = await request.json();
  if (!username || !password) {
    await recordLoginAttempt(env, ip);
    return json({ error: 'Username & password wajib' }, 400);
  }

  const count = await env.DB.prepare('SELECT COUNT(*) as n FROM admin_users').first();
  if (count.n === 0) {
    const hash = await hashPassword('aleena2026');
    await env.DB.prepare(
      `INSERT INTO admin_users (username, nama_lengkap, password_hash, role)
       VALUES (?, ?, ?, ?)`
    ).bind('admin', 'Admin Griya Aleena', hash, 'owner').run();
  }

  const user = await env.DB.prepare(
    'SELECT * FROM admin_users WHERE username = ? AND aktif = 1'
  ).bind(username).first();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordLoginAttempt(env, ip);
    return json({ error: 'Username atau password salah' }, 401);
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, user.id, expiresAt).run();

  return json({
    token,
    user: {
      id: user.id,
      username: user.username,
      nama_lengkap: user.nama_lengkap,
      role: user.role,
    },
    expires_at: expiresAt,
  });
}

async function handleLogout(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  return json({ ok: true });
}

async function handleMe(request, env) {
  return withAuth(request, env, (user) =>
    json({ user: { id: user.user_id, username: user.username, nama_lengkap: user.nama_lengkap, role: user.role } })
  );
}

// ═══════════════════════════════════════════════════════════
// UPLOAD FILE KONTRAK KE R2
// ═══════════════════════════════════════════════════════════

async function handleUpload(request, env) {
  if (!env.BUCKET) {
    return json({ error: 'R2 bucket belum dikonfigurasi. Hubungi admin.' }, 501);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const roomId = formData.get('room_id');
    const jenisDokumen = formData.get('jenis');

    if (!file) {
      return json({ error: 'File tidak ditemukan' }, 400);
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      return json({ error: 'Hanya PDF, JPG, dan PNG yang diizinkan' }, 400);
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return json({ error: 'File terlalu besar. Maksimal 5 MB.' }, 400);
    }

    // ─── Buat nama file unik dengan format baru ───
    // Format: kamarX_jenis_YYYYMMDDHHmm.ext
    // Pakai timezone Asia/Jakarta (GMT+7 / WIB)
    const now = new Date();
    const wibParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const getPart = (type) => wibParts.find(p => p.type === type)?.value || '00';
    const timestamp =
      getPart('year') +
      getPart('month') +
      getPart('day') +
      getPart('hour') +
      getPart('minute');

    // Ambil nama kamar dari database
    let kamarLabel = 'kamar';
    if (roomId) {
      const room = await env.DB.prepare('SELECT nama_kamar FROM rooms WHERE id = ?')
        .bind(roomId).first();
      if (room && room.nama_kamar) {
        const match = String(room.nama_kamar).match(/\d+/);
        kamarLabel = match ? `kamar${match[0]}` : String(room.nama_kamar).toLowerCase().replace(/\s+/g, '_');
      }
    }

    const jenisLabel = (jenisDokumen || 'dokumen').replace(/[^a-zA-Z0-9\-_]/g, '_');

    const originalName = file.name || 'file.pdf';
    const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';

    const filename = `kontrak/${kamarLabel}_${jenisLabel}_${timestamp}.${ext}`;

    await env.BUCKET.put(filename, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    const publicUrl = `${env.R2_PUBLIC_URL}/${filename}`;

    return json({
      ok: true,
      url: publicUrl,
      filename: filename,
      size: file.size
    });

  } catch (err) {
    console.error('Upload error:', err);
    return json({ error: 'Gagal upload: ' + err.message }, 500);
  }
}

// ═══════════════════════════════════════════════════════════
// HAPUS FILE DARI R2
// ═══════════════════════════════════════════════════════════

async function handleDeleteFile(request, env) {
  if (!env.BUCKET) {
    return json({ error: 'R2 bucket belum dikonfigurasi' }, 501);
  }

  try {
    const { url } = await request.json();
    if (!url) {
      return json({ error: 'URL file wajib dikirim' }, 400);
    }

    const urlObj = new URL(url);
    const filename = urlObj.pathname.substring(1);

    const existing = await env.BUCKET.head(filename);
    if (!existing) {
      return json({ error: 'File tidak ditemukan', filename }, 404);
    }

    await env.BUCKET.delete(filename);

    return json({ ok: true, deleted: filename });
  } catch (err) {
    console.error('Delete file error:', err);
    return json({ error: 'Gagal hapus: ' + err.message }, 500);
  }
}

// ═══════════════════════════════════════════════════════════
// HAPUS BANYAK FILE DARI R2 (BULK)
// ═══════════════════════════════════════════════════════════

async function handleBulkDeleteFiles(request, env) {
  if (!env.BUCKET) {
    return json({ error: 'R2 bucket belum dikonfigurasi' }, 501);
  }

  try {
    const body = await request.json();
    const urls = Array.isArray(body.urls) ? body.urls : [];

    if (urls.length === 0) {
      return json({ ok: true, deleted: [], failed: [] });
    }

    if (urls.length > 50) {
      return json({ error: 'Maksimal 50 file per request' }, 400);
    }

    const deleted = [];
    const failed = [];

    for (const url of urls) {
      if (!url || typeof url !== 'string') continue;
      try {
        const urlObj = new URL(url);
        const filename = urlObj.pathname.substring(1);
        if (!filename) {
          failed.push({ url, error: 'Filename kosong' });
          continue;
        }
        await env.BUCKET.delete(filename);
        deleted.push(filename);
      } catch (err) {
        failed.push({ url, error: err.message });
      }
    }

    return json({ ok: true, deleted, failed });
  } catch (err) {
    console.error('Bulk delete error:', err);
    return json({ error: 'Gagal hapus: ' + err.message }, 500);
  }
}

// ═══════════════════════════════════════════════════════════
// CEK FILE ADA / TIDAK DI R2
// ═══════════════════════════════════════════════════════════

async function handleCheckFile(request, env) {
  if (!env.BUCKET) {
    return json({ error: 'R2 bucket belum dikonfigurasi' }, 501);
  }

  try {
    const body = await request.json();
    const urls = body.urls || [];

    if (!Array.isArray(urls)) {
      return json({ error: 'Format urls harus array' }, 400);
    }

    const results = {};

    for (const url of urls) {
      if (!url) {
        results[url] = false;
        continue;
      }

      try {
        const urlObj = new URL(url);
        const filename = urlObj.pathname.substring(1);
        const existing = await env.BUCKET.head(filename);
        results[url] = !!existing;
      } catch (err) {
        results[url] = false;
      }
    }

    return json({ ok: true, results });
  } catch (err) {
    console.error('Check file error:', err);
    return json({ error: 'Gagal cek file: ' + err.message }, 500);
  }
}

// ═══════════════════════════════════════════════════════════
// TRACK VISITOR
// ═══════════════════════════════════════════════════════════

async function handleTrack(request, env) {
  try {
    const cf = request.cf || {};
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || '';
    const referer = request.headers.get('Referer') || '';
    const path = request.headers.get('X-Path') || '/';

    const parsed = parseUserAgent(userAgent);
    const countryName = getCountryName(cf.country || '');

    await env.DB.prepare(
      `INSERT INTO visitor_logs
        (ip, country, country_name, city, region, timezone,
         latitude, longitude, isp, user_agent, browser, browser_version,
         os, device_type, referer, path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      ip,
      cf.country || null,
      countryName,
      cf.city || null,
      cf.region || null,
      cf.timezone || null,
      cf.latitude || null,
      cf.longitude || null,
      cf.asOrganization || null,
      userAgent,
      parsed.browser,
      parsed.browserVersion,
      parsed.os,
      parsed.deviceType,
      referer || null,
      path
    ).run();

    return json({ ok: true });
  } catch (err) {
    console.error('Track error:', err);
    return json({ ok: false });
  }
}

function parseUserAgent(ua) {
  if (!ua) return { browser: 'Unknown', browserVersion: '', os: 'Unknown', deviceType: 'Unknown' };

  let browser = 'Unknown';
  let browserVersion = '';
  let os = 'Unknown';
  let deviceType = 'Desktop';

  if (ua.includes('Edg/')) {
    browser = 'Edge';
    browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('OPR/') || ua.includes('Opera')) {
    browser = 'Opera';
    browserVersion = ua.match(/OPR\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    browser = 'Chrome';
    browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('Safari/') && ua.includes('Version/')) {
    browser = 'Safari';
    browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('Firefox/')) {
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || '';
  }

  if (browserVersion) {
    browserVersion = browserVersion.split('.')[0];
  }

  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Android')) {
    const m = ua.match(/Android\s([\d.]+)/);
    os = m ? `Android ${m[1].split('.')[0]}` : 'Android';
  }
  else if (ua.includes('iPhone') || ua.includes('iPad')) {
    const m = ua.match(/OS\s([\d_]+)/);
    os = m ? `iOS ${m[1].replace(/_/g, '.').split('.')[0]}` : 'iOS';
  }
  else if (ua.includes('Linux')) os = 'Linux';

  if (/Mobile|Android|iPhone|iPod/i.test(ua) && !/iPad|Tablet/i.test(ua)) {
    deviceType = 'Mobile';
  } else if (/iPad|Tablet/i.test(ua)) {
    deviceType = 'Tablet';
  } else {
    deviceType = 'Desktop';
  }

  return { browser, browserVersion, os, deviceType };
}

function getCountryName(code) {
  const map = {
    ID: 'Indonesia', MY: 'Malaysia', SG: 'Singapore', US: 'United States',
    JP: 'Japan', CN: 'China', KR: 'South Korea', IN: 'India',
    AU: 'Australia', GB: 'United Kingdom', DE: 'Germany', FR: 'France',
    NL: 'Netherlands', TH: 'Thailand', VN: 'Vietnam', PH: 'Philippines',
  };
  return map[code] || code || 'Unknown';
}

// ═══════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════

async function handleGetAnalytics(request, env) {
  const url = new URL(request.url);
  const days = Number(url.searchParams.get('days')) || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const total = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM visitor_logs WHERE DATE(visited_at) >= ?`
  ).bind(cutoff).first();

  const uniqueIPs = await env.DB.prepare(
    `SELECT COUNT(DISTINCT ip) as n FROM visitor_logs WHERE DATE(visited_at) >= ?`
  ).bind(cutoff).first();

  const today = new Date().toISOString().slice(0, 10);
  const todayTotal = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM visitor_logs WHERE DATE(visited_at) = ?`
  ).bind(today).first();

  const todayUnique = await env.DB.prepare(
    `SELECT COUNT(DISTINCT ip) as n FROM visitor_logs WHERE DATE(visited_at) = ?`
  ).bind(today).first();

  const browsers = await env.DB.prepare(
    `SELECT browser, COUNT(*) as n FROM visitor_logs
     WHERE DATE(visited_at) >= ? GROUP BY browser ORDER BY n DESC LIMIT 10`
  ).bind(cutoff).all();

  const osList = await env.DB.prepare(
    `SELECT os, COUNT(*) as n FROM visitor_logs
     WHERE DATE(visited_at) >= ? GROUP BY os ORDER BY n DESC LIMIT 10`
  ).bind(cutoff).all();

  const devices = await env.DB.prepare(
    `SELECT device_type, COUNT(*) as n FROM visitor_logs
     WHERE DATE(visited_at) >= ? GROUP BY device_type ORDER BY n DESC`
  ).bind(cutoff).all();

  const cities = await env.DB.prepare(
    `SELECT city, country_name, COUNT(*) as n FROM visitor_logs
     WHERE DATE(visited_at) >= ? AND city IS NOT NULL
     GROUP BY city, country_name ORDER BY n DESC LIMIT 10`
  ).bind(cutoff).all();

  const isps = await env.DB.prepare(
    `SELECT isp, COUNT(*) as n FROM visitor_logs
     WHERE DATE(visited_at) >= ? AND isp IS NOT NULL
     GROUP BY isp ORDER BY n DESC LIMIT 10`
  ).bind(cutoff).all();

  const referers = await env.DB.prepare(
    `SELECT 
       CASE 
         WHEN referer IS NULL OR referer = '' THEN 'Direct'
         WHEN referer LIKE '%google%' THEN 'Google'
         WHEN referer LIKE '%instagram%' THEN 'Instagram'
         WHEN referer LIKE '%facebook%' OR referer LIKE '%fb.%' THEN 'Facebook'
         WHEN referer LIKE '%whatsapp%' OR referer LIKE '%wa.me%' THEN 'WhatsApp'
         WHEN referer LIKE '%tiktok%' THEN 'TikTok'
         WHEN referer LIKE '%twitter%' OR referer LIKE '%x.com%' THEN 'Twitter/X'
         ELSE 'Lainnya'
       END as source,
       COUNT(*) as n 
     FROM visitor_logs
     WHERE DATE(visited_at) >= ?
     GROUP BY source ORDER BY n DESC`
  ).bind(cutoff).all();

  const daily = await env.DB.prepare(
    `SELECT DATE(visited_at) as tanggal, COUNT(*) as n, COUNT(DISTINCT ip) as unique_ip
     FROM visitor_logs
     WHERE DATE(visited_at) >= ?
     GROUP BY DATE(visited_at)
     ORDER BY tanggal ASC`
  ).bind(cutoff).all();

  return json({
    total: total.n,
    unique_ips: uniqueIPs.n,
    today_total: todayTotal.n,
    today_unique: todayUnique.n,
    browsers: browsers.results,
    os_list: osList.results,
    devices: devices.results,
    cities: cities.results,
    isps: isps.results,
    referers: referers.results,
    daily: daily.results,
  });
}

async function handleGetVisitorLogs(request, env) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
  const offset = Number(url.searchParams.get('offset')) || 0;

  const { results } = await env.DB.prepare(
    `SELECT * FROM visitor_logs
     ORDER BY visited_at DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  const total = await env.DB.prepare(
    'SELECT COUNT(*) as n FROM visitor_logs'
  ).first();

  return json({ logs: results, total: total.n, limit, offset });
}

// ─── Mark logs sebagai sudah dilihat ───────────────────────
async function handleMarkLogsViewed(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const ids = body.ids;

    if (Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      const result = await env.DB.prepare(
        `UPDATE visitor_logs 
         SET viewed = 1, viewed_at = CURRENT_TIMESTAMP 
         WHERE id IN (${placeholders}) AND viewed = 0`
      ).bind(...ids).run();
      return json({ ok: true, marked: result.meta.changes });
    } else {
      const result = await env.DB.prepare(
        `UPDATE visitor_logs 
         SET viewed = 1, viewed_at = CURRENT_TIMESTAMP 
         WHERE viewed = 0`
      ).run();
      return json({ ok: true, marked: result.meta.changes });
    }
  } catch (err) {
    console.error('Mark viewed error:', err);
    return json({ error: err.message }, 500);
  }
}

// ─── Hitung log yang belum dilihat ─────────────────────────
async function handleUnseenCount(env) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM visitor_logs WHERE viewed = 0`
  ).first();
  return json({ count: row.n || 0 });
}

async function handleDeleteVisitorLogs(request, env) {
  const url = new URL(request.url);
  const olderThanDays = Number(url.searchParams.get('older_than_days'));

  if (olderThanDays && olderThanDays > 0) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await env.DB.prepare(
      `DELETE FROM visitor_logs WHERE DATE(visited_at) < ?`
    ).bind(cutoff).run();
    return json({ deleted: result.meta.changes, cutoff });
  } else {
    const result = await env.DB.prepare('DELETE FROM visitor_logs').run();
    return json({ deleted: result.meta.changes, all: true });
  }
}

// ═══════════════════════════════════════════════════════════
// COUNTER
// ═══════════════════════════════════════════════════════════

async function handleIncrement(env) {
  await env.DB.prepare(
    `INSERT INTO counter (id, count) VALUES (1, 0) ON CONFLICT(id) DO NOTHING`
  ).run();
  await env.DB.prepare('UPDATE counter SET count = count + 1 WHERE id = 1').run();
  const row = await env.DB.prepare('SELECT count FROM counter WHERE id = 1').first();
  return json({ count: row.count });
}

async function handleCount(env) {
  const row = await env.DB.prepare('SELECT count FROM counter WHERE id = 1').first();
  return json({ count: row?.count || 0 });
}

// ═══════════════════════════════════════════════════════════
// ROOMS
// ═══════════════════════════════════════════════════════════

async function handleGetRooms(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM rooms ORDER BY urutan, id'
  ).all();
  return json({ rooms: results });
}
// ═══════════════════════════════════════════════════════════
// CREATE ROOM — TAMBAH KAMAR BARU
// ═══════════════════════════════════════════════════════════
async function handleCreateRoom(request, env) {
  try {
    const body = await request.json();
    const nama_kamar = (body.nama_kamar || '').trim();
    const tipe = (body.tipe || '').trim().toUpperCase();
    const harga_bulanan = Number(body.harga_bulanan) || 0;
    const urutanInput = body.urutan;

    // Validasi
    if (!nama_kamar) {
      return json({ error: 'Nama kamar wajib diisi' }, 400);
    }
    if (!tipe) {
      return json({ error: 'Tipe kamar wajib diisi' }, 400);
    }
    if (!harga_bulanan || harga_bulanan <= 0) {
      return json({ error: 'Harga bulanan wajib diisi' }, 400);
    }

    // Cek duplikat
    const existing = await env.DB.prepare(
      'SELECT id FROM rooms WHERE nama_kamar = ?'
    ).bind(nama_kamar).first();

    if (existing) {
      return json({ error: 'Kamar "' + nama_kamar + '" sudah ada' }, 409);
    }

    // Ambil urutan
    let urutan;
    if (urutanInput !== null && urutanInput !== undefined && urutanInput !== '') {
      urutan = Number(urutanInput);
    } else {
      const lastUrutan = await env.DB.prepare(
        'SELECT COALESCE(MAX(urutan), 0) as max_urutan FROM rooms'
      ).first();
      urutan = (lastUrutan?.max_urutan || 0) + 1;
    }

    // Insert — kirim SEMUA kolom yang wajib
    const result = await env.DB.prepare(
      `INSERT INTO rooms (nama_kamar, tipe, urutan, harga_bulanan)
       VALUES (?, ?, ?, ?)`
    ).bind(nama_kamar, tipe, urutan, harga_bulanan).run();

    return json({
      ok: true,
      id: result.meta.last_row_id,
      message: 'Kamar "' + nama_kamar + '" berhasil ditambahkan',
    });
  } catch (err) {
    console.error('Create room error:', err);
    return json({ error: 'Gagal tambah kamar: ' + err.message }, 500);
  }
}

// ═══════════════════════════════════════════════════════════
// OCCUPANCIES
// ═══════════════════════════════════════════════════════════

async function handleGetOccupancies(env) {
  const { results } = await env.DB.prepare(
    `SELECT o.*, r.nama_kamar, r.tipe
     FROM occupancies o
     JOIN rooms r ON r.id = o.room_id
     ORDER BY o.tanggal_mulai DESC, o.id DESC`
  ).all();
  return json({ occupancies: results });
}

async function handleCreateOccupancy(request, env) {
  const b = await request.json();
  const required = [
    'room_id',
    'nama_penyewa',
    'tipe_sewa',
    'tanggal_mulai',
    'tanggal_selesai',
    'harga_total'
  ];

  for (const f of required) {
    if (b[f] === undefined || b[f] === null || b[f] === '') {
      return json({ error: `Field '${f}' wajib diisi` }, 400);
    }
  }

  // ID baru = ID terbesar yang masih ada + 1.
  const maxRow = await env.DB.prepare(
    'SELECT COALESCE(MAX(id), 0) AS max_id FROM occupancies'
  ).first();

  const newId = Number(maxRow?.max_id || 0) + 1;

  const result = await env.DB.prepare(
    `INSERT INTO occupancies
      (id, room_id, nama_penyewa, no_hp, asal_kampus, tipe_sewa,
       tanggal_mulai, tanggal_selesai, harga_total, status_bayar,
       link_kontrak, catatan,
       no_ktp, alamat_penyewa,
       no_ktp_ortu, nama_ortu, no_hp_ortu, alamat_ortu, hubungan_keluarga,
       file_ktp_penyewa, file_ktp_ortu, file_ktm, file_perjanjian)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    newId,
    b.room_id,
    b.nama_penyewa,
    b.no_hp || null,
    b.asal_kampus || null,
    b.tipe_sewa,
    b.tanggal_mulai,
    b.tanggal_selesai,
    b.harga_total,
    b.status_bayar || 'belum',
    b.link_kontrak || null,
    b.catatan || null,
    b.no_ktp || null,
    b.alamat_penyewa || null,
    b.no_ktp_ortu || null,
    b.nama_ortu || null,
    b.no_hp_ortu || null,
    b.alamat_ortu || null,
    b.hubungan_keluarga || null,
    b.file_ktp_penyewa || null,
    b.file_ktp_ortu || null,
    b.file_ktm || null,
    b.file_perjanjian || null
  ).run();

  return json({ id: newId, ok: true });
}

async function handleBulkImport(request, env) {
  const { rows } = await request.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return json({ error: 'Data kosong' }, 400);
  }
  if (rows.length > 500) {
    return json({ error: 'Maksimal 500 baris per import' }, 400);
  }

  let sukses = 0;
  let gagal = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const b = rows[i];
    try {
      if (!b.nama_penyewa || !b.tipe_sewa ||
          !b.tanggal_mulai || !b.tanggal_selesai || !b.harga_total) {
        gagal++;
        errors.push(`Baris ${i + 1}: data tidak lengkap`);
        continue;
      }

      let roomId = b.room_id;
      if (b.nama_kamar && !roomId) {
        const room = await env.DB.prepare(
          'SELECT id FROM rooms WHERE nama_kamar = ?'
        ).bind(b.nama_kamar).first();
        if (room) roomId = room.id;
      }

      if (!roomId) {
        gagal++;
        errors.push(`Baris ${i + 1}: kamar tidak ditemukan`);
        continue;
      }

      await env.DB.prepare(
        `INSERT INTO occupancies
          (room_id, nama_penyewa, no_hp, asal_kampus, tipe_sewa,
           tanggal_mulai, tanggal_selesai, harga_total, status_bayar,
           link_kontrak, catatan,
           no_ktp, alamat_penyewa,
           no_ktp_ortu, nama_ortu, no_hp_ortu, alamat_ortu, hubungan_keluarga,
           file_ktp_penyewa, file_ktp_ortu, file_ktm, file_perjanjian)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        roomId, b.nama_penyewa, b.no_hp || null, b.asal_kampus || null,
        b.tipe_sewa, b.tanggal_mulai, b.tanggal_selesai, Number(b.harga_total),
        b.status_bayar || 'belum', b.link_kontrak || null, b.catatan || null,
        b.no_ktp || null, b.alamat_penyewa || null,
        b.no_ktp_ortu || null, b.nama_ortu || null, b.no_hp_ortu || null, b.alamat_ortu || null,
        b.hubungan_keluarga || null,
        b.file_ktp_penyewa || null, b.file_ktp_ortu || null, b.file_ktm || null, b.file_perjanjian || null
      ).run();

      sukses++;
    } catch (e) {
      gagal++;
      errors.push(`Baris ${i + 1}: ${e.message}`);
    }
  }

  return json({ sukses, gagal, errors: errors.slice(0, 20) });
}

async function handleUpdateOccupancy(id, request, env) {
  const b = await request.json();
  await env.DB.prepare(
    `UPDATE occupancies SET
      room_id = ?, nama_penyewa = ?, no_hp = ?, asal_kampus = ?,
      tipe_sewa = ?, tanggal_mulai = ?, tanggal_selesai = ?,
      harga_total = ?, status_bayar = ?, link_kontrak = ?, catatan = ?,
      no_ktp = ?, alamat_penyewa = ?,
      no_ktp_ortu = ?, nama_ortu = ?, no_hp_ortu = ?, alamat_ortu = ?,
      hubungan_keluarga = ?,
      file_ktp_penyewa = ?, file_ktp_ortu = ?, file_ktm = ?, file_perjanjian = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    b.room_id, b.nama_penyewa, b.no_hp || null, b.asal_kampus || null,
    b.tipe_sewa, b.tanggal_mulai, b.tanggal_selesai, b.harga_total,
    b.status_bayar, b.link_kontrak || null, b.catatan || null,
    b.no_ktp || null, b.alamat_penyewa || null,
    b.no_ktp_ortu || null, b.nama_ortu || null, b.no_hp_ortu || null, b.alamat_ortu || null,
    b.hubungan_keluarga || null,
    b.file_ktp_penyewa || null, b.file_ktp_ortu || null, b.file_ktm || null, b.file_perjanjian || null,
    id
  ).run();
  return json({ ok: true });
}

async function handleDeleteOccupancy(id, env) {
  await env.DB.prepare('DELETE FROM occupancies WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ═══════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════

async function handleGetUsers(env, currentUser) {
  if (currentUser.role !== 'owner') return json({ error: 'Hanya owner' }, 403);
  const { results } = await env.DB.prepare(
    'SELECT id, username, nama_lengkap, role, aktif, created_at FROM admin_users ORDER BY id'
  ).all();
  return json({ users: results });
}

async function handleCreateUser(request, env, currentUser) {
  if (currentUser.role !== 'owner') return json({ error: 'Hanya owner' }, 403);
  const { username, password, nama_lengkap, role } = await request.json();
  if (!username || !password) return json({ error: 'Username & password wajib' }, 400);
  if (password.length < 6) return json({ error: 'Password minimal 6 karakter' }, 400);

  const hash = await hashPassword(password);
  try {
    const r = await env.DB.prepare(
      `INSERT INTO admin_users (username, nama_lengkap, password_hash, role)
       VALUES (?, ?, ?, ?)`
    ).bind(username, nama_lengkap || username, hash, role || 'admin').run();
    return json({ id: r.meta.last_row_id, ok: true });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return json({ error: 'Username sudah dipakai' }, 409);
    throw e;
  }
}

async function handleDeleteUser(id, env, currentUser) {
  if (currentUser.role !== 'owner') return json({ error: 'Hanya owner' }, 403);
  if (Number(id) === currentUser.user_id) {
    return json({ error: 'Tidak bisa hapus akun sendiri' }, 400);
  }
  await env.DB.prepare('DELETE FROM admin_users WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ═══════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════

async function handleStats(env) {
  const today = new Date().toISOString().slice(0, 10);

  const rooms = await env.DB.prepare('SELECT COUNT(*) as total FROM rooms').first();

  const terisi = await env.DB.prepare(
    `SELECT COUNT(DISTINCT room_id) as n FROM occupancies
     WHERE tanggal_mulai <= ? AND tanggal_selesai >= ?`
  ).bind(today, today).first();

  const keseluruhan = await env.DB.prepare(
    `SELECT COALESCE(SUM(harga_total),0) as total FROM occupancies
     WHERE status_bayar = 'lunas'`
  ).first();

  const tahunIni = await env.DB.prepare(
    `SELECT COALESCE(SUM(harga_total),0) as total FROM occupancies
     WHERE status_bayar = 'lunas'
       AND strftime('%Y', tanggal_mulai) = strftime('%Y', 'now')`
  ).first();

  const bulanIni = await env.DB.prepare(
    `SELECT COALESCE(SUM(harga_total),0) as total FROM occupancies
     WHERE status_bayar = 'lunas'
       AND strftime('%Y-%m', tanggal_mulai) = strftime('%Y-%m', 'now')`
  ).first();

  return json({
    total_kamar: rooms.total,
    terisi: terisi.n,
    kosong: rooms.total - terisi.n,
    okupansi_persen: Math.round((terisi.n / rooms.total) * 100),
    penghasilan_keseluruhan: keseluruhan.total,
    penghasilan_tahun_ini: tahunIni.total,
    penghasilan_bulan_ini: bulanIni.total,
  });
}