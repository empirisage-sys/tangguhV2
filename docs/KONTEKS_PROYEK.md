# KONTEKS PROYEK TANGGUH — Dokumen Serah Terima Lengkap

**Untuk dipakai sebagai konteks utama di Antigravity IDE.**
Letakkan berkas ini di `docs/KONTEKS_PROYEK.md` pada repositori `tangguh-web`.

| | |
|---|---|
| Proyek | Aplikasi TANGGUH (Tanggulangi Stunting untuk Generasi Hulonthalo) |
| Pemilik | Pak Nelitie, Kaprodi FK UMGo |
| Wilayah sasaran | 6 kabupaten/kota Provinsi Gorontalo |
| Migrasi | React 19 + Vite + Firebase → Next.js 16 + Supabase + Vercel |
| Versi paket terakhir | `tangguh-2.4.0.zip` |
| Versi engine | `zscore-2.0.0` |
| Tanggal dokumen | 19 Agustus 2026 |
| Status uji | 230 uji otomatis lolos, pemeriksaan tipe bersih |

---

## Cara Memakai Dokumen Ini di Antigravity

1. Buat repositori privat `tangguh-web` di GitHub, buka sebagai workspace di Antigravity.
2. Letakkan `AGENTS.md` di root — berkas itu dibaca agen setiap sesi dan berisi aturan mengikat.
3. Letakkan berkas ini di `docs/KONTEKS_PROYEK.md`.
4. Ekstrak `tangguh-2.4.0.zip` ke dalam repositori.
5. Sesi pertama, tempelkan prompt Sprint 0 pada Bagian 12 dokumen ini.

**Disiplin yang menentukan keberhasilan otodidak:**

- Satu tugas, satu cabang, satu tujuan.
- Baca Implementation Plan sampai habis sebelum menekan Proceed. Memperbaiki rencana butuh satu menit; memperbaiki 800 baris kode yang salah arah butuh sehari.
- Setelah setiap tugas selesai, minta penjelasan: *"Jelaskan kode yang baru kamu tulis, berkas per berkas, seolah saya belum pernah memakai Next.js. Sebutkan bagian mana yang paling mungkin bermasalah dan mengapa."*
- **Jangan pernah menerima perubahan pada `src/lib/who/` atau `src/lib/zscore/` tanpa membaca diff-nya sendiri.**
- Commit setiap kali satu tugas selesai dan lolos `npm run cek`.
- Bila agen gagal dua kali pada masalah yang sama, hentikan sesi dan mulai baru dengan penjelasan lebih spesifik.

---

# BAGIAN 1 — TUJUAN DAN LATAR

Aplikasi TANGGUH adalah platform deteksi dini stunting dan gizi buruk pada balita di Provinsi Gorontalo. Penggunanya:

| Peran | Perangkat | Kondisi kerja |
|---|---|---|
| Kader posyandu | Android kelas menengah-bawah | luar ruangan, sinyal lemah, sambil menggendong anak |
| Dokter | ponsel dan laptop | puskesmas |
| Dietisien | ponsel dan laptop | puskesmas |
| Admin Dinkes | laptop | kantor dinas |

Tiga konsekuensi yang tidak boleh dilanggar:

1. Aplikasi harus tetap dapat mencatat pengukuran **saat offline**.
2. Salah hitung Z-Score sama dengan salah diagnosis. Logika perhitungan adalah kode paling kritis di repositori ini.
3. Data balita adalah data pribadi bersifat spesifik menurut UU No. 27 Tahun 2022. Tidak boleh bocor antar wilayah.

---

# BAGIAN 2 — SELURUH KEPUTUSAN YANG SUDAH DIAMBIL

Ini rekaman keputusan sepanjang diskusi. Agen tidak boleh mengubahnya tanpa persetujuan baru.

## 2.1 Keputusan arsitektur

| Kode | Keputusan | Alasan |
|---|---|---|
| A-1 | Identitas balita dipisah ke tabel `balita`, terpisah dari `skrining` | Tanpa pemisahan ini, kurva pertumbuhan dan evaluasi weight faltering tidak dapat dibuat andal |
| A-2 | Z-Score dihitung dua kali: di perangkat untuk tampil seketika saat offline, di server sebagai sumber kebenaran | Klien tidak boleh menjadi sumber kebenaran data medis, tetapi kader butuh hasil seketika tanpa sinyal |
| A-3 | Palet warna: biru-hijau laut sebagai warna utama, kuning Karawo sebagai aksen | Hijau, kuning, merah sudah terpakai untuk status gizi; warna merek tidak boleh mengambil dari triad itu |
| A-4 | Kawasan Supabase Southeast Asia (Singapore), fungsi Vercel `sin1` | Latensi dari Gorontalo ke Singapura jauh lebih baik daripada ke Amerika |

## 2.2 Keputusan klinis (D-1 sampai D-8)

| Kode | Keputusan | Status |
|---|---|---|
| D-1 | Terapkan rumus catch-up untuk kalori, ditampilkan berdampingan dengan kebutuhan pemeliharaan | disetujui, sudah dikerjakan, **menunggu verifikasi nutrisionis** |
| D-2 | Protein 1,5–2,0 g per kg berat ideal untuk catch-up, berdampingan dengan 1,2–1,5 g per kg berat aktual | disetujui, sudah dikerjakan, **menunggu verifikasi nutrisionis** |
| D-3 | Tolak umur di atas 60 bulan dan nilai di luar tabel, jangan dijepit ke tepi tabel | disetujui, sudah dikerjakan |
| D-4 | TB/U normal sampai +3 SD sesuai Kemenkes, hapus kategori "Sangat Tinggi" | disetujui, sudah dikerjakan |
| D-5 | Kalori PKMK dihitung per produk, bukan angka tetap 25 kkal per sendok | disetujui, menunggu Sprint 8 |
| D-6 | Perbaiki `firestore.rules` pada aplikasi lama | **masih menunggu tindakan Pak Nelitie** |
| D-7 | Kurangkan delta pada penilaian velocity WHO | sudah dikerjakan, wajib |
| D-8 | Jalur cadangan KBM diberi label terbuka pada keluaran | sudah dikerjakan, **tabel KBM menunggu verifikasi nutrisionis** |
| D-9 | Cakupan data balita spesialis RS: HANYA balita yang diinput sendiri (dan rujukan aktif 90 hari) | disetujui, sudah dikerjakan |
| D-10 | Alur rujukan medis terintegrasi Puskesmas ➔ RSUD ➔ Rujuk Balik | disetujui, sudah dikerjakan |
| S-1 | ~~Verifikasi tabel velocity perempuan~~ | **dibatalkan — kecurigaan keliru, lihat Bagian 3.5** |

## 2.3 Keputusan desain dan akses

| Kode | Keputusan | Alasan |
|---|---|---|
| E-1 | Palet biru-hijau laut disetujui | jawaban Pak Nelitie |
| E-2 | Bentuk utama visualisasi riwayat adalah **kurva pertumbuhan**, dapat diplot berulang | jawaban Pak Nelitie |
| E-3 | Dua angka kebutuhan gizi berdampingan dinilai sudah jelas | jawaban Pak Nelitie |
| E-4 | Ukuran huruf dan tombol sudah sesuai | jawaban Pak Nelitie |
| E-5 | Pita Z-Score dipertahankan **hanya** pada layar hasil satu pengukuran, bukan pada halaman riwayat | pita tidak butuh riwayat sehingga langsung tampil saat offline |
| E-6 | **Kurva tren nilai Z hanya untuk dokter dan admin.** Kader dan dietisien memakai tiga kurva WHO | kurva itu paling menuntut penafsiran; tanpa pendampingan berisiko menimbulkan kesimpulan keliru |
| E-7 | **Seluruh peran wajib melalui persetujuan admin**, termasuk kader | keputusan Pak Nelitie, mengubah rancangan awal yang menyetujui kader otomatis |
| E-8 | **Pendaftaran bertingkat & normalisasi usulan:** 38 provinsi, puskesmas vs rumah sakit, dan posyandu manual | menjamin keutuhan relasi RLS wilayah dan fleksibilitas pendaftaran |

---

# BAGIAN 3 — TEMUAN TELAAH KODE LAMA

Hasil pembacaan penuh `zScoreUtils.ts`, `constants.ts`, `types.ts`, `App.tsx`, `KaderDashboard.tsx`, `DietisienDashboard.tsx`, `firestore.rules`, `package.json`.

## 3.1 KRITIS

### K-1. Siapa pun dapat mendaftar sebagai dietisien berstatus disetujui, lalu membaca seluruh data balita

`firestore.rules` hanya memaksa `isApproved == false` untuk peran `dokter`. Peran `dietisien` tidak dicakup, sehingga siapa pun dapat mendaftar dengan `role: 'dietisien'` dan `isApproved: true`. Fungsi `isScreeningManager()` memberi dietisien hak baca atas **seluruh koleksi `screenings`** tanpa batas wilayah.

