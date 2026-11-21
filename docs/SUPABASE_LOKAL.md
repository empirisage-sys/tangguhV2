# Supabase Lokal untuk Pengembangan TANGGUH

Supabase lokal adalah salinan database TANGGUH yang berjalan di laptop. Isinya 20 balita fiktif, sehingga fitur bisa diuji tanpa menyentuh data produksi.

Semua perintah di bawah dijalankan di terminal Antigravity (PowerShell), dari folder repo.

## 1. Persiapan sekali saja

1. Pasang **Docker Desktop for Windows** dari situs resmi Docker, dengan pilihan **WSL 2**.
2. Buka Docker Desktop dan tunggu sampai statusnya **Engine running**.
3. Pastikan Node.js sudah terpasang. Perintah `node -v` harus menampilkan versi 20 atau lebih baru.

Supabase CLI tidak perlu dipasang. Semua perintah memakai `npx supabase@2.122.1`, versi yang sudah diuji.

## 2. Menyalakan Supabase lokal

```powershell
npx supabase@2.122.1 start
```

Pemakaian pertama mengunduh beberapa GB image Docker, jadi bisa memakan 10 sampai 20 menit. Pemakaian berikutnya hanya beberapa detik.

Perintah ini menjalankan semua migrasi di `supabase/migrations` secara berurutan, lalu mengisi data dari `supabase/seed.sql`.

## 3. Menyambungkan aplikasi ke Supabase lokal

```powershell
node scripts/lokal/tulis-env-lokal.mjs
npm run dev
```

Skrip pertama menulis `.env.development.local`. `npm run dev` membaca berkas ini lebih dulu daripada `.env.local`, jadi:

- `.env.local` yang berisi kunci produksi **tidak diubah**,
- `npm run dev` memakai Supabase lokal,
- `npm run build` dan Vercel tetap memakai produksi.

Buka `http://localhost:3000`.

## 4. Akun uji

Semua akun memakai sandi `TangguhLokal#2026`. Akun ini hanya ada di Supabase lokal.

| Email | Peran | Wilayah |
| --- | --- | --- |
| admin@tangguh.lokal | Admin | Se-provinsi |
| kader1@tangguh.lokal | Kader | SIM Posyandu Melati |
| dokter1@tangguh.lokal | Dokter | SIM Puskesmas Uji Satu |
| dokter2@tangguh.lokal | Dokter | SIM Puskesmas Uji Dua |
| dietisien1@tangguh.lokal | Dietisien | SIM Puskesmas Uji Satu |
| dsa@tangguh.lokal | Dokter Spesialis Anak | SIM RSUD Uji |

## 5. Isi data simulasi

- 2 puskesmas, 4 posyandu, dan 1 rumah sakit, semuanya berawalan `SIM`.
- 20 balita dengan skenario normal, stunting, gizi kurang, gizi buruk, edema, LILA rendah, prematur, gizi lebih, obesitas, berat turun, tepat 24 bulan, dan 62 bulan.
- 56 skrining. Semua nilai Z dihitung oleh mesin aplikasi (`zscore-2.2.0`), bukan diketik tangan.
- 4 rujukan dengan status diajukan (2), diterima (1), dan selesai (1).

Tanggal ditulis relatif terhadap hari ini. Kunjungan terakhir selalu jatuh hari ini, dan umur anak tetap sama setiap kali seed dijalankan.

Anak 62 bulan hanya terdaftar sebagai balita tanpa skrining, karena database menolak umur di atas 60 bulan.

### Data yang terlihat per akun (sudah diuji dengan RLS)

| Akun | Balita | Skrining | Rujukan |
| --- | --- | --- | --- |
| admin | 20 | 56 | 4 |
| dokter1 / dietisien1 | 10 | 30 | 1 |
| dokter2 | 10 | 26 | 3 |
| kader1 | 5 | 15 | 1 |
| dsa | 4 | 12 | 4 |

### Angka pengukuran hari ini

| Ukuran | Nilai |
| --- | --- |
| Balita ditimbang hari ini | 18 |
| Stunting (TB/U < -2) | 5 |
| Wasting (BB/TB < -2) | 4 |
| Penanda rujukan (`is_red_flag`) dari mesin | 7 |

Halaman **Pasien Rujukan** menampilkan keempat rujukan ini sejak rujukan tersimpan di database (migrasi `20261121000000_rujukan_tersambung.sql`). Masuk sebagai `dsa@tangguh.lokal` untuk mencoba alur balasan rumah sakit, dan sebagai `dokter1@tangguh.lokal` untuk menerbitkan rujukan baru.

## 6. Perintah harian

| Keperluan | Perintah |
| --- | --- |
| Menyalakan | `npx supabase@2.122.1 start` |
| Mematikan | `npx supabase@2.122.1 stop` |
| Mengulang database dari nol | `npx supabase@2.122.1 db reset` |
| Melihat alamat dan kunci | `npx supabase@2.122.1 status` |
| Membuat ulang seed setelah JSON diubah | `npx tsx scripts/seed/buat-seed.ts` |
| Supabase Studio lokal | `http://127.0.0.1:54323` |
| Kotak surat uji (email masuk) | `http://127.0.0.1:54324` |

Setelah mengubah migrasi, jalankan `db reset` untuk memastikan semua migrasi masih berjalan dari nol.

## 7. Aturan keselamatan

- Jangan menjalankan `supabase link` atau `supabase db push` ke proyek produksi tanpa rencana migrasi yang disetujui.
- Seed berhenti sendiri jika database berisi pengguna yang namanya tidak berawalan `SIM`, sehingga tidak bisa terjalankan di produksi.
- `.env.development.local` hanya berisi kunci lokal dan tidak masuk Git.
- Jangan memasukkan data anak yang nyata ke Supabase lokal.

## 8. Jika ada masalah

| Gejala | Penyebab dan cara mengatasi |
| --- | --- |
| `Cannot connect to the Docker daemon` | Docker Desktop belum menyala. Buka Docker Desktop, lalu tunggu Engine running. |
| `port is already allocated` | Ada Supabase lokal lain yang masih berjalan. Jalankan `npx supabase@2.122.1 stop --all`. |
| Login gagal dengan akun uji | Jalankan `db reset` agar akun dibuat ulang. |
| Aplikasi masih memakai data produksi | Pastikan `.env.development.local` ada, lalu hentikan dan jalankan ulang `npm run dev`. |
| Seed gagal setelah migrasi baru | Kolom baru mungkin wajib diisi. Perbarui `scripts/seed/buat-seed.ts`, lalu jalankan ulang skripnya. |

## 9. Batas pengujian

Migrasi dan seed sudah diuji pada PostgreSQL 16 dengan tiruan skema `auth`, termasuk RLS per peran dan menjalankan seed dua kali. Uji penuh dengan Docker Supabase (login lewat GoTrue) baru bisa dilakukan di laptop, karena ruang kerja pengujian tidak dapat mengunduh image Docker.
