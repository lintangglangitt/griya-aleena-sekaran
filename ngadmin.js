// ============================================================
// ngadmin.js - Dashboard Okupansi Griya Aleena
// ============================================================

const API = 'https://griya-api.lintangglangitt.workers.dev';
let TOKEN = localStorage.getItem('ga_token') || '';
let USER = JSON.parse(localStorage.getItem('ga_user') || '{}');
let ROOMS = [];
let OCCS = [];
let EDITING_ID = null;
let ACTIVE_ROOM_FILTER = 'all';
let ACTIVE_INCOME_FILTER = null;

// ─── State Modal Okupansi (untuk upload & delete file) ─────
const MODAL_STATE = {
  editingId: null,
  pendingUploads: {},   // { field: newUrl } — file baru yang di-upload (belum di DB)
  pendingDeletes: [],   // [field, ...] — field yang mau dihapus (file lama di DB)
  originalUrls: {},     // { field: oldUrl } — snapshot URL awal (mode edit)
  pendingError: null,   // pesan error untuk ditampilkan setelah Simpan
};

// ─── Konfigurasi Pemilik ──────────────────────────────────
const PEMILIK = {
  nama: 'Nawang Wulan',
  no_ktp: '3304025911900001',
  alamat: 'Jl. Margasatwa, Gg. Sadewa No. 14, Sekaran 005/005, Kec. Gunungpati, Kota Semarang, Jawa Tengah, 50229',
  alamat_singkat: 'Jl. Margasatwa, Gg. Sadewa No. 14, Sekaran, Gunungpati, Semarang.',
  no_hp: '0898-5446-121',
  no_hp_perjanjian: '0899-5677-419',
};

// ─── Harga Default per Tipe Sewa ───────────────────────────
const HARGA_DEFAULT = {
  harian: 100000,
  mingguan: 500000,
  bulanan: 800000,
  semesteran: 4600000,
  tahunan: 9100000,
};

// ─── Konfigurasi Upload Dokumen (4 file) ───────────────────

const UPLOAD_CONFIGS = [
  { key: 'f-file-ktp-penyewa', statusId: 'upload-status-ktp-penyewa', linkId: 'f-link-ktp-penyewa', previewId: 'link-preview-ktp-penyewa', field: 'file_ktp_penyewa' },
  { key: 'f-file-ktp-ortu',    statusId: 'upload-status-ktp-ortu',    linkId: 'f-link-ktp-ortu',    previewId: 'link-preview-ktp-ortu',    field: 'file_ktp_ortu' },
  { key: 'f-file-ktm',         statusId: 'upload-status-ktm',         linkId: 'f-link-ktm',         previewId: 'link-preview-ktm',         field: 'file_ktm' },
  { key: 'f-file-perjanjian',  statusId: 'upload-status-perjanjian',  linkId: 'f-link-perjanjian',  previewId: 'link-preview-perjanjian',  field: 'file_perjanjian' },
];

if (!TOKEN) window.location.href = 'ibun.html';

// ─── API helper ────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('ga_token');
    localStorage.removeItem('ga_user');
    window.location.href = 'ibun.html';
    throw new Error('Sesi berakhir');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Utility ───────────────────────────────────────────────
function rupiah(n) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n || 0);
}
function rupiahFull(n) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n || 0) + ',00';
}
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateLong(s) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysBetween(a, b) {
  return Math.ceil((new Date(b) - new Date(a)) / 86400000);
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function hitungDurasi(mulai, selesai, tipe) {
  const d1 = new Date(mulai);
  const d2 = new Date(selesai);
  const hari = Math.ceil((d2 - d1) / 86400000);
  const bulan = Math.round(hari / 30);
  const label = { harian: 'hari', mingguan: 'minggu', bulanan: 'bulan', semesteran: 'semester', tahunan: 'tahun' };
  const satuan = label[tipe] || 'hari';
  let jumlah;
  if (tipe === 'harian') jumlah = hari;
  else if (tipe === 'mingguan') jumlah = Math.round(hari / 7);
  else if (tipe === 'bulanan') jumlah = bulan;
  else if (tipe === 'semesteran') jumlah = Math.round(bulan / 6);
  else if (tipe === 'tahunan') jumlah = Math.round(bulan / 12);
  else jumlah = hari;
  return `${jumlah} ${satuan}`;
}
function generateInvoiceNo(id, tgl) {
  const d = new Date(tgl || todayISO());
  const yyyymm = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
  return `INV-${yyyymm}-${String(id).padStart(4, '0')}`;
}
function generateKuitansiNo(id, tgl) {
  const d = new Date(tgl || todayISO());
  const yyyymm = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
  return `KU-${yyyymm}-${String(id).padStart(4, '0')}`;
}
function terbilangAngka(n) {
  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  if (n < 12) return satuan[n];
  if (n < 20) return terbilangAngka(n - 10) + ' belas';
  if (n < 100) return terbilangAngka(Math.floor(n / 10)) + ' puluh ' + terbilangAngka(n % 10);
  if (n < 200) return 'seratus ' + terbilangAngka(n - 100);
  if (n < 1000) return terbilangAngka(Math.floor(n / 100)) + ' ratus ' + terbilangAngka(n % 100);
  if (n < 2000) return 'seribu ' + terbilangAngka(n - 1000);
  if (n < 1000000) return terbilangAngka(Math.floor(n / 1000)) + ' ribu ' + terbilangAngka(n % 1000);
  if (n < 1000000000) return terbilangAngka(Math.floor(n / 1000000)) + ' juta ' + terbilangAngka(n % 1000000);
  return terbilangAngka(Math.floor(n / 1000000000)) + ' miliar ' + terbilangAngka(n % 1000000000);
}
function terbilangRupiah(n) {
  n = Math.floor(Number(n) || 0);
  if (n === 0) return 'nol rupiah';
  return terbilangAngka(n).replace(/\s+/g, ' ').trim() + ' rupiah';
}
function getHariIndonesia() {
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return hari[new Date().getDay()];
}
function printDoc(namaFile) {
  const originalTitle = document.title;
  document.title = namaFile;
  window.print();
  setTimeout(() => {
    document.title = originalTitle;
  }, 1500);
}

// ─── Auto-isi Harga Sesuai Tipe Sewa ───────────────────────
function updateHargaOtomatis() {
  const tipe = document.getElementById('f-tipe').value;
  const hargaInput = document.getElementById('f-harga');
  if (!tipe || !hargaInput) return;
  if (HARGA_DEFAULT[tipe]) {
    hargaInput.value = HARGA_DEFAULT[tipe];
  }
}

function setupAutoHarga() {
  const tipeSelect = document.getElementById('f-tipe');
  if (tipeSelect && !tipeSelect.dataset.listenerBound) {
    tipeSelect.addEventListener('change', updateHargaOtomatis);
    tipeSelect.dataset.listenerBound = 'true';
  }
}

// ─── Logout ────────────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  localStorage.removeItem('ga_token');
  localStorage.removeItem('ga_user');
  window.location.href = 'ibun.html';
});

// ─── Init ──────────────────────────────────────────────────
async function init() {
  document.getElementById('user-name').textContent = USER.nama_lengkap || USER.username || '—';
  document.getElementById('today-label').textContent = `(${fmtDate(todayISO())})`;

  await Promise.all([loadRooms(), loadOccs(), loadStats()]);
  fillYearFilter();
  renderRooms();
  renderTable();
  setupIncomeCardListeners();
  setupAutoHarga();

  if (USER.role !== 'owner') {
    document.getElementById('btn-users').style.display = 'none';
  }

  // Load badge analitik + auto-refresh tiap 5 menit
  updateAnalyticsBadge();
  setInterval(updateAnalyticsBadge, 5 * 60 * 1000);
}

// ─── Badge Angka di Tombol Analitik ────────────────────────
async function updateAnalyticsBadge() {
  try {
    const data = await api('/analytics/logs/unseen-count');
    const badge = document.getElementById('analytics-badge');
    if (!badge) return;

    if (data.count > 0) {
      badge.textContent = data.count > 99 ? '99+' : data.count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  } catch (err) {
    // Silent fail — jangan ganggu user
    console.log('Analytics badge error:', err.message);
  }
}

async function loadRooms() {
  const data = await api('/rooms');
  ROOMS = data.rooms || [];
}
async function loadOccs() {
  const data = await api('/occupancies');
  OCCS = data.occupancies || [];
}
async function loadStats() {
  const s = await api('/stats');
  document.getElementById('st-total').textContent = s.total_kamar;
  document.getElementById('st-terisi').textContent = s.terisi;
  document.getElementById('st-kosong').textContent = s.kosong;
  document.getElementById('st-okupansi').textContent = s.okupansi_persen + '%';
  document.getElementById('st-income-all').textContent = rupiahFull(s.penghasilan_keseluruhan);
  document.getElementById('st-income-year').textContent = rupiahFull(s.penghasilan_tahun_ini);
  document.getElementById('st-income-month').textContent = rupiahFull(s.penghasilan_bulan_ini);
}

// ─── Kartu Pembayaran jadi Filter ──────────────────────────
function setupIncomeCardListeners() {
  document.querySelectorAll('.stat-card.clickable').forEach(card => {
    card.addEventListener('click', () => toggleIncomeFilter(card.dataset.filter));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleIncomeFilter(card.dataset.filter);
      }
    });
  });
}

function toggleIncomeFilter(filter) {
  if (ACTIVE_INCOME_FILTER === filter) {
    ACTIVE_INCOME_FILTER = null;
  } else {
    ACTIVE_INCOME_FILTER = filter;
    document.getElementById('filter-tahun').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('search').value = '';
    ACTIVE_ROOM_FILTER = 'all';
  }
  updateIncomeCardUI();
  renderRooms();
  renderTable();
}

function updateIncomeCardUI() {
  document.querySelectorAll('.stat-card.clickable').forEach(card => {
    card.classList.toggle('active', card.dataset.filter === ACTIVE_INCOME_FILTER);
  });
}

// ─── Filter Tahun ──────────────────────────────────────────
function fillYearFilter() {
  const sel = document.getElementById('filter-tahun');
  const currentVal = sel.value;
  const years = new Set();

  OCCS.forEach(o => {
    if (!o.tanggal_mulai || !o.tanggal_selesai) return;
    const y1 = Number(o.tanggal_mulai.slice(0, 4));
    const y2 = Number(o.tanggal_selesai.slice(0, 4));
    for (let y = y1; y <= y2; y++) years.add(y);
  });

  const sorted = [...years].sort((a, b) => a - b);
  sel.innerHTML = '<option value="">Semua Tahun</option>' +
    sorted.map(y => `<option value="${y}">${y}</option>`).join('');

  if (currentVal && sorted.includes(Number(currentVal))) {
    sel.value = currentVal;
  }
}