**Perbaikan pada aplikasi lama, satu baris:**

```
(incoming().role == 'kader' || incoming().isApproved == false)
```

lalu `firebase deploy --only firestore:rules`, lalu periksa koleksi `users` untuk akun dietisien/dokter berstatus disetujui yang tidak dikenali.

**Status: masih menunggu tindakan Pak Nelitie (D-6).**

Di aplikasi baru celah ini tertutup sendiri: status akun ditetapkan trigger database, dan policy RLS melarang pengguna mengubah `role` maupun `status_akun` miliknya sendiri.

### K-2. Identitas admin ditentukan alamat email pribadi di dalam aturan keamanan

`isAdmin()` memuat dua alamat email tetap, salah satunya Gmail pribadi. Kewenangan tertinggi aplikasi layanan publik terikat pada akun pribadi seseorang.

Di aplikasi baru: kewenangan ditentukan kolom `role` di tabel `profiles`. Admin pertama dibuat sekali lewat SQL. **Sediakan minimal dua akun admin institusional, bukan akun pribadi.**

### K-3. Parameter delta pada tabel velocity WHO tidak pernah dikurangkan

**Temuan dengan dampak lapangan terbesar.**

WHO memodelkan tabel velocity berat badan pada data yang sudah digeser, yaitu kenaikan sebenarnya ditambah delta. Nilai yang keluar dari rumus LMS **wajib dikurangi delta**. Aplikasi lama tidak melakukannya.

| Interval | Delta laki-laki | Delta perempuan |
|---|---|---|
| 1 bulan | 400 g | 400 g |
| 2 bulan | 600 g | 600 g |
| 3 bulan | 650 g | **800 g** |

Delta bukan satu angka untuk semua tabel.

**Bukti kebenaran rumus.** Perempuan interval 0–4 minggu: L = 0,7781, M = 1279,4834, S = 0,21479, delta = 400.

```
nilai LMS pada z = -1,645        = 846 g
dikurangi delta                  = 446 g
kolom persentil 5 tabel WHO      = 446 g   cocok
```

Seluruh 114 baris cocok dengan selisih di bawah 1,5 gram.

**Dampak:**

| Jenis kelamin | Interval | Umur awal | Ambang WHO | Ambang aplikasi lama |
|---|---|---|---|---|
| laki-laki | 1 bulan | 0 bln | 460 g | 860 g |
| laki-laki | 1 bulan | 11 bln | **−106 g** | 294 g |
| perempuan | 1 bulan | 11 bln | **−102 g** | 298 g |
| perempuan | 2 bulan | 12 bln | **−19 g** | 581 g |
| perempuan | 3 bulan | 21 bln | 8 g | 808 g |

Angka negatif bukan salah cetak: lima persen bayi sehat memang kehilangan sedikit berat pada bulan mendekati usia satu tahun.

Contoh kasus: bayi laki-laki 11 bulan naik 100 g dalam 30 hari — **normal** menurut WHO, **growth faltering** menurut aplikasi lama.

**Arah kesalahannya over-diagnosis.** Tidak ada anak gagal tumbuh yang dinyatakan normal.

**Yang perlu disiapkan:** setelah perbaikan, jumlah kasus growth faltering yang terdeteksi akan **turun tajam**. Sampaikan penjelasannya ke puskesmas dan dinas **sebelum** angka rekap bulanan berubah.

## 3.2 TINGGI

### T-1. Rumus kalori di kode bukan rumus catch-up seperti di dokumentasi

| | Rumus |
|---|---|
| Dokumentasi | RDA(usia-tinggi) × BB ideal |
| Kode `App.tsx` baris 982–983 | RDA(usia **kronologis**) × BB **aktual** |

Variabel `usiaTinggiBulan` sudah dihitung di baris 968 dan sudah ditampilkan di antarmuka baris 3634, tetapi tidak pernah dipakai dalam perhitungan kalori. Niat desainnya ada, penyambungannya tidak selesai.

Contoh anak laki-laki 24 bulan, tinggi 78 cm, berat 8,0 kg:

| Perhitungan | Hasil |
|---|---|
| Kode sekarang | 800 kkal/hari |
| Rumus catch-up | 1.021 kkal/hari |

Selisih 28% ke bawah, pada anak yang justru sedang dikejar pertumbuhannya.

### T-2. Rentang protein berbeda dari dokumentasi, dan basis beratnya juga berbeda

| | Rumus | Contoh anak di atas |
|---|---|---|
| Kode | 1,2–1,5 g × BB aktual | 9,6–12,0 g/hari |
| Dokumentasi | 1,5–2,0 g × BB ideal | 15,3–20,4 g/hari |

Hampir dua kali lipat.

### T-3. Nilai di luar rentang tabel dijepit ke tepi, bukan ditolak

`interpolateLms` mengembalikan baris tepi bila nilai di luar rentang. Untuk anak 62 bulan, kode memakai parameter bulan ke-60 dan mengeluarkan Z-Score yang tampak wajar. Karena anak lebih tua secara alami lebih tinggi, status stunting **terlihat lebih ringan dari kenyataan**.

### T-4. Ambang "Tinggi" pada TB/U berbeda antara kode dan dokumentasi sendiri

| | Ambang |
|---|---|
| Kode `getStatusGiziTBU` | Z > 2 → "Tinggi", Z > 3 → "Sangat Tinggi" |
| Dokumentasi TANGGUH | −2 SD ≤ Z ≤ +3 SD → Normal |
| Standar Kemenkes | normal sampai +3 SD, tidak mengenal "sangat tinggi" |

Dokumentasi yang benar, kode yang menyimpang.

### T-5. Penyaring dasbor tidak pernah cocok karena beda huruf besar-kecil

| Berkas dan baris | Yang dicari | Teks sebenarnya | Hasil |
|---|---|---|---|
| `KaderDashboard.tsx` 32 | `'Gizi kurang'` | `'Gizi Kurang (Wasted)'` | tidak pernah cocok |
| `KaderDashboard.tsx` 32 | `'Gizi buruk'` | `'Gizi Buruk (Severely Wasted)'` | tidak pernah cocok |
| `KaderDashboard.tsx` 43 | `'Gizi baik'` | `'Gizi Baik (Normal)'` | tidak pernah cocok |
| `DietisienDashboard.tsx` 73–74 | sama | sama | tidak pernah cocok |
| `DietisienDashboard.tsx` 75 | hanya `'Sangat Pendek'` | | anak berstatus pendek terlewat |

**Akibat praktis:** daftar prioritas dietisien melewatkan anak yang hanya wasted tetapi BB/U masih normal, dan melewatkan anak yang stunted tanpa wasting. Statistik "anak berstatus normal" di dasbor kader **selalu nol**.

Penyebab akarnya rancangan: fungsi klasifikasi mengembalikan teks yang dibaca pengguna berikut nama kelas Tailwind dari lapisan logika, lalu lapisan lain mencocokkan teks itu.

### T-6. Cakupan tabel velocity WHO tidak menjangkau kebutuhan posyandu

| Tabel | Cakupan umur awal |
|---|---|
| interval 1 bulan | 0–11 bulan |
| interval 2 bulan | 0–22 bulan |
| interval 3 bulan | 0–21 bulan |

Anak umur 2–5 tahun tidak dapat dinilai dengan standar velocity WHO, dan anak di atas 12 bulan yang ditimbang dengan jarak satu bulan juga tidak — padahal penimbangan bulanan itulah yang lazim di posyandu.

## 3.3 SEDANG

| Kode | Temuan |
|---|---|
| S-2 | Kalori per sendok takar PKMK dipatok 25 kkal untuk semua produk, padahal nilai sebenarnya 20–40 dan datanya sudah tersedia di `pkmkData`. Tidak ada satu pun produk bernilai 25 |
| S-3 | Ambang velocity diskalakan linear tanpa batas. Jarak 200 hari mengalikan ambang tabel 3 bulan sekitar 2,2 kali. Laju pertumbuhan tidak linear terhadap umur |
| S-4 | Logika perhitungan tersalin dua kali di `App.tsx` (baris ~930–1040 dan ~1308–1390) dan kedua salinannya sudah menyimpang. Salinan kedua memakai `Math.round(totalKalori * 0.8)` yang dipatok tetap |
| S-5 | `types.ts` mengizinkan `posisiPengukuran: 'auto'` tetapi `firestore.rules` menolaknya. Perlu diperiksa apakah ada data yang hilang karenanya |

**Dampak S-4 pada migrasi data:** baris skrining lama menyimpan objek `results` yang nilainya bergantung jalur kode mana yang dipakai. **Jangan pindahkan objek `results` dari Firestore.** Pindahkan hanya angka mentah, lalu hitung ulang dengan engine baru dan beri `engine_version`.

## 3.4 RENDAH

