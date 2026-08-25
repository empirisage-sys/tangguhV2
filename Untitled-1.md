# Instruksi Perubahan Alur Registrasi — Wilayah dan Fasilitas Kesehatan

Untuk ditempelkan ke Antigravity IDE. Versi 1.4, 20 Agustus 2026.
Menggantikan alur registrasi pada `docs/REGISTRASI_DAN_VERIFIKASI.md` Bagian 1.

---

## 1. Alur Baru yang Diminta

```
1. Pilih Provinsi                    → 38 provinsi, dropdown
2. Pilih Kabupaten/Kota              → dropdown, tergantung provinsi
3. Pilih jenis fasilitas             → Rumah Sakit  |  Puskesmas
        │
        ├── Rumah Sakit              → SELALU isi manual
        │
        └── Puskesmas
              ├── Provinsi Gorontalo → dropdown puskesmas + pilihan "Lainnya" untuk isi manual
              └── Luar Gorontalo     → isi manual
4. Khusus kader: nama Posyandu       → SELALU isi manual
```

---

## 2. Masalah yang Harus Diselesaikan Lebih Dahulu

Isian manual menimbulkan satu akibat yang tidak terlihat di formulir tetapi merusak keamanan data, dan ini harus dipahami sebelum kode ditulis.

**Cakupan data pada aplikasi ini ditentukan oleh `puskesmas_id` dan `posyandu_id`.** Seorang dokter melihat balita di puskesmasnya karena `puskesmas_id` profilnya cocok dengan `puskesmas_id` balita. Bila fasilitas diisi manual sebagai teks bebas, tidak ada id yang dapat dicocokkan.

Akibatnya, bila dibiarkan sebagai teks bebas:

- Dua kader menuliskan "Puskesmas Marisa" dan "PKM Marisa" akan berada di dua cakupan berbeda, sehingga tidak dapat melihat data yang sama.
- Rekapitulasi per puskesmas menjadi kacau karena satu puskesmas terpecah menjadi beberapa nama.
- Kebijakan RLS tidak dapat menegakkan pemisahan wilayah, karena tidak ada wilayah yang pasti.

### Penyelesaian yang saya usulkan

**Isian manual tidak langsung menjadi wilayah kerja, melainkan menjadi USULAN fasilitas yang dinormalkan admin saat memverifikasi akun.**

```
Pengguna mengisi manual "PKM Marisa"
        ▼
Tersimpan sebagai baris faskes berstatus 'usulan', dan
profil pengguna menunjuk ke baris usulan itu
        ▼
Akun berstatus 'menunggu' — memang belum boleh mengakses data
        ▼
Admin membuka antrean verifikasi dan melihat:
   "Fasilitas yang diusulkan: PKM Marisa (Kab. Pohuwato)"
   Sistem menampilkan kemiripan: "Puskesmas Marisa" sudah ada di master
        ▼
Admin memilih salah satu:
   (a) Tautkan ke fasilitas master yang sudah ada  → usulan dibuang
   (b) Sahkan menjadi fasilitas master baru        → usulan menjadi master
   (c) Tolak pendaftaran beserta alasannya
        ▼
Akun disetujui, dan profilnya SELALU menunjuk ke fasilitas master
```

Alur ini cocok dengan keputusan bahwa seluruh peran wajib melalui persetujuan admin. Admin memang sudah harus memeriksa setiap pendaftaran; menormalkan nama fasilitas hanyalah satu langkah tambahan pada layar yang sama.

Hasilnya: **tidak ada akun aktif yang wilayah kerjanya berupa teks bebas.** Setiap akun yang disetujui pasti menunjuk fasilitas master dengan id yang pasti, sehingga RLS dan rekapitulasi tetap dapat diandalkan.

Perlakuan yang sama berlaku untuk nama posyandu yang diisi kader.

---

## 3. Keputusan Cakupan Data

### D-9. Cakupan data — SUDAH DIPUTUSKAN (20 Agustus 2026)

