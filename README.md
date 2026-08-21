# Engine Perhitungan TANGGUH — `zscore-2.0.0`

Paket ini berisi engine perhitungan antropometri untuk Aplikasi TANGGUH versi
Next.js, hasil pemindahan dari aplikasi versi Firebase beserta enam perubahan
perilaku yang sudah disetujui.

Status: engine dan lapisan murni **selesai dan teruji** (230 uji lolos).
Lapisan Supabase dan antarmuka **sudah ditulis tetapi belum pernah dijalankan**;
lihat `docs/STATUS_VERIFIKASI.md` sebelum memakainya.
Seluruh 842 baris tabel WHO diverifikasi baris per baris terhadap sumber resmi.

---

## Isi

```
src/lib/who/                        Tabel referensi WHO (dihasilkan otomatis, jangan diedit)
  tipe.ts                           Tipe bersama, termasuk penjelasan parameter delta
  lms-bbu-lk.ts  lms-bbu-pr.ts      BB/U, 61 baris, 0-60 bulan
  lms-tbu-lk.ts  lms-tbu-pr.ts      TB/U, 61 baris, 0-60 bulan
  lms-bbpb-lk.ts lms-bbpb-pr.ts     BB/PB, 131 baris, 45-110 cm
  lms-bbtb-lk.ts lms-bbtb-pr.ts     BB/TB, 111 baris, 65-120 cm
  velocity.ts                       6 tabel velocity, 114 baris, dengan delta
  index.ts                          Titik masuk tunggal

src/lib/zscore/                     Engine perhitungan
  tipe.ts                           Tipe domain
  umur.ts                           Umur dari tanggal murni, tanpa zona waktu
  lms.ts                            Interpolasi dan Z-Score dengan koreksi WHO
  klasifikasi.ts                    Kategori status gizi menurut Kemenkes
  gizi.ts                           Kalori dan protein, pemeliharaan dan tumbuh kejar
  velocity.ts                       Kenaikan berat badan, dengan koreksi delta
  index.ts                          hitungSkrining, satu-satunya pintu masuk
  __tests__/                        230 uji

referensi/engine-lama.ts            Salinan perilaku aplikasi Firebase, hanya untuk uji regresi
docs/PERBEDAAN_DENGAN_APLIKASI_LAMA.md   Dokumen untuk verifikasi klinis
docs/VERIFIKASI_TABEL_WHO.md        Laporan verifikasi 842 baris tabel terhadap WHO
```

---

## Cara memasang ke proyek Next.js

1. Salin folder `src/lib/who/` dan `src/lib/zscore/` ke proyek `tangguh-web`.
2. Salin `referensi/engine-lama.ts` juga. Berkas ini bukan bagian aplikasi, tetapi
   uji regresi memerlukannya. Jangan mengimpornya dari kode aplikasi.
3. Pastikan alias `@` menunjuk ke `src`. Pada Next.js hasil `create-next-app` alias
   itu sudah ada di `tsconfig.json`.
4. Pasang Vitest dan salin `vitest.config.ts`:
   ```bash
   npm install -D vitest
   ```
5. Tambahkan skrip di `package.json`:
   ```json
   "scripts": {
     "test": "vitest run",
     "cek": "tsc --noEmit && next lint && vitest run && next build"
   }
   ```
6. Jalankan `npm run test`. Seluruh 230 uji harus lolos sebelum melanjutkan ke
   Sprint 5.

---

## Cara memakai

### Menghitung satu skrining

```ts
import { hitungSkrining } from '@/lib/zscore'

const hasil = hitungSkrining({
  tanggalLahir: '2024-08-19',   // wajib YYYY-MM-DD
  tanggalPeriksa: '2026-08-21',
  jenisKelamin: 'lk',           // 'lk' atau 'pr'
  beratKg: 8,
  panjangCm: 78,
  posisiUkur: 'otomatis',       // 'terlentang' | 'berdiri' | 'otomatis'
  lilaCm: 12.1,                 // opsional
  edema: false,                 // opsional
})

hasil.statusBBTB          // 'gizi_buruk'
hasil.bbtb.z              // -3.06
hasil.isRedFlag           // true
hasil.alasanRedFlag       // ['Gizi buruk (BB/TB di bawah -3 SD)', ...]
hasil.gizi.metode         // 'catch_up'
hasil.gizi.kaloriCatchUpKkal        // 1021
hasil.gizi.kaloriPemeliharaanKkal   // 800
hasil.engineVersion       // 'zscore-2.0.0'
```