// ─── Render Room Cards ─────────────────────────────────────
function renderRooms() {
  const grid = document.getElementById('rooms-grid');
  const today = todayISO();

  const allCard = `
    <div class="room-card all-card ${ACTIVE_ROOM_FILTER === 'all' ? 'active' : ''}" data-room="all">
      <h3>ALL</h3>
      <div class="room-tipe">SEMUA KAMAR</div>
    </div>
  `;

  const roomCards = ROOMS.map(room => {
    const active = OCCS.find(o =>
      o.room_id === room.id &&
      o.tanggal_mulai <= today &&
      o.tanggal_selesai >= today
    );

    let statusClass = 'status-kosong';
    let statusLabel = 'Kosong';
    let penyewa = '—';
    let tanggal = 'Belum ada penghuni';

    if (active) {
      penyewa = active.nama_penyewa;
      tanggal = `${fmtDate(active.tanggal_mulai)} — ${fmtDate(active.tanggal_selesai)}`;
      const sisa = daysBetween(today, active.tanggal_selesai);
      if (active.status_bayar === 'lunas') {
        statusClass = sisa <= 14 ? 'status-habis' : 'status-terisi';
        statusLabel = sisa <= 14 ? `⚠️ Habis dalam<br>${sisa} hari` : 'Terisi';
      } else {
        statusClass = 'status-dp';
        statusLabel = active.status_bayar === 'dp' ? 'DP' : 'Belum Bayar';
      }
    }

    const isActive = String(ACTIVE_ROOM_FILTER) === String(room.id);

    return `
      <div class="room-card ${statusClass} ${isActive ? 'active' : ''}" data-room="${room.id}">
        <h3>${escapeHtml(room.nama_kamar)}</h3>
        <div class="room-tipe">${escapeHtml(room.tipe)}</div>
        <div class="room-penyewa">${escapeHtml(penyewa)}</div>
        <div class="room-tanggal">${escapeHtml(tanggal)}</div>
        <span class="room-status">${statusLabel}</span>
      </div>
    `;
  }).join('');

  grid.innerHTML = allCard + roomCards;

  grid.querySelectorAll('.room-card').forEach(el => {
    el.addEventListener('click', () => {
      ACTIVE_ROOM_FILTER = el.dataset.room;
      ACTIVE_INCOME_FILTER = null;
      updateIncomeCardUI();
      renderRooms();
      renderTable();
    });
  });
}

// ─── Helper filter income ──────────────────────────────────
function passesIncomeFilter(o) {
  if (!ACTIVE_INCOME_FILTER) return true;
  if (o.status_bayar !== 'lunas') return false;

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = String(now.getMonth() + 1).padStart(2, '0');
  const startY = o.tanggal_mulai.slice(0, 4);
  const startM = o.tanggal_mulai.slice(5, 7);

  if (ACTIVE_INCOME_FILTER === 'all') return true;
  if (ACTIVE_INCOME_FILTER === 'year') return startY === String(curYear);
  if (ACTIVE_INCOME_FILTER === 'month') return startY === String(curYear) && startM === curMonth;
  return true;
}