| Peran dan tempat kerja | Boleh melihat |
|---|---|
| Kader | balita di posyandunya |
| Dokter atau dietisien di **puskesmas** | balita di puskesmasnya |
| Spesialis di **rumah sakit** | **hanya balita yang ia input sendiri** |
| Admin Dinkes | seluruh provinsi |

Ini cakupan paling ketat di antara tiga pilihan yang sempat dibahas, dan paling
mudah dipertanggungjawabkan: seseorang hanya melihat data yang ia catat sendiri.

**Tiga hal yang mengikuti keputusan ini, dan perlu Bapak ketahui.**

**Pertama, spesialis mencatat tanpa posyandu.** Ia tidak bertugas di posyandu
mana pun, sehingga kolom posyandu dilonggarkan menjadi boleh kosong — tetapi
hanya bila pencatatnya berbasis rumah sakit. Kader yang mencoba menyimpan tanpa
posyandu tetap ditolak, karena tanpa batasan itu kader dapat lolos dari seluruh
pemisahan wilayah.

**Kedua, satu anak dapat memiliki dua riwayat terpisah.** Karena spesialis tidak
dapat melihat data yang dicatat kader, ia juga tidak dapat menemukan anak yang
sudah terdaftar di posyandu. Bila anak yang sama datang ke rumah sakit,
spesialis akan mencatatnya sebagai balita baru. Kurva pertumbuhan di posyandu
dan di rumah sakit tidak akan menyambung.

Ini bukan kesalahan, melainkan harga dari cakupan yang ketat. Pilihannya memang
antara privasi dan kesinambungan data.

**Ketiga, ada jalan menyambungkannya kelak tanpa melonggarkan privasi**, yaitu
lewat rujukan: puskesmas menerbitkan rujukan ke rumah sakit tertentu, dan
rujukan itu membuka akses spesialis pada anak tersebut saja, bukan pada seluruh
kabupaten. Kolom `faskes_tujuan_id` sudah disiapkan di tabel `rujukan` tetapi
belum dipakai untuk hak akses. Mengaktifkannya kelak cukup menambah satu syarat
pada dua policy.

Saya sarankan dibiarkan seperti sekarang sampai alur rujukan benar-benar
berjalan di lapangan. Menambah akses lebih mudah daripada menariknya kembali.

### D-10. Kabupaten/kota di luar Gorontalo

Indonesia memiliki 416 kabupaten dan 98 kota. Saya hanya menyediakan data lengkap dan terverifikasi untuk 6 kabupaten/kota Gorontalo.

| Pilihan | Isi |
|---|---|
| A | Impor daftar lengkap 514 kabupaten/kota dari data master BPS atau Kemendagri |
| B | Untuk sementara, kabupaten di luar Gorontalo juga diisi manual dan dinormalkan admin |

**Rekomendasi saya: A**, dan datanya tidak sulit diperoleh — tersedia sebagai berkas terbuka mengacu penomoran Kementerian Dalam Negeri. Saya tidak menyalinnya di sini karena 514 baris yang saya tulis dari ingatan berisiko memuat kesalahan, dan kesalahan nama wilayah akan menyebar ke seluruh laporan.

Migrasi ini **mengaktifkan pilihan B** sebagai jalan sementara, dan strukturnya sudah siap menerima impor penuh kapan pun tanpa perlu mengubah skema.

---

## 4. Perubahan Skema

### 4.1 Tabel baru dan yang berubah nama

| Semula | Menjadi | Alasan |
|---|---|---|
| — | `provinsi` | jenjang wilayah baru, 38 baris |
| `kabupaten` | `kabupaten` + kolom `provinsi_id` | menautkan ke provinsi |
| `puskesmas` | **`faskes`** | kini menampung puskesmas dan rumah sakit |
| `posyandu` | `posyandu` + kolom status usulan | kader mengisi manual |
| `profiles.puskesmas_id` | `profiles.faskes_id` | mengikuti perubahan di atas |
| `balita.puskesmas_id` | `balita.faskes_id` | idem |
| `skrining.puskesmas_id` | `skrining.faskes_id` | idem |

### 4.2 Kolom penting pada `faskes`