| Kode | Temuan |
|---|---|
| R-1 | `firestore.rules` mengizinkan `delete` pada `screenings` oleh pemilik. Rekam medis dapat dihapus permanen |
| R-2 | `public/logo.png` berukuran 7,7 MB dan dimuat di halaman awal. Optimalkan di bawah 100 KB |
| R-3 | `puppeteer` dan `serve-handler` berada di `dependencies`, seharusnya `devDependencies`. `xlsx@0.18.5` sudah lama tidak diperbarui |
| R-4 | `migrated_prompt_history/` berisi 6 MB JSON, ditambah `output.html`, `tmp.txt`, dan sepuluh berkas `fix_*.cjs`. Repositori baru mulai dari bersih |

**Catatan tentang kunci Firebase.** `apiKey` di `firebase-applet-config.json` memang dirancang publik dan bukan kebocoran kredensial. Yang membuatnya berisiko adalah aturan keamanan permisif pada K-1, bukan kuncinya. Setelah aturan diperbaiki, kunci tidak perlu diganti.

## 3.5 Koreksi temuan saya yang keliru

Pada telaah pertama saya menyatakan tabel `whoVelocityData.girls['1mo']` patut dicurigai salah salin, karena seluruh dua belas nilai L-nya seragam 0,7781, dan menjadikannya penghalang untuk Sprint 4.

**Kecurigaan itu salah.** Tabel resmi WHO memang menetapkan L konstan 0,7781 pada seluruh interval. Keseragaman itu sifat pemodelan, bukan kesalahan.

Verifikasi lanjutan menunjukkan seluruh 114 baris tabel velocity aplikasi lama **sama persis** dengan tabel WHO. Penyalinannya sangat teliti.

Pelajarannya: keseragaman pola dalam data statistik bukan bukti kesalahan. Temuan seperti itu seharusnya dinyatakan sebagai pertanyaan yang perlu diverifikasi, bukan sebagai dugaan kesalahan. Tetapi verifikasi itu justru membuka temuan K-3 yang jauh lebih serius.

## 3.6 Yang sudah benar di aplikasi lama dan wajib dipertahankan

1. **Seluruh tabel referensi WHO lengkap dan tepat.** BB/U dan TB/U masing-masing 61 baris, BB/PB 131 baris, BB/TB 111 baris, velocity 114 baris.
2. **Koreksi WHO untuk nilai di luar 3 SD sudah diterapkan dengan benar**, memakai ekstrapolasi jarak SD3–SD2 persis seperti WHO Anthro. Bagian ini paling sering hilang pada aplikasi buatan sendiri; tanpanya kasus gizi buruk berat terlaporkan dengan Z yang meleset jauh.
3. **Peralihan basis panjang ke tinggi pada tabel TB/U ditangani tepat.** Median laki-laki bulan 23 = 86,941 cm (basis panjang), bulan 24 = 87,1161 cm (basis tinggi). Titik peralihannya konsisten dengan koreksi posisi ±0,7 cm.
4. **Kategori BB/U dan BB/TB sudah sesuai standar Kemenkes** seluruhnya.

Uji regresi membuktikannya: pada 4.032 kasus, nilai Z-Score kedua engine **identik sampai tiga desimal** di setiap kasus yang dinilai keduanya.

---

# BAGIAN 4 — VERIFIKASI TABEL WHO

Seluruh tabel L/M/S dibandingkan baris per baris dengan tabel resmi yang diunduh dari cdn.who.int.

| Tabel | Baris | Nilai berbeda | Status |
|---|---|---|---|
| BB/U laki-laki | 61 | 0 | sama persis |
| BB/U perempuan | 61 | 0 | sama persis |
| TB/U laki-laki | 61 | 0 | sama persis |
| TB/U perempuan | 61 | 0 | sama persis |
| BB/PB laki-laki | 131 | 0 | sama persis |
| **BB/PB perempuan** | 131 | **2** | **satu baris dikoreksi** |
| BB/TB laki-laki | 111 | 0 | sama persis |
| BB/TB perempuan | 111 | 0 | sama persis |
| Velocity (6 tabel) | 114 | 0 | sama persis |

**Total 842 baris, 2.526 nilai, 2 berbeda (0,08%).**

## Koreksi BB/PB perempuan baris 95,5 cm

Baris 95,5 cm pada `girlsWfl` berisi nilai yang **identik dengan baris 95,5 cm `girlsWfh`**. Satu baris tabel berat-menurut-tinggi masuk ke tabel berat-menurut-panjang.

```
girlsWfl['95.5'] = [-0.3833, 14.0186, 0.08984]   keliru
nilai resmi WHO  = [-0.3833, 13.8408, 0.08972]
```

Kesalahan itu memutus sifat monoton tabel:

| Panjang | Aplikasi lama | Resmi WHO |
|---|---|---|
| 95,0 cm | 13,7146 kg | 13,7146 kg |
| 95,5 cm | **14,0186 kg** | **13,8408 kg** |
| 96,0 cm | 13,9676 kg | 13,9676 kg |

Nilai tengah lebih besar daripada nilai berikutnya. Satu-satunya pelanggaran monotonisitas di antara 728 baris tabel LMS.

**Dampak:** anak perempuan di bawah 24 bulan dengan panjang 95,0–96,0 cm. Ambang gizi kurang bergeser dari 11,636 kg ke 11,783 kg. Arah kesalahannya over-diagnosis. Kejadiannya jarang (95 cm pada umur di bawah 24 bulan sekitar +3 SD), tetapi nyata.

**Tindakan yang menunggu:** hitung ulang riwayat anak perempuan di bawah 24 bulan dengan panjang 95–96 cm.

## Uji pencegahan yang ditambahkan

`src/lib/zscore/__tests__/integritas-tabel.test.ts`, berjalan otomatis setiap `npm run test`:

1. **Monotonisitas median** pada seluruh delapan tabel.
2. **Kehalusan lokal** — setiap baris dibandingkan dengan titik tengah tetangganya. Ambang dikalibrasi dari data nyata:

| Kelompok tabel | Rasio tertinggi yang sah | Ambang uji |
|---|---|---|
| BB/PB dan BB/TB | 0,022 | 0,10 |
| BB/U | 0,151 | 0,25 |
| TB/U selain bulan 23–24 | 0,146 | 0,25 |
| TB/U bulan 23 dan 24 | 0,672 (peralihan basis) | 0,80 |

Baris salah salin menghasilkan rasio **1,403**.

3. **Rentang parameter S** antara 0,02 dan 0,2.
4. **Sifat nilai L** — TB/U harus 1, BB/PB dan BB/TB tetap per jenis kelamin (−0,3521 laki-laki, −0,3833 perempuan).
5. **Tidak ada baris identik antara BB/PB dan BB/TB** pada rentang tumpang tindih 65–110 cm. Inilah pemeriksaan yang secara khusus menutup celah yang terjadi.

---

# BAGIAN 5 — ARSITEKTUR TARGET

```
Peramban (Android/iOS/desktop)
  ├── Next.js 16.3 App Router (React 19.2, TypeScript strict)
  ├── Tailwind CSS v4 + komponen sendiri
  ├── Recharts (kurva WHO)
  ├── Serwist Service Worker + IndexedDB (mode offline)
  └── jspdf / exceljs (ekspor di sisi klien)
        │
        ▼  Server Action & Server Component
Vercel (kawasan sin1)
  ├── Node.js runtime
  └── proxy.ts (penyegaran sesi, BUKAN lapisan keamanan)
        │
        ▼  @supabase/ssr, cookie HttpOnly
Supabase (Southeast Asia)
  ├── Postgres + Row Level Security
  ├── Auth (email/sandi, verifikasi admin)
  └── Storage (opsional)
```

## Tumpukan wajib

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Framework | Next.js 16.x App Router, TypeScript strict | middleware bernama `proxy.ts`, fungsi `proxy` |
| Runtime | Node.js 22 LTS | |
| Styling | Tailwind CSS v4 via `@theme` di CSS | jangan buat `tailwind.config.js` gaya v3 |
| Database | Supabase Postgres | migrasi di `supabase/migrations/` |
| Auth | `@supabase/ssr` | hanya `getAll`/`setAll`, hanya `getClaims()` |
| Grafik | Recharts | wajib Client Component |
| Ikon | lucide-react | |
| Validasi | Zod | satu skema untuk form, Server Action, antrean offline |
| Ekspor PDF | jspdf + jspdf-autotable, `dynamic(..., { ssr: false })` | |
| Ekspor Excel | **exceljs** | jangan pakai paket `xlsx` npm |
| PWA/offline | @serwist/next + idb | jangan pakai `next-pwa` |
| Uji | Vitest, Playwright | |

## Pembagian server dan klien

