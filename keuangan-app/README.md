# 💰 Keuangan Harian — PWA + APK + Supabase (Login Multi-Akun)

Aplikasi catat uang masuk/keluar: versi web (PWA) dan APK Android, dengan
**database online (Supabase)** dan **login multi-akun** — setiap akun hanya bisa
melihat & mengubah datanya sendiri (dilindungi Row Level Security).

## Fitur
- 📱 Mobile-first: PWA (install dari browser) dan APK Android (Capacitor)
- 🔐 Login email/password — data terpisah per akun, tidak akan bertabrakan
- ☁️ Sinkron otomatis antar perangkat (HP ↔ web ↔ HP lain) via Supabase
- ⬇️⬆️ Transaksi masuk/keluar, riwayat per tanggal, filter bulanan
- 🧮 Kalkulator + 📊 grafik + 💾 cadangan JSON
- 📴 Offline-first: tetap bisa mencatat saat offline, tersinkron saat online
- ⚙️ Konfigurasi Supabase bisa diisi langsung dari aplikasi (tab Setelan) — tanpa rebuild

## Setup Database Online (±5 menit, sekali saja)
1. Daftar di https://supabase.com (gratis) → **New project** → simpan password database-nya
2. Buka **SQL Editor** → New query → copy **seluruh isi `supabase-setup.sql`** → **Run**
   (membuat tabel `transactions` + proteksi RLS per akun)
3. (Disarankan) Buka **Authentication → Sign In / Providers → Email** → matikan **"Confirm email"**
   supaya langsung bisa login setelah daftar tanpa verifikasi email
4. Buka **Project Settings → API**, salin:
   - **Project URL** (format `https://xxxx.supabase.co`)
   - **anon public** key

## Menghubungkan Aplikasi
- **Di APK / web**: buka tab **⚙️ Setelan → Koneksi Database Online** → tempel URL & anon key → **Simpan Koneksi** → aplikasi restart → layar login muncul → **Daftar** akun → masuk
- Atau isi langsung di file `js/config.js` (untuk deploy web)

Akun dikelola Supabase Auth (password ter-hash di server; aplikasi tidak menyimpan password).

## Keamanan / Isolasi Data
- Tabel punya kolom `user_id` + kebijakan RLS: `auth.uid() = user_id`
- Akun A **tidak mungkin** membaca/mengubah data akun B, meskipun request dibuat manual
- Sinkronisasi hanya aktif setelah login; tanpa login = mode lokal per perangkat

## Struktur
```
keuangan-app/
├── index.html          UI + layar login
├── css/style.css
├── js/app.js           Logika aplikasi + auth + sinkronisasi
├── js/config.js        (opsional) URL & anon key bawaan
├── manifest.webmanifest, sw.js, icons/
├── supabase-setup.sql  ⬅ jalankan ini di Supabase
├── vercel.json         header cache + konfigurasi deploy
├── .vercelignore       file yang tidak ikut terbit
└── README.md
```

## Menjalankan
### Web di komputer
```powershell
cd keuangan-app
python -m http.server 8000
```
Buka http://localhost:8000

### Web di HP (PWA)
Host folder ini dengan HTTPS (lihat **Deploy ke Vercel** di bawah),
lalu di HP: Chrome ⋮ → *Install app*, atau iPhone Safari → Bagikan → *Tambah ke Layar Utama*.

### APK Android
File `Keuangan Harian.apk` ada di folder induk. Install langsung (izinkan
"sumber tidak dikenal"). Setelah install: **Setelan → Koneksi Database Online** →
isi URL & key → login. Semua perangkat dengan akun yang sama akan tersinkron.

## Deploy ke Vercel

Folder ini sudah siap deploy: tidak ada build step, tidak ada dependency. `vercel.json`
mengatur header cache, `.vercelignore` menyembunyikan dokumen & file SQL dari publik.

**Root directory proyek harus `keuangan-app`**, jangan root repo — di root repo ada
prototipe `index.html` lama dan file APK yang tidak boleh ikut terbit.

### Cara 1 — dari dashboard (paling mudah)
1. Push repo ini ke GitHub (pastikan commit terbaru sudah masuk).
2. Vercel → **Add New… → Project** → import repo tersebut.
3. Pada layar konfigurasi:
   - **Root Directory**: `keuangan-app`
   - **Framework Preset**: `Other`
   - **Build Command**: kosongkan (sit ini tidak punya build step)
   - **Output Directory**: kosongkan (sajikan folder apa adanya)
4. **Deploy**. Setiap push berikutnya otomatis rilis ulang.

### Cara 2 — dari CLI
```powershell
cd keuangan-app
vercel --prod
```
Saat ditanya: link ke project baru, framework `Other`, build command kosong, output
`.`. `--prod` = domain produksi; tanpa flag = preview URL.

### Wajib setelah dapat domain
Buka Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://domain-anda`
- **Redirect URLs**: tambahkan `https://domain-anda` (dan `https://*.vercel.app` bila perlu)

Tanpa ini, login/daftar akan gagal karena Supabase menolak redirect ke domain baru.

### Custom domain
Vercel → project → **Settings → Domains** → tambahkan domain, ikuti record A/CNAME yang
ditampilkan. HTTPS disediakan otomatis oleh Vercel.

### Cek setelah deploy
- `https://domain-anda/sw.js` → status 200 dan header `cache-control: no-cache`.
- `https://domain-anda/manifest.webmanifest` → `content-type: application/manifest+json`.
- Buka situs → DevTools → **Application → Service Workers**: worker aktif dengan scope `/`.
- Coba install PWA, daftar akun, tambah transaksi, lalu **refresh** — data harus tetap ada.

### Penting: melempar update ke pengguna lama
`sw.js` memakai nama cache tetap (`CACHE`), dan file shell disajikan cache-first. Header
`no-cache` di atas hanya membuat browser cepat memeriksa `sw.js` — bila isi `index.html`,
`css/`, atau `js/` berubah, **naikkan versi `CACHE` di `sw.js`** (mis. `keuangan-v3`) dan
rilis ulang. Tanpa itu pengguna yang sudah install tetap melihat versi lama.

Catatan paket: plan **Hobby gratis hanya untuk proyek personal/non-komersial**. Untuk
pemakaian bisnis, Vercel mewajibkan plan Pro.

## Cara kerja sinkronisasi
- Setiap baris punya `updated_at`; saat sinkron, versi terbaru yang menang (LWW per baris)
- Hapus ditandai `deleted=true` (soft delete) agar terhapus di semua perangkat
- Pemicu: login, tambah/ubah data (delay 2,5 dtk), koneksi kembali, aplikasi dibuka, tiap 60 dtk, tombol manual

## Ganti isi aplikasi / rebuild APK
Project build APK ada di folder build (Capacitor). Jika file di `keuangan-app/` diubah,
APK perlu dibuat ulang — minta asisten untuk rebuild.