// ─── Render Table ──────────────────────────────────────────
function renderTable() {
  const q = document.getElementById('search').value.toLowerCase().trim();
  const fTahun = document.getElementById('filter-tahun').value;
  const fs = document.getElementById('filter-status').value;
  const today = todayISO();

  const filtered = OCCS.filter(o => {
    if (!passesIncomeFilter(o)) return false;

    if (!ACTIVE_INCOME_FILTER) {
      if (fTahun) {
        const y1 = Number(o.tanggal_mulai.slice(0, 4));
        const y2 = Number(o.tanggal_selesai.slice(0, 4));
        const targetY = Number(fTahun);
        if (!(y1 <= targetY && y2 >= targetY)) return false;
      }
      if (fs && o.status_bayar !== fs) return false;
      if (q && !(o.nama_penyewa.toLowerCase().includes(q) || (o.no_hp || '').includes(q))) return false;
    }

    if (ACTIVE_ROOM_FILTER !== 'all' && String(o.room_id) !== String(ACTIVE_ROOM_FILTER)) return false;

    return true;
  });

  const tbody = document.getElementById('occ-body');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:#5a7373;">Tidak ada data</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const sudahSelesai = o.tanggal_selesai < today;
    const akanHabis = !sudahSelesai &&
      o.tanggal_selesai >= today &&
      daysBetween(today, o.tanggal_selesai) <= 14 &&
      o.tanggal_mulai <= today;

    const badgeClass = { lunas: 'lunas', dp: 'dp', belum: 'belum' }[o.status_bayar] || 'belum';
    const link = o.link_kontrak
      ? `<a href="${escapeHtml(o.link_kontrak)}" target="_blank" class="btn-icon" title="Buka kontrak">📄</a>`
      : '—';

    const rowClass = sudahSelesai ? 'kontrak-selesai' : (akanHabis ? 'akan-habis' : 'baris-aktif');

    return `
      <tr class="${rowClass}">
        <td><strong>${escapeHtml(o.nama_kamar)}</strong></td>
        <td>${escapeHtml(o.nama_penyewa)}</td>
        <td>${escapeHtml(o.no_hp || '—')}</td>
        <td><span class="badge tipe">${escapeHtml(o.tipe_sewa)}</span></td>
        <td>${fmtDate(o.tanggal_mulai)}</td>
        <td>${fmtDate(o.tanggal_selesai)}</td>
        <td><strong>${rupiahFull(o.harga_total)}</strong></td>
        <td><span class="badge ${badgeClass}">${escapeHtml(o.status_bayar)}</span></td>
        <td>${link}</td>
        <td>
          <div class="btn-row">
            <button class="btn-icon" data-invoice="${o.id}" title="Print Invoice">🧾</button>
            <button class="btn-icon" data-kuitansi="${o.id}" title="Print Kuitansi">💰</button>
            <button class="btn-icon" data-perjanjian="${o.id}" title="Print Perjanjian">📄</button>
            <button class="btn-icon" data-edit="${o.id}" title="Edit">✏️</button>
            <button class="btn-icon danger" data-del="${o.id}" title="Hapus">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-invoice]').forEach(b =>
    b.addEventListener('click', () => openInvoice(Number(b.dataset.invoice))));
  tbody.querySelectorAll('[data-kuitansi]').forEach(b =>
    b.addEventListener('click', () => openKuitansi(Number(b.dataset.kuitansi))));
  tbody.querySelectorAll('[data-perjanjian]').forEach(b =>
    b.addEventListener('click', () => openPerjanjian(Number(b.dataset.perjanjian))));
  tbody.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openModal(Number(b.dataset.edit))));
  tbody.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => deleteOcc(Number(b.dataset.del))));
}

// ═══════════════════════════════════════════════════════════
// HEADER BERSAMA
// ═══════════════════════════════════════════════════════════

function buildDocHeader(title, no) {
  return `
    <div class="inv-header">
      <div class="inv-brand">
        <img src="foto/logo.png" alt="" onerror="this.style.display='none'">
        <div>
          <h1>GRIYA ALEENA</h1>
          <p>Kos Putri Nyaman, Kampus Unnes Sekaran.<br>
          ${escapeHtml(PEMILIK.alamat_singkat)} Telp/WA: ${escapeHtml(PEMILIK.no_hp)}</p>
        </div>
      </div>
      <div class="inv-title-block">
        <h2>${escapeHtml(title)}</h2>
        <div class="inv-no">No. ${escapeHtml(no)}</div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// INVOICE
// ═══════════════════════════════════════════════════════════
function openInvoice(id) {
  const o = OCCS.find(x => x.id === id);
  if (!o) return;

  const invoiceNo = generateInvoiceNo(o.id, o.tanggal_mulai);
  const today = fmtDateLong(todayISO());
  const durasi = hitungDurasi(o.tanggal_mulai, o.tanggal_selesai, o.tipe_sewa);

  const html = `
    ${buildDocHeader('INVOICE', invoiceNo)}

    <div class="inv-section">
      <div class="inv-section-title">Ditagihkan kepada:</div>
      <dl class="inv-info-grid">
        <dt>Nama</dt><dd>${escapeHtml(o.nama_penyewa)}</dd>
        ${o.no_hp ? `<dt>No. HP/WA</dt><dd>${escapeHtml(o.no_hp)}</dd>` : ''}
        <dt>Kamar</dt><dd>${escapeHtml(o.nama_kamar)} (${escapeHtml(o.tipe)})</dd>
      </dl>
    </div>

    <table class="inv-table">
      <thead>
        <tr>
          <th>Tipe Sewa</th>
          <th>Periode Sewa</th>
          <th style="text-align:right">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(o.tipe_sewa.charAt(0).toUpperCase() + o.tipe_sewa.slice(1))}</td>
          <td>
            ${escapeHtml(fmtDateLong(o.tanggal_mulai))} — ${escapeHtml(fmtDateLong(o.tanggal_selesai))}
            <div class="inv-period">Durasi: ${escapeHtml(durasi)}</div>
          </td>
          <td class="inv-amount">${escapeHtml(rupiahFull(o.harga_total))}</td>
        </tr>
      </tbody>
    </table>

    <div class="inv-total">
      <div>
        <div class="inv-total-label">Total Tagihan</div>
      </div>
      <div class="inv-total-value">${escapeHtml(rupiahFull(o.harga_total))}</div>
    </div>

    <p style="font-size:0.85rem;color:#5a7373;margin:16px 0 20px;line-height:1.5;">
      Invoice ini dibuat otomatis oleh sistem Griya Aleena. Mohon dibayarkan sebelum menempati kamar kos.
    </p>

    ${o.catatan ? `<div class="inv-notes"><strong>Catatan:</strong> ${escapeHtml(o.catatan)}</div>` : ''}

    <div class="inv-signature">
      <div class="inv-sign-date">Semarang, ${escapeHtml(today)}</div>
      <div>Hormat kami,</div>
      <div style="font-weight:700;">${escapeHtml(PEMILIK.nama)}</div>
      <div class="inv-sign-role">Pemilik Griya Aleena</div>
    </div>

    <div class="inv-footer">
      Terima kasih atas kepercayaan Anda. Semoga nyaman tinggal dan belajar di Griya Aleena. 🏠
    </div>

    <div class="invoice-actions">
      <button class="inv-btn-close" id="inv-btn-close">Tutup</button>
      <button class="inv-btn-print" id="inv-btn-print" data-filename="Invoice - ${escapeHtml(o.nama_penyewa)}">🖨️ Print / Simpan PDF</button>
    </div>
  `;

  document.getElementById('invoice-content').innerHTML = html;
  document.getElementById('invoice-modal').classList.add('open');

  // Attach event listener tombol Print
  setTimeout(() => {
    const btnPrint = document.getElementById('inv-btn-print');
    if (btnPrint) {
      btnPrint.onclick = () => printDoc(btnPrint.dataset.filename);
    }
  }, 0);
}

// ═══════════════════════════════════════════════════════════
// KUITANSI
// ═══════════════════════════════════════════════════════════
function openKuitansi(id) {
  const o = OCCS.find(x => x.id === id);
  if (!o) return;

  const noKuitansi = generateKuitansiNo(o.id, o.tanggal_mulai);
  const today = fmtDateLong(todayISO());
  const durasi = hitungDurasi(o.tanggal_mulai, o.tanggal_selesai, o.tipe_sewa);

  const html = `
    ${buildDocHeader('KUITANSI', noKuitansi)}

    <div class="inv-section">
      <div class="inv-section-title">Telah diterima dari:</div>
      <dl class="inv-info-grid">
        <dt>Nama</dt><dd>${escapeHtml(o.nama_penyewa)}</dd>
        ${o.no_hp ? `<dt>No. HP/WA</dt><dd>${escapeHtml(o.no_hp)}</dd>` : ''}
        <dt>Kamar</dt><dd>${escapeHtml(o.nama_kamar)} (${escapeHtml(o.tipe)})</dd>
      </dl>
    </div>

    <p style="font-size:0.9rem;margin-bottom:8px;">Untuk pembayaran sewa kamar kos dengan rincian:</p>
    <table class="inv-table">
      <thead>
        <tr>
          <th>Tipe Sewa</th>
          <th>Periode</th>
          <th style="text-align:right">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(o.tipe_sewa.charAt(0).toUpperCase() + o.tipe_sewa.slice(1))}</td>
          <td>
            ${escapeHtml(fmtDateLong(o.tanggal_mulai))} — ${escapeHtml(fmtDateLong(o.tanggal_selesai))}
            <div class="inv-period">Durasi: ${escapeHtml(durasi)}</div>
          </td>
          <td class="inv-amount">${escapeHtml(rupiahFull(o.harga_total))}</td>
        </tr>
      </tbody>
    </table>

    <div class="kuitansi-amount-box">
      <div class="kuitansi-amount-label">Jumlah Dibayar</div>
      <div class="kuitansi-amount-value">${escapeHtml(rupiahFull(o.harga_total))}</div>
      <div class="kuitansi-amount-text">(${escapeHtml(terbilangRupiah(o.harga_total))})</div>
      ${o.status_bayar === 'lunas' ? '<div class="kuitansi-check">✓ LUNAS</div>' : ''}
      ${o.status_bayar === 'dp' ? '<div class="kuitansi-check" style="background:#F5A623">DP</div>' : ''}
    </div>

    ${o.catatan ? `<div class="inv-notes"><strong>Catatan:</strong> ${escapeHtml(o.catatan)}</div>` : ''}

    <p style="font-size:0.85rem;color:#5a7373;margin-bottom:24px;line-height:1.5;">
      Kuitansi ini dibuat otomatis oleh sistem Griya Aleena dan merupakan bukti pembayaran yang sah. <br>Mohon disimpan dengan baik.
    </p>

    <div class="inv-signature">
      <div class="inv-sign-date">Semarang, ${escapeHtml(today)}</div>
      <div>Hormat kami,</div>
      <div style="font-weight:700;">${escapeHtml(PEMILIK.nama)}</div>
      <div class="inv-sign-role">Pemilik Griya Aleena</div>
    </div>

    <div class="inv-footer">
      Terima kasih atas kepercayaan Anda. Semoga nyaman tinggal dan belajar di Griya Aleena. 🏠
    </div>

    <div class="invoice-actions">
      <button class="inv-btn-close" id="kui-btn-close">Tutup</button>
      <button class="inv-btn-print" id="kui-btn-print" data-filename="Kuitansi - ${escapeHtml(o.nama_penyewa)}">🖨️ Print / Simpan PDF</button>
    </div>
  `;

  document.getElementById('kuitansi-content').innerHTML = html;
  document.getElementById('kuitansi-modal').classList.add('open');

  // Attach event listener tombol Tutup

    setTimeout(() => {
    const btnPrint = document.getElementById('kui-btn-print');
    if (btnPrint) {
      btnPrint.onclick = () => printDoc(btnPrint.dataset.filename);
    }
  }, 0);
}
// ═══════════════════════════════════════════════════════════
// PERJANJIAN
// ═══════════════════════════════════════════════════════════

function openPerjanjian(id) {
  const o = OCCS.find(x => x.id === id);
  if (!o) return;

  // Helper: kapitalkan semua teks (kecuali angka & simbol)
  const toUpper = (s) => {
    if (!s) return '';
    return String(s).toUpperCase();
  };

  // Field yang tidak di-uppercase (untuk angka/rupiah)
  const fieldRaw = (label, value) => `
    <div class="pj-field">
      <div class="pj-label">${escapeHtml(label)}</div>
      <div class="pj-colon">:</div>
      <div class="pj-value-line ${value ? '' : 'empty'}">${value ? escapeHtml(value) : '&nbsp;'}</div>
    </div>
  `;

  const field = (label, value) => `
    <div class="pj-field">
      <div class="pj-label">${escapeHtml(label)}</div>
      <div class="pj-colon">:</div>
      <div class="pj-value-line ${value ? '' : 'empty'}">${value ? escapeHtml(toUpper(value)) : '&nbsp;'}</div>
    </div>
  `;

  const totalBiaya = rupiahFull(o.harga_total);
  const tipeUpper = o.tipe_sewa.toUpperCase();
  const kamarTipe = o.tipe === 'AC' ? 'AC' : 'NON AC';
  const namaKamar = (o.nama_kamar || 'Kamar').toUpperCase();  // ⬅️ TAMBAH
  const kamarLabel = `${namaKamar} (${kamarTipe})`;            // ⬅️ TAMBAH

  const html = `
    <div class="perjanjian-logo">
      <img src="foto/logo.png" alt="Griya Aleena" onerror="this.style.display='none'">
    </div>

    <h1>PERJANJIAN DAN TATA TERTIB BERSAMA<br>GRIYA ALEENA</h1>

    <p>
      Pada hari ini <span class="pj-fill-inline">${escapeHtml(getHariIndonesia())}</span>
      tanggal <span class="pj-fill-inline">${escapeHtml(fmtDateLong(todayISO()))}</span>
      telah disepakati Perjanjian dan Tata Tertib Bersama terkait sewa-menyewa kamar kos antara:
    </p>

    <h2>1. Pemilik Kos</h2>
    <div class="pj-info-block">
      ${field('Nama', PEMILIK.nama)}
      ${field('Nomor KTP/SIM', PEMILIK.no_ktp)}
      ${field('Alamat', PEMILIK.alamat)}
      ${field('Nomor HP/WA', PEMILIK.no_hp_perjanjian)}
    </div>
    <p>Selanjutnya disebut <strong>Pemilik</strong>.</p>

    <h2>2. Penyewa Kos</h2>
    <div class="pj-info-block">
      ${field('Nama', o.nama_penyewa)}
      ${field('Nomor KTP/SIM', o.no_ktp)}
      ${field('Alamat', o.alamat_penyewa)}
      ${field('Nomor HP/WA', o.no_hp)}
    </div>

    <div class="pj-info-block" style="margin-top:14px;">
      <p style="font-weight:700;color:#1a5c5c;margin-bottom:10px;">Data Orang Tua/Wali/Kontak Darurat:</p>
      ${field('Nama', o.nama_ortu || '')}
      ${field('Nomor KTP/SIM', o.no_ktp_ortu || '')}
      ${field('Alamat', o.alamat_ortu || '')}
      ${field('Nomor HP/WA', o.no_hp_ortu || '')}
      ${field('Hubungan Keluarga', o.hubungan_keluarga || '')}
    </div>

    <p>Selanjutnya disebut <strong>Penyewa</strong>.</p>

    <p style="margin-top:16px;">
      Pemilik dan Penyewa sepakat mengikat diri dalam Perjanjian dan Tata Tertib Bersama dengan ketentuan sebagai berikut:
    </p>

    <h2>Pasal 1 – Objek Sewa</h2>
    <ol>
      <li>Pemilik menyewakan kamar kos yang beralamat di ${escapeHtml(PEMILIK.alamat)} kepada Penyewa.</li>
      <li>Kamar kos yang disewakan adalah <strong>${escapeHtml(kamarLabel)}</strong> dan hanya diperuntukkan bagi satu orang Penyewa dan tidak diperbolehkan dialihgunakan atau disewakan kembali kepada pihak lain tanpa persetujuan tertulis dari Pemilik.</li>
      <li>Fasilitas dasar yang disiapkan oleh Pemilik meliputi:
        <p style="margin-top:6px;"><strong>a. Fasilitas Pribadi Penyewa</strong></p>
        <ul>
          <li>Satu unit ${escapeHtml(kamarLabel)}</li>
          <li>Kamar mandi dalam</li>
          <li>Lemari pakaian besi sliding</li>
          <li>Kasur busa, bantal, dan guling</li>
          <li>Kipas angin dinding</li>
          <li>Meja kayu</li>
          <li>Rol kabel</li>
        </ul>
        <p><strong>b. Fasilitas Umum</strong> (dipakai bersama dengan penghuni kos lainnya)</p>
        <ul>
          <li>Jaringan Internet (WiFi)</li>
          <li>Dapur bersama</li>
          <li>Kulkas bersama</li>
          <li>Mesin cuci bersama dan tempat jemuran</li>
          <li>Kompor gas (mengisi gas sendiri jika habis)</li>
          <li>Alat-alat masak</li>
          <li>Wastafel</li>
          <li>Garasi motor</li>
        </ul>
      </li>
    </ol>

    <h2>Pasal 2 – Masa Sewa</h2>
    <ol>
      <li>Masa sewa kamar kos dimulai pada tanggal <strong>${escapeHtml(fmtDateLong(o.tanggal_mulai))}</strong> dan akan berakhir pada tanggal <strong>${escapeHtml(fmtDateLong(o.tanggal_selesai))}</strong>.</li>
      <li>Perpanjangan/pengakhiran sewa harus diinformasikan oleh Penyewa paling lambat 10 (sepuluh) hari sebelum masa sewa berakhir.</li>
    </ol>

    <h2>Pasal 3 – Biaya Sewa dan Pembayaran</h2>
    <ol>
      <li>Biaya sewa yang disepakati Para Pihak adalah sebagai berikut:
        <div class="pj-info-block" style="margin-top:8px;">
          <p><strong> ${escapeHtml(kamarLabel)}</strong></p>
          ${field('Durasi', tipeUpper)}
          ${fieldRaw('Biaya', totalBiaya)}
          ${field('Periode', fmtDateLong(o.tanggal_mulai) + ' — ' + fmtDateLong(o.tanggal_selesai))}
        </div>
      </li>
      <li>Pembayaran harus dilunasi sebelum unit kamar ditempati oleh Penyewa.</li>
      <li>Setiap kamar memiliki meteran listrik pribadi. Setiap Penyewa mengisi token listrik prabayar sendiri sesuai yang dibutuhkan (Penyewa boleh membawa alat elektronik yang dibutuhkan).</li>
      <li>Penyewa bebas biaya air bulanan dan bebas iuran sampah bulanan.</li>
    </ol>

    <h2>Pasal 4 – Tata Tertib</h2>
    <ol>
      <li>Penyewa wajib menjaga ketertiban dan tidak mengganggu kenyamanan penghuni lain.</li>
      <li>Penyewa bertanggung jawab atas kebersihan kamar masing-masing dan kebersihan fasilitas umum (dapur bersama, kulkas bersama, mesin cuci bersama, garasi, dan lain-lain).</li>
      <li>Penyewa wajib menjaga dan menggunakan seluruh fasilitas serta barang milik kos (seperti perabot, peralatan bersama, dan properti lainnya) dengan hati-hati, serta dilarang merusak, mengubah, atau memindahkan tanpa izin dari Pemilik.</li>
      <li>Penggunaan fasilitas umum harus dilakukan secara tertib, bergantian, dan penuh tanggung jawab.</li>
      <li>Kebijakan jam malam berlaku pukul 22:00 WIB, di mana setelah jam tersebut tidak diperkenankan menerima tamu, berisik, dan/atau melakukan aktivitas yang mengganggu penghuni lain.</li>
      <li>Volume musik, televisi, atau aktivitas lain yang menghasilkan suara keras harus dijaga agar tidak mengganggu lingkungan.</li>
      <li>Sampah harus dibuang secara teratur pada tempat yang telah disediakan.</li>
    </ol>

    <h2>Pasal 5 – Larangan</h2>
    <ol>
      <li>Dilarang membawa tamu lawan jenis ke dalam kamar kos.</li>
      <li>Dilarang menutup pintu kamar apabila sedang menerima tamu di area kos.</li>
      <li>Dilarang merokok di dalam kamar dan seluruh area dalam kos.</li>
      <li>Dilarang membawa, menyimpan, atau menggunakan narkotika, psikotropika, zat adiktif lainnya (termasuk sabu-sabu, ganja, ekstasi, dan sejenisnya), minuman keras, serta barang terlarang lainnya dalam bentuk apa pun.</li>
      <li>Dilarang membawa barang berbahaya seperti senjata tajam, senjata api, bahan peledak, zat kimia berbahaya, zat mudah terbakar serta barang-barang lain yang dapat membahayakan keselamatan, keamanan, atau kenyamanan penghuni lainnya.</li>
    </ol>

    <h2>Pasal 6 – Keamanan dan Keselamatan</h2>
    <ol>
      <li>Penyewa wajib menjaga kunci kamar dan/atau kunci gerbang, serta segera melaporkan kepada pemilik kos apabila terjadi kehilangan.</li>
      <li>Penyewa bertanggung jawab menjaga keamanan barang pribadinya masing-masing. Pemilik Kos tidak bertanggung jawab atas kehilangan akibat kelalaian Penyewa.</li>
      <li>Penyewa dilarang meminjamkan kunci kamar dan/atau gerbang kepada orang lain tanpa seizin Pemilik Kos.</li>
    </ol>

    <h2>Pasal 7 – Kerusakan dan Perbaikan</h2>
    <ol>
      <li>Penyewa bertanggung jawab atas kerusakan yang diakibatkan oleh kelalaian Penyewa.</li>
      <li>Jika ditemukan kerusakan pada properti, Penyewa wajib melaporkannya kepada pemilik kos secepatnya untuk dapat diperbaiki.</li>
    </ol>

    <h2>Pasal 8 – Pengakhiran Sewa</h2>
    <ol>
      <li>Jika Penyewa ingin mengakhiri sewa sebelum waktu yang disepakati, maka uang sewa yang sudah dibayarkan tidak dapat dikembalikan.</li>
      <li>Jika Penyewa mengakhiri sewa sebelum waktu yang disepakati, Penyewa diperbolehkan mencari pengganti hak sewa/mengoper sewa ke orang lain hanya jika mendapatkan persetujuan tertulis dari Pemilik.</li>
      <li>Pemilik berhak menolak calon pengganti yang diajukan oleh Penyewa untuk menggantikan hak sewa/oper sewa atas pertimbangan pribadi Pemilik (misal: atas pertimbangan bahwa calon pengganti terkesan tidak bertanggung jawab, tidak dapat mematuhi tata tertib kos, dan/atau hal lain.)</li>
      <li>Pemilik berhak memutus perjanjian jika Penyewa melanggar perjanjian dan tata tertib yang telah disepakati tanpa mengembalikan uang sewa yang telah dibayarkan.</li>
    </ol>

    <h2>Pasal 9 – Lain-lain</h2>
    <ol>
      <li>Segala hal yang belum diatur dalam Perjanjian ini akan dibahas bersama antara kedua pihak.</li>
      <li>Setiap sengketa yang timbul dari Perjanjian ini akan diselesaikan terlebih dahulu secara kekeluargaan melalui musyawarah untuk mencapai mufakat, sebelum menempuh jalur hukum.</li>
      <li>Perjanjian ini dibuat dalam dua rangkap, masing-masing untuk Pemilik dan Penyewa, dan memiliki kekuatan hukum yang sama.</li>
    </ol>

    <p style="margin-top:20px;">
      Demikian perjanjian ini dibuat dan ditandatangani oleh kedua belah pihak tanpa paksaan dari pihak mana pun.
    </p>

    <div class="pj-tanggal">
      Semarang, <span class="pj-fill-inline">${escapeHtml(fmtDateLong(todayISO()))}</span>
    </div>

    <div class="pj-sign-row">
      <div class="pj-sign-col">
        <div class="pj-sign-label">Pemilik,</div>
        <div class="pj-sign-space"></div>
        <div class="pj-sign-name-line">${escapeHtml(String(PEMILIK.nama || '').toUpperCase())}</div>
      </div>
      <div class="pj-sign-col">
        <div class="pj-sign-label">Penyewa,</div>
        <div class="pj-sign-space"></div>
        <div class="pj-sign-name-line">${escapeHtml(String(o.nama_penyewa || '').toUpperCase())}</div>
      </div>
    </div>

    <div class="pj-lampiran">
      <h3>Lampiran:</h3>
      <ol type="a">
        <li>Fotokopi KTP/SIM Pemilik.</li>
        <li>Fotokopi KTP/SIM Penyewa.</li>
        <li>Fotokopi KTP/SIM Orang Tua/Wali/Kontak Darurat.</li>
        <li>Fotokopi Kartu Tanda Mahasiswa Penyewa.</li>
      </ol>
    </div>

    <div class="inv-footer">
      Perjanjian ini dicetak otomatis dari sistem Griya Aleena. Wajib ditandatangani oleh kedua pihak.
    </div>

    <div class="invoice-actions">
      <button class="inv-btn-close" onclick="closePerjanjian()">Tutup</button>
      <button class="inv-btn-print" id="perj-btn-print" data-filename="Perjanjian - ${escapeHtml(o.nama_penyewa)}">🖨️ Print / Simpan PDF</button>
    </div>
  `;

  document.getElementById('perjanjian-content').innerHTML = html;
  document.getElementById('perjanjian-modal').classList.add('open');

  // Attach event listener tombol Print
  setTimeout(() => {
    const btnPrint = document.getElementById('perj-btn-print');
    if (btnPrint) {
      btnPrint.onclick = () => printDoc(btnPrint.dataset.filename);
    }
  }, 0);
}


function closePerjanjian() {
  document.getElementById('perjanjian-modal').classList.remove('open');
}

// Close modal saat klik backdrop
['invoice-modal', 'kuitansi-modal', 'perjanjian-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', (e) => {
    if (e.target.id === id) {
      document.getElementById(id).classList.remove('open');
    }
  });
});

