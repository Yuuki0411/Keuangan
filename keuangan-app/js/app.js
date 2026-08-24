'use strict';

const GUEST_KEY = 'keuangan_app_v2_lokal';
const CFG_KEY = 'keuangan_cfg';

const DEVICE_ID = (() => {
  let d = localStorage.getItem('keuangan_device');
  if (!d) { d = 'dev-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('keuangan_device', d); }
  return d;
})();

function getConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (c && c.url && c.key) return c;
  } catch (e) {}
  if (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL && typeof SUPABASE_ANON_KEY !== 'undefined' && SUPABASE_ANON_KEY)
    return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
  return null;
}

let sb = null;
let cloudAktif = false;
let currentUser = null;
let storeKey = GUEST_KEY;
let db = { records: {}, lastSync: null };

function muatDb() {
  try {
    const raw = localStorage.getItem(storeKey);
    if (raw) { const p = JSON.parse(raw); if (p && p.records) return p; }
  } catch (e) {}
  return { records: {}, lastSync: null };
}
const save = () => localStorage.setItem(storeKey, JSON.stringify(db));

(function migrasiVersiLama() {
  if (localStorage.getItem('keuangan_migrasi_v2')) return;
  let lama = JSON.parse(localStorage.getItem('alurKeuangan_data') || '[]');
  const v1 = JSON.parse(localStorage.getItem('keuangan_app_v1') || 'null');
  if (v1 && v1.records) lama = lama.concat(Object.values(v1.records));
  const tamu = JSON.parse(localStorage.getItem(GUEST_KEY) || '{"records":{}}');
  for (const t of lama) {
    const id = String(t.id);
    if (!tamu.records[id]) {
      tamu.records[id] = {
        id, jenis: t.jenis, jumlah: Number(t.jumlah), ket: t.ket || '',
        tanggal: t.tanggal, jam: t.jam || '', deleted: false, device: DEVICE_ID,
        updated_at: new Date().toISOString()
      };
    }
  }
  localStorage.setItem(GUEST_KEY, JSON.stringify(tamu));
  localStorage.setItem('keuangan_migrasi_v2', '1');
})();

function initCloud() {
  const cfg = getConfig();
  cloudAktif = !!cfg;
  sb = null;
  if (cfg && typeof supabase !== 'undefined') {
    try { sb = supabase.createClient(cfg.url, cfg.key); } catch (e) { sb = null; cloudAktif = false; }
  }
}

function setUser(u, langsungSync) {
  const sebelum = currentUser;
  currentUser = u;
  storeKey = u ? 'keuangan_app_v2_' + u.id : GUEST_KEY;
  db = muatDb();
  if (u) {
    tampilkanApp();
    $('akunInfo').textContent = 'Masuk sebagai: ' + (u.email || u.id);
    $('btnAksiAkun').textContent = '🚪 Keluar Akun';
    renderSemua();
    if (langsungSync || !sebelum) syncNow(false);
  } else {
    $('akunInfo').textContent = 'Tidak ada akun aktif (mode lokal — data hanya di perangkat ini).';
    $('btnAksiAkun').textContent = '🔐 Masuk / Daftar';
    renderSemua();
    if (cloudAktif && !lewatiLoginAktif()) tampilkanLogin();
  }
}

function lewatiLoginAktif() { return sessionStorage.getItem('keuangan_lewati') === '1'; }

function tampilkanLogin() {
  $('loginScreen').style.display = 'flex';
  $('loginMsg').textContent = '';
  $('loginPass').value = '';
}
function tampilkanApp() {
  $('loginScreen').style.display = 'none';
  sessionStorage.removeItem('kewangan_dummy');
  sessionStorage.removeItem('keuangan_lewati');
}
function lewatiLogin() {
  sessionStorage.setItem('keuangan_lewati', '1');
  tampilkanApp();
  updateStatusCloud('lokal');
}

function setLoginMsg(teks, err) {
  const el = $('loginMsg');
  el.textContent = teks || '';
  el.classList.toggle('err', !!err);
}