| Kolom | Isi |
|---|---|
| `jenis` | `puskesmas` atau `rumah_sakit` |
| `nama` | nama resmi |
| `kabupaten_id` | wajib |
| `status` | `master` (sudah disahkan admin) atau `usulan` (isian manual, menunggu) |
| `diusulkan_oleh` | siapa yang mengusulkan, bila berstatus usulan |
| `sumber_data` | `seed_dinkes`, `usulan_pengguna`, atau `impor` |
| `kode_kemenkes` | kode registrasi Kemenkes, bila ada |

**Aturan mutlak: profil pengguna yang berstatus `disetujui` tidak boleh menunjuk `faskes` yang berstatus `usulan`.** Ditegakkan lewat batasan di database, bukan hanya di kode.

---

## 5. PROMPT SIAP TEMPEL

Salin seluruh blok di bawah ini ke Antigravity.

> Ubah alur registrasi agar mengikuti jenjang wilayah dan jenis fasilitas kesehatan. Migrasi database sudah tersedia di `supabase/migrations/20260819160000_wilayah_dan_faskes.sql` — **jalankan migrasi itu lebih dahulu**, lalu `supabase gen types typescript --linked > src/types/database.ts`, dan sesuaikan kode terhadap skema barunya. Jangan mengubah skema untuk menyesuaikan kode.
>
> **Formulir pendaftaran, berurutan dan bertingkat:**
>
> 1. **Provinsi** — dropdown dari tabel `provinsi`, 38 baris, diurutkan menurut nama.
> 2. **Kabupaten/Kota** — dropdown dari tabel `kabupaten` yang disaring `provinsi_id`. Nonaktif sampai provinsi dipilih. Bila provinsi yang dipilih belum memiliki data kabupaten, tampilkan kolom isian manual dengan keterangan "Kabupaten/kota Anda akan diperiksa admin saat verifikasi."
> 3. **Jenis fasilitas** — dua pilihan besar berbentuk kartu yang dapat ditekan, bukan dropdown: **Puskesmas** dan **Rumah Sakit**. Target sentuh minimal 48 piksel.
> 4. **Nama fasilitas**, dengan tiga perilaku berbeda:
>    - Jenis **Rumah Sakit** → selalu kolom isian manual, apa pun provinsinya.
>    - Jenis **Puskesmas** dan provinsi **Gorontalo** → dropdown dari tabel `faskes` yang disaring `kabupaten_id` dan `jenis = 'puskesmas'` dan `status = 'master'`, **ditambah satu pilihan terakhir bertuliskan "Lainnya, tidak ada dalam daftar"**. Bila dipilih, munculkan kolom isian manual di bawahnya.
>    - Jenis **Puskesmas** dan provinsi selain Gorontalo → selalu kolom isian manual.
> 5. **Nama Posyandu** — hanya muncul bila peran yang dipilih adalah kader. **Selalu isian manual**, tidak ada dropdown, karena data posyandu tidak tersedia lengkap di mana pun. Pengguna yang memilih jenis fasilitas Rumah Sakit tidak pernah melihat kolom ini.
> 6. Sisa kolom seperti sebelumnya: nama lengkap, email, kata sandi, nomor HP, nomor STR untuk dokter dan dietisien, serta centang persetujuan pengolahan data.
>
> **Penanganan isian manual — ini bagian terpenting:**
>
> Isian manual TIDAK BOLEH disimpan sebagai teks bebas pada profil. Panggil fungsi database `usulkan_faskes(...)` yang membuat baris `faskes` berstatus `usulan` lalu mengembalikan id-nya, dan simpan id itu pada profil. Perlakuan yang sama untuk posyandu lewat `usulkan_posyandu(...)`.
>
> Alasannya: cakupan data pada aplikasi ini ditentukan oleh id fasilitas. Teks bebas membuat dua kader yang menulis "Puskesmas Marisa" dan "PKM Marisa" berada di cakupan berbeda, membuat rekapitulasi per puskesmas terpecah, dan membuat policy RLS tidak dapat menegakkan pemisahan wilayah.
>
> **Panel verifikasi admin, tambahan:**
>
> Pada `/admin/verifikasi`, bila pendaftar menunjuk fasilitas atau posyandu berstatus `usulan`, tampilkan kotak "Fasilitas yang diusulkan" berisi nama yang diketik pendaftar, dan di bawahnya daftar fasilitas master yang mirip. Kemiripan dicari lewat fungsi `cari_faskes_mirip(...)` yang sudah ada di database dan memakai `pg_trgm`.
>
> Admin diberi tiga tombol:
> - **Tautkan ke fasilitas ini** — untuk setiap saran yang muncul. Memanggil `sahkan_faskes_usulan(usulan_id, faskes_master_id)`.
> - **Sahkan sebagai fasilitas baru** — memanggil `sahkan_faskes_usulan(usulan_id, null)`.
> - **Tolak pendaftaran** — seperti sebelumnya, wajib beralasan.
>
> Persetujuan akun **tidak boleh berhasil** selama fasilitas yang ditunjuk masih berstatus `usulan`. Database sudah menolaknya; tugas antarmuka adalah menjelaskan hal itu kepada admin sebelum ia menekan Setujui, bukan membiarkannya menemui pesan galat.
>
> **Yang harus diperbarui di kode yang sudah ada:**
>
> - `src/lib/validasi/pendaftaran.ts` — tambah `provinsiId`, `kabupatenId`, `jenisFaskes`, `faskesId`, `faskesManual`, `posyanduManual`. Aturan bersyarat: rumah sakit dan puskesmas luar Gorontalo mewajibkan `faskesManual`; puskesmas Gorontalo mewajibkan `faskesId` kecuali pilihan "Lainnya" yang lalu mewajibkan `faskesManual`; kader mewajibkan `posyanduManual`.
> - `src/lib/supabase/penjaga.ts` — ganti `puskesmasId` menjadi `faskesId` pada tipe `ProfilAktif`, tambah `provinsiId` dan `jenisFaskes`.
> - `src/lib/db/pemetaan.ts` — ganti `puskesmas_id` menjadi `faskes_id`.
> - `src/lib/tampilan/akses.ts` — tambah `cakupanData(peran, jenisFaskes)` yang mengembalikan `'posyandu' | 'faskes' | 'input_sendiri' | 'provinsi'`, mengikuti keputusan D-9. Spesialis rumah sakit bernilai `input_sendiri`.
> - Halaman daftar balita untuk pengguna rumah sakit wajib menampilkan keterangan bahwa daftar hanya memuat pasien yang ia input sendiri, agar ia tidak mengira datanya hilang.
> - Seluruh kueri yang menyebut `puskesmas`.
>
> **Yang tidak boleh berubah:** seluruh isi `src/lib/who/` dan `src/lib/zscore/`. Engine perhitungan tidak menyentuh wilayah sama sekali.
>
> **Uji yang wajib ditambahkan:**
>
> 1. Pendaftar memilih Rumah Sakit → kolom dropdown puskesmas tidak pernah muncul.
> 2. Pendaftar memilih Puskesmas di Gorontalo → dropdown terisi, dan pilihan "Lainnya" ada di urutan terakhir.
> 3. Pendaftar memilih Puskesmas di luar Gorontalo → langsung kolom isian manual.
> 4. Peran kader → kolom posyandu manual muncul dan wajib diisi; peran dokter → tidak muncul.
> 5. Isian manual menghasilkan baris `faskes` berstatus `usulan`, bukan teks pada profil.
> 6. Admin menyetujui akun yang fasilitasnya masih `usulan` → **gagal**, dengan pesan yang jelas.
> 7. `sahkan_faskes_usulan` dengan id master → profil pendaftar berpindah ke fasilitas master, dan baris usulan terhapus.
> 8. Dua pendaftar mengetik "PKM Marisa" dan "Puskesmas Marisa " (dengan spasi di akhir) → keduanya muncul sebagai saran yang sama di panel admin.
>
> Setelah selesai, laporkan berkas apa saja yang berubah, dan sebutkan bagian mana yang paling berisiko saat diuji manual.