// ─── Filters ───────────────────────────────────────────────
document.getElementById('search').addEventListener('input', renderTable);
document.getElementById('filter-tahun').addEventListener('change', renderTable);
document.getElementById('filter-status').addEventListener('change', renderTable);

// ─── Modal Okupansi ────────────────────────────────────────
const modalOcc = document.getElementById('modal-occ');
const formOcc = document.getElementById('form-occ');

document.getElementById('btn-add').addEventListener('click', () => openModal(null));

// Tombol Batal di modal-occ → cancelModal (dengan konfirmasi + cleanup)
modalOcc.querySelectorAll('[data-close]').forEach(b =>
  b.addEventListener('click', () => cancelModal()));

// CATATAN: klik backdrop TIDAK menutup modal-occ
// Hanya tombol Batal atau Simpan yang bisa menutup

// ═══════════════════════════════════════════════════════════
// MODAL STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════

function resetModalState() {
  MODAL_STATE.editingId = null;
  MODAL_STATE.pendingUploads = {};
  MODAL_STATE.pendingDeletes = [];
  MODAL_STATE.originalUrls = {};
  MODAL_STATE.pendingError = null;
}

// Batal: hapus semua file yang di-upload sesi ini, tutup modal
async function cancelModal() {
  const pendingUrls = Object.values(MODAL_STATE.pendingUploads).filter(Boolean);

  // 1. Konfirmasi kalau ada pending upload
  if (pendingUrls.length > 0) {
    const confirmed = window.confirm(
      `Ada ${pendingUrls.length} file yang belum disimpan.\n\n` +
      `Klik OK untuk batalkan dan HAPUS file tersebut.\n` +
      `Klik Cancel untuk kembali ke form.`
    );
    if (!confirmed) return;

    // 2. Hapus dari R2
    try {
      const result = await api('/delete-files', {
        method: 'POST',
        body: JSON.stringify({ urls: pendingUrls }),
      });

      if (result.failed && result.failed.length > 0) {
        alert(
          `⚠️ Sebagian file gagal dihapus dari server:\n\n` +
          result.failed.map(f => `• ${f.url}\n  (${f.error})`).join('\n\n') +
          `\n\nFile yang gagal mungkin menjadi orphan. Hubungi admin.`
        );
      }
    } catch (err) {
      alert(
        `⚠️ Gagal menghapus file sementara:\n${err.message}\n\n` +
        `File mungkin menjadi orphan di server.`
      );
    }
  }

  // 3. Reset state & tutup
  resetModalState();
  formOcc.reset();
  modalOcc.classList.remove('open');
}

