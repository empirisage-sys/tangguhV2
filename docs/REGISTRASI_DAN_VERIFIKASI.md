# Registrasi dan Verifikasi Pengguna — Aplikasi TANGGUH

Versi: 1.4
Tanggal: 20 Agustus 2026
Berlaku setelah migrasi `20260819160000_wilayah_dan_faskes.sql` dijalankan

---

## 1. Keputusan

**1. Seluruh peran wajib melalui persetujuan admin sebelum dapat memakai aplikasi.** Tidak ada pengecualian, termasuk untuk kader posyandu.
**2. Alur pendaftaran bertingkat:** Provinsi (38 provinsi) ➔ Kabupaten/Kota ➔ Jenis Faskes (Puskesmas | Rumah Sakit) ➔ Nama Faskes (Master / Usulan) ➔ Posyandu (Khusus kader).
**3. Cakupan Data Balita (Keputusan D-9):**
- Kader: balita di posyandu tempat bertugas.
- Dokter/Dietisien Puskesmas: balita di puskesmas tempat bertugas.
- Spesialis/Nakes Rumah Sakit: HANYA balita yang ia input sendiri (dan balita rujukan aktif).
- Admin: seluruh provinsi.

```
Pengguna mendaftar
        │
        ├── Pilih Peran: Kader / Dokter / Dietisien
        ├── 1. Provinsi: Dropdown 38 provinsi se-Indonesia
        ├── 2. Kabupaten/Kota: Dropdown (Gorontalo) / Isian Manual (Luar Gorontalo)
        ├── 3. Jenis Fasilitas: Kartu Puskesmas vs Rumah Sakit
        ├── 4. Nama Fasilitas:
        │       ├── Rumah Sakit ➔ Selalu Isian Manual (status: usulan)
        │       ├── Puskesmas Gorontalo ➔ Dropdown 95 Puskesmas Master + "Lainnya"
        │       └── Puskesmas Luar Gorontalo ➔ Isian Manual (status: usulan)
        └── 5. Nama Posyandu: Khusus Kader, selalu isian manual (status: usulan)
        │
        ▼
   status_akun = 'menunggu' (seluruh peran, tanpa kecuali)
        │
        ▼
   Admin membuka /admin/verifikasi
        │
        ├── Kotak Faskes Usulan: Rekomendasi master yang mirip (Levenshtein/Substring)
        ├── Opsi A: Tautkan ke fasilitas master yang sudah ada
        ├── Opsi B: Sahkan menjadi fasilitas master baru
        └── Opsi C: Tolak pendaftaran beserta alasan wajib
```

Peran `admin` tidak dapat dibuat lewat pendaftaran mandiri. Bila ada yang
mencoba mengirim `role: 'admin'` saat mendaftar, trigger menurunkannya menjadi
`kader` dan tetap menempatkannya di antrean verifikasi.

---

## 2. Konsekuensi Operasional yang Perlu Disiapkan

Keputusan ini menaikkan ketertiban data, tetapi ada harganya, dan harga itu
dibayar di lapangan bukan di kode.

**Kader yang mendaftar pada hari posyandu tidak dapat mencatat apa pun hari itu.**
Ia harus menunggu admin. Kalau pendaftaran terjadi Sabtu pagi saat posyandu
berjalan dan admin baru membuka aplikasi Senin, satu sesi penimbangan hilang
dari sistem dan harus dicatat manual lalu dimasukkan menyusul.

Tiga hal yang perlu disiapkan sebelum aplikasi dipakai:

1. **Pendaftaran kader dilakukan beberapa hari sebelum jadwal posyandu.**
   Sampaikan ini dalam pelatihan kader, bukan sebagai catatan kecil di panduan.
2. **Ada petugas admin yang memeriksa antrean setiap hari kerja.** Tunjuk orangnya
   dengan nama, bukan sekadar "bagian gizi". Sediakan pengganti saat yang
   bersangkutan tidak masuk.
3. **Ada jalur mendesak.** Nomor telepon puskesmas pembina atau admin, yang
   diketahui kader, untuk kasus pendaftaran yang perlu didahulukan.

Untuk membantu pemantauan, view `v_antrean_verifikasi` menyertakan kolom
`lama_menunggu`. Panel admin sebaiknya menandai pendaftaran yang menunggu lebih
dari dua hari kerja dengan warna waspada.

### Bila antreannya terbukti menghambat