---

## 6. Data Seed — 38 Provinsi

Kode mengikuti penomoran Kementerian Dalam Negeri dan BPS.

| Kode | Provinsi | | Kode | Provinsi |
|---|---|---|---|---|
| 11 | Aceh | | 51 | Bali |
| 12 | Sumatera Utara | | 52 | Nusa Tenggara Barat |
| 13 | Sumatera Barat | | 53 | Nusa Tenggara Timur |
| 14 | Riau | | 61 | Kalimantan Barat |
| 15 | Jambi | | 62 | Kalimantan Tengah |
| 16 | Sumatera Selatan | | 63 | Kalimantan Selatan |
| 17 | Bengkulu | | 64 | Kalimantan Timur |
| 18 | Lampung | | 65 | Kalimantan Utara |
| 19 | Kepulauan Bangka Belitung | | 71 | Sulawesi Utara |
| 21 | Kepulauan Riau | | 72 | Sulawesi Tengah |
| 31 | DKI Jakarta | | 73 | Sulawesi Selatan |
| 32 | Jawa Barat | | 74 | Sulawesi Tenggara |
| 33 | Jawa Tengah | | **75** | **Gorontalo** |
| 34 | DI Yogyakarta | | 76 | Sulawesi Barat |
| 35 | Jawa Timur | | 81 | Maluku |
| 36 | Banten | | 82 | Maluku Utara |
| | | | 91 | Papua Barat |
| | | | 92 | Papua Barat Daya |
| | | | 94 | Papua |
| | | | 95 | Papua Selatan |
| | | | 96 | Papua Tengah |
| | | | 97 | Papua Pegunungan |