function fillRoomSelect(currentEditingId = null) {
  const fr = document.getElementById('f-room');
  const today = todayISO();

  let editingRoomId = null;
  if (currentEditingId) {
    const editingOcc = OCCS.find(x => x.id === currentEditingId);
    if (editingOcc) editingRoomId = editingOcc.room_id;
  }

  fr.innerHTML = ROOMS.map(r => {
    const activeOcc = OCCS.find(o =>
      o.room_id === r.id &&
      o.tanggal_mulai <= today &&
      o.tanggal_selesai >= today
    );

    const isDisabled = activeOcc && activeOcc.room_id !== editingRoomId;
    const disabledAttr = isDisabled ? 'disabled' : '';
    const label = isDisabled
      ? `${r.nama_kamar} (${r.tipe}) — TERISI`
      : `${r.nama_kamar} (${r.tipe})`;

    return `<option value="${r.id}" ${disabledAttr}>${escapeHtml(label)}</option>`;
  }).join('');
}

function openModal(id) {
  EDITING_ID = id;
  const f = formOcc;
  f.reset();
  fillRoomSelect(id);
  setupAutoHarga();

  // ─── Reset state modal ───
  MODAL_STATE.editingId = id;
  MODAL_STATE.pendingUploads = {};
  MODAL_STATE.pendingDeletes = [];
  MODAL_STATE.originalUrls = {};
  MODAL_STATE.pendingError = null;

  // Helper: safe set value (kalau element ada, kalau tidak skip)
  const safeSet = (elId, val) => {
    const el = document.getElementById(elId);
    if (el) el.value = val !== undefined && val !== null ? val : '';
    else console.warn('Element tidak ditemukan:', elId);
  };

  // Reset semua upload UI
  if (typeof UPLOAD_CONFIGS !== 'undefined') {
    UPLOAD_CONFIGS.forEach(cfg => {
      const status = document.getElementById(cfg.statusId);
      const preview = document.getElementById(cfg.previewId);
      const link = document.getElementById(cfg.linkId);
      if (status) { status.innerHTML = ''; status.className = 'upload-status'; }
      if (preview) preview.innerHTML = '';
      if (link) link.value = '';
    });
  }

  if (id) {
    const o = OCCS.find(x => x.id === id);
    if (!o) return;
    document.getElementById('modal-title').textContent = 'Edit Okupansi';
    safeSet('f-id', o.id);
    safeSet('f-room', o.room_id);
    safeSet('f-tipe', o.tipe_sewa);
    safeSet('f-mulai', o.tanggal_mulai);
    safeSet('f-selesai', o.tanggal_selesai);
    safeSet('f-harga', o.harga_total);
    // safeSet('f-link', o.link_kontrak || '');
    safeSet('f-status', o.status_bayar);
    safeSet('f-nama', o.nama_penyewa);
    safeSet('f-ktp', o.no_ktp || '');
    safeSet('f-alamat', o.alamat_penyewa || '');
    safeSet('f-hp', o.no_hp || '');
    safeSet('f-kampus', o.asal_kampus || '');
    safeSet('f-nama-ortu', o.nama_ortu || '');
    safeSet('f-ktp-ortu', o.no_ktp_ortu || '');
    safeSet('f-alamat-ortu', o.alamat_ortu || '');
    safeSet('f-hp-ortu', o.no_hp_ortu || '');
    safeSet('f-hubungan', o.hubungan_keluarga || '');
    safeSet('f-catatan', o.catatan || '');

   
        // Isi link & preview untuk 4 file + snapshot URL asli
    const fileMap = {
      'f-ktp-penyewa': { link: o.file_ktp_penyewa, preview: 'link-preview-ktp-penyewa', hidden: 'f-link-ktp-penyewa', field: 'file_ktp_penyewa' },
      'f-ktp-ortu':    { link: o.file_ktp_ortu,    preview: 'link-preview-ktp-ortu',    hidden: 'f-link-ktp-ortu',    field: 'file_ktp_ortu' },
      'f-ktm':         { link: o.file_ktm,         preview: 'link-preview-ktm',         hidden: 'f-link-ktm',         field: 'file_ktm' },
      'f-perjanjian':  { link: o.file_perjanjian,  preview: 'link-preview-perjanjian',  hidden: 'f-link-perjanjian',  field: 'file_perjanjian' },
    };

    // ─── Snapshot URL asli (untuk cleanup setelah Simpan) ───
    Object.values(fileMap).forEach(item => {
      if (item.link) MODAL_STATE.originalUrls[item.field] = item.link;
    });

    
    Object.values(fileMap).forEach(item => {
      if (item.link) {
        const hidden = document.getElementById(item.hidden);
        const preview = document.getElementById(item.preview);
        if (hidden) hidden.value = item.link;
        if (preview) preview.innerHTML = `<a href="${escapeHtml(item.link)}" target="_blank">📄 Memuat...</a>`;
      }
    });

    // Tampilkan tombol Hapus kalau ada file tersimpan
    UPLOAD_CONFIGS.forEach(cfg => {
      const btnDelete = document.querySelector(`[data-delete-file="${cfg.key}"]`);
      if (btnDelete) {
        const linkInput = document.getElementById(cfg.linkId);
        btnDelete.style.display = linkInput?.value ? 'inline-block' : 'none';
      }
    });

          // ⬇️ Validasi semua link ke R2 (async, tidak blocking)
    const linksToCheck = Object.values(fileMap).map(item => item.link).filter(Boolean);
    if (linksToCheck.length > 0) {
      checkFilesExist(linksToCheck).then(results => {
        Object.values(fileMap).forEach(item => {
          if (!item.link) return;
          const preview = document.getElementById(item.preview);
          const hidden = document.getElementById(item.hidden);
          
          // Cari key dari UPLOAD_CONFIGS untuk tombol Hapus
          const cfg = UPLOAD_CONFIGS.find(c => c.linkId === item.hidden);
          const deleteBtn = cfg ? document.querySelector(`[data-delete-file="${cfg.key}"]`) : null;
          const status = cfg ? document.getElementById(cfg.statusId) : null;

          const exist = results[item.link];
          if (exist === true) {
            // ✅ File ada → tampilkan link normal + tombol Hapus
            if (preview) preview.innerHTML = `<a href="${escapeHtml(item.link)}" target="_blank">📄 Lihat file yang tersimpan</a>`;
            if (deleteBtn) deleteBtn.style.display = 'inline-block';
          } else if (exist === false) {
            // ❌ File TIDAK ada → tampilkan POLOS (seperti belum upload)
            if (preview) preview.innerHTML = '';
            if (deleteBtn) deleteBtn.style.display = 'none';
            if (status) { status.innerHTML = ''; status.className = 'upload-status'; }
            
            // Bersihkan link tersembunyi biar tidak tersimpan URL mati
            if (hidden) hidden.value = '';
          }
        });
      }).catch(err => {
        console.warn('Gagal validasi file:', err);
        // Fallback: sembunyikan preview (biar tidak tampil link mati)
        Object.values(fileMap).forEach(item => {
          if (!item.link) return;
          const preview = document.getElementById(item.preview);
          const hidden = document.getElementById(item.hidden);
          if (preview) preview.innerHTML = '';
          if (hidden) hidden.value = '';
        });
      });
    }

  } else {
    document.getElementById('modal-title').textContent = 'Tambah Okupansi';
    safeSet('f-mulai', todayISO());
    updateHargaOtomatis();
  }
  modalOcc.classList.add('open');
}