async function masuk() {
  if (!sb) { setLoginMsg('Koneksi Supabase belum diisi di tab Setelan.', true); return; }
  const email = $('loginEmail').value.trim();
  const pass = $('loginPass').value;
  if (!email || !pass) { setLoginMsg('Isi email dan password.', true); return; }
  $('btnLoginMasuk').disabled = true;
  setLoginMsg('Memproses…');
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  $('btnLoginMasuk').disabled = false;
  if (error) setLoginMsg('Gagal: ' + error.message, true);
}

async function daftar() {
  if (!sb) { setLoginMsg('Koneksi Supabase belum diisi di tab Setelan.', true); return; }
  const email = $('loginEmail').value.trim();
  const pass = $('loginPass').value;
  if (!email || pass.length < 6) { setLoginMsg('Isi email dan password minimal 6 karakter.', true); return; }
  $('btnLoginDaftar').disabled = true;
  setLoginMsg('Mendaftarkan…');
  const { data, error } = await sb.auth.signUp({ email, password: pass });
  $('btnLoginDaftar').disabled = false;
  if (error) { setLoginMsg('Gagal: ' + error.message, true); return; }
  if (data.session) { setLoginMsg('Akun dibuat & langsung masuk.'); }
  else { setLoginMsg('Akun dibuat. Buka email untuk verifikasi, lalu tekan Masuk.', false); }
}

async function keluarAkun() {
  if (sb) await sb.auth.signOut();
}

function aksiAkun() {
  if (currentUser) {
    if (confirm('Keluar dari akun ' + (currentUser.email || '') + '? Data cloud tetap aman dan muncul lagi saat login.')) keluarAkun();
  } else {
    sessionStorage.removeItem('keuangan_lewati');
    tampilkanLogin();
  }
}

function simpanCfg() {
  const url = $('cfgUrl').value.trim();
  const key = $('cfgKey').value.trim();
  if (!url || !key) { alert('Isi Project URL dan anon key terlebih dahulu.'); return; }
  localStorage.setItem(CFG_KEY, JSON.stringify({ url, key }));
  location.reload();
}
function hapusCfg() {
  if (!confirm('Hapus konfigurasi koneksi cloud dari perangkat ini?')) return;
  localStorage.removeItem(CFG_KEY);
  location.reload();
}

let jenisAktif = 'keluar';
let grafik = null;
let syncTimer = null;
let sedangSync = false;
let deferredPrompt = null;

const $ = id => document.getElementById(id);
const formatRupiah = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const hariIni = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const tanggalIndo = iso => new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function dataAktif() {
  const f = $('filterBulan').value;
  let arr = Object.values(db.records).filter(t => !t.deleted);
  if (f) arr = arr.filter(t => t.tanggal.startsWith(f));
  return arr.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || (b.id > a.id ? 1 : -1));
}

function setJenis(j) {
  jenisAktif = j;
  $('btnJenisMasuk').className = j === 'masuk' ? 'aktif' : '';
  $('btnJenisKeluar').className = j === 'keluar' ? 'aktif' : '';
  $('btnSimpan').style.background = j === 'masuk' ? '#16a34a' : '#2563eb';
}

function tambahTransaksi(e) {
  e.preventDefault();
  const jumlah = parseFloat($('jumlah').value);
  const ket = $('keterangan').value.trim();
  const tanggal = $('tanggal').value || hariIni();
  if (!jumlah || jumlah <= 0 || !ket) return;
  const id = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  db.records[id] = {
    id, jenis: jenisAktif, jumlah, ket, tanggal,
    jam: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    deleted: false, device: DEVICE_ID, updated_at: new Date().toISOString(),
    user_id: currentUser ? currentUser.id : null
  };
  save(); renderSemua(); jadwalkanSync();
  e.target.reset();
  $('tanggal').value = hariIni();
  setJenis(jenisAktif);
  if (navigator.vibrate) navigator.vibrate(15);
}

function hapusTransaksi(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  if (db.records[id]) {
    db.records[id].deleted = true;
    db.records[id].updated_at = new Date().toISOString();
    db.records[id].device = DEVICE_ID;
    save(); renderSemua(); jadwalkanSync();
  }
}