| Kebutuhan | Tempat |
|---|---|
| Daftar, riwayat, rekap, halaman detail | Server Component |
| Form pengukuran | Client Component |
| Z-Score untuk **ditampilkan** | klien (agar jalan offline) |
| Z-Score untuk **disimpan** | Server Action, dihitung ulang dari angka mentah |
| Kurva WHO | Client Component, data dari server |
| Ekspor PDF/Excel | klien, `dynamic import` |

**Pola hitung dua kali (A-2) disengaja.** Klien menghitung supaya kader melihat hasil seketika bahkan tanpa sinyal; server menghitung ulang supaya angka tersimpan tidak dapat dipalsukan. Bila selisih lebih dari 0,01 SD, server memakai hasilnya sendiri dan menandai baris untuk ditinjau — biasanya pertanda perangkat memakai versi aplikasi lama.

---

# BAGIAN 6 — INVENTARIS PAKET `tangguh-2.4.0.zip`

```
src/lib/who/                      Tabel referensi WHO (dihasilkan otomatis, JANGAN DIEDIT)
  tipe.ts                         Tipe bersama, penjelasan parameter delta
  lms-bbu-lk.ts  lms-bbu-pr.ts    BB/U, 61 baris, 0-60 bulan
  lms-tbu-lk.ts  lms-tbu-pr.ts    TB/U, 61 baris, 0-60 bulan
  lms-bbpb-lk.ts lms-bbpb-pr.ts   BB/PB, 131 baris, 45-110 cm
  lms-bbtb-lk.ts lms-bbtb-pr.ts   BB/TB, 111 baris, 65-120 cm
  velocity.ts                     6 tabel, 114 baris, DENGAN delta
  index.ts                        Titik masuk tunggal

src/lib/zscore/                   Engine perhitungan
  tipe.ts umur.ts lms.ts klasifikasi.ts gizi.ts velocity.ts index.ts
  __tests__/                      230 uji

src/lib/tampilan/
  status.ts                       Kode kategori → label, nada warna, ikon
  pita.ts                         Matematika Pita Z-Score
  format.ts                       Angka, tanggal, umur, nama berkas gaya Indonesia
  akses.ts                        Aturan akses per peran, pesan status akun

src/lib/grafik/
  seri.ts                         Penyusun seri kurva pertumbuhan
  svg.ts                          Perender SVG (untuk PDF dan pratinjau)

src/lib/validasi/
  skrining.ts pendaftaran.ts      Skema Zod

src/lib/db/pemetaan.ts            Hasil engine → baris tabel skrining
src/lib/supabase/                 client, server, penjaga, admin
src/proxy.ts                      Penyegaran sesi Next.js 16

src/components/ui/                Button, InputAngka, LencanaStatus
src/components/skrining/          PitaZScore, KartuHasil
src/components/grafik/            KurvaWHO, TrenZScore, PanelKurva

src/app/globals.css               Token desain Tailwind v4
src/app/(publik)/                 masuk, daftar, menunggu-verifikasi, auth/konfirmasi
src/app/(aplikasi)/admin/verifikasi/

supabase/migrations/              Tiga berkas migrasi
tests/rls/jalankan-uji-rls.mjs    30 skenario uji RLS
referensi/engine-lama.ts          Salinan perilaku Firebase, HANYA untuk uji regresi
referensi/tabel-who-resmi/        Transkripsi tabel WHO untuk verifikasi
pratinjau/sistem-desain.html      Pratinjau sistem desain
pratinjau/kurva-pertumbuhan.html  Pratinjau kurva, tiga kasus nyata
docs/                             Lima dokumen
```

## Status verifikasi tiap bagian

| Bagian | Cara diverifikasi | Kepercayaan |
|---|---|---|
| Tabel referensi WHO | 842 baris dibanding tabel terbitan WHO | **tinggi** |
| Engine perhitungan | 230 uji, regresi 4.032 kasus | **tinggi** |
| Ambang velocity dengan delta | 114 titik dibanding kolom persentil 5 WHO | **tinggi** |
| Penyusun seri kurva | 41 uji | **tinggi** |
| Perender SVG | 12 uji, keluaran dilihat di pratinjau | **tinggi** |
| Pemetaan kategori | 18 uji | **tinggi** |
| Aturan akses per peran | 18 uji | **tinggi** |
| Skema validasi Zod | 12 uji | **tinggi** |
| Pemetaan ke baris database | 8 uji, belum pernah menulis ke Postgres | sedang |
| Skema SQL dan policy RLS | **belum pernah dijalankan** | **rendah sampai diuji** |
| Klien Supabase dan proxy | **belum pernah dijalankan** | **rendah sampai diuji** |
| Server Action | **belum pernah dijalankan** | **rendah sampai diuji** |
| Komponen React | **belum pernah dirender** | **rendah sampai diuji** |

**Mengapa dibedakan.** Engine dapat dijalankan tanpa apa pun selain Node, jadi benar-benar dijalankan. SQL butuh Postgres, RLS butuh Supabase sungguhan, React butuh peramban — semuanya tidak tersedia saat paket disusun.

**Konsekuensi paling perlu diperhatikan:** policy RLS yang salah tulis dapat membuka seluruh data balita provinsi **tanpa gejala apa pun di antarmuka**. Aplikasi tetap berjalan mulus, kader tetap dapat mencatat; yang berubah hanya kader dari satu kabupaten diam-diam dapat membaca data kabupaten lain.

---

# BAGIAN 7 — ATURAN MENGIKAT UNTUK AGEN

Isi `AGENTS.md` yang wajib ada di root repositori. Ringkasannya:

## 7.1 Larangan keras

1. **Jangan pernah** menuliskan `SUPABASE_SERVICE_ROLE_KEY` di kode yang dapat berjalan di browser, di Client Component, atau di berkas berawalan `NEXT_PUBLIC_`.
2. **Jangan pernah** memakai pola cookie lama Supabase (`get`, `set`, `remove`). Hanya `getAll` dan `setAll`.
3. **Jangan pernah** memakai `supabase.auth.getSession()` untuk keputusan otorisasi di sisi server. Gunakan `getClaims()`.
4. **Jangan pernah** membuat tabel tanpa `enable row level security` beserta policy-nya dalam migrasi yang sama.
5. **Jangan pernah** mengandalkan `proxy.ts` sebagai satu-satunya lapis otorisasi.
6. **Jangan pernah** menghapus baris pada `balita` atau `skrining`. Gunakan `deleted_at`.
7. **Jangan pernah** menerima nilai Z, status gizi, atau kebutuhan kalori dari klien lalu menyimpannya apa adanya.
8. **Jangan pernah** menulis `.env*` ke repositori, log, Artifact, atau pesan commit.
9. **Jangan** menambah dependensi di luar daftar tanpa menanyakan lebih dulu.
10. **Jangan** mengubah berkas di `src/lib/who/` kecuali diminta eksplisit.

## 7.2 Delapan aturan hasil telaah kode lama

1. **Tabel velocity WHO memiliki delta yang WAJIB dikurangkan.** Urutan: hitung dari LMS → kurangi delta → skalakan ke jumlah hari sebenarnya.
2. **Jangan pernah menyaring data berdasarkan pencocokan teks status.** Selalu pakai kode kategori.
3. **Fungsi di lapisan logika tidak boleh mengembalikan teks yang dibaca pengguna maupun nama kelas CSS.**
4. **Nilai di luar rentang tabel dikembalikan sebagai `null`, tidak dijepit.** Penjepitan hanya pada fungsi khusus penggambaran kurva.
5. **Umur di atas 60 bulan ditolak untuk SELURUH indikator**, termasuk BB/PB dan BB/TB yang tabelnya tidak berbasis umur.
6. **Jangan menskalakan ambang velocity secara linear di luar 21–110 hari.**
7. **Bila memakai jalur cadangan KBM, metodenya wajib dinyatakan pada keluaran dan ditampilkan kepada pengguna.**
8. **Kebutuhan gizi menghasilkan dua angka**, pemeliharaan dan tumbuh kejar, disertai penanda `kalori_metode`.

## 7.3 Aturan registrasi dan verifikasi

1. **Seluruh peran wajib melalui persetujuan admin.** Tidak ada pengecualian, termasuk kader.
2. **Peran `admin` tidak boleh dapat dibuat lewat pendaftaran mandiri.**
3. **Akun berstatus `menunggu` tidak boleh membaca maupun menulis data balita.** Bukan hanya dilarang menulis — ini pernah menjadi celah pada migrasi pertama.
4. **Verifikasi lewat `supabase.rpc('verifikasi_pengguna', ...)`,** bukan `update` langsung.
5. **Penolakan wajib disertai alasan minimal 10 karakter,** ditampilkan kepada pendaftar.
6. **Admin tidak boleh menyetujui akunnya sendiri.**
7. **Halaman `/menunggu-verifikasi` wajib menjelaskan tiga hal:** apa yang terjadi, bahwa data belum dapat diakses, dan apa yang bisa dilakukan bila mendesak. Pakai `pesanStatusAkun()`.
8. **Panel admin wajib menandai pendaftaran yang menunggu lebih dari dua hari kerja.**