Nilai `posisiUkur: 'otomatis'` berarti pengukur mengikuti standar yang berlaku
menurut umur, sehingga tidak ada koreksi. Pakai `'terlentang'` atau `'berdiri'`
hanya bila posisi yang dipakai berbeda dari standar.

### Menangani nilai di luar rentang

`hitungSkrining` tidak pernah melempar galat untuk nilai di luar rentang. Ia
mengembalikan `null` pada indikator terkait dan menjelaskan alasannya:

```ts
if (hasil.diLuarRentang) {
  // hasil.alasanDiLuarRentang  -> ['umur_melebihi_60_bulan']
  // hasil.catatanDiLuarRentang -> teks siap ditampilkan kepada kader
}
```

Selalu periksa `diLuarRentang` sebelum menampilkan angka. Indikator yang bernilai
`null` harus tampil sebagai "Tidak dapat dinilai", bukan sebagai nol atau tanda hubung.

Galat hanya dilempar untuk format tanggal yang salah, berupa `TanggalTidakValidError`.

### Menilai kenaikan berat badan

```ts
import { hitungVelocity } from '@/lib/zscore'

const v = hitungVelocity({
  tanggalLahir: '2025-09-01',
  jenisKelamin: 'lk',
  tanggalAwal: '2026-08-02',   // penimbangan sebelumnya
  beratAwalKg: 9.0,
  tanggalAkhir: '2026-09-01',  // penimbangan sekarang
  beratAkhirKg: 9.1,
})

v.status               // 'naik' | 'tidak_naik' | 'growth_faltering' | 'tidak_dapat_dinilai'
v.kenaikanMinimalGram  // ambang persentil 5 WHO, delta sudah dikurangkan
v.metode               // wajib ditampilkan kepada pengguna
v.alasan               // terisi bila 'tidak_dapat_dinilai'
```

Teks pada `v.metode` **wajib ditampilkan**, karena membedakan penilaian berdasarkan
standar WHO dari penilaian berdasarkan jalur cadangan KBM yang masih perkiraan.

### Menggambar kurva

```ts
import { lmsUntukKurva, nilaiDariLms } from '@/lib/zscore'
import { tabelUmur, LANGKAH_UMUR_BULAN } from '@/lib/who'

const tabel = tabelUmur('tbu', 'lk')
const garisMinusDua = Object.keys(tabel).map((k) => {
  const bulan = Number(k)
  const lms = lmsUntukKurva(bulan, tabel, LANGKAH_UMUR_BULAN)
  return { x: bulan, y: lms ? nilaiDariLms(lms, -2) : null }
})
```

`lmsUntukKurva` menjepit nilai ke tepi tabel. Fungsi itu **hanya** untuk menggambar
garis. Jangan pernah memakainya untuk menetapkan status.

---

## Aturan yang tidak boleh dilanggar

1. **Jangan mengedit berkas di `src/lib/who/`.** Seluruh 842 barisnya sudah
   diverifikasi baris per baris terhadap tabel terbitan WHO. Setiap perubahan
   mengubah hasil diagnosis seluruh aplikasi. Bila suatu hari benar-benar perlu
   diubah, catat alasan dan sumbernya di kepala berkas, seperti pada koreksi
   baris 95,5 cm di `lms-bbpb-pr.ts`.
2. **Jangan menerima nilai Z, status gizi, atau kebutuhan kalori dari klien lalu
   menyimpannya apa adanya.** Server wajib memanggil `hitungSkrining` sendiri dari
   angka mentah.
3. **Simpan `engineVersion` pada setiap baris skrining.** Tanpa itu, hasil lama dan
   baru tidak dapat dibedakan bila rumus diperbaiki suatu hari.
4. **Jangan mengubah `src/lib/zscore/` tanpa memperbarui uji.** Perubahan tanpa uji
   dianggap belum selesai.
5. **Jalankan `npx vitest run` sebelum setiap commit** yang menyentuh folder ini.

---

## Yang masih menunggu verifikasi manusia

Tiga hal berikut sudah ditandai di dalam kode dan tidak dapat diselesaikan tanpa
tenaga kesehatan:

| Perkara | Lokasi | Perlu diverifikasi oleh |
|---|---|---|
| Rumus kalori dan protein tumbuh kejar | `src/lib/zscore/gizi.ts` | nutrisionis atau dokter anak |
| Tabel RDA 110 / 100 / 90 kkal per kg | `src/lib/zscore/gizi.ts` | nutrisionis |
| Tabel Kenaikan Berat Minimal harian | `src/lib/zscore/velocity.ts` | nutrisionis |

Rincian dan angka pembandingnya ada di `docs/PERBEDAAN_DENGAN_APLIKASI_LAMA.md`.