formOcc.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    room_id: Number(document.getElementById('f-room').value),
    tipe_sewa: document.getElementById('f-tipe').value,
    tanggal_mulai: document.getElementById('f-mulai').value,
    tanggal_selesai: document.getElementById('f-selesai').value,
    harga_total: Number(document.getElementById('f-harga').value),
    link_kontrak: null,
    status_bayar: document.getElementById('f-status').value,
    nama_penyewa: document.getElementById('f-nama').value.trim(),
    no_ktp: document.getElementById('f-ktp').value.trim() || null,
    alamat_penyewa: document.getElementById('f-alamat').value.trim() || null,
    no_hp: document.getElementById('f-hp').value.trim() || null,
    asal_kampus: document.getElementById('f-kampus').value.trim() || null,
    nama_ortu: document.getElementById('f-nama-ortu').value.trim() || null,
    no_ktp_ortu: document.getElementById('f-ktp-ortu').value.trim() || null,
    alamat_ortu: document.getElementById('f-alamat-ortu').value.trim() || null,
    no_hp_ortu: document.getElementById('f-hp-ortu').value.trim() || null,
    hubungan_keluarga: document.getElementById('f-hubungan').value.trim() || null,
    file_ktp_penyewa: document.getElementById('f-link-ktp-penyewa').value.trim() || null,
    file_ktp_ortu: document.getElementById('f-link-ktp-ortu').value.trim() || null,
    file_ktm: document.getElementById('f-link-ktm').value.trim() || null,
    file_perjanjian: document.getElementById('f-link-perjanjian').value.trim() || null,
    catatan: document.getElementById('f-catatan').value.trim() || null,
  };

  try {
    // ─── 1. Simpan ke DB ───
    if (EDITING_ID) {
      await api(`/occupancies/${EDITING_ID}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/occupancies', { method: 'POST', body: JSON.stringify(payload) });
    }

    // ─── 2. Hapus file LAMA dari R2 (yang ditandai pending delete) ───
    if (EDITING_ID && MODAL_STATE.pendingDeletes.length > 0) {
      const urlsToDelete = MODAL_STATE.pendingDeletes
        .map(f => MODAL_STATE.originalUrls[f])
        .filter(Boolean);

      if (urlsToDelete.length > 0) {
        try {
          const result = await api('/delete-files', {
            method: 'POST',
            body: JSON.stringify({ urls: urlsToDelete }),
          });

          if (result.failed && result.failed.length > 0) {
            alert(
              `✅ Data tersimpan.\n\n` +
              `⚠️ Namun ${result.failed.length} file LAMA gagal dihapus dari server:\n\n` +
              result.failed.map(f => `• ${f.url}\n  (${f.error})`).join('\n\n') +
              `\n\nFile tersebut mungkin menjadi orphan. Hubungi admin.`
            );
          }
        } catch (err) {
          alert(
            `✅ Data tersimpan.\n\n` +
            `⚠️ Namun gagal menghapus file LAMA dari server:\n${err.message}\n\n` +
            `File lama mungkin menjadi orphan. Hubungi admin.`
          );
        }
      }
    }

    // ─── 3. Reset state & tutup modal ───
    resetModalState();
    modalOcc.classList.remove('open');

    await Promise.all([loadOccs(), loadStats()]);
    fillYearFilter();
    renderRooms();
    renderTable();

  } catch (err) {
    // Gagal simpan → JANGAN reset state, biar user bisa coba lagi
    alert('Gagal simpan: ' + err.message);
  }
});

// ═══════════════════════════════════════════════════════════
// UPLOAD DOKUMEN KE R2 (4 File)
// Upload → simpan URL di MODAL_STATE.pendingUploads
// Link BARU disimpan ke DB saat klik Simpan
// ═══════════════════════════════════════════════════════════
async function uploadDokumen(file, cfg) {
  const status = document.getElementById(cfg.statusId);
  const linkInput = document.getElementById(cfg.linkId);
  const preview = document.getElementById(cfg.previewId);

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedTypes.includes(file.type)) {
    status.innerHTML = '❌ Hanya PDF, JPG, PNG';
    status.className = 'upload-status error';
    return;
  }

  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    status.innerHTML = '❌ File terlalu besar (max 5 MB)';
    status.className = 'upload-status error';
    return;
  }

  // ─── Kalau di sesi ini sudah ada pending upload untuk field ini, hapus dulu ───
  const prevUpload = MODAL_STATE.pendingUploads[cfg.field];
  if (prevUpload) {
    status.innerHTML = '🗑️ Menghapus file sebelumnya...';
    status.className = 'upload-status loading';
    try {
      await api('/delete-file', {
        method: 'POST',
        body: JSON.stringify({ url: prevUpload }),
      });
    } catch (e) {
      console.warn('Gagal hapus pending upload sebelumnya:', e.message);
    }
    delete MODAL_STATE.pendingUploads[cfg.field];
  }

  status.innerHTML = '⏳ Mengunggah... 0%';
  status.className = 'upload-status loading';

  try {
    const formData = new FormData();
    formData.append('file', file);

    const roomId = document.getElementById('f-room')?.value || '';
    formData.append('room_id', roomId);

    const jenisDokumen = (cfg.field || '').replace(/^file_/, '').replace(/_/g, '-');
    formData.append('jenis', jenisDokumen);

    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${TOKEN}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          status.innerHTML = `⏳ Mengunggah... ${percent}%`;
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error('Response tidak valid')); }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || `HTTP ${xhr.status}`));
          } catch { reject(new Error(`HTTP ${xhr.status}`)); }
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });

        // ⬇️ Simpan URL ke memori (BELUM ke DB)
    MODAL_STATE.pendingUploads[cfg.field] = result.url;

    // ⬇️ Kalau ada file LAMA di DB untuk field ini, tandai untuk dihapus setelah Simpan.
    // Ini berlaku baik user klik 🗑️ dulu atau tidak — karena file lama sudah DIGANTI,
    // jadi harus dihapus dari R2 supaya tidak orphan.
    if (EDITING_ID && MODAL_STATE.originalUrls[cfg.field]) {
      if (!MODAL_STATE.pendingDeletes.includes(cfg.field)) {
        MODAL_STATE.pendingDeletes.push(cfg.field);
      }
    }

    // Update UI
    linkInput.value = result.url;
    status.innerHTML = '⏳ Akan tersimpan saat klik Simpan';
    status.className = 'upload-status loading';
    preview.innerHTML = `<a href="${escapeHtml(result.url)}" target="_blank">📄 Lihat file (belum disimpan)</a>`;

    // Tampilkan tombol Hapus
    const btnDelete = document.querySelector(`[data-delete-file="${cfg.key}"]`);
    if (btnDelete) btnDelete.style.display = 'inline-block';

    
  } catch (err) {
    status.innerHTML = `❌ Gagal: ${escapeHtml(err.message)}`;
    status.className = 'upload-status error';
  } finally {
    document.getElementById(cfg.key).value = '';
  }
}
// ═══════════════════════════════════════════════════════════
// HAPUS FILE DARI R2
// ═══════════════════════════════════════════════════════════

async function deleteFileFromR2(fileUrl) {
  if (!fileUrl) return false;
  
  try {
    const result = await api('/delete-file', {
      method: 'POST',
      body: JSON.stringify({ url: fileUrl }),
    });
    console.log('File dihapus:', result.deleted);
    return true;
  } catch (err) {
    console.error('Gagal hapus file:', err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// HAPUS FILE — 2 SKENARIO
//  A. File baru di-upload sesi ini → hapus dari R2 langsung
//  B. File lama di DB → tandai pending, hapus setelah Simpan
// ═══════════════════════════════════════════════════════════
async function deleteUploadedFile(cfg) {
  const linkInput = document.getElementById(cfg.linkId);
  const preview = document.getElementById(cfg.previewId);
  const status = document.getElementById(cfg.statusId);
  const btnDelete = document.querySelector(`[data-delete-file="${cfg.key}"]`);

  const urlInField = linkInput.value;
  if (!urlInField) return;

  const confirmed = window.confirm('Hapus file ini?');
  if (!confirmed) return;

  const isPendingUpload = MODAL_STATE.pendingUploads[cfg.field] === urlInField;
  const hasOriginal = !!MODAL_STATE.originalUrls[cfg.field];

  if (isPendingUpload) {
    // ─── KASUS A/C: File baru di-upload sesi ini → hapus dari R2 langsung ───
    status.innerHTML = '🗑️ Menghapus...';
    status.className = 'upload-status loading';
    try {
      await api('/delete-file', {
        method: 'POST',
        body: JSON.stringify({ url: urlInField }),
      });
      delete MODAL_STATE.pendingUploads[cfg.field];
      linkInput.value = '';
      preview.innerHTML = '';

      // ⬇️ Kalau ada file LAMA di DB, tandai untuk dihapus setelah Simpan
      if (EDITING_ID && hasOriginal) {
        if (!MODAL_STATE.pendingDeletes.includes(cfg.field)) {
          MODAL_STATE.pendingDeletes.push(cfg.field);
        }
        status.innerHTML = '🗑️ File baru dihapus · file lama akan dihapus saat Simpan';
        status.className = 'upload-status loading';
        if (btnDelete) btnDelete.style.display = 'none';
      } else {
        status.innerHTML = '🗑️ File dihapus';
        status.className = 'upload-status success';
        if (btnDelete) btnDelete.style.display = 'none';
      }
    } catch (err) {
      status.innerHTML = `❌ Gagal hapus: ${escapeHtml(err.message)}`;
      status.className = 'upload-status error';
    }
  } else {
    // ─── KASUS B: File lama di DB (belum diganti) → tandai pending delete ───
    if (!MODAL_STATE.pendingDeletes.includes(cfg.field)) {
      MODAL_STATE.pendingDeletes.push(cfg.field);
    }
    linkInput.value = '';
    preview.innerHTML = '';
    status.innerHTML = '⏳ Akan dihapus saat klik Simpan';
    status.className = 'upload-status loading';
    if (btnDelete) btnDelete.style.display = 'none';
  }
}
// ═══════════════════════════════════════════════════════════
// CEK FILE MASIH ADA DI R2
// ═══════════════════════════════════════════════════════════

async function checkFilesExist(urls) {
  // Filter URL yang valid
  const validUrls = urls.filter(u => u && typeof u === 'string');
  if (validUrls.length === 0) return {};

  try {
    const result = await api('/check-file', {
      method: 'POST',
      body: JSON.stringify({ urls: validUrls }),
    });
    return result.results || {};
  } catch (err) {
    console.error('Check files error:', err.message);
    return {};
  }
}

// ─── Export CSV ────────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', () => {
  const rows = [
    [
      'Kamar','Penyewa','No HP','Prodi/Jurusan & Kampus','Tipe Sewa','Mulai','Selesai','Total','Status',
      'Link Kontrak','Catatan','No KTP','Alamat',
      'Nama Ortu','No KTP Ortu','No HP Ortu','Alamat Ortu','Hubungan Keluarga',
      'File KTP Penyewa','File KTP Ortu','File KTM','File Perjanjian'
    ],
    ...OCCS.map(o => [
      o.nama_kamar || '',
      o.nama_penyewa || '',
      o.no_hp || '',
      o.asal_kampus || '',
      o.tipe_sewa || '',
      o.tanggal_mulai || '',
      o.tanggal_selesai || '',
      o.harga_total || '',
      o.status_bayar || '',
      o.link_kontrak || '',
      o.catatan || '',
      o.no_ktp || '',
      o.alamat_penyewa || '',
      o.nama_ortu || '',
      o.no_ktp_ortu || '',
      o.no_hp_ortu || '',
      o.alamat_ortu || '',
      o.hubungan_keluarga || '',
      o.file_ktp_penyewa || '',
      o.file_ktp_ortu || '',
      o.file_ktm || '',
      o.file_perjanjian || ''
    ])
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `okupansi-griya-aleena-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// ─── Import CSV ────────────────────────────────────────────
document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!confirm(`Import ${file.name}?\n\nPastikan format CSV sesuai template export.`)) {
    e.target.value = '';
    return;
  }

  try {
    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      alert('CSV kosong atau format tidak valid');
      e.target.value = '';
      return;
    }

    const payload = rows.map(r => ({
      nama_kamar: r['Kamar'] || r['kamar'] || '',
      nama_penyewa: r['Penyewa'] || r['penyewa'] || '',
      no_hp: r['No HP'] || r['no_hp'] || '',
      asal_kampus: r['Prodi/Jurusan & Kampus'] || r['Asal Kampus'] || r['asal_kampus'] || '',
      tipe_sewa: (r['Tipe Sewa'] || r['tipe_sewa'] || 'bulanan').toLowerCase(),
      tanggal_mulai: normalizeDate(r['Mulai'] || r['mulai'] || ''),
      tanggal_selesai: normalizeDate(r['Selesai'] || r['selesai'] || ''),
      harga_total: Number(String(r['Total'] || r['total'] || '0').replace(/[^0-9]/g, '')),
      status_bayar: (r['Status'] || r['status'] || 'belum').toLowerCase(),
      link_kontrak: r['Link Kontrak'] || r['link_kontrak'] || null,
      catatan: r['Catatan'] || r['catatan'] || null,
      no_ktp: r['No KTP'] || r['no_ktp'] || null,
      alamat_penyewa: r['Alamat'] || r['alamat_penyewa'] || null,
      nama_ortu: r['Nama Ortu'] || r['nama_ortu'] || null,
      no_ktp_ortu: r['No KTP Ortu'] || r['no_ktp_ortu'] || null,
      no_hp_ortu: r['No HP Ortu'] || r['no_hp_ortu'] || null,
      alamat_ortu: r['Alamat Ortu'] || r['alamat_ortu'] || null,
      hubungan_keluarga: r['Hubungan Keluarga'] || r['hubungan_keluarga'] || null,
      file_ktp_penyewa: r['File KTP Penyewa'] || r['file_ktp_penyewa'] || null,
      file_ktp_ortu: r['File KTP Ortu'] || r['file_ktp_ortu'] || null,
      file_ktm: r['File KTM'] || r['file_ktm'] || null,
      file_perjanjian: r['File Perjanjian'] || r['file_perjanjian'] || null,
    }));

    const result = await api('/occupancies/bulk', {
      method: 'POST',
      body: JSON.stringify({ rows: payload }),
    });

    const wrap = document.getElementById('import-result');
    let html = `
      <p style="margin-bottom:12px;">
        <strong>✅ Sukses:</strong> ${result.sukses} baris<br>
        <strong>❌ Gagal:</strong> ${result.gagal} baris
      </p>
    `;
    if (result.errors && result.errors.length) {
      html += `<div style="background:#fdecec;padding:12px;border-radius:8px;font-size:0.85rem;">
        <strong>Detail error:</strong><br>
        ${result.errors.map(e => escapeHtml(e)).join('<br>')}
      </div>`;
    }
    wrap.innerHTML = html;
    document.getElementById('modal-import-result').classList.add('open');

    await Promise.all([loadOccs(), loadStats()]);
    fillYearFilter();
    renderRooms();
    renderTable();
  } catch (err) {
    alert('Gagal import: ' + err.message);
  } finally {
    e.target.value = '';
  }
});