function resetFilter() { $('filterBulan').value = ''; renderSemua(); }

function renderBeranda() {
  const arr = dataAktif();
  const masuk = arr.filter(t => t.jenis === 'masuk').reduce((s, t) => s + Number(t.jumlah), 0);
  const keluar = arr.filter(t => t.jenis === 'keluar').reduce((s, t) => s + Number(t.jumlah), 0);
  const saldo = masuk - keluar;
  $('chipMasuk').textContent = formatRupiah(masuk);
  $('chipKeluar').textContent = formatRupiah(keluar);
  $('chipSaldo').textContent = formatRupiah(saldo);
  const sbEl = $('saldoBesar');
  sbEl.textContent = formatRupiah(saldo);
  sbEl.style.color = saldo < 0 ? '#fecaca' : '#fff';
  $('jmlTrans').textContent = '(' + arr.length + ')';

  const wadah = $('daftar');
  if (!arr.length) {
    wadah.innerHTML = '<p class="kosong">Belum ada transaksi.<br>Mulai catat di form di atas.</p>';
    return;
  }
  const grup = {};
  arr.forEach(t => { (grup[t.tanggal] = grup[t.tanggal] || []).push(t); });
  wadah.innerHTML = Object.keys(grup).sort().reverse().map(tgl => {
    const gM = grup[tgl].filter(t => t.jenis === 'masuk').reduce((s, t) => s + Number(t.jumlah), 0);
    const gK = grup[tgl].filter(t => t.jenis === 'keluar').reduce((s, t) => s + Number(t.jumlah), 0);
    return `<div class="grup-tanggal">
      <div class="tgl-head"><span>📅 ${escapeHtml(tanggalIndo(tgl))}</span><span>+${formatRupiah(gM)} / −${formatRupiah(gK)}</span></div>
      ${grup[tgl].map(t => `
        <div class="item">
          <div class="ikon ${t.jenis}">${t.jenis === 'masuk' ? '↓' : '↑'}</div>
          <div class="info"><div class="ket">${escapeHtml(t.ket)}</div><div class="jam">${escapeHtml(t.jam || '')}</div></div>
          <div class="nominal ${t.jenis}">${t.jenis === 'masuk' ? '+' : '−'} ${formatRupiah(t.jumlah)}</div>
          <button class="hapus" onclick="hapusTransaksi('${t.id}')">🗑</button>
        </div>`).join('')}
    </div>`;
  }).join('');
}

