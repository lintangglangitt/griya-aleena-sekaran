// ============================================================
// app.js - Griya Aleena Sekaran
// Versi: 7.0 (Anti-Slop revision 2026-09-18)
// ============================================================

// ─── GLOBAL ──────────────────────────────────────────────────────
let CONFIG = null;
const API = 'https://griya-api.lintangglangitt.workers.dev';

// ─── HELPER FUNCTIONS ──────────────────────────────────────────
function formatRupiah(num) {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  return 'Rp' + new Intl.NumberFormat('id-ID').format(num);
}

// Format tanggal ke Bahasa Indonesia
function formatTanggalIndonesia(isoString) {
  const bulanID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "-";
  return `${d.getDate()} ${bulanID[d.getMonth()]} ${d.getFullYear()}`;
}

// Generate syarat early bird dari countdown.target
function getEarlyBirdRequirement(countdownTarget) {
  if (!countdownTarget) return "Booking kamar sebelum batas waktu yang ditentukan.";
  return `Booking kamar sebelum ${formatTanggalIndonesia(countdownTarget)}.`;
}

// ─── LOAD CONFIG ──────────────────────────────────────────────
async function loadConfig() {
  try {
    const timestamp = new Date().getTime();
    const response = await fetch(`./config.json?v=${timestamp}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    CONFIG = await response.json();
    renderAll(CONFIG);
    console.log('Config loaded successfully');
  } catch (error) {
    console.error('Load config error:', error);
    document.body.innerHTML = `
      <div style="padding:40px;text-align:center;font-family:sans-serif;">
        <h2>Gagal memuat data</h2>
        <p>${error.message}</p>
        <button onclick="location.reload()" style="padding:10px 24px;margin-top:16px;cursor:pointer;">Refresh</button>
      </div>
    `;
  }
}

// ─── RENDER ALL ─────────────────────────────────────────────────
function renderAll(c) {
  renderMeta(c);
  renderNav(c);
  renderHero(c);
  renderChips(c);
  renderGaleri(c);
  renderFasilitas(c);
  renderFasilitasPlus(c);
  renderPricing(c);
  renderInfoHarianMingguan(c);
  renderEarlyBird(c);
  renderSpecialRequirements(c);
  renderLokasi(c);
  renderContacts(c);
  renderFloatingWA(c);
  renderFooter(c);
  renderHeroCTA(c);
  initCounter();

  console.log('All sections rendered');
}

// ─── 1. META & OG ──────────────────────────────────────────────
function renderMeta(c) {
  const s = c.site || {};
  const title = s.title || 'Griya Aleena Sekaran';
  const desc = s.metaDescription || s.heroSub || 'Kos Putri Kampus UNNES';
  const url = s.url || window.location.href;

  document.title = title + (s.titleSuffix || ' , Kos Putri Kampus UNNES');
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const ogUrl = document.querySelector('meta[property="og:url"]');

  if (ogTitle) ogTitle.setAttribute('content', title + ' , Kos Putri Kampus UNNES');
  if (ogDesc) ogDesc.setAttribute('content', desc);
  if (ogUrl) ogUrl.setAttribute('content', url);

  const schema = c.schema || {};
  const schemaData = {
    "@context": "https://schema.org",
    "@type": schema.type || "LodgingBusiness",
    "name": title,
    "description": schema.description || desc,
    "address": schema.address || {
      "@type": "PostalAddress",
      "streetAddress": "Sekaran",
      "addressLocality": "Gunungpati",
      "addressRegion": "Semarang",
      "addressCountry": "ID"
    },
    "telephone": schema.telephone || "+628985446121",
    "url": url,
    "priceRange": schema.priceRange || "Rp800.000 sampai Rp1.100.000/bulan"
  };

  document.querySelectorAll('script[type="application/ld+json"]').forEach(el => el.remove());
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schemaData);
  document.head.appendChild(script);

  console.log('Meta & Schema updated');
}

// ─── 2. NAV ─────────────────────────────────────────────────────
function renderNav(c) {
  const s = c.site || {};
  const brand = document.getElementById('nav-brand-name');
  const sub = document.getElementById('nav-brand-sub');
  const cta = document.getElementById('nav-cta');

  if (brand) brand.textContent = s.navbarTitle || s.titleBrowser || s.title || 'Griya Aleena Sekaran';
  if (sub) sub.innerHTML = s.navbarSubtitle || s.tagline || 'Kos Putri Kampus UNNES';
  if (cta) cta.textContent = s.navCta || 'Pesan Kamar';
}

// ─── 3. HERO ────────────────────────────────────────────────────
function renderHero(c) {
  const s = c.site || {};
  const title = document.getElementById('hero-title');
  const subtitle = document.getElementById('hero-subtitle');
  const sub = document.getElementById('hero-sub');
  const badge2 = document.getElementById('hero-badge2');
  const cdLabel2 = document.getElementById('countdown-label-2');

  if (title) title.textContent = s.heroTitle || s.title || 'GRIYA ALEENA SEKARAN';
  if (subtitle) subtitle.innerHTML = s.heroSubtitle || s.tagline || 'Kos Putri<br>UNIVERSITAS NEGERI SEMARANG';
  if (sub) sub.textContent = s.heroSub || 'Fasilitas Lengkap. Harga Terjangkau.';

  if (badge2 && s.heroBadge2) {
    badge2.innerHTML = `<span class="badge-dot"></span> ${s.heroBadge2}`;
  }

  if (cdLabel2) {
    cdLabel2.textContent = 'Tersedia diskon early bird dan diskon prestasi/kurang mampu.';
  }
}

// ─── 4. CHIPS ────────────────────────────────────────────────────
function renderChips(c) {
  const container = document.getElementById('hero-chips');
  if (!container) return;
  const chips = c.heroChips || ['Kamar mandi dalam', 'AC / Non-AC', 'WiFi gratis'];
  container.innerHTML = chips.map(chip => `<span class="chip">${chip}</span>`).join('');
}

// ─── 5. HERO CTA ───────────────────────────────────────────────
function renderHeroCTA(c) {
  const container = document.getElementById('hero-cta-row');
  if (!container) return;
  const ctas = c.heroCtas || [
    { text: 'Pesan Kamar', href: 'https://wa.me/628985446121', class: 'btn-primary' },
    { text: 'Lihat Fasilitas', href: '#fasilitas', class: 'btn-outline' }
  ];
  container.innerHTML = ctas.map(cta => {
    const isExternal = /^https?:\/\//.test(cta.href);
    const extAttrs = isExternal ? ' target="_blank" rel="noopener"' : '';
    return `<a class="${cta.class}" href="${cta.href}"${extAttrs}>${cta.text}</a>`;
  }).join('');
}

// ─── 6. GALERI ──────────────────────────────────────────────────
function renderGaleri(c) {
  const title = document.getElementById('galeri-title');
  const desc = document.getElementById('galeri-desc');
  const container = document.getElementById('galeri-grid');

  if (title) title.innerHTML = c.galeriTitle || 'Lihat Sendiri,<br>Bangunan Baru & Bersih';
  if (desc) desc.textContent = c.galeriDesc || 'Kamar dan fasilitas siap ditempati.';

  if (!container) return;
  const items = c.galeri || [];
  container.innerHTML = items.map((item, i) => `
    <div class="galeri-item ${i === 0 ? 'main' : ''}" data-src="${item.src}">
      <img src="${item.src}" alt="${item.alt}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="no-image" style="display:none;">
        <span>${item.emoji || '📷'}</span>
        <p>${item.label || 'Foto'}<br><small>Foto segera hadir</small></p>
      </div>
    </div>
  `).join('');
}

// ─── 7. FASILITAS ──────────────────────────────────────────────
function renderFasilitas(c) {
  const eye = document.getElementById('fasilitas-eye');
  const title = document.getElementById('fasilitas-title');
  const desc = document.getElementById('fasilitas-desc');
  const container = document.getElementById('fas-grid');

  if (eye) eye.textContent = c.fasilitasEye || 'Fasilitas Lengkap';
  if (title) title.innerHTML = c.fasilitasTitle || 'Semua yang Kamu Butuhkan<br>Sudah Tersedia';
  if (desc) desc.textContent = c.fasilitasDesc || 'Kamar dirancang nyaman dan fungsional.';

  if (!container) return;
  const items = c.fasilitas || [];
  container.innerHTML = items.map(item => `
    <div class="fas-card">
      <div class="fas-icon amber">${item.emoji || '📦'}</div>
      <div class="fas-text">
        <h4>${item.text || 'Fasilitas'}</h4>
        <p>${item.desc || ''}</p>
      </div>
    </div>
  `).join('');
}

// ─── 8. FASILITAS PLUS ────────────────────────────────────────
function renderFasilitasPlus(c) {
  const title = document.getElementById('plus-title');
  const container = document.getElementById('plus-list');

  if (title) title.textContent = c.plusTitle || 'Kenyamanan Adalah Prioritas';

  if (!container) return;
  const items = c.fasilitasPlus || [];
  container.innerHTML = items.map(item => `
    <div class="plus-item">
      <div class="plus-check">✓</div>
      <p>${item}</p>
    </div>
  `).join('');
}

// ─── 9. PRICING ───────────────────────────────────────────────
function renderPricing(c) {
  const eye = document.getElementById('harga-eye');
  const title = document.getElementById('harga-title');
  const desc = document.getElementById('harga-desc');
  const container = document.getElementById('harga-container');

  if (eye) eye.textContent = c.hargaEye || 'Harga Terjangkau';
  if (title) title.innerHTML = c.hargaTitle || 'Harga Kamar dan Diskon';
  if (desc) desc.textContent = c.hargaDesc || 'Pilih durasi yang sesuai kantong kamu. 1 kamar untuk 1 orang.';

  if (!container) return;
  const pricing = c.pricing;
  if (!pricing) {
    container.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;">Data harga belum tersedia</p>';
    return;
  }

  const version = pricing.version || 1;
  const acData = pricing.ac;
  const nonacData = pricing.nonac;

  let cards = [];
  if (acData) {
    cards.push(buildPriceCard(acData, 'AC', '❄️', 'ac-badge', version));
  }
  if (nonacData) {
    cards.push(buildPriceCard(nonacData, 'Non-AC', '🌀', 'nonac-badge', version));
  }

  if (cards.length === 0) {
    container.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;">Data harga belum tersedia</p>';
    return;
  }

  container.innerHTML = `
    <div class="harga-cards">${cards.join('')}</div>
  `;
}

function buildPriceCard(data, type, emoji, badgeClass, version = 1) {
  const { monthly, semesterMonths, yearMonths, semesterEB, yearEB, semesterSpecial, yearSpecial } = data;
  const semesterBase = monthly * semesterMonths;
  const yearBase = monthly * yearMonths;

  // Versi 1: tanpa nominal diskon spesial
  if (version === 1) {
    return `
      <div class="harga-card featured">
        <div class="room-type-badge ${badgeClass}">${emoji} Kamar ${type}</div>
        <div class="price-segment">
          <div class="harga-durasi">Bulanan</div>
          <div class="harga-price-row">
            <span class="harga-normal">${formatRupiah(monthly)}</span>
            <span class="harga-period">/ bulan</span>
          </div>
        </div>
        <div class="price-sep"></div>
        <div class="price-segment">
          <div class="harga-durasi">Semesteran (${semesterMonths} Bulan)</div>
          <div class="price-calc-row">${semesterMonths} x ${formatRupiah(monthly)} = <span class="calc-base">${formatRupiah(semesterBase)}</span></div>
          <div class="price-calc-row early">Diskon Early Bird: Potongan ${formatRupiah(semesterEB)} menjadi <span class="calc-early">${formatRupiah(semesterBase - semesterEB)}</span></div>
          <div class="price-calc-row spesial">Diskon Prestasi/Kurang Mampu: <a href="#kontak" class="btn-hubungi-kami">Tanya Syaratnya</a></div>
        </div>
        <div class="price-sep"></div>
        <div class="price-segment">
          <div class="harga-durasi">Tahunan (${yearMonths} Bulan) <span class="hemat-tag">Paling Hemat</span></div>
          <div class="price-calc-row">${yearMonths} x ${formatRupiah(monthly)} = <span class="calc-base">${formatRupiah(yearBase)}</span></div>
          <div class="price-calc-row early">Diskon Early Bird: Potongan ${formatRupiah(yearEB)} menjadi <span class="calc-early">${formatRupiah(yearBase - yearEB)}</span></div>
          <div class="price-calc-row spesial">Diskon Prestasi/Kurang Mampu: <a href="#kontak" class="btn-hubungi-kami">Tanya Syaratnya</a></div>
        </div>
      </div>
    `;
  }

  // Versi 2: menampilkan nominal diskon spesial
  if (version === 2) {
    return `
      <div class="harga-card featured">
        <div class="room-type-badge ${badgeClass}">${emoji} Kamar ${type}</div>
        <div class="price-segment">
          <div class="harga-durasi">Bulanan</div>
          <div class="harga-price-row">
            <span class="harga-normal">${formatRupiah(monthly)}</span>
            <span class="harga-period">/ bulan</span>
          </div>
        </div>
        <div class="price-sep"></div>
        <div class="price-segment">
          <div class="harga-durasi">Semesteran (${semesterMonths} Bulan)</div>
          <div class="price-calc-row">${semesterMonths} x ${formatRupiah(monthly)} = <span class="calc-base">${formatRupiah(semesterBase)}</span></div>
          <div class="price-calc-row early">Diskon Early Bird: Potongan ${formatRupiah(semesterEB)} menjadi <span class="calc-early">${formatRupiah(semesterBase - semesterEB)}</span></div>
          <div class="price-calc-row spesial">Diskon Prestasi/Kurang Mampu: Potongan ${formatRupiah(semesterSpecial)} menjadi <span class="calc-spesial">${formatRupiah(semesterBase - semesterSpecial)}</span> <a href="#kontak" class="btn-hubungi-kami">Tanya Syaratnya</a></div>
        </div>
        <div class="price-sep"></div>
        <div class="price-segment">
          <div class="harga-durasi">Tahunan (${yearMonths} Bulan) <span class="hemat-tag">Paling Hemat</span></div>
          <div class="price-calc-row">${yearMonths} x ${formatRupiah(monthly)} = <span class="calc-base">${formatRupiah(yearBase)}</span></div>
          <div class="price-calc-row early">Diskon Early Bird: Potongan ${formatRupiah(yearEB)} menjadi <span class="calc-early">${formatRupiah(yearBase - yearEB)}</span></div>
          <div class="price-calc-row spesial">Diskon Prestasi/Kurang Mampu: Potongan ${formatRupiah(yearSpecial)} menjadi <span class="calc-spesial">${formatRupiah(yearBase - yearSpecial)}</span> <a href="#kontak" class="btn-hubungi-kami">Tanya Syaratnya</a></div>
        </div>
      </div>
    `;
  }
}

// ─── 10. INFO HARIAN & MINGGUAN ─────────────────────────────
function renderInfoHarianMingguan(c) {
  const container = document.getElementById('info-harian-mingguan-container');
  if (!container) return;

  container.innerHTML = `
    <div class="info-harian-mingguan">
      <h4>Tersedia Kamar Harian & Mingguan</h4>
      <p>Untuk keluarga yang sedang menghadiri wisuda.</p>
      <p class="info-harga-note">Harga sewa silakan <a href="#kontak">hubungi pemilik</a>.</p>
    </div>
  `;
}

// ─── 11. EARLY BIRD ────────────────────────────────────────────
function renderEarlyBird(c) {
  const container = document.getElementById('early-bird-container');
  if (!container) return;

  const req = getEarlyBirdRequirement(c.countdown?.target);

  container.innerHTML = `
    <div class="diskon-syarat">
      <h4>Syarat Diskon Early Bird</h4>
      <div class="syarat-item"><p>${req}</p></div>
    </div>
  `;
}

// ─── 12. SPECIAL REQUIREMENTS ──────────────────────────────────
function renderSpecialRequirements(c) {
  const container = document.getElementById('diskon-syarat-container');
  if (!container) return;
  const req = c.specialRequirements;
  if (!req) { container.innerHTML = ''; return; }

  let itemsHtml = '';
  Object.keys(req).forEach((key) => {
    const section = req[key];
    if (!section?.items) return;
    const items = section.items.map(item => `<li>${item}</li>`).join('');
    itemsHtml += `
      <div class="syarat-item">
        <h5>${section.title || ''}</h5>
        <ul>${items}</ul>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="diskon-syarat">
      <h4>Syarat Diskon Prestasi/Kurang Mampu</h4>
      <div class="syarat-grid">${itemsHtml}</div>
    </div>
  `;
}

// ─── 13. LOKASI ────────────────────────────────────────────────
function renderLokasi(c) {
  const eye = document.getElementById('lokasi-eye');
  const title = document.getElementById('lokasi-title');
  const iframe = document.getElementById('maps-iframe');
  const jarakContainer = document.getElementById('jarak-list');

  if (eye) eye.textContent = c.lokasiEye || 'Lokasi Strategis';
  if (title) title.innerHTML = c.lokasiTitle || 'Di Jantung Sekaran,<br>Mana-mana Dekat';
  if (iframe && c.location?.mapsUrl) iframe.src = c.location.mapsUrl;

  if (!jarakContainer) return;
  const jarak = c.jarak || [];
  jarakContainer.innerHTML = jarak.map(item => `
    <div class="jarak-item">
      <span class="jarak-icon">${item.icon || '📍'}</span>
      <div class="jarak-info">
        <h5>${item.title || ''}</h5>
        <p>${item.desc || ''}</p>
      </div>
      <span class="jarak-time">${item.time || ''}</span>
    </div>
  `).join('');
}

// ─── 14. KONTAK ─────────────────────────────────────────────────
function renderContacts(c) {
  const title = document.getElementById('kontak-title');
  const note = document.getElementById('kontak-note');
  const container = document.getElementById('kontak-cards-wrap');

  if (title) title.textContent = c.kontakTitle || 'Hubungi Pemilik Langsung';
  if (note) note.innerHTML = c.kontakNote || 'Langsung hubungi pemilik tanpa perantara<br>cepat, mudah, dan bisa tanya apa saja.';

  if (!container) return;
  const contacts = c.contacts || [];
  if (!contacts.length) {
    container.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;">Kontak belum tersedia</p>';
    return;
  }

  container.innerHTML = `
    <div style="display:flex; justify-content:center; margin-top:36px;">
      <div class="kontak-card">
        <div class="k-label">${c.kontakLabel || 'Hubungi Langsung'}</div>
        <div class="k-divider"></div>
        ${contacts.map((contact, i) => {
          const waUrl = buildWhatsAppUrl(contact.wa, contact.name);
          return `
            <div class="k-item">
              <div class="k-name">${contact.name || 'Kontak'}</div>
              <a class="wa-btn" href="${waUrl}" target="_blank" rel="noopener">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <span>WhatsApp</span>
              </a>
            </div>
            ${i < contacts.length - 1 ? '<div class="k-item-spacer"></div>' : ''}
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function getWhatsAppTemplate(contactName = '') {
  const template = CONFIG?.whatsapp?.template || 'Assalamu\'alaikum,\nSaya ingin bertanya tentang kos putri Griya Aleena Sekaran.';
  return encodeURIComponent(template.replace(/{name}/g, contactName || ''));
}

function buildWhatsAppUrl(phoneNumber, contactName = '') {
  const clean = phoneNumber.replace(/[^0-9]/g, '');
  const waNumber = clean.startsWith('62') ? clean : '62' + clean;
  return `https://wa.me/${waNumber}?text=${getWhatsAppTemplate(contactName)}`;
}

function renderFloatingWA(c) {
  const btn = document.getElementById('floating-wa');
  if (!btn) return;
  const contacts = c.contacts || [];
  if (!contacts.length) return;
  btn.href = buildWhatsAppUrl(contacts[0].wa, contacts[0].name);
}

// ─── 15. FOOTER ─────────────────────────────────────────────────
function renderFooter(c) {
  const brand = document.getElementById('footer-brand');
  const year = document.getElementById('footer-year');
  if (brand) brand.textContent = c.site?.titleBrowser || c.site?.title || 'Griya Aleena Sekaran';
  if (year) year.textContent = c.site?.footerYear || new Date().getFullYear();
}

// ─── HIT COUNTER ──────────────────────────────────────────────
async function initCounter() {
  const el = document.getElementById('hc-num');
  const div = document.getElementById('hit-counter');
  if (!el || !div) return;

  const today = new Date().toDateString();
  const lastVisit = localStorage.getItem('griya_last_visit');
  const isNewDay = (lastVisit !== today);
  const sessionVisited = sessionStorage.getItem('counter_visited');

  try {
    let res;
    if (isNewDay || !sessionVisited) {
      res = await fetch(`${API}/increment`, { method: 'POST' });
      localStorage.setItem('griya_last_visit', today);
      sessionStorage.setItem('counter_visited', '1');
    } else {
      res = await fetch(`${API}/count`);
    }
    const data = await res.json();
    if (typeof data.count !== 'number') throw new Error('Data counter tidak valid');
    el.textContent = Number(data.count).toLocaleString('id-ID');
    div.style.display = 'block';
  } catch (error) {
    // API gagal atau data tidak valid: jangan tampilkan angka apa pun.
    // Angka pengunjung tidak boleh dikarang (DESIGN.md bagian 6 dan 16).
    console.error('Counter error:', error);
    div.style.display = 'none';
  }
}

// ─── INIT ──────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadConfig);
} else {
  loadConfig();
}

console.log('app.js v7.0 - Anti-Slop revision');