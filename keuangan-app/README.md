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
Host folder ini (Netlify Drop / Vercel / GitHub Pages — gratis, wajib HTTPS),
lalu di HP: Chrome ⋮ → *Install app*, atau iPhone Safari → Bagikan → *Tambah ke Layar Utama*.

### APK Android
File `Keuangan Harian.apk` ada di folder induk. Install langsung (izinkan
"sumber tidak dikenal"). Setelah install: **Setelan → Koneksi Database Online** →
isi URL & key → login. Semua perangkat dengan akun yang sama akan tersinkron.

## Cara kerja sinkronisasi
- Setiap baris punya `updated_at`; saat sinkron, versi terbaru yang menang (LWW per baris)
- Hapus ditandai `deleted=true` (soft delete) agar terhapus di semua perangkat
- Pemicu: login, tambah/ubah data (delay 2,5 dtk), koneksi kembali, aplikasi dibuka, tiap 60 dtk, tombol manual

## Ganti isi aplikasi / rebuild APK
Project build APK ada di folder build (Capacitor). Jika file di `keuangan-app/` diubah,
APK perlu dibuat ulang — minta asisten untuk rebuild.