---

## Hasil uji terakhir

```
Test Files  9 passed (9)
     Tests  230 passed (230)

Regresi 4032 kasus, 1432 perbedaan:
    DISENGAJA_1_di_luar_rentang_ditolak: 1280
    DISENGAJA_2_ambang_tbu_kemenkes: 152
```

Tidak ada perbedaan berkategori `TIDAK_DIHARAPKAN`. Nilai Z identik pada seluruh
kasus yang dinilai kedua engine.

Verifikasi tabel: 842 baris dan 2.526 nilai L/M/S dibandingkan dengan tabel
terbitan WHO. Dua nilai berbeda, keduanya pada satu baris yang sama, dan sudah
dikoreksi. Lihat `docs/VERIFIKASI_TABEL_WHO.md`.

---

## Catatan tentang komponen React di paket ini

Folder `src/components/` dan `src/app/globals.css` disertakan sebagai bahan siap
pakai untuk proyek Next.js, tetapi **tidak ikut diperiksa** oleh `tsc` di paket
ini, karena paket ini sengaja tidak memasang React agar tetap ringan dan cepat
diuji.

Pemeriksaan tipe komponen dilakukan setelah berkasnya disalin ke proyek
`tangguh-web`, yang sudah memuat React, Next.js, dan lucide-react. Jalankan
`npx tsc --noEmit` di sana.

Logika yang dapat diuji sudah dipisahkan keluar dari komponen dan berada di
`src/lib/tampilan/`, sehingga tetap tercakup 171 uji di paket ini. Komponennya
sendiri hanya menyusun tampilan.

---

## Isi tambahan Sprint 2 (jembatan tampilan)

| Berkas | Isi |
|---|---|
| `src/lib/tampilan/status.ts` | Pemetaan kode kategori ke label, nada warna, dan ikon |
| `src/lib/tampilan/pita.ts` | Matematika Pita Z-Score, murni dan teruji |
| `src/lib/tampilan/format.ts` | Pemformatan angka, tanggal, umur, nama berkas |
| `src/lib/validasi/skrining.ts` | Skema Zod, dipakai formulir, Server Action, dan antrean offline |
| `src/lib/db/pemetaan.ts` | Hasil engine ke baris tabel `skrining`, dan pembanding klien vs server |
| `src/app/globals.css` | Token desain Tailwind v4 |
| `src/components/ui/` | Button, InputAngka, LencanaStatus |
| `src/components/skrining/` | PitaZScore, KartuHasil |
| `src/lib/tampilan/akses.ts` | Aturan akses per peran dan pesan status akun |
| `src/lib/grafik/seri.ts` | Penyusun seri kurva pertumbuhan, murni dan teruji |
| `src/lib/grafik/svg.ts` | Perender SVG kurva, untuk PDF dan pratinjau |
| `src/components/grafik/` | KurvaWHO, TrenZScore, PanelKurva (Recharts) |
| `pratinjau/sistem-desain.html` | Pratinjau sistem desain |
| `pratinjau/kurva-pertumbuhan.html` | Pratinjau kurva pertumbuhan, tiga kasus nyata |
| `supabase/migrations/` | Tiga berkas migrasi skema |
| `src/lib/supabase/` | Klien peramban, server, penjaga otorisasi, klien admin |
| `src/proxy.ts` | Penyegaran sesi dan pengalihan halaman (Next.js 16) |
| `src/app/(publik)/` | Halaman masuk, daftar, menunggu verifikasi, konfirmasi email |
| `src/app/(aplikasi)/admin/verifikasi/` | Panel antrean verifikasi admin |
| `tests/rls/jalankan-uji-rls.mjs` | 30 skenario uji RLS terhadap Supabase sungguhan |
| `docs/STATUS_VERIFIKASI.md` | Bagian mana yang sudah terbukti, mana yang belum |
| `docs/REGISTRASI_DAN_VERIFIKASI.md` | Alur persetujuan admin dan konsekuensinya |

Halaman pratinjau dihasilkan oleh engine, bukan ditulis manual. Setiap nilai Z,
setiap ambang kenaikan berat, dan setiap angka kebutuhan gizi di sana adalah
keluaran `hitungSkrining()` dan `hitungVelocity()` yang sebenarnya.

---

## Kurva pertumbuhan

Empat kurva tersedia, seluruhnya dapat diplot berulang mengikuti riwayat anak.