Seluruh persetujuan berada di tangan admin provinsi, yang berarti kader dari enam
kabupaten menunggu satu meja. Bila itu terbukti menjadi hambatan setelah
aplikasi berjalan, ada jalan tengah yang sudah disiapkan tetapi **sengaja belum
diaktifkan**: mendelegasikan persetujuan kader kepada dokter di puskesmas
pembinanya, sementara persetujuan dokter dan dietisien tetap di tangan admin
karena menyangkut pemeriksaan nomor STR.

Fungsi `verifikasi_kader_oleh_puskesmas` sudah ada di database tetapi tidak
diberi hak eksekusi. Untuk mengaktifkannya perlu satu perintah `grant`, dan
keputusan itu harus dicatat di dokumen tata kelola karena mengubah siapa yang
bertanggung jawab atas kebenaran data kader.

Saya sarankan **jangan diaktifkan dulu**. Mulailah dengan jalur admin tunggal,
ukur berapa lama antreannya sebenarnya selama satu bulan, baru putuskan. Menambah
pendelegasian lebih mudah daripada menariknya kembali.

---

## 3. Apa yang Dapat dan Tidak Dapat Dilakukan Akun Menunggu

| Tindakan | Akun menunggu | Akun disetujui |
|---|---|---|
| Masuk ke aplikasi | bisa | bisa |
| Melihat dan menyunting profil sendiri | bisa | bisa |
| Melihat daftar balita | **tidak** | sesuai cakupan peran |
| Melihat riwayat skrining | **tidak** | sesuai cakupan peran |
| Menambah balita atau skrining | **tidak** | sesuai cakupan peran |
| Melihat rekapitulasi | **tidak** | sesuai cakupan peran |

Perhatikan baris kedua dan ketiga. Pada migrasi pertama, akun berstatus menunggu
sebenarnya masih dapat **membaca** data balita, karena fungsi `boleh_lihat` hanya
memeriksa wilayah tanpa memeriksa persetujuan. Hanya penambahan data yang
terhalang. Celah itu ditutup pada migrasi ini: `boleh_lihat` sekarang memeriksa
persetujuan lebih dahulu, sebelum wilayah.

---

## 4. Yang Ditegakkan Database, Bukan Hanya Antarmuka

Aturan berikut berada di dalam Postgres, sehingga berlaku pada semua jalur akses
termasuk bila ada yang memanggil API secara langsung.

| Aturan | Cara penegakan |
|---|---|
| Pendaftaran baru selalu berstatus menunggu | trigger `handle_new_user` |
| Peran admin tidak dapat didaftarkan mandiri | trigger `handle_new_user` |
| Pengguna tidak dapat mengubah peran atau status akunnya sendiri | policy `ubah profil sendiri` |
| Akun menunggu tidak dapat membaca data balita | fungsi `boleh_lihat` |
| Akun menunggu tidak dapat menambah data | fungsi `is_aktif` |
| Kader wajib punya posyandu | `chk_kader_wajib_posyandu` |
| Tenaga kesehatan wajib punya puskesmas | `chk_nakes_wajib_puskesmas` |
| Tenaga kesehatan wajib punya nomor STR | `chk_str_nakes` |
| Penolakan wajib disertai alasan minimal 10 karakter | `chk_tolak_wajib_beralasan` |
| Keputusan verifikasi wajib mencatat siapa dan kapan | `chk_keputusan_tercatat` |
| Admin tidak dapat menyetujui akunnya sendiri | fungsi `verifikasi_pengguna` |
| Hanya admin yang dapat memverifikasi | fungsi `verifikasi_pengguna` |
| Setiap perubahan status tercatat | trigger `trg_audit_profiles` |

Verifikasi dilakukan lewat fungsi `verifikasi_pengguna`, bukan lewat `update`
langsung. Alasannya: fungsi dapat menjamin beberapa hal sekaligus dalam satu
langkah — penolakan beralasan, pencatatan siapa dan kapan, dan larangan
menyetujui diri sendiri — yang tidak dapat dijamin oleh policy RLS sendirian.

Pemakaian dari Server Action:

```ts
const { data, error } = await supabase.rpc('verifikasi_pengguna', {
  p_pengguna_id: pengguna.id,
  p_setujui: true,
})
```

---

## 5. Uji RLS yang Wajib Ditambahkan

Lima skenario berikut menutup celah yang baru dibuka oleh perubahan ini.
Tambahkan ke `tests/rls/`.

