# Status Verifikasi Tiap Bagian

Tanggal: 19 Agustus 2026
Versi paket: 2.4.0

Berkas ini menjawab satu pertanyaan yang penting sebelum kode dipakai untuk
keputusan gizi anak: **bagian mana yang sudah terbukti bekerja, dan bagian mana
yang baru berupa niat baik.**

Tanpa pembedaan ini, mudah menganggap seluruh paket sama tepercayanya, padahal
tidak. Engine perhitungan sudah dijalankan ribuan kali; lapisan autentikasi belum
pernah dijalankan sama sekali.

---

## Ringkasan

| Bagian | Cara diverifikasi | Tingkat kepercayaan |
|---|---|---|
| Tabel referensi WHO | dibandingkan baris per baris dengan tabel terbitan WHO, 842 baris | **tinggi** |
| Engine perhitungan Z-Score | 230 uji otomatis, regresi 4.032 kasus terhadap engine lama | **tinggi** |
| Ambang velocity dengan koreksi delta | dibandingkan dengan kolom persentil 5 terbitan WHO, 114 titik | **tinggi** |
| Penyusun seri kurva pertumbuhan | 41 uji otomatis | **tinggi** |
| Perender SVG kurva | 12 uji otomatis, keluarannya dilihat langsung di pratinjau | **tinggi** |
| Pemetaan kategori ke label dan warna | 18 uji otomatis | **tinggi** |
| Aturan akses per peran | 18 uji otomatis | **tinggi** |
| Skema validasi Zod | 12 uji otomatis | **tinggi** |
| Pemetaan ke baris database | 8 uji otomatis, tetapi belum pernah menulis ke Postgres sungguhan | sedang |
| Skema SQL dan policy RLS | ditulis dengan cermat, **belum pernah dijalankan** | **rendah sampai diuji** |
| Klien Supabase dan proxy | ditulis mengikuti pola resmi, **belum pernah dijalankan** | **rendah sampai diuji** |
| Server Action pendaftaran dan verifikasi | ditulis dengan cermat, **belum pernah dijalankan** | **rendah sampai diuji** |
| Komponen React | **belum pernah dirender** | **rendah sampai diuji** |

---

## Apa Artinya "Belum Pernah Dijalankan"

Paket ini disusun tanpa akses ke proyek Supabase Bapak. Akibatnya:

1. **SQL belum pernah dieksekusi Postgres.** Salah nama kolom, salah tipe enum,
   atau urutan migrasi yang keliru baru akan terlihat saat `supabase db push`.
   Kesalahan seperti itu mudah diperbaiki tetapi pasti ada beberapa.
2. **Policy RLS belum pernah dievaluasi.** Policy yang salah tulis dapat
   membuka seluruh data balita provinsi tanpa gejala apa pun di antarmuka.
   Inilah sebabnya `tests/rls/jalankan-uji-rls.mjs` disediakan, dan sebabnya
   skrip itu **tidak boleh dilewati**.
3. **Berkas `.ts` yang mengimpor Next.js dan Supabase tidak ikut diperiksa tipe**
   di paket ini, karena paket ini sengaja tidak memasang kedua pustaka itu agar
   tetap ringan. Pemeriksaannya terjadi setelah berkasnya disalin ke proyek
   `tangguh-web`.
4. **Komponen React belum pernah dirender.** Kesalahan seperti prop yang tidak
   cocok atau kelas Tailwind yang salah baru terlihat di peramban.

Yang **sudah** terbukti adalah bagian yang paling menentukan kebenaran medis:
perhitungan Z-Score, tabel WHO, ambang velocity, dan klasifikasi status gizi.
Itu memang urutan prioritas yang benar — antarmuka yang jelek dapat diperbaiki
pekan depan, sedangkan Z-Score yang salah menghasilkan diagnosis yang salah pada
anak yang nyata.

---

## Urutan Verifikasi yang Disarankan

Kerjakan berurutan. Jangan lanjut sebelum langkah sebelumnya bersih.

### Langkah 1 — Jalankan migrasi

```bash
supabase db push
```

Perbaiki setiap galat SQL yang muncul. Setelah bersih:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

Berkas tipe itu akan menyingkap ketidakcocokan antara `src/lib/db/pemetaan.ts`
dan skema sebenarnya. Itu justru gunanya.

### Langkah 2 — Buat admin pertama dan master wilayah