function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (c === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else { cur += c; }
  }
  result.push(cur);
  return result;
}

function normalizeDate(s) {
  if (!s) return '';
  s = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05',
    jun: '06', jul: '07', agu: '08', aug: '08', sep: '09', okt: '10', oct: '10',
    nov: '11', des: '12', dec: '12',
    januari: '01', februari: '02', maret: '03', april: '04',
    juni: '06', juli: '07', agustus: '08', september: '09',
    oktober: '10', november: '11', desember: '12'
  };
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const mon = months[m[2].toLowerCase()] || '01';
    return `${m[3]}-${mon}-${day}`;
  }
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  return s;
}

document.getElementById('modal-import-result').querySelectorAll('[data-close]').forEach(b =>
  b.addEventListener('click', () => document.getElementById('modal-import-result').classList.remove('open')));
document.getElementById('modal-import-result').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-import-result')) {
    document.getElementById('modal-import-result').classList.remove('open');
  }
});

// ═══════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════

document.getElementById('btn-analytics').addEventListener('click', async () => {
  document.getElementById('modal-analytics').classList.add('open');
  await loadAnalytics();
});

document.getElementById('analytics-period').addEventListener('change', loadAnalytics);

document.querySelectorAll('[data-close-analytics]').forEach(b =>
  b.addEventListener('click', () => document.getElementById('modal-analytics').classList.remove('open')));

document.getElementById('modal-analytics').addEventListener('click', e => {
  if (e.target.id === 'modal-analytics') {
    document.getElementById('modal-analytics').classList.remove('open');
  }
});

