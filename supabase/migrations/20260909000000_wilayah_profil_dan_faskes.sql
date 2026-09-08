-- =====================================================================
-- APLIKASI TANGGUH - PERBAIKAN WILAYAH PROFIL, PERAN, DAN TABEL FASKES
--
-- Versi   : 1.7
-- Tanggal : 9 September 2026
--
-- LATAR BELAKANG
--
-- Administrator mencoba mengubah peran sebuah akun menjadi
-- `dokter_spesialis_anak` lewat halaman Manajemen Akun, dan menerima:
--
--   new row for relation "profiles" violates check constraint
--   "chk_spesialis_anak_di_rs"
--
-- Formulir edit admin hanya menyunting nama, peran, status, no HP, dan
-- no STR. Ia tidak pernah menyentuh `jenis_faskes`, `faskes_id`,
-- `puskesmas_id`, maupun `posyandu_id`. Akibatnya ada lima batasan
-- database yang MUSTAHIL dipenuhi dari formulir itu:
--
--   chk_spesialis_anak_di_rs   jenis_faskes wajib 'rumah_sakit'
--   chk_kader_wajib_posyandu   posyandu_id wajib terisi
--   chk_nakes_wajib_puskesmas  puskesmas_id wajib terisi
--   chk_keputusan_tercatat     disetujui_oleh & disetujui_pada wajib
--   chk_tolak_wajib_beralasan  alasan_tolak wajib >= 10 huruf
--
-- Perbaikan lapisan aplikasi ada di berkas TypeScript. Migrasi ini
-- mengerjakan dua hal yang HANYA bisa dikerjakan di database.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BAGIAN 1: DOKTER SPESIALIS ANAK TIDAK LAGI WAJIB BERPUSKESMAS
--
-- Migrasi 20260826100100 memasukkan `dokter_spesialis_anak` ke dalam
-- chk_nakes_wajib_puskesmas dengan alasan "agar profil tidak menggantung
-- tanpa induk". Alasan itu tidak berlaku untuk peran ini:
--
--   1. Peran ini SELALU bertugas di rumah sakit (chk_spesialis_anak_di_rs),
--      sehingga induknya adalah baris `faskes` bertipe 'rumah_sakit',
--      bukan sebuah puskesmas.
--
--   2. Cakupan datanya TIDAK ditentukan puskesmas. Fungsi
--      `boleh_akses_balita` mengalihkan peran ini ke
--      `spesialis_anak_boleh_lihat`, yang menilai dua hal saja: balita
--      yang ia catat sendiri, dan balita yang dirujuk ke rumah sakit
--      tempat ia bertugas. Nilai `my_puskesmas_id()` tidak pernah dibaca
--      untuk peran ini.
--
--   3. Memaksakan sebuah puskesmas justru menanam data yang tidak benar:
--      administrator harus menebak puskesmas mana yang hendak dituliskan
--      pada seorang spesialis yang tidak bekerja di puskesmas mana pun.
--
-- Dokter umum dan dietisien TETAP wajib berpuskesmas, karena cakupan
-- keduanya memang `p_puskesmas_id = my_puskesmas_id()`.
-- ---------------------------------------------------------------------

alter table public.profiles drop constraint if exists chk_nakes_wajib_puskesmas;
alter table public.profiles add constraint chk_nakes_wajib_puskesmas check (
  role not in ('dokter', 'dietisien')
  or puskesmas_id is not null
);

comment on constraint chk_nakes_wajib_puskesmas on public.profiles is
  'Dokter umum dan dietisien wajib berpuskesmas karena cakupan datanya ditentukan puskesmas. Dokter spesialis anak dikecualikan: induknya rumah sakit, dan cakupannya dinilai spesialis_anak_boleh_lihat.';

-- Sebagai gantinya, spesialis anak wajib punya fasilitas rumah sakit yang
-- nyata. Tanpa ini, mengecualikan peran itu dari batasan di atas akan
-- meninggalkan profil yang benar-benar tanpa induk apa pun.
alter table public.profiles drop constraint if exists chk_spesialis_anak_wajib_faskes;
alter table public.profiles add constraint chk_spesialis_anak_wajib_faskes check (
  role <> 'dokter_spesialis_anak'
  or faskes_id is not null
);

comment on constraint chk_spesialis_anak_wajib_faskes on public.profiles is
  'Spesialis anak wajib menunjuk baris faskes. Kejenisannya sebagai rumah sakit ditegakkan chk_spesialis_anak_di_rs dan diverifikasi lapisan aplikasi.';

-- Rapatkan chk_spesialis_anak_di_rs terhadap NULL.
--
-- Bentuk lamanya `role <> 'dokter_spesialis_anak' or jenis_faskes = 'rumah_sakit'`
-- LOLOS ketika jenis_faskes bernilai NULL: ekspresinya menjadi
-- `false or NULL` yang bernilai NULL, dan batasan CHECK menganggap NULL
-- sebagai terpenuhi. Sebelum migrasi ini celah itu tidak terjangkau karena
-- kolomnya berDEFAULT 'puskesmas'. Setelah DEFAULT dibuang pada Bagian 4,
-- celah itu menjadi nyata: seorang spesialis anak dapat tersimpan tanpa
-- jenis fasilitas sama sekali.
alter table public.profiles drop constraint if exists chk_spesialis_anak_di_rs;
alter table public.profiles add constraint chk_spesialis_anak_di_rs check (
  role <> 'dokter_spesialis_anak'
  or (jenis_faskes is not null and jenis_faskes = 'rumah_sakit')
);

comment on constraint chk_spesialis_anak_di_rs on public.profiles is
  'Spesialis anak selalu bertugas di rumah sakit. Tahan NULL: jenis_faskes yang kosong ditolak, bukan dianggap terpenuhi.';