function renderGrafik() {
  const arr = dataAktif();
  const perTanggal = {};
  arr.forEach(t => {
    perTanggal[t.tanggal] = perTanggal[t.tanggal] || { masuk: 0, keluar: 0 };
    perTanggal[t.tanggal][t.jenis] += Number(t.jumlah);
  });
  const labels = Object.keys(perTanggal).sort().slice(-31);
  const wrap = document.querySelector('.chart-wrap');
  const masukTot = arr.filter(t => t.jenis === 'masuk').reduce((s, t) => s + Number(t.jumlah), 0);
  const keluarTot = arr.filter(t => t.jenis === 'keluar').reduce((s, t) => s + Number(t.jumlah), 0);
  $('ringkasanGrafik').innerHTML = `
    <div><span>Total Uang Masuk</span><b class="masuk">${formatRupiah(masukTot)}</b></div>
    <div><span>Total Uang Keluar</span><b class="keluar">${formatRupiah(keluarTot)}</b></div>
    <div><span>Selisih (Saldo)</span><b style="color:${masukTot - keluarTot < 0 ? 'var(--red)' : 'var(--green)'}">${formatRupiah(masukTot - keluarTot)}</b></div>
    <div><span>Jumlah Transaksi</span><b>${arr.length}</b></div>`;
  if (typeof Chart === 'undefined' || !labels.length) {
    wrap.style.display = 'none';
    $('grafikKosong').style.display = 'block';
    $('grafikKosong').textContent = typeof Chart === 'undefined' ? 'Grafik butuh internet (memuat Chart.js).' : 'Belum ada data.';
    if (grafik) { grafik.destroy(); grafik = null; }
    return;
  }
  wrap.style.display = '';
  $('grafikKosong').style.display = 'none';
  const pendek = labels.map(l => new Date(l + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
  if (grafik) grafik.destroy();
  grafik = new Chart($('grafik'), {
    type: 'bar',
    data: {
      labels: pendek,
      datasets: [
        { label: 'Masuk', data: labels.map(l => perTanggal[l].masuk), backgroundColor: '#16a34a', borderRadius: 6 },
        { label: 'Keluar', data: labels.map(l => perTanggal[l].keluar), backgroundColor: '#dc2626', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + formatRupiah(c.parsed.y) } }
      },
      scales: { y: { beginAtZero: true, ticks: { callback: v => 'Rp' + (v >= 1000000 ? (v / 1000000) + 'jt' : v >= 1000 ? (v / 1000) + 'rb' : v) } } }
    }
  });
}

function renderSemua() {
  renderBeranda();
  if (document.querySelector('#tab-grafik').classList.contains('aktif')) renderGrafik();
  const aktif = Object.values(db.records).filter(t => !t.deleted);
  $('setDataInfo').textContent = aktif.length + ' transaksi tersimpan · Perangkat: ' + DEVICE_ID;
  $('setLastSync').textContent = db.lastSync ? new Date(db.lastSync).toLocaleString('id-ID') : '–';
}

function updateStatusCloud(kondisi, pesan) {
  const el = $('statusCloud'), teks = $('statusCloudText'), cfg = $('cfgStatus');
  el.classList.remove('ok', 'err');
  if (!cloudAktif) {
    teks.textContent = 'Mode lokal';
    cfg.textContent = 'Belum terhubung. Tempel Project URL & anon key lalu tekan Simpan.';
    return;
  }
  cfg.textContent = 'Terhubung ke Supabase ✔ (ubah koneksi lewat form di atas)';
  if (kondisi === 'ok') { el.classList.add('ok'); teks.textContent = currentUser ? 'Tersinkron ☁️' : 'Cloud siap — belum login'; }
  else if (kondisi === 'err') { el.classList.add('err'); teks.textContent = 'Sinkron gagal'; }
  else if (kondisi === 'proses') { teks.textContent = 'Menyinkronkan…'; }
  else { teks.textContent = currentUser ? 'Offline — disimpan lokal' : 'Cloud siap — login untuk sinkron'; }
  if (pesan) cfg.textContent = 'Pesan: ' + pesan;
}

async function syncNow(manual) {
  if (!sb || !currentUser) { updateStatusCloud('lokal'); return; }
  if (sedangSync) return;
  if (!navigator.onLine) { updateStatusCloud('lokal'); return; }
  sedangSync = true;
  updateStatusCloud('proses');
  try {
    const { data: remote, error } = await sb.from('transactions').select('*');
    if (error) throw error;
    for (const r of remote || []) {
      const l = db.records[r.id];
      if (!l || new Date(r.updated_at) > new Date(l.updated_at)) {
        db.records[r.id] = {
          id: r.id, jenis: r.jenis, jumlah: Number(r.jumlah), ket: r.ket || '',
          tanggal: r.tanggal, jam: r.jam || '', deleted: !!r.deleted,
          device: r.device || '', updated_at: r.updated_at, user_id: r.user_id
        };
      }
    }
    const payload = Object.values(db.records).map(t => ({
      id: t.id, user_id: currentUser.id, jenis: t.jenis, jumlah: Number(t.jumlah),
      ket: t.ket || '', tanggal: t.tanggal, jam: t.jam || '', deleted: !!t.deleted,
      device: t.device || '', updated_at: t.updated_at
    }));
    if (payload.length) {
      const { error: upErr } = await sb.from('transactions').upsert(payload);
      if (upErr) throw upErr;
    }
    db.lastSync = new Date().toISOString();
    save(); updateStatusCloud('ok'); renderSemua();
  } catch (e) {
    updateStatusCloud('err', e.message || e);
  } finally {
    sedangSync = false;
  }
}

function jadwalkanSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(false), 2500);
}