async function loadAnalytics() {
  const wrap = document.getElementById('analytics-content');
  wrap.innerHTML = '<div class="analytics-loading">⏳ Memuat data...</div>';

  const days = document.getElementById('analytics-period').value;

  try {
    const data = await api(`/analytics?days=${days}`);
    wrap.innerHTML = renderAnalytics(data, Number(days));

    try {
      const unseen = await api('/analytics/logs/unseen-count');
      const badge = document.getElementById('unseen-badge');
      if (badge) {
        if (unseen.count > 0) {
          badge.textContent = unseen.count > 99 ? '99+' : unseen.count;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) {
      console.error('Unseen count error:', e);
    }
  } catch (err) {
    wrap.innerHTML = `<div class="analytics-loading" style="color:#e74c3c;">❌ Gagal memuat: ${escapeHtml(err.message)}</div>`;
  }
}

function renderAnalytics(d, days) {
  const pct = (n, total) => total > 0 ? Math.round((n / total) * 100) : 0;

  const maxDaily = Math.max(...d.daily.map(x => x.n), 1);
  const dailyBars = d.daily.map(x => {
    const h = Math.round((x.n / maxDaily) * 100);
    const tgl = new Date(x.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    return `<div class="bar-item" title="${tgl}: ${x.n} visitor (${x.unique_ip} unique)">
      <div class="bar" style="height:${h}%"></div>
      <div class="bar-label">${tgl}</div>
    </div>`;
  }).join('');

  const renderList = (arr, key1, key2 = null) => {
    if (!arr.length) return '<div class="analytics-empty">—</div>';
    const total = arr.reduce((s, x) => s + x.n, 0);
    return arr.map(x => `
      <div class="analytics-list-item">
        <div class="ali-label">
          <strong>${escapeHtml(x[key1] || 'Unknown')}</strong>
          ${key2 && x[key2] ? `<small>${escapeHtml(x[key2])}</small>` : ''}
        </div>
        <div class="ali-bar-wrap">
          <div class="ali-bar" style="width:${pct(x.n, total)}%"></div>
        </div>
        <div class="ali-count">${x.n} <small>(${pct(x.n, total)}%)</small></div>
      </div>
    `).join('');
  };

  return `
    <div class="analytics-stats">
      <div class="astat">
        <div class="astat-label">Hari Ini</div>
        <div class="astat-num">${d.today_total}</div>
        <div class="astat-sub">${d.today_unique} unique IP</div>
      </div>
      <div class="astat">
        <div class="astat-label">${days} Hari Terakhir</div>
        <div class="astat-num">${d.total}</div>
        <div class="astat-sub">${d.unique_ips} unique IP</div>
      </div>
    </div>

    <div class="analytics-block">
      <h4>📈 Visitor ${days} Hari Terakhir</h4>
      <div class="bar-chart">${dailyBars || '<div class="analytics-empty">Belum ada data</div>'}</div>
    </div>

    <div class="analytics-grid-2">
      <div class="analytics-block">
        <h4>🌐 Browser</h4>
        ${renderList(d.browsers, 'browser')}
      </div>
      <div class="analytics-block">
        <h4>💻 Sistem Operasi</h4>
        ${renderList(d.os_list, 'os')}
      </div>
      <div class="analytics-block">
        <h4>📱 Device</h4>
        ${renderList(d.devices, 'device_type')}
      </div>
      <div class="analytics-block">
        <h4>🔗 Sumber Traffic</h4>
        ${renderList(d.referers, 'source')}
      </div>
      <div class="analytics-block">
        <h4>📍 Kota</h4>
        ${renderList(d.cities, 'city', 'country_name')}
      </div>
      <div class="analytics-block">
        <h4>📡 ISP</h4>
        ${renderList(d.isps, 'isp')}
      </div>
    </div>


  `;
}

document.getElementById('btn-view-logs-header').addEventListener('click', () => {
  openLogsModal();
});

document.getElementById('btn-export-logs-header').addEventListener('click', () => {
  exportLogsCsv();
});

async function openLogsModal() {
  document.getElementById('modal-logs').classList.add('open');
  await loadLogsModal();
}

async function loadLogsModal() {
  const wrap = document.getElementById('logs-content');
  wrap.innerHTML = '<div class="analytics-loading">⏳ Memuat log...</div>';

  try {
    const data = await api('/analytics/logs?limit=200');
    window.__logsCache = data.logs || [];
    wrap.innerHTML = renderLogsTable(window.__logsCache);

    const unseenIds = window.__logsCache.filter(l => !l.viewed).map(l => l.id);
    if (unseenIds.length > 0) {
      fetch(`${API}/analytics/logs/mark-viewed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({ ids: unseenIds }),
      }).then(() => {
        window.__logsCache.forEach(l => {
          if (unseenIds.includes(l.id)) l.viewed = 1;
        });
        // Refresh badge angka di tombol Analitik
        updateAnalyticsBadge();
      }).catch(err => console.error('Mark viewed failed:', err));
    }

    const searchInput = document.getElementById('log-search');
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = window.__logsCache.filter(l =>
          (l.ip || '').toLowerCase().includes(q) ||
          (l.city || '').toLowerCase().includes(q) ||
          (l.browser || '').toLowerCase().includes(q) ||
          (l.os || '').toLowerCase().includes(q) ||
          (l.isp || '').toLowerCase().includes(q)
        );
        document.getElementById('logs-content').innerHTML = renderLogsTable(filtered);
      });
      searchInput.dataset.bound = 'true';
    }
  } catch (err) {
    wrap.innerHTML = `<div class="analytics-loading" style="color:#e74c3c;">❌ Gagal memuat: ${escapeHtml(err.message)}</div>`;
  }
}

function renderLogsTable(logs) {
  if (!logs.length) {
    return '<div class="analytics-empty">Belum ada log</div>';
  }

  const fmtDT = (s) => {
    if (!s) return '—';
    
    // Pastikan waktu dianggap UTC (kalau dari server belum ada timezone)
    let iso = s;
    if (!s.endsWith('Z') && !s.includes('+') && !s.match(/-\d{2}:\d{2}$/)) {
      iso = s.replace(' ', 'T') + 'Z';
    }
    
    const d = new Date(iso);
    if (isNaN(d.getTime())) return s;
    
    // Format waktu di timezone Asia/Jakarta (WIB, GMT+7)
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
      hour12: false
    }).replace(/\./g, ':').replace(',', '');
  };

  const rows = logs.map(l => {
    const isNew = !l.viewed;
    const rowClass = isNew ? 'log-new' : 'log-seen';

    return `
      <tr class="${rowClass}">

        <td style="min-width:70px;">
          <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start;">
            <code style="font-size:0.68rem;">${escapeHtml(String(l.id || '—'))}</code>
            ${isNew ? '<span class="log-badge-new">BARU</span>' : ''}
          </div>
        </td>
        
        <td><small style="white-space:nowrap;">${fmtDT(l.visited_at)}</small></td>
        <td><code style="font-size:0.72rem;">${escapeHtml(l.ip || '—')}</code></td>
        <td>${escapeHtml(l.country || '—')}</td>
        <td>${escapeHtml(l.country_name || '—')}</td>
        <td>${escapeHtml(l.city || '—')}</td>
        <td>${escapeHtml(l.region || '—')}</td>
        <td><small>${escapeHtml(l.timezone || '—')}</small></td>
        <td><small>${escapeHtml(l.latitude || '—')}</small></td>
        <td><small>${escapeHtml(l.longitude || '—')}</small></td>
        <td><small style="color:#5a7373;">${escapeHtml(l.isp || '—')}</small></td>
        <td>${escapeHtml(l.browser || '—')}</td>
        <td><small>${escapeHtml(l.browser_version || '—')}</small></td>
        <td>${escapeHtml(l.os || '—')}</td>
        <td><span style="display:inline-block;padding:2px 8px;border-radius:50px;background:#e0f0f0;color:#1a5c5c;font-size:0.7rem;font-weight:700;">${escapeHtml(l.device_type || '—')}</span></td>
        <td><small style="color:#5a7373;">${escapeHtml((l.referer || 'Direct').substring(0, 50))}</small></td>
        <td><code style="font-size:0.7rem;">${escapeHtml(l.path || '/')}</code></td>
        <td><small style="color:#8b9494;font-size:0.68rem;">${escapeHtml((l.user_agent || '—').substring(0, 60))}${(l.user_agent || '').length > 60 ? '…' : ''}</small></td>
      </tr>
    `;
  }).join('');

  return `
    <div style="overflow-x:auto;max-height:65vh;overflow-y:auto;border:1px solid #e3ebeb;border-radius:8px;">
      <table style="width:100%;border-collapse:collapse;font-size:0.78rem;min-width:1800px;">
        <thead style="position:sticky;top:0;background:#1a5c5c;color:white;z-index:1;">
          <tr>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">ID</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Waktu (GMT+7)</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">IP</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Kode Negara</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Negara</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Kota</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Provinsi</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Timezone</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Lat</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Lon</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">ISP</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Browser</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Versi</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">OS</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Device</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Referer</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">Path</th>
            <th style="padding:10px 8px;text-align:left;font-size:0.68rem;text-transform:uppercase;white-space:nowrap;">User Agent</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    <div style="margin-top:12px;font-size:0.78rem;color:#5a7373;text-align:center;">
      Menampilkan ${logs.length} log terakhir 
      — <strong style="color:#1a5c5c;">${logs.filter(l => !l.viewed).length}</strong> log baru 
      — scroll horizontal untuk lihat semua kolom →
    </div>
  `;
}

document.querySelectorAll('[data-close-logs]').forEach(b =>
  b.addEventListener('click', () => {
    document.getElementById('modal-logs').classList.remove('open');
    updateAnalyticsBadge();
  }));

document.getElementById('modal-logs').addEventListener('click', (e) => {
  if (e.target.id === 'modal-logs') {
    document.getElementById('modal-logs').classList.remove('open');
    updateAnalyticsBadge();
  }
});

async function exportLogsCsv() {
  try {
    const data = await api('/analytics/logs?limit=500');
    const logs = data.logs || [];

    if (!logs.length) {
      alert('Belum ada log untuk di-export');
      return;
    }

    const headers = ['ID', 'Waktu', 'IP', 'Kode Negara', 'Negara', 'Kota', 'Provinsi',
                     'Timezone', 'Latitude', 'Longitude', 'ISP', 'Browser', 'Versi',
                     'OS', 'Device', 'Referer', 'Path', 'User Agent', 'Viewed', 'Viewed At'];

    const rows = logs.map(l => [
      l.id || '',
      l.visited_at || '',
      l.ip || '',
      l.country || '',
      l.country_name || '',
      l.city || '',
      l.region || '',
      l.timezone || '',
      l.latitude || '',
      l.longitude || '',
      l.isp || '',
      l.browser || '',
      l.browser_version || '',
      l.os || '',
      l.device_type || '',
      l.referer || '',
      l.path || '',
      l.user_agent || '',
      l.viewed ? 'Ya' : 'Belum',
      l.viewed_at || ''
    ]);

    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitor-logs-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Gagal export: ' + err.message);
  }
}

// ─── Users Modal ───────────────────────────────────────────
const modalUsers = document.getElementById('modal-users');
document.getElementById('btn-users').addEventListener('click', async () => {
  modalUsers.classList.add('open');
  await renderUsersList();
});
modalUsers.querySelectorAll('[data-close]').forEach(b =>
  b.addEventListener('click', () => modalUsers.classList.remove('open')));
modalUsers.addEventListener('click', e => {
  if (e.target === modalUsers) modalUsers.classList.remove('open');
});

async function renderUsersList() {
  const wrap = document.getElementById('users-list');
  if (USER.role !== 'owner') {
    wrap.innerHTML = '<p style="color:#5a7373;font-size:0.85rem;">Hanya owner yang dapat mengelola user.</p>';
    return;
  }
  try {
    const { users } = await api('/users');
    wrap.innerHTML = users.map(u => `
      <div class="user-item">
        <div class="u-info">
          <strong>${escapeHtml(u.username)}</strong>
          <small>${escapeHtml(u.nama_lengkap || '')} · ${escapeHtml(u.role)}</small>
        </div>
        ${u.username !== USER.username
          ? `<button class="btn-icon danger" data-deluser="${u.id}" title="Hapus">🗑️</button>`
          : '<small style="color:#5a7373;">(Anda)</small>'}
      </div>
    `).join('');

    wrap.querySelectorAll('[data-deluser]').forEach(b =>
      b.addEventListener('click', async () => {
        if (!confirm('Hapus user ini?')) return;
        try {
          await api(`/users/${b.dataset.deluser}`, { method: 'DELETE' });
          renderUsersList();
        } catch (err) { alert(err.message); }
      }));
  } catch (err) {
    wrap.innerHTML = `<p style="color:#e74c3c;">${escapeHtml(err.message)}</p>`;
  }
}

document.getElementById('form-user').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/users', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('u-username').value.trim(),
        password: document.getElementById('u-pass').value,
        nama_lengkap: document.getElementById('u-nama').value.trim(),
        role: document.getElementById('u-role').value,
      }),
    });
    e.target.reset();
    renderUsersList();
  } catch (err) { alert(err.message); }
});

// ─── Start ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════
// GLOBAL CLOSE HANDLER — Tutup Modal via Event Delegation
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// GLOBAL EVENT DELEGATION — Tutup Modal, Print, Upload
// ═══════════════════════════════════════════════════════════

document.addEventListener('click', (e) => {
  // ─── Tombol Tutup Modal ───
  if (e.target.closest('.inv-btn-close')) {
    const modal = e.target.closest('.invoice-modal');
    if (modal) {
      modal.classList.remove('open');
      return;
    }
  }
  
  // ─── Tombol Print / Simpan PDF ───
  const btnPrint = e.target.closest('.inv-btn-print');
  if (btnPrint && btnPrint.dataset.filename) {
    printDoc(btnPrint.dataset.filename);
    return;
  }
  
  // ─── Tombol Upload File (trigger file picker) ───
  const btnUpload = e.target.closest('[data-upload-trigger]');
  if (btnUpload) {
    const targetId = btnUpload.dataset.uploadTrigger;
    const input = document.getElementById(targetId);
    if (input) input.click();
    return;
  }

    // ─── Tombol Hapus File ───
  const btnDelete = e.target.closest('[data-delete-file]');
  if (btnDelete) {
    const key = btnDelete.dataset.deleteFile;
    const cfg = UPLOAD_CONFIGS.find(c => c.key === key);
    if (cfg) deleteUploadedFile(cfg);
    return;
  }
  
  // ─── Klik Backdrop Modal → TIDAK menutup ───
  // Semua modal (invoice, kuitansi, perjanjian, users, analytics, logs,
  // import-result, occ) hanya bisa ditutup via tombol close eksplisit.
  // Tidak ada auto-close via backdrop.
});

// ─── Event Delegation untuk Input File (change) ───
document.addEventListener('change', async (e) => {
  const input = e.target;
  if (!input.id) return;
  
  // Cek apakah input adalah salah satu dari UPLOAD_CONFIGS
  const cfg = UPLOAD_CONFIGS.find(c => c.key === input.id);
  if (!cfg) return;
  
  const file = input.files[0];
  if (!file) return;
  
  await uploadDokumen(file, cfg);
});


// ═══════════════════════════════════════════════════════════
// DISABLE ESC KEY untuk Tutup Modal
// ═══════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  // Cek apakah ada modal yang terbuka
  const openModals = document.querySelectorAll('.modal.open, .invoice-modal.open');
  if (openModals.length === 0) return;

  // Cegah default behavior
  e.preventDefault();
  e.stopPropagation();

  // Opsional: kasih feedback ke user
  // (biarkan silent, biar tidak mengganggu)
  return false;
}, true);

init().catch(err => {
  console.error(err);
  alert('Gagal memuat data: ' + err.message);
});