## 7.4 Alur kerja wajib per tugas

1. Mulai dengan **Planning Mode**, berhenti untuk persetujuan sebelum mengubah kode.
2. Satu ruang lingkup per tugas.
3. Setelah menulis kode, jalankan dan pastikan lolos:
   ```
   npx tsc --noEmit
   npm run lint
   npm run test
   npm run build
   ```
4. Untuk perubahan tampilan: tangkapan layar pada 390 px **dan** 1280 px.
5. Untuk perubahan skema: migrasi baru, jangan mengedit migrasi yang sudah dijalankan; lalu `supabase gen types`.
6. Untuk perubahan `src/lib/zscore/`: wajib menambah atau memperbarui uji Vitest.
7. Ringkasan akhir dalam Bahasa Indonesia: apa yang diubah, mengapa, berkas apa saja, apa yang perlu diverifikasi manual.

## 7.5 Ambang klinis (jangan diubah tanpa perintah)

| Indikator | Ambang | Kategori |
|---|---|---|
| TB/U | Z < −3 | sangat_pendek |
| TB/U | −3 ≤ Z < −2 | pendek |
| TB/U | −2 ≤ Z ≤ +3 | normal |
| TB/U | Z > +3 | tinggi |
| BB/TB | Z < −3 | gizi_buruk |
| BB/TB | −3 ≤ Z < −2 | gizi_kurang |
| BB/TB | −2 ≤ Z ≤ +1 | gizi_baik |
| BB/TB | +1 < Z ≤ +2 | risiko_gizi_lebih |
| BB/TB | +2 < Z ≤ +3 | gizi_lebih |
| BB/TB | Z > +3 | obesitas |
| BB/U | Z < −3 | berat_badan_sangat_kurang |
| BB/U | −3 ≤ Z < −2 | berat_badan_kurang |
| BB/U | −2 ≤ Z ≤ +1 | berat_badan_normal |
| BB/U | Z > +1 | risiko_berat_badan_lebih |

Koreksi posisi: umur < 24 bulan diukur berdiri → **+0,7 cm**; umur ≥ 24 bulan diukur terlentang → **−0,7 cm**.

Setiap layar hasil wajib memuat: *"Hasil ini adalah alat bantu skrining, bukan pengganti pemeriksaan dan keputusan klinis tenaga kesehatan."*

---

# BAGIAN 8 — SISTEM DESAIN

## 8.1 Arah

- **Biru-hijau laut** sebagai warna utama, dari perairan Olele dan Torosiaje. Dipilih karena tidak bertabrakan dengan hijau/kuning/merah yang sudah dipakai untuk status gizi.
- **Kuning emas** aksen, merujuk sulaman Karawo. Dipakai hemat.
- **Latar putih kabut**, bukan putih murni — mengurangi pantulan di bawah matahari.
- Huruf tajuk **Plus Jakarta Sans** (dirancang di Indonesia), isi **Inter**, angka **IBM Plex Mono** bertabular.

## 8.2 Token warna

```css
@theme {
  --color-laut-50: #ECFDFE;  --color-laut-100: #C7F6F9; --color-laut-200: #97EDF3;
  --color-laut-300: #5FDCE3; --color-laut-400: #2AC5CF; --color-laut-500: #12B5C0;
  --color-laut-600: #0E96A1; --color-laut-700: #0B7681; --color-laut-800: #095F68;
  --color-laut-900: #06454B;

  --color-karawo-100: #FFF3D1; --color-karawo-300: #FFD873; --color-karawo-400: #FFC53D;
  --color-karawo-500: #F5A524; --color-karawo-700: #8A5300;

  --color-kabut-50: #F6FAFB;  --color-kabut-100: #EDF3F5; --color-kabut-200: #DCE9EB;
  --color-tinta-400: #7A959B; --color-tinta-600: #4A6B72; --color-tinta-900: #0F2B31;

  --color-aman-bg: #E8F8EF;    --color-aman-garis: #21A366;    --color-aman-teks: #0E6B41;
  --color-waspada-bg: #FFF6E0; --color-waspada-garis: #E08700; --color-waspada-teks: #7A4A00;
  --color-bahaya-bg: #FEECEC;  --color-bahaya-garis: #D93A43;  --color-bahaya-teks: #97161D;
  --color-netral-bg: #EDF3F5;  --color-netral-garis: #A8BFC4;  --color-netral-teks: #4A6B72;

  --font-display: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-angka: "IBM Plex Mono", ui-monospace, monospace;

  --radius-kartu: 1rem;  --radius-pil: 9999px;
  --shadow-kartu: 0 1px 2px rgb(15 43 49 / 0.05), 0 8px 24px -12px rgb(15 43 49 / 0.12);
  --spacing-sentuh: 3rem;   /* 48 px */
  --spacing-input: 3.5rem;  /* 56 px */
}
```

## 8.3 Aturan pemakaian warna status

| Makna | Token | Boleh untuk |
|---|---|---|
| Normal / gizi baik | `aman-*` | lencana status, garis kartu hasil |
| Pendek, gizi kurang, growth faltering | `waspada-*` | lencana status, banner tindak lanjut |
| Sangat pendek, gizi buruk, red flag | `bahaya-*` | lencana status, banner rujukan |
| Merek, navigasi, tombol utama | `laut-*` | tombol, tautan, ikon navigasi |
| Penanda aktif, sorotan | `karawo-*` | tab aktif, penanda hari ini |

**Warna status tidak boleh dipakai untuk tombol biasa.** Tombol hijau untuk "Simpan" membuat kader mengasosiasikan hijau dengan tindakan, bukan status gizi baik.

**Setiap lencana wajib memuat warna, ikon, DAN teks.** Sekitar 8% laki-laki mengalami gangguan penglihatan warna; layar di bawah matahari mengurangi perbedaan warna.

## 8.4 Ergonomi untuk kader

| Aturan | Angka |
|---|---|
| Sasaran sentuh minimum | 48 × 48 px, jarak antar tombol ≥ 8 px |
| Ukuran huruf isi | ≥ 17 px di ponsel |
| Angka pengukuran di form | 24 px, tebal |
| Tinggi kolom input | 56 px |
| Kontras teks | ≥ 4,5:1 biasa, ≥ 3:1 besar |
| Kolom input per layar pada alur pengukuran | maksimal 3 |
| Navigasi ponsel | bilah bawah, 4 butir, ikon + label |

Kolom angka wajib `inputMode="decimal"` dan `type="text"`, **bukan** `type="number"` — tombol naik-turun bawaannya terlalu kecil dan mudah tergeser saat menggulir.

## 8.5 Bahasa antarmuka

| Jangan | Pakai |
|---|---|
| "Submit" | "Simpan hasil pengukuran" |
| "Data berhasil disubmit" | "Hasil pengukuran tersimpan" |
| "Error: validation failed" | "Berat badan harus antara 0,5 dan 40 kg" |
| "No data available" | "Belum ada penimbangan bulan ini. Mulai dari tombol Ukur." |
| "Sync in progress" | "Mengirim 3 data yang tertunda" |

Nama tindakan konsisten sepanjang alur: tombol "Simpan" → notifikasi "Tersimpan".

---

# BAGIAN 9 — KURVA PERTUMBUHAN

## 9.1 Empat kurva

| Kurva | Sumbu datar | Sumbu tegak | Untuk siapa |
|---|---|---|---|
| BB/U | umur (bulan) | berat badan (kg) | kader, orang tua |
| TB/U | umur (bulan) | panjang/tinggi (cm) | kader, orang tua |
| BB/TB | panjang/tinggi (cm) | berat badan (kg) | kader, dietisien |
| Tren nilai Z | umur (bulan) | nilai Z ketiga indikator | **dokter dan admin saja** |

## 9.2 Pemakaian

```ts
import { semuaKurva } from '@/lib/grafik/seri'
import { PanelKurva } from '@/components/grafik/PanelKurva'

// di Server Component
const kurva = semuaKurva(riwayat, balita.jenisKelamin)

// di JSX
<PanelKurva {...kurva} peran={profil.peran} />
```

## 9.3 Empat keputusan desain kurva

1. **Jendela tampilan dipersempit ke sekitar riwayat anak**, bukan selalu 0–60 bulan. Rentang penuh membuat titik anak berdesakan di satu sudut. Lebar minimum enam bulan dijaga.

2. **Kurva BB/TB memakai standar yang berlaku pada kunjungan terakhir**, dan titik dari standar lain tetap digambar disertai catatan. Tabel rujukannya berbeda untuk anak di bawah dan di atas 24 bulan; pada 78 cm median BB/PB 10,08 kg sedangkan median BB/TB 10,21 kg. Menyembunyikannya membuat kurva lebih rapi tetapi menyesatkan.