function backupJson() {
  const blob = new Blob([JSON.stringify(Object.values(db.records), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'backup-keuangan-' + hariIni() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function bukaTab(nama) {
  document.querySelectorAll('.tab').forEach(s => s.classList.remove('aktif'));
  document.querySelector('#tab-' + nama).classList.add('aktif');
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('aktif', b.dataset.tab === nama));
  if (nama === 'grafik') renderGrafik();
  window.scrollTo(0, 0);
}

let expr = '', hasilTerakhir = null;
function hitungExpr() {
  let e = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  if (!e || !/^[\d+\-*/().%\s]+$/.test(e)) return null;
  try {
    const v = Function('"use strict";return (' + e + ')')();
    if (typeof v !== 'number' || !isFinite(v)) return null;
    return Math.round(v * 100) / 100;
  } catch (_) { return null; }
}
function tampilHasil(h) {
  $('calcHasil').textContent = h === null ? '…' : (Number.isInteger(h) ? h.toLocaleString('id-ID') : h.toLocaleString('id-ID', { maximumFractionDigits: 2 }));
}
function calcInput(ch) { expr += ch; $('calcExpr').textContent = expr; const h = hitungExpr(); tampilHasil(h); if (h !== null) hasilTerakhir = h; }
function calcClear() { expr = ''; hasilTerakhir = null; $('calcExpr').textContent = '\u00A0'; $('calcHasil').textContent = '0'; }
function calcBack() { expr = expr.slice(0, -1); $('calcExpr').textContent = expr || '\u00A0'; const h = hitungExpr(); hasilTerakhir = h; tampilHasil(h); if (!expr) $('calcHasil').textContent = '0'; }
function calcEquals() {
  const h = hitungExpr();
  if (h !== null) { expr = String(h); hasilTerakhir = h; $('calcExpr').textContent = '='; tampilHasil(h); }
  else $('calcHasil').textContent = 'Error';
}
function pakaiHasil() {
  const h = hasilTerakhir !== null ? hasilTerakhir : hitungExpr();
  if (h !== null && h > 0) {
    $('jumlah').value = h;
    bukaTab('beranda');
    $('jumlah').focus();
  } else alert('Hitung dulu angkanya di kalkulator.');
}

document.addEventListener('DOMContentLoaded', async () => {
  $('tanggal').value = hariIni();
  setJenis('keluar');
  initCloud();
  const cfg = getConfig();
  if (cfg) { $('cfgUrl').value = cfg.url; $('cfgKey').value = cfg.key; }

  $('formTransaksi').addEventListener('submit', tambahTransaksi);
  $('filterBulan').addEventListener('change', renderSemua);
  document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => bukaTab(b.dataset.tab)));
  $('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') masuk(); });

  document.addEventListener('keydown', e => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
    if (!document.querySelector('#tab-kalkulator').classList.contains('aktif')) return;
    if (/^[0-9+\-*/().%]$/.test(e.key)) { calcInput(e.key); e.preventDefault(); }
    else if (e.key === 'Enter') { calcEquals(); e.preventDefault(); }
    else if (e.key === 'Backspace') { calcBack(); e.preventDefault(); }
    else if (e.key === 'Escape') { calcClear(); e.preventDefault(); }
  });

  window.addEventListener('online', () => syncNow(false));
  window.addEventListener('offline', () => updateStatusCloud('lokal'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(false); });

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
  });

  renderSemua();
  updateStatusCloud('lokal');

  if (sb) {
    sb.auth.onAuthStateChange((event, session) => {
      setUser(session ? session.user : null, event === 'SIGNED_IN' || event === 'INITIAL_SESSION');
    });
    const { data } = await sb.auth.getSession();
    if (data.session) {
      setUser(data.session.user, true);
    } else if (lewatiLoginAktif()) {
      updateStatusCloud('lokal');
    } else {
      tampilkanLogin();
      updateStatusCloud('lokal');
    }
    setInterval(() => syncNow(false), 60000);
  }
});