Catatan: Undang-Undang Nomor 2 Tahun 2024 mengubah status Jakarta menjadi Daerah Khusus Jakarta, tetapi perubahan itu berlaku setelah ibu kota resmi berpindah ke Nusantara, yang ditargetkan 2028. Sampai saat itu, penamaan resmi yang masih dipakai BPS adalah DKI Jakarta. Bila kelak berubah, cukup satu perintah `update` pada tabel `provinsi`.

## 7. Data Seed — 6 Kabupaten/Kota Provinsi Gorontalo

| Kode | Nama | Ibu kota |
|---|---|---|
| 7501 | Kabupaten Boalemo | Tilamuta |
| 7502 | Kabupaten Gorontalo | Limboto |
| 7503 | Kabupaten Pohuwato | Marisa |
| 7504 | Kabupaten Bone Bolango | Suwawa |
| 7505 | Kabupaten Gorontalo Utara | Kwandang |
| 7571 | Kota Gorontalo | — |

## 8. Data Seed — Puskesmas Provinsi Gorontalo (95 unit)

### Kota Gorontalo (12)

Pilolodaa · Buladu · Dungingi · Limba B · Tamalate · Hulonthalangi · Dumbo Raya · Dulalowo · Wongkaditi · Sipatana · Kota Tengah · Kota Utara

### Kabupaten Gorontalo (21)

Batudaa Pantai · Biluhu · Batudaa · Dungaliyo · Molopatodu · Tabongo · Tibawa · Buhu · Pulubala · Boliyohuto · Bilato · Mootilango · Tolangohula · Asparaga · Limboto · Limboto Barat · Telaga · Pilohayanga · Telaga Biru · Tilango · Telaga Jaya

### Kabupaten Boalemo (11)

Mananggu · Tilamuta · Dulupi · Pangi · Botumoito · Paguyaman · Bongo II · Bongo Nol · Berlian · Sari Tani · Paguyaman Pantai

### Kabupaten Pohuwato (16)

Popayato · Popayato Barat · Popayato Timur · Lemito · Wonggarasi I · Wonggarasi II · Wanggarasi · Marisa · Patilanggio · Buntulia · Duhiadaa · Motolohu · Pancakarsa I · Pancakarsa II · Paguat · Dengilo

### Kabupaten Bone Bolango (20)