3. **Kurva tren nilai Z ditambahkan** meskipun tidak ada pada KMS. Alasannya nyata: anak yang beratnya naik setiap kunjungan tetapi nilai Z-nya menurun sedang tumbuh lebih lambat daripada standar — pada kurva berat badan biasa hal itu sulit disadari karena garisnya tetap menanjak.

4. **Pita Z-Score dipertahankan hanya pada layar hasil satu pengukuran.** Pita tidak memerlukan riwayat sehingga langsung tampil saat kader menekan tombol hitung, termasuk offline.

## 9.4 Tiga hal yang wajib diperhatikan

1. **Selalu tampilkan `seri.catatan`.** Isinya menjelaskan titik dari standar berbeda, pengukuran di luar rentang, atau riwayat yang baru berisi satu titik.
2. **Nilai Z pada setiap titik tetap dihitung dengan standar yang benar untuk umurnya**, sehingga status gizi tidak terpengaruh oleh pilihan garis rujukan.
3. **Perender SVG dapat dipakai untuk laporan PDF.** `jspdf` tidak dapat memotret komponen Recharts, tetapi `renderKurvaSvg()` menghasilkan SVG sebagai teks.

## 9.5 Catatan perilaku: batas 24 bulan bukan hari ulang tahun kedua

24 bulan setara 730,5 hari menurut konvensi 30,4375 hari per bulan. Dua tahun kalender hanya 730 hari.

| Hari sejak lahir | Umur tercatat | Standar berlaku |
|---|---|---|
| 730 (ulang tahun kedua) | 23,98 bulan | panjang terlentang |
| 731 | 24,03 bulan | tinggi berdiri |

Sejalan dengan WHO Anthro, tidak diubah. Konsekuensinya perlu disampaikan kepada kader: pada tinggi yang sama, berat ideal berubah saat standar berpindah. Selisih 130 gram itu normal.

---

# BAGIAN 10 — REGISTRASI DAN VERIFIKASI

## 10.1 Alur

```
Pengguna mendaftar
   ├── Kader      → wajib memilih posyandu
   ├── Dokter     → wajib STR dan puskesmas
   └── Dietisien  → wajib STR dan puskesmas
        ▼
   status_akun = 'menunggu'   (SELURUH peran)
        ▼
   /menunggu-verifikasi
   Belum dapat mencatat, belum dapat membaca data balita
        ▼
   Admin membuka /admin/verifikasi
        ├── Setujui  → akses penuh sesuai peran
        └── Tolak    → status 'ditolak' + alasan, ditampilkan ke pendaftar
```

## 10.2 Konsekuensi operasional yang WAJIB disiapkan

**Kader yang mendaftar pada hari posyandu tidak dapat mencatat apa pun hari itu.** Kalau mendaftar Sabtu pagi dan admin baru membuka aplikasi Senin, satu sesi penimbangan hilang dan harus dicatat manual.

Tiga hal yang perlu disiapkan sebelum aplikasi dipakai:

1. **Pendaftaran kader beberapa hari sebelum jadwal posyandu.** Sampaikan dalam pelatihan kader, bukan sebagai catatan kecil.
2. **Petugas admin yang memeriksa antrean setiap hari kerja.** Tunjuk orangnya dengan nama, sediakan pengganti.
3. **Jalur mendesak** — nomor telepon puskesmas pembina atau admin yang diketahui kader.

View `v_antrean_verifikasi` menyertakan kolom `lama_menunggu`. Panel admin menandai pendaftaran yang menunggu lebih dari dua hari kerja.

## 10.3 Bila antrean terbukti menghambat

Sudah disiapkan tetapi **sengaja belum diaktifkan**: mendelegasikan persetujuan kader kepada dokter di puskesmas pembinanya, sementara dokter dan dietisien tetap di tangan admin karena menyangkut STR.

Fungsi `verifikasi_kader_oleh_puskesmas` ada di database tetapi hak eksekusinya dicabut. Untuk mengaktifkan perlu satu `grant`, dan keputusan itu harus dicatat di dokumen tata kelola.

**Saran: jangan diaktifkan dulu.** Jalankan sebulan dengan admin tunggal, ukur antreannya, baru putuskan. Menambah pendelegasian lebih mudah daripada menariknya kembali.

## 10.4 Yang ditegakkan database

| Aturan | Penegakan |
|---|---|
| Pendaftaran baru selalu menunggu | trigger `handle_new_user` |
| Peran admin tidak dapat didaftarkan mandiri | trigger `handle_new_user` |
| Pengguna tidak dapat mengubah peran/status sendiri | policy `ubah profil sendiri` |
| Akun menunggu tidak dapat membaca data balita | fungsi `boleh_lihat` |
| Akun menunggu tidak dapat menambah data | fungsi `is_aktif` |
| Kader wajib punya posyandu | `chk_kader_wajib_posyandu` |
| Nakes wajib punya puskesmas dan STR | `chk_nakes_wajib_puskesmas`, `chk_str_nakes` |
| Penolakan wajib beralasan ≥ 10 karakter | `chk_tolak_wajib_beralasan` |
| Keputusan wajib mencatat siapa dan kapan | `chk_keputusan_tercatat` |
| Admin tidak dapat menyetujui diri sendiri | fungsi `verifikasi_pengguna` |
| Setiap perubahan status tercatat | trigger `trg_audit_profiles` |

## 10.5 Alasan `proxy.ts` membaca status dari tabel, bukan dari klaim token

Klaim JWT hanya berubah saat token disegarkan, bawaannya satu jam. Kalau status dibaca dari klaim, persetujuan admin baru terasa satu jam kemudian — pada halaman yang sedang menunggu persetujuan, keterlambatan itu terasa seperti aplikasi rusak.

## 10.6 Admin pertama

```sql
update public.profiles
set role = 'admin', status_akun = 'disetujui',
    disetujui_oleh = id, disetujui_pada = now()
where id = '<uuid-pengguna>';
```

**Sediakan minimal dua akun admin institusional, bukan akun pribadi.** Aplikasi lama mengikat kewenangan tertinggi ke alamat Gmail pribadi; itu tidak boleh terulang.

---

# BAGIAN 11 — URUTAN VERIFIKASI SEBELUM LANJUT

Kerjakan berurutan. Jangan lanjut sebelum langkah sebelumnya bersih.

### Langkah 1 — Jalankan migrasi

```bash
supabase db push
supabase gen types typescript --linked > src/types/database.ts
```

Berkas tipe hasil `gen types` akan menyingkap ketidakcocokan antara `src/lib/db/pemetaan.ts` dan skema sebenarnya. Itu justru gunanya.

### Langkah 2 — Admin pertama dan master wilayah

Ikuti Bagian 10.6. Tambahkan minimal **dua posyandu pada dua puskesmas berbeda**, karena uji RLS memerlukannya untuk menguji pemisahan wilayah.

### Langkah 3 — Uji RLS

```bash
node --env-file=.env.local tests/rls/jalankan-uji-rls.mjs
```

30 skenario. **Setiap kegagalan adalah celah keamanan nyata, bukan uji yang perlu disesuaikan.** Perbaiki policy atau fungsinya, jangan ujinya.

Uji memakai **anon key**, bukan service role key — service role melewati RLS sehingga seluruh uji lulus secara menyesatkan. Skrip menolak berjalan bila mendeteksi service role key.

Jalankan terhadap proyek Supabase terpisah untuk pengujian, atau sebelum ada data nyata.

### Langkah 4 — Pemeriksaan tipe

```bash
npx tsc --noEmit
```

### Langkah 5 — Uji alur autentikasi manual

1. Daftar sebagai kader, lihat halaman menunggu verifikasi.
2. Coba buka `/dasbor` langsung lewat bilah alamat → harus dialihkan.
3. Setujui akun dari panel admin, muat ulang → harus langsung dapat masuk tanpa keluar-masuk.
4. Tolak satu akun tanpa alasan → harus gagal.
5. Tolak dengan alasan, masuk sebagai akun itu → alasan harus tampil.
6. Coba menyetujui akun admin sendiri → harus gagal.
7. Keluar, tekan tombol kembali peramban → jangan sampai masih terlihat data.

### Langkah 6 — Uji tampilan

`npm run dev`, periksa pada 390 px dan 1280 px. Bandingkan dengan `pratinjau/sistem-desain.html` dan `pratinjau/kurva-pertumbuhan.html` — keduanya sudah disetujui.

### Langkah 7 — Uji lapangan

Dampingi dua kader di satu posyandu nyata selama satu sesi penimbangan. Catat setiap kali mereka ragu, salah tekan, atau bertanya. **Temuan satu pagi di posyandu lebih berharga daripada dua pekan perbaikan berdasarkan dugaan.**

---

# BAGIAN 12 — SPRINT BERIKUTNYA DAN PROMPT SIAP TEMPEL

Status sprint:

| Sprint | Isi | Status |
|---|---|---|
| 0 | Membaca konteks | untuk dijalankan ulang di Antigravity |
| 1 | Fondasi Supabase | **sudah ditulis, belum diuji** |
| 2 | Sistem desain | **sudah ditulis sebagian** |
| 3 | Autentikasi dan verifikasi | **sudah ditulis, belum diuji** |
| 4 | Engine perhitungan | **selesai dan teruji** |
| 5 | Pendataan balita | belum |
| 6 | Form skrining dan kartu hasil | belum |
| 7 | Kurva WHO dan evaluasi velocity | **kurva selesai, evaluasi velocity selesai di engine** |
| 8 | PKMK dan dasbor dietisien | belum |
| 9 | Rekapitulasi, admin, ekspor | panel verifikasi selesai, sisanya belum |
| 10 | Offline dan PWA | belum |
| 11 | Uji keamanan dan kesiapan produksi | skrip RLS selesai, belum dijalankan |

---

**Sprint 0 — Orientasi (jalankan lebih dulu)**

> Baca `AGENTS.md`, `docs/KONTEKS_PROYEK.md`, `docs/STATUS_VERIFIKASI.md`, dan ketiga berkas di `supabase/migrations/`. Jangan menulis kode apa pun.
>
> Buat `docs/RENCANA_TEKNIS.md` berisi: (1) daftar seluruh berkas yang sudah ada beserta status verifikasinya, (2) daftar berkas yang masih perlu dibuat untuk Sprint 5 sampai 11, (3) urutan pengerjaan beserta ketergantungannya, (4) daftar risiko teknis.
>
> Tandai hal apa pun yang menurutmu tidak konsisten antar dokumen, dan tanyakan kepada saya sebelum melanjutkan. Perhatikan khusus: apakah nama kolom di `src/lib/db/pemetaan.ts` benar-benar cocok dengan ketiga migrasi.

---

**Sprint 1–3 verifikasi — Menjalankan yang sudah ditulis**

> Kode Supabase, autentikasi, dan verifikasi admin sudah ada tetapi belum pernah dijalankan. Tugasmu menjalankannya dan memperbaiki apa yang rusak, bukan menulis ulang.
>
> Langkah: (1) `supabase db push`, perbaiki setiap galat SQL; (2) `supabase gen types typescript --linked > src/types/database.ts`; (3) `npx tsc --noEmit`, perbaiki ketidakcocokan tipe yang muncul — terutama di `src/lib/db/pemetaan.ts` dan `src/lib/supabase/penjaga.ts`; (4) `npm run build`.
>
> Aturan: **jangan mengubah nama kolom di database untuk menyesuaikan kode.** Skema database adalah acuan; kode yang menyesuaikan. Bila menurutmu skema yang keliru, laporkan kepada saya, jangan diubah sendiri.
>
> Setelah bersih, laporkan daftar perubahan yang kamu lakukan beserta alasannya, dan sebutkan bagian mana yang menurutmu paling berisiko saat diuji manual.

---

**Sprint 5 — Pendataan balita**

> Bangun modul balita: `/balita` (daftar dengan pencarian nama tahan salah ketik ringan memakai `ilike` dan `pg_trgm`, dengan penomoran halaman), `/balita/baru`, `/balita/[id]` (profil dengan riwayat skrining dan kurva pertumbuhan).
>
> Pengambilan data di Server Component; mutasi lewat Server Action dengan `skemaBalita` dari `src/lib/validasi/skrining.ts` yang sudah ada. Panggil `wajibPeran(['kader','dokter','dietisien'])` sebagai baris pertama setiap Server Action.
>
> Wilayah balita diisi dari `wilayahUntukMenulis(profil)`, **tidak boleh** dari masukan formulir.
>
> Tangani galat duplikasi dari indeks `uq_balita_identitas` dengan pesan yang menjelaskan bahwa balita dengan nama dan tanggal lahir tersebut sudah terdaftar, disertai tautan ke profilnya. Tangani keadaan kosong dan keadaan memuat.
>
> Pada halaman profil, tampilkan `PanelKurva` dengan prop `peran` dari profil pengguna.

---

**Sprint 6 — Form skrining dan kartu hasil**

> Bangun `/balita/[id]/skrining-baru`: formulir tiga langkah (identitas dan tanggal → pengukuran → konfirmasi), maksimal 3 kolom input per layar, memakai komponen `InputAngka` yang sudah ada.
>
> Hasil dihitung di perangkat memakai `hitungSkrining` dari `@/lib/zscore` sehingga tampil seketika tanpa jaringan. `clientUuid` dibuat di perangkat sebelum pengiriman pertama.
>
> Server Action `simpanSkrining` wajib berurutan: `wajibPeran(...)` → validasi `skemaSkrining` → `periksaTerhadapBalita` → **hitung ulang seluruh nilai turunan di server dari angka mentah** → `keBarisSkrining()` → insert → `revalidatePath`.
>
> Jangan pernah menyimpan hasil hitung yang dikirim klien. Untuk data dari antrean offline, bandingkan dengan `bandingkanHasil()` dan catat selisihnya bila ada.
>
> Tampilkan `KartuHasil` yang sudah ada. Kasus Z < −3 pada TB/U atau BB/TB memunculkan banner rujukan yang tidak dapat ditutup.

---

**Sprint 8 — PKMK dan dasbor dietisien**

> Buat modul formulasi PKMK: dari target kalori dan densitas kalori produk, hitung volume harian, jumlah saji, dan takaran praktis. **Jangan memakai angka tetap 25 kkal per sendok** — hitung dari kolom `kkal_per_sendok` pada tabel `produk_pkmk`, yang sudah dihitung otomatis oleh database. Tampilkan hanya produk yang sesuai umur balita.
>
> Antarmukanya panel bawah, bukan modal tengah. Sertakan peringatan bahwa gizi buruk dengan komplikasi memerlukan penanganan rawat inap sesuai protokol.
>
> Bangun `/dietisien`: daftar balita berstatus gizi kurang dan gizi buruk di puskesmas pengguna, diurutkan dari yang paling gawat. **Penyaringan memakai kode kategori, bukan pencocokan teks** — pakai `perluIntervensiGizi()` dari `@/lib/zscore/klasifikasi`. Formulir asuhan gizi sesuai tabel `asuhan_gizi`. Akses hanya `dietisien` dan `admin`.

---

**Sprint 9 — Rekapitulasi dan ekspor**

> Bangun `/rekap` membaca view `v_rekap_bulanan` dengan penyaring bulan dan wilayah sesuai cakupan peran. **Setiap persentase wajib ditampilkan bersama pembilang dan penyebutnya** — view sudah menyediakan kolom `penyebut_tbu` dan `penyebut_bbtb`; baris `di_luar_rentang` tidak masuk penyebut.
>
> Ekspor Excel memakai `exceljs` dengan dua lembar: `Data` (satu baris per skrining) dan `Ringkasan` (agregat per posyandu). Bekukan baris judul, atur lebar kolom, format kolom tanggal sebagai tanggal, jangan menggabungkan sel.
>
> Ekspor PDF per skrining memakai `jspdf` dan `jspdf-autotable`, dimuat lewat `dynamic import` dengan `ssr: false`. Sisipkan kurva pertumbuhan memakai `renderKurvaSvg()` dari `@/lib/grafik/svg` — `jspdf` tidak dapat memotret Recharts. Isi PDF: kop dan logo, identitas balita dan orang tua, wilayah, tanggal, tabel hasil tiga indikator, hasil evaluasi kenaikan berat, rekomendasi, kalimat penyangkalan klinis, nama pemeriksa, kolom tanda tangan, tanggal cetak, dan versi engine di kaki halaman.

---

**Sprint 10 — Offline dan PWA**

> Terapkan kemampuan offline dengan `@serwist/next` dan `idb`. Buat `src/lib/offline/db.ts`, `outbox.ts`, dan `sync.ts` dengan pola kotak keluar: simpan skrining ke IndexedDB lebih dahulu berikut `clientUuid`, tampilkan hasil hitung lokal, kirim ke server saat jaringan tersedia. **Galat pelanggaran keunikan `client_uuid` diperlakukan sebagai sukses, bukan galat.**
>
> Strategi cache: kerangka aplikasi dan aset di-precache; daftar balita dalam cakupan pengguna `stale-while-revalidate`; master wilayah dan produk PKMK 7 hari; **data rekap tidak boleh di-cache** — angka lama lebih berbahaya daripada tidak ada angka. Data balita di luar cakupan pengguna tidak boleh pernah disimpan di perangkat.
>
> Data lokal dibersihkan saat pengguna keluar; entri outbox terkirim lebih dari 7 hari dihapus otomatis.
>
> Buat `IndikatorOffline` yang menampilkan jumlah data tertunda beserta tombol "Kirim sekarang". Buat `manifest.webmanifest` dan ikon 192, 512, maskable 512.
>
> Buktikan dengan rekaman peramban: mode offline, catat 3 skrining, kembali online, ketiganya terkirim tanpa duplikat.