Ikuti Bagian 8 pada migrasi ketiga. Lalu tambahkan minimal **dua posyandu pada
dua puskesmas berbeda**, karena uji RLS memerlukannya untuk menguji pemisahan
wilayah.

### Langkah 3 — Jalankan uji RLS

```bash
node --env-file=.env.local tests/rls/jalankan-uji-rls.mjs
```

30 skenario. Jangan lanjut selama masih ada yang gagal.

**Setiap kegagalan adalah celah keamanan nyata, bukan uji yang perlu
disesuaikan.** Perbaiki policy atau fungsinya, jangan ujinya. Kalau sebuah uji
terasa terlalu ketat, tuliskan alasannya di dokumen tata kelola sebelum
mengubahnya, supaya keputusan itu terlacak.

Jalankan terhadap proyek Supabase **terpisah untuk pengujian**, atau sebelum ada
data nyata. Skrip membuat akun uji dan tidak menghapusnya sendiri.

### Langkah 4 — Pemeriksaan tipe di proyek Next.js

Setelah seluruh berkas disalin ke `tangguh-web`:

```bash
npx tsc --noEmit
```

Perbaiki galat tipe yang muncul dari berkas di `src/lib/supabase/`, `src/app/`,
dan `src/components/`.

### Langkah 5 — Uji alur autentikasi secara manual

Tujuh hal yang perlu dicoba sendiri:

1. Daftar sebagai kader, lihat halaman menunggu verifikasi.
2. Coba buka `/dasbor` langsung lewat bilah alamat, harus dialihkan.
3. Setujui akun itu dari panel admin, lalu muat ulang, harus langsung dapat
   masuk tanpa perlu keluar dan masuk lagi.
4. Tolak satu akun tanpa alasan, harus gagal.
5. Tolak dengan alasan, lalu masuk sebagai akun itu, alasannya harus tampil.
6. Coba menyetujui akun admin sendiri, harus gagal.
7. Keluar, lalu tekan tombol kembali peramban, jangan sampai masih terlihat data.

Butir ketiga adalah alasan `proxy.ts` membaca status dari tabel `profiles` dan
bukan dari klaim token. Klaim hanya berubah saat token disegarkan, bawaannya satu
jam, dan keterlambatan sejam pada halaman menunggu persetujuan akan terasa
seperti aplikasi rusak.

### Langkah 6 — Uji tampilan

Jalankan `npm run dev`, lalu periksa pada lebar 390 piksel dan 1280 piksel.
Bandingkan dengan `pratinjau/sistem-desain.html` dan
`pratinjau/kurva-pertumbuhan.html`. Kedua berkas itu adalah acuan yang sudah
Bapak setujui.

### Langkah 7 — Uji lapangan

Dampingi dua kader di satu posyandu nyata selama satu sesi penimbangan. Catat
setiap kali mereka ragu, salah tekan, atau bertanya. Temuan satu pagi di posyandu
lebih berharga daripada dua pekan perbaikan berdasarkan dugaan.

---

## Yang Tetap Tidak Dapat Diverifikasi oleh Kode

Tiga hal ini menunggu tanda tangan manusia yang berkompeten, dan tidak akan
pernah lulus lewat pengujian otomatis:

| Perkara | Lokasi penanda | Diverifikasi oleh |
|---|---|---|
| Rumus kalori dan protein tumbuh kejar | `src/lib/zscore/gizi.ts` | nutrisionis atau dokter anak |
| Tabel RDA 110 / 100 / 90 kkal per kg | `src/lib/zscore/gizi.ts` | nutrisionis |
| Tabel Kenaikan Berat Minimal harian | `src/lib/zscore/velocity.ts` | nutrisionis |

Bawa `docs/PERBEDAAN_DENGAN_APLIKASI_LAMA.md` ke pertemuan verifikasi. Dokumen
itu memuat angka sebelum dan sesudah untuk setiap perubahan, sehingga yang
memverifikasi dapat menilai tanpa perlu membaca kode.

Ditambah satu hal yang bersifat tata kelola, bukan teknis: dasar hukum
pengolahan data, mekanisme persetujuan orang tua, dan penunjukan petugas admin
yang memeriksa antrean verifikasi setiap hari kerja. Tanpa yang terakhir, kader
di lapangan akan menunggu tanpa kepastian, dan aplikasi ini akan dianggap
menghambat alih-alih membantu.