Tapa · Bulango Selatan · Bulango Timur · Bulango Utara · Bulango Ulu · Kabila · Botupingge · Tilongkabila · Toto Utara · Suwawa · Ulantha · Suwawa Selatan · Suwawa Tengah · Dumbayabulan · Pinogu · Bone Pantai · Kabila Bone · Tombulilato · Bone · Bulawa

### Kabupaten Gorontalo Utara (15)

Atinggola · Gentuma · Kwandang · Molingkapoto · Ponelo · Dambalo · Anggrek · Monano · Ilangata · Sumalata · Dulukapa · Buloila · Tolinggula · Biawu · Limbato

**Peringatan tentang mutu data ini.** Daftar puskesmas bersumber dari kompilasi tahun 2015–2016, dilengkapi dua puskesmas Kota Gorontalo yang saya temukan dari situs resmi Pemerintah Kota. Sejak itu bisa terjadi pemekaran wilayah, penggantian nama, atau pembukaan puskesmas baru.

Karena itu seluruh baris di-seed dengan `sumber_data = 'seed_kompilasi_2016'` dan `perlu_verifikasi = true`. Panel admin menampilkan penanda pada fasilitas yang belum diverifikasi. **Mintalah daftar resmi terbaru dari Dinas Kesehatan Provinsi**, lalu perbarui lewat panel admin. Sampai itu dilakukan, pilihan "Lainnya" menjadi jaring pengaman bila ada puskesmas yang tidak tercantum.

## 9. Rumah Sakit di Gorontalo — Tidak Di-seed, dan Alasannya

Bapak sudah meminta rumah sakit diisi manual, dan saya setuju. Tetapi 19 rumah sakit di Gorontalo sudah terdaftar resmi di Kemenkes berikut kodenya, jadi datanya ada.

Saya sertakan sebagai **seed opsional yang dikomentari** di dalam berkas migrasi. Bila diaktifkan, dokter di Gorontalo memilih dari dropdown alih-alih mengetik, dan itu mengurangi variasi penulisan nama yang harus dinormalkan admin.

Isian manual tetap tersedia untuk rumah sakit luar Gorontalo dan untuk yang belum terdaftar.

Terserah Bapak. Bila ingin diaktifkan, hapus tanda komentar pada Bagian 9 berkas migrasi.

---

## 10. Yang Perlu Diperbarui pada Dokumen Lain

| Dokumen | Perubahan |
|---|---|
| `docs/KONTEKS_PROYEK.md` Bagian 2 | tambah keputusan E-8 (alur wilayah), D-9, D-10 |
| `docs/KONTEKS_PROYEK.md` Bagian 10 | ganti diagram alur registrasi |
| `docs/REGISTRASI_DAN_VERIFIKASI.md` | tambah langkah normalisasi fasilitas oleh admin |
| `AGENTS.md` Bagian 4a | tambah aturan: isian manual tidak pernah menjadi teks bebas pada profil |
| `tests/rls/jalankan-uji-rls.mjs` | tambah 4 skenario pada Bagian 11 dokumen ini |

Saya belum memperbarui keempatnya karena menunggu keputusan D-9 dan D-10. Setelah Bapak putuskan, saya perbarui seluruhnya sekaligus agar tidak ada dokumen yang saling bertentangan.

## 11. Uji RLS Tambahan

| Skenario | Hasil yang harus terjadi |
|---|---|
| Admin menyetujui akun yang fasilitasnya berstatus `usulan` | gagal |
| Pengguna mengubah `faskes_id` profilnya sendiri menjadi fasilitas lain | ditolak |
| Kader memanggil `sahkan_faskes_usulan` | ditolak |
| Spesialis RS membaca balita yang diinput kader | kosong |
| Spesialis RS membaca balita yang ia input sendiri | berhasil |
| Spesialis RS A membaca balita yang diinput spesialis RS B | kosong |
| Dokter puskesmas membaca balita puskesmas lain | kosong |
| Kader menyimpan balita tanpa posyandu | ditolak |
| Spesialis RS menyimpan balita tanpa posyandu | berhasil |
| Dua usulan dengan nama sama persis dari dua pengguna | keduanya tercatat, dan admin melihat keduanya |