| Kurva | Sumbu datar | Sumbu tegak | Untuk siapa |
|---|---|---|---|
| BB/U | umur (bulan) | berat badan (kg) | kader, orang tua |
| TB/U | umur (bulan) | panjang atau tinggi badan (cm) | kader, orang tua |
| BB/TB | panjang atau tinggi badan (cm) | berat badan (kg) | kader, dietisien |
| Tren nilai Z | umur (bulan) | nilai Z ketiga indikator | dokter, dietisien |

Pemakaian:

```ts
import { semuaKurva } from '@/lib/grafik/seri'
import { PanelKurva } from '@/components/grafik/PanelKurva'

// di Server Component
const kurva = semuaKurva(riwayat, balita.jenisKelamin)

// di JSX
<PanelKurva {...kurva} peran={profil.role} />
```

`riwayat` adalah array `KunjunganRiwayat`, satu baris per skrining, diurutkan
bebas. Bentuknya sengaja dibuat sama dengan kolom tabel `skrining`, sehingga
hasil kueri Supabase dapat langsung dipetakan.

### Tiga hal yang wajib diperhatikan

1. **Selalu tampilkan `seri.catatan`.** Isinya menjelaskan hal yang mudah
   disalahpahami: titik yang berasal dari standar berbeda, pengukuran yang di
   luar rentang, atau riwayat yang baru berisi satu titik. Menyembunyikannya
   membuat kurva tampak rapi tetapi menyesatkan.

2. **Kurva BB/TB memakai satu standar untuk garis rujukannya**, yaitu standar
   yang berlaku pada kunjungan terakhir. Anak yang riwayatnya melintasi umur
   24 bulan memiliki titik dari dua standar, dan itu dijelaskan lewat catatan.
   Nilai Z pada setiap titik tetap dihitung dengan standar yang benar untuk
   umurnya, sehingga status gizi tidak terpengaruh.

3. **Perender SVG dapat dipakai untuk laporan PDF.** `jspdf` tidak dapat
   memotret komponen Recharts, tetapi `renderKurvaSvg()` menghasilkan SVG
   sebagai teks yang dapat disisipkan. Kurva di laporan cetak karena itu identik
   dengan kurva di layar.

---

## Akses menurut peran

| Peran | BB/U | TB/U | BB/TB | Tren nilai Z |
|---|---|---|---|---|
| Kader | ya | ya | ya | tidak |
| Dietisien | ya | ya | ya | tidak |
| Dokter | ya | ya | ya | ya |
| Admin | ya | ya | ya | ya |

Aturannya ada di `src/lib/tampilan/akses.ts`. Jangan menuliskannya ulang di
komponen. Menyembunyikan tab bukan lapisan keamanan: keamanan ada di policy RLS
dan pemeriksaan peran di Server Action.

Seluruh peran, termasuk kader, wajib melalui persetujuan admin sebelum dapat
memakai aplikasi. Lihat `docs/REGISTRASI_DAN_VERIFIKASI.md` untuk alurnya beserta
konsekuensi operasional yang perlu disiapkan sebelum aplikasi dipakai di lapangan.

---

## Baca ini sebelum memakai bagian autentikasi

Paket ini memuat dua jenis kode dengan tingkat kepercayaan yang berbeda, dan
perbedaannya penting.

**Sudah terbukti bekerja.** Engine perhitungan, tabel WHO, ambang velocity,
penyusun kurva, pemetaan label, aturan akses, dan skema validasi. Seluruhnya
dijalankan oleh 230 uji otomatis, termasuk regresi 4.032 kasus dan pembandingan
842 baris tabel terhadap terbitan WHO.

**Belum pernah dijalankan.** Skema SQL, policy RLS, klien Supabase, `proxy.ts`,
Server Action, dan seluruh komponen React. Ditulis dengan cermat mengikuti pola
resmi, tetapi paket ini disusun tanpa akses ke proyek Supabase, sehingga tidak ada
satu pun baris SQL yang pernah dieksekusi Postgres.

Konsekuensi yang paling perlu diperhatikan: **policy RLS yang salah tulis dapat
membuka seluruh data balita provinsi tanpa gejala apa pun di antarmuka.** Karena
itu langkah berikut tidak boleh dilewati:

```bash
supabase db push
supabase gen types typescript --linked > src/types/database.ts
node --env-file=.env.local tests/rls/jalankan-uji-rls.mjs
```

30 skenario. Jangan melanjutkan pengembangan selama masih ada yang gagal, dan
perlakukan setiap kegagalan sebagai celah keamanan nyata, bukan sebagai uji yang
perlu disesuaikan.

Urutan verifikasi lengkap beserta tujuh pemeriksaan manual ada di
`docs/STATUS_VERIFIKASI.md`.