-- ---------------------------------------------------------------------
-- BAGIAN 2: ROW LEVEL SECURITY UNTUK TABEL FASKES
--
-- `faskes` adalah SATU-SATUNYA tabel di skema ini yang tidak pernah
-- mendapat `enable row level security`. Nilainya memang bukan data
-- pribadi, tetapi:
--
--   - kolom `diusulkan_oleh` menunjuk profil pengguna
--   - halaman edit admin yang baru perlu MENAMBAH baris rumah sakit,
--     dan penambahan itu harus dibatasi pada administrator saja
--
-- Pola yang dipakai sama dengan tabel wilayah lainnya: dibaca semua
-- pengguna terautentikasi, dikelola administrator.
--
-- Fungsi `usulkan_faskes`, `sahkan_faskes_usulan`, dan `handle_new_user`
-- bersifat SECURITY DEFINER sehingga tidak terpengaruh perubahan ini.
-- Tidak ada satu pun kueri di dalam `src/` yang membaca tabel ini
-- sebelum migrasi ini, sehingga tidak ada yang patah.
-- ---------------------------------------------------------------------

alter table public.faskes enable row level security;

drop policy if exists "faskes dibaca semua" on public.faskes;
create policy "faskes dibaca semua" on public.faskes
  for select to authenticated using (true);

drop policy if exists "faskes dikelola admin" on public.faskes;
create policy "faskes dikelola admin" on public.faskes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- BAGIAN 3: TABEL puskesmas DIISI, KARENA KUNCI ASING MENUNJUK KE SANA
--
-- Ini temuan yang paling mengejutkan dalam audit ini, dan terbukti dengan
-- menjalankan seluruh migrasi pada PostgreSQL 16 yang kosong:
--
--     select count(*) from public.puskesmas;  ->  0
--     select count(*) from public.faskes;     ->  95
--
-- Migrasi 20260819160000 menanam 95 puskesmas Gorontalo ke dalam tabel
-- `faskes`, dan TIDAK SATU PUN migrasi pernah mengisi tabel `puskesmas`.
-- Sementara itu:
--
--     profiles.puskesmas_id  -> references public.puskesmas(id)
--     balita.puskesmas_id    -> references public.puskesmas(id)
--     skrining.puskesmas_id  -> references public.puskesmas(id)
--     posyandu.puskesmas_id  -> references public.puskesmas(id)
--     my_puskesmas_id()      -> membaca profiles.puskesmas_id
--
-- Artinya seluruh kunci asing puskesmas menunjuk tabel yang kosong, dan
-- penyalinan pada migrasi 20260819160000 berjalan ke arah yang justru
-- tidak dibutuhkan (`puskesmas` -> `faskes`, dari tabel kosong).
--
-- Akibat nyatanya pada halaman edit admin: dropdown puskesmas membaca
-- tabel `puskesmas`, sehingga hanya menampilkan baris yang kebetulan
-- sudah ada di sana, sementara 95 puskesmas yang sebenarnya tersimpan di
-- `faskes` tidak dapat dipilih sama sekali.
--
-- Penyalinan di bawah ini memakai id yang SAMA, sehingga profil yang
-- sudah menunjuk sebuah puskesmas tetap sah dan tidak ada data yang
-- berubah artinya. Baris yang kabupatennya kosong dilewati karena
-- `puskesmas.kabupaten_id` bersifat NOT NULL.
-- ---------------------------------------------------------------------

insert into public.puskesmas (id, kabupaten_id, nama, created_at)
select f.id, f.kabupaten_id, f.nama, f.created_at
from public.faskes f
where f.jenis = 'puskesmas'
  and f.kabupaten_id is not null
on conflict (id) do nothing;

-- Arah sebaliknya tetap dijalankan, untuk puskesmas yang ditambahkan
-- langsung ke tabel `puskesmas` setelah migrasi 20260819160000 dan karena
-- itu belum punya pasangan di `faskes`.
insert into public.faskes (id, nama, jenis, status, kabupaten_id, created_at)
select p.id, p.nama, 'puskesmas'::public.jenis_faskes,
       'master'::public.status_faskes, p.kabupaten_id, p.created_at
from public.puskesmas p
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- BAGIAN 4: ADMINISTRATOR TIDAK BERTUGAS DI WILAYAH MANA PUN
--
-- Tidak ada batasan yang mewajibkan administrator memiliki wilayah, dan
-- `boleh_akses_balita` mengembalikan `true` untuk peran admin tanpa
-- melihat wilayah sama sekali. Namun `handle_new_user` memberi setiap
-- pendaftar sebuah puskesmas cadangan, dan kolom `jenis_faskes` memiliki
-- DEFAULT 'puskesmas'. Akibatnya profil administrator tampil sebagai
-- "bertugas di Puskesmas X, Posyandu Y" pada halaman Manajemen Akun,
-- yang menyesatkan pembacanya.
--
-- Migrasi ini TIDAK mengosongkan wilayah administrator yang sudah ada.
-- Mengubah data pengguna tanpa diminta bukan kewenangan migrasi;
-- pengosongan dilakukan administrator sendiri lewat formulir edit yang
-- kini menyediakan pilihan "Tidak bertugas di wilayah mana pun".
--
-- Yang dikerjakan di sini hanya membuang DEFAULT yang menyesatkan itu,
-- supaya baris baru tidak lagi mengaku berpuskesmas tanpa dasar.
-- ---------------------------------------------------------------------

alter table public.profiles alter column jenis_faskes drop default;

comment on column public.profiles.jenis_faskes is
  'Jenis fasilitas tempat pengguna bertugas. NULL berarti tidak bertugas di fasilitas mana pun, yang sah bagi administrator. Wajib rumah_sakit bagi dokter spesialis anak.';