| Skenario | Hasil yang harus terjadi |
|---|---|
| Kader berstatus menunggu membaca daftar balita | kosong |
| Kader berstatus menunggu menambah skrining | ditolak |
| Kader berstatus menunggu membaca rekapitulasi | kosong |
| Admin memverifikasi akunnya sendiri | gagal, dengan pesan yang jelas |
| Admin menolak tanpa alasan atau dengan alasan kurang dari 10 karakter | gagal |
| Dokter memanggil `verifikasi_pengguna` | gagal |
| Dokter memanggil `verifikasi_kader_oleh_puskesmas` | gagal, karena hak eksekusi dicabut |
| Pendaftaran dengan `role: 'admin'` | tercatat sebagai kader berstatus menunggu |

Uji memakai **anon key**, bukan service role key. Service role melewati RLS
sehingga seluruh uji akan lulus secara menyesatkan.

---

## 6. Menertibkan Data yang Sudah Ada

Bila migrasi pertama sudah dijalankan dan sudah ada kader yang disetujui
otomatis, ada dua pilihan. Keduanya sengaja dikomentari di berkas migrasi agar
tidak berjalan tanpa keputusan Bapak.

**Pilihan A — pertahankan kader yang sudah aktif.** Mereka tetap dapat bekerja,
dan kolom `disetujui_oleh` diisi dengan penanda bahwa persetujuannya berasal dari
kebijakan lama. Lebih ramah di lapangan, tetapi ada sekelompok akun yang tidak
pernah benar-benar diverifikasi manusia.

**Pilihan B — kembalikan seluruh kader ke antrean.** Lebih tertib, tetapi
menghentikan pencatatan sampai admin selesai. **Jangan dijalankan pada hari
posyandu.**

Bila belum ada data sama sekali, kedua pilihan tidak diperlukan dan aplikasi
langsung berjalan dengan aturan baru.

Saran saya: bila jumlah kader yang sudah aktif masih di bawah sekitar dua puluh,
pilih B dan verifikasi semuanya dalam satu sesi, sehingga tidak ada akun yang
statusnya tidak jelas. Di atas itu, pilih A dan verifikasi susulan secara
bertahap.

---

## 7. Admin Pertama

Peran admin tidak dapat dibuat lewat pendaftaran mandiri, jadi admin pertama
dibuat sekali lewat SQL Editor Supabase:

```sql
update public.profiles
set role = 'admin',
    status_akun = 'disetujui',
    disetujui_oleh = id,
    disetujui_pada = now()
where id = '<uuid-pengguna>';
```

Dua hal yang perlu dipatuhi:

1. **Sediakan minimal dua akun admin**, agar tidak ada satu titik kegagalan bila
   pemegangnya berhalangan.
2. **Pakai akun institusional, bukan akun pribadi.** Aplikasi lama mengikat
   kewenangan tertinggi ke alamat Gmail pribadi lewat `firestore.rules`, dan itu
   temuan tata kelola yang tidak boleh terulang. Catat pemegang peran admin di
   dokumen tata kelola beserta prosedur penggantiannya.

---

## 8. Perubahan Kedua: Kurva Tren Nilai Z Hanya untuk Dokter

Keputusan terpisah pada tanggal yang sama.

| Peran | BB/U | TB/U | BB/TB | Tren nilai Z |
|---|---|---|---|---|
| Kader | ya | ya | ya | tidak |
| Dietisien | ya | ya | ya | tidak |
| Dokter | ya | ya | ya | **ya** |
| Admin | ya | ya | ya | ya |

Alasannya: kurva tren nilai Z paling informatif secara klinis, tetapi juga paling
menuntut penafsiran. Nilai Z yang menurun sementara berat badan naik memerlukan
pemahaman, bukan sekadar pembacaan. Menampilkannya tanpa pendampingan berisiko
menimbulkan kesimpulan yang keliru.

Dietisien tetap memakai tiga kurva WHO beserta angka nilai Z pada tabel riwayat,
yang sudah cukup untuk menyusun asuhan gizi.

Aturannya ada di `src/lib/tampilan/akses.ts`, diuji, dan dipakai `PanelKurva`
lewat prop `peran`.

**Yang perlu ditegaskan:** menyembunyikan tab bukan lapisan keamanan. Data
riwayat tetap dilindungi policy RLS dan pemeriksaan peran di Server Action.
Penyembunyian di antarmuka semata agar pengguna tidak dibebani hal yang bukan
urusannya. Bila suatu hari ada kader yang secara teknis dapat memanggil datanya
langsung, itu bukan kebocoran — nilai Z memang sudah tampil di tabel riwayat yang
boleh ia lihat. Yang dibatasi adalah penyajian grafiknya, bukan datanya.
