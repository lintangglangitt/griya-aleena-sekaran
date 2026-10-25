// ngadmin-mobile.js — navigasi bawah, tombol tambah, menu Lainnya, banner install
(function () {
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  // ── Beri id pada section berdasarkan judulnya ──
  const sectionByTitle = (text) =>
    [...document.querySelectorAll('.section-block')].find(s =>
      (s.querySelector('.section-h')?.textContent || '').includes(text));

  const secKamar = sectionByTitle('Status Kamar');
  const secPenyewa = sectionByTitle('Riwayat Penyewa');
  const secRiwayat = sectionByTitle('Riwayat Okupansi');
  const secIncome = sectionByTitle('Riwayat Pemasukan');
  if (secKamar) secKamar.id = 'sec-kamar';
  if (secPenyewa) secPenyewa.id = 'sec-penyewa';
  if (secRiwayat) secRiwayat.id = 'sec-riwayat';
  if (secIncome) secIncome.id = 'sec-income';

  // ── Banner install ──
  const banner = document.createElement('div');
  banner.className = 'm-install';
  banner.innerHTML = `
    <div class="txt"><strong>Pasang aplikasi di HP</strong><br>Buka dashboard langsung dari layar utama.</div>
    <button class="go" type="button">Pasang</button>
    <button class="x" type="button" aria-label="Tutup">✕</button>`;
  const header = document.querySelector('.admin-header');
  header?.insertAdjacentElement('afterend', banner);

  function updateBanner() {
    const dismissed = localStorage.getItem('ga_install_dismissed') === '1';
    const can = !!window.__installPrompt && !window.isStandalone?.() && !dismissed;
    banner.classList.toggle('show', can);
  }
  banner.querySelector('.go').addEventListener('click', async () => { await window.triggerInstall?.(); updateBanner(); });
  banner.querySelector('.x').addEventListener('click', () => { localStorage.setItem('ga_install_dismissed', '1'); updateBanner(); });
  document.addEventListener('pwa-installable', updateBanner);
  document.addEventListener('pwa-installed', updateBanner);

  // ── Navigasi bawah ──
  const nav = document.createElement('nav');
  nav.className = 'm-nav';
  nav.setAttribute('aria-label', 'Navigasi utama');
  nav.innerHTML = `
    <button type="button" data-go="top"><span class="ic">🏠</span>Beranda</button>
    <button type="button" data-go="sec-kamar"><span class="ic">🛏️</span>Kamar</button>
    <button type="button" data-go="sec-penyewa"><span class="ic">👥</span>Penyewa</button>
    <button type="button" data-go="sec-income"><span class="ic">💰</span>Pemasukan</button>
    <button type="button" data-more><span class="ic">☰</span>Lainnya<span class="m-badge" id="m-more-badge" style="display:none"></span></button>`;
  document.body.appendChild(nav);

  // ── Tombol + melayang ──
  const fab = document.createElement('button');
  fab.className = 'm-fab';
  fab.type = 'button';
  fab.innerHTML = '<span class="ic">＋</span>Penyewa';
  fab.setAttribute('aria-label', 'Tambah penyewa');
  fab.addEventListener('click', () => document.getElementById('btn-add')?.click());
  document.body.appendChild(fab);

  // ── Menu Lainnya ──
  const backdrop = document.createElement('div');
  backdrop.className = 'm-sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'm-sheet';
  sheet.setAttribute('role', 'dialog');
  const userName = document.getElementById('user-name')?.textContent || '';
  const showUsers = document.getElementById('btn-users')?.style.display !== 'none';
  sheet.innerHTML = `
    <div class="grip"></div>
    <div class="who">Masuk sebagai <strong id="m-who">${userName}</strong></div>
    <button class="m-sheet-item" data-act="analytics"><span class="ic">📊</span>Analitik pengunjung<span class="m-badge" id="m-an-badge" style="display:none"></span></button>
    ${showUsers ? '<button class="m-sheet-item" data-act="users"><span class="ic">👤</span>Kelola user</button>' : ''}
    <button class="m-sheet-item" data-act="riwayat"><span class="ic">📅</span>Riwayat per kamar</button>
    <button class="m-sheet-item" data-act="db"><span class="ic">🗄️</span>Database &amp; backup</button>
    <button class="m-sheet-item" data-act="tatib"><span class="ic">📋</span>Tata tertib</button>
    <button class="m-sheet-item" data-act="install" id="m-install-item" style="display:none"><span class="ic">📲</span>Pasang aplikasi</button>
    <button class="m-sheet-item" data-act="reload"><span class="ic">🔄</span>Muat ulang data</button>
    <button class="m-sheet-item danger" data-act="logout"><span class="ic">🚪</span>Keluar</button>`;
  document.body.append(backdrop, sheet);

  const openSheet = () => {
    document.getElementById('m-who').textContent = document.getElementById('user-name')?.textContent || '';
    document.getElementById('m-install-item').style.display =
      (window.__installPrompt && !window.isStandalone?.()) ? 'flex' : 'none';
    backdrop.classList.add('open'); sheet.classList.add('open');
  };
  const closeSheet = () => { backdrop.classList.remove('open'); sheet.classList.remove('open'); };
  backdrop.addEventListener('click', closeSheet);

  sheet.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    closeSheet();
    switch (b.dataset.act) {
      case 'analytics': document.getElementById('btn-analytics')?.click(); break;
      case 'users':     document.getElementById('btn-users')?.click(); break;
      case 'riwayat':   document.getElementById('sec-riwayat')?.scrollIntoView({ behavior: 'smooth' }); break;
      case 'db':        location.href = 'dbkuy.html'; break;
      case 'tatib':     location.href = 'tatib.html'; break;
      case 'install':   await window.triggerInstall?.(); break;
      case 'reload':    location.reload(); break;
      case 'logout':    document.getElementById('btn-logout')?.click(); break;
    }
  });

  // ── Klik nav ──
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-more')) { openSheet(); return; }
    const go = b.dataset.go;
    if (go === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else document.getElementById(go)?.scrollIntoView({ behavior: 'smooth' });
  });

  // ── Penanda tab aktif saat scroll ──
  const order = [
    ['top', null],
    ['sec-kamar', secKamar],
    ['sec-penyewa', secPenyewa],
    ['sec-income', secIncome],
  ];
  function markActive() {
    let current = 'top';
    const y = window.scrollY + 120;
    for (const [key, el] of order) {
      if (el && el.offsetTop <= y) current = key;
    }
    // riwayat per kamar masih bagian dari "Penyewa"
    if (secRiwayat && secRiwayat.offsetTop <= y && (!secIncome || secIncome.offsetTop > y)) current = 'sec-penyewa';
    nav.querySelectorAll('[data-go]').forEach(b => b.classList.toggle('active', b.dataset.go === current));
  }
  window.addEventListener('scroll', markActive, { passive: true });
  markActive();

  // ── Salin badge analitik ke menu ──
  const srcBadge = document.getElementById('analytics-badge');
  function syncBadge() {
    const show = srcBadge && srcBadge.style.display !== 'none' && srcBadge.textContent.trim() !== '0';
    ['m-more-badge', 'm-an-badge'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.display = show ? 'inline-block' : 'none';
      el.textContent = show ? srcBadge.textContent : '';
    });
  }
  if (srcBadge) {
    new MutationObserver(syncBadge).observe(srcBadge, { attributes: true, childList: true, characterData: true, subtree: true });
    syncBadge();
  }

  // Tombol Back Android: tutup menu dulu bila terbuka
  window.addEventListener('popstate', closeSheet);
})();