---

**Sprint 11 — Kesiapan produksi**

> Jalankan `node --env-file=.env.local tests/rls/jalankan-uji-rls.mjs` dan laporkan hasilnya dalam bentuk tabel lulus/gagal. Perbaiki setiap kegagalan pada policy atau fungsinya, **jangan pada ujinya**.
>
> Buat uji E2E Playwright untuk alur: daftar sebagai kader → halaman menunggu → disetujui admin → masuk → tambah balita → catat skrining → lihat kartu hasil dan kurva → unduh PDF → keluar.
>
> Buat `docs/KESIAPAN_PRODUKSI.md` berisi daftar periksa go-live, dan laporkan setiap temuan keamanan yang kamu jumpai selama pengerjaan proyek ini.

---

# BAGIAN 13 — DAFTAR TINDAKAN YANG MENUNGGU PAK NELITIE

## 13.1 Mendesak

| | Tindakan | Alasan |
|---|---|---|
| 1 | **Perbaiki satu baris `firestore.rules` pada aplikasi lama** | Siapa pun dapat mendaftar sebagai dietisien berstatus disetujui lalu membaca seluruh data balita. Celah ini aktif sekarang |
| 2 | Periksa koleksi `users` di Firebase untuk akun dietisien/dokter berstatus disetujui yang tidak dikenali | menindaklanjuti butir 1 |

## 13.2 Sebelum aplikasi dipakai di lapangan

| | Tindakan | Diverifikasi oleh |
|---|---|---|
| 3 | Verifikasi rumus kalori dan protein tumbuh kejar | nutrisionis atau dokter anak |
| 4 | Verifikasi tabel RDA 110 / 100 / 90 kkal per kg | nutrisionis |
| 5 | Verifikasi tabel Kenaikan Berat Minimal harian | nutrisionis |
| 6 | Uji silang 10 kartu hasil dari data nyata terhadap perhitungan manual atau WHO Anthro | dokter anak |
| 7 | Arsipkan lembar verifikasi bertanda tangan | — |

Bawa `docs/PERBEDAAN_DENGAN_APLIKASI_LAMA.md` ke pertemuan verifikasi. Dokumen itu memuat angka sebelum dan sesudah untuk setiap perubahan.

## 13.3 Persiapan operasional

| | Tindakan |
|---|---|
| 8 | Tunjuk petugas admin bernama yang memeriksa antrean verifikasi setiap hari kerja, beserta penggantinya |
| 9 | Sediakan jalur mendesak (nomor telepon) yang diketahui kader |
| 10 | Sampaikan dalam pelatihan kader: **daftar beberapa hari sebelum jadwal posyandu** |
| 11 | Siapkan penjelasan penurunan angka growth faltering **sebelum** rekap bulanan berubah |
| 12 | Sepakati perlakuan data lama yang menjadi "tidak dapat dinilai" — tandai, laporkan, jangan hapus |
| 13 | Hitung ulang riwayat anak perempuan di bawah 24 bulan dengan panjang 95–96 cm |

## 13.4 Tata kelola

| | Tindakan |
|---|---|
| 14 | Dasar hukum pengolahan data — PKS atau surat penugasan dari Dinkes, menetapkan pengendali dan pemroses data |
| 15 | Mekanisme persetujuan orang tua |
| 16 | Kebijakan privasi yang dapat diakses dari dalam aplikasi |
| 17 | Masa retensi data dan prosedur penghapusan atas permintaan |
| 18 | Prosedur penanganan insiden kebocoran |
| 19 | Anggarkan paket berbayar Supabase dan Vercel lewat jalur pengadaan resmi — proyek gratis Supabase dijeda setelah seminggu tanpa aktivitas, dan Vercel Hobby ditujukan untuk non-komersial |
| 20 | Tinjau ketentuan rekam medis elektronik dan SATUSEHAT bersama bagian hukum bila aplikasi akan menjadi bagian RME |

## 13.5 Keputusan yang perlu diambil

| | Keputusan | Rekomendasi |
|---|---|---|
| 21 | Perlakuan kader yang sudah disetujui otomatis pada skema lama | Bila di bawah ~20 kader: kembalikan semua ke antrean, verifikasi dalam satu sesi. Di atas itu: pertahankan aktif, verifikasi susulan bertahap |
| 22 | Aktivasi pendelegasian persetujuan kader ke dokter puskesmas | **Jangan dulu.** Jalankan sebulan dengan admin tunggal, ukur antreannya, baru putuskan |

---

# BAGIAN 14 — DAFTAR BERKAS YANG SUDAH DIKIRIM

| Berkas | Isi |
|---|---|
| `PANDUAN_PENGEMBANGAN_TANGGUH_WEB.md` | Panduan migrasi lengkap, 20 bagian, termasuk 12 prompt sprint |
| `AGENTS.md` | Aturan mengikat untuk agen Antigravity |
| `20260819090000_init_tangguh.sql` | Migrasi pertama: skema, RLS, trigger, view |
| `20260819120000_patch_temuan_telaah.sql` | Migrasi kedua: kolom hasil telaah kode lama |
| `20260819140000_approval_semua_peran.sql` | Migrasi ketiga: persetujuan semua peran |
| `TELAAH_KODE_LAMA_TANGGUH.md` | Telaah pertama kode Firebase |
| `TELAAH_KODE_LAMA_TANGGUH_REV1.1.md` | Revisi: koreksi S-1, temuan K-3, T-5, T-6 |
| `VERIFIKASI_TABEL_WHO.md` | Laporan verifikasi 842 baris tabel |
| `PERBEDAAN_DENGAN_APLIKASI_LAMA.md` | Sembilan perbedaan hasil, untuk verifikasi klinis |
| `REGISTRASI_DAN_VERIFIKASI.md` | Alur persetujuan dan konsekuensi operasional |
| `STATUS_VERIFIKASI.md` | Bagian mana yang terbukti, mana yang belum |
| `sistem-desain.html` | Pratinjau sistem desain |
| `kurva-pertumbuhan.html` | Pratinjau kurva, tiga kasus nyata |
| `jalankan-uji-rls.mjs` | 30 skenario uji RLS |
| `tangguh-2.4.0.zip` | Seluruh kode, dokumen, migrasi, dan pratinjau |

---

# BAGIAN 15 — GLOSARIUM ISTILAH KUNCI

| Istilah | Arti dalam proyek ini |
|---|---|
| **LMS** | Tiga parameter WHO: L (Box-Cox power), M (median), S (coefficient of variation). Dipakai menghitung Z-Score |
| **Delta velocity** | Konstanta penggeser pada tabel velocity WHO. Nilai LMS **wajib** dikurangi delta untuk memperoleh kenaikan berat sebenarnya |
| **Usia-tinggi (height-age)** | Umur yang mediannya setara panjang atau tinggi anak. Dasar perhitungan RDA tumbuh kejar |
| **Kalori pemeliharaan** | RDA(umur kronologis) × berat aktual. Perilaku aplikasi lama |
| **Kalori tumbuh kejar** | RDA(usia-tinggi) × berat ideal untuk tinggi. Rumus dokumen desain |
| **Koreksi posisi** | ±0,7 cm antara pengukuran terlentang dan berdiri, ditentukan oleh **umur** bukan posisi |
| **Koreksi WHO nilai ekstrem** | Ekstrapolasi linear memakai jarak SD3–SD2 untuk \|Z\| > 3. Wajib dipertahankan |
| **`client_uuid`** | Penanda idempoten dibuat di perangkat, mencegah data ganda saat sinyal terputus |
| **`engine_version`** | Versi engine yang menghitung baris itu. Tanpanya hasil lama dan baru tidak dapat dibedakan |
| **Pita Z-Score** | Elemen penanda visual, pita bergaya meteran antropometri. Hanya di layar hasil satu pengukuran |
| **RLS** | Row Level Security. Policy di Postgres yang membatasi baris mana yang dapat dibaca dan ditulis tiap peran |
| **`security_invoker`** | Setelan view agar policy RLS pemanggil tetap berlaku. Wajib pada semua view |
| **`SECURITY DEFINER`** | Fungsi yang berjalan dengan hak pembuatnya. Dipakai pada fungsi pembantu RLS agar tidak terjadi rekursi |
| **Pola kotak keluar (outbox)** | Menyimpan ke IndexedDB lebih dahulu, mengirim ke server saat jaringan tersedia |
| **`proxy.ts`** | Nama middleware di Next.js 16. **Bukan lapisan keamanan** |

---

*Dokumen ini merangkum seluruh diskusi pengembangan Aplikasi TANGGUH sampai 19 Agustus 2026. Versi pustaka berubah cepat; ketika ada keraguan, dokumentasi resmi versi terkait yang berlaku, bukan dokumen ini.*
