-- =====================================================================
-- APLIKASI TANGGUH - MIGRASI KEENAM (BAGIAN 2 DARI 3)
-- ATURAN UNTUK PERAN DOKTER SPESIALIS ANAK
--
-- Versi     : 1.6
-- Tanggal   : 26 Agustus 2026
-- Prasyarat : 20260826100000_peran_dsa_enum.sql (WAJIB sudah selesai, karena
--             nilai enum baru tidak boleh dipakai pada transaksi yang sama
--             dengan penambahannya)
--
-- RINGKASAN KEPUTUSAN
--
-- Dokter Spesialis Anak bertugas di Rumah Sakit dan berada di ujung rantai
-- rujukan Posyandu -> Puskesmas -> Rumah Sakit. Cakupan datanya karena itu
-- bukan "satu puskesmas penuh" seperti dokter umum dan dietisien, melainkan:
--
--   1. balita yang ia catat sendiri, dan
--   2. balita yang dirujuk ke Rumah Sakit tempat ia bertugas.
--
-- CATATAN PENTING TENTANG boleh_lihat()
--
-- Migrasi 20260819160000 menambahkan boleh_lihat() versi empat argumen yang
-- sadar-faskes, tetapi tidak pernah mengalihkan satu pun policy kepadanya:
-- seluruh policy masih terikat pada versi tiga argumen. Akibatnya kini ada
-- dua kandidat untuk pemanggilan tiga argumen, sehingga setiap SQL baru yang
-- menulis boleh_lihat(a, b, c) gagal dengan galat 42725 "function is not
-- unique".
--
-- Migrasi ini karena itu TIDAK menambah beban lagi pada nama boleh_lihat.
-- Ia memperkenalkan nama tersendiri, boleh_akses_balita(), yang menyalin
-- persis perilaku versi tiga argumen untuk peran lama dan menambahkan satu
-- cabang baru untuk spesialis anak. Kedua versi boleh_lihat dibiarkan utuh
-- agar tidak ada yang patah di luar jangkauan pandang migrasi ini.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BAGIAN 1: TUJUAN RUMAH SAKIT PADA RUJUKAN
--
-- Sebelumnya rujukan hanya menyimpan puskesmas_id, sehingga tujuan rumah
-- sakit tidak pernah terekam dan hak akses spesialis tidak mungkin
-- ditegakkan oleh RLS. Kolom ini membuat kaitan itu nyata.
-- ---------------------------------------------------------------------

alter table public.rujukan
  add column if not exists rs_tujuan_id uuid references public.faskes(id);

create index if not exists idx_rujukan_rs_tujuan
  on public.rujukan(rs_tujuan_id)
  where rs_tujuan_id is not null;

comment on column public.rujukan.rs_tujuan_id is
  'Rumah sakit tujuan rujukan. Diisi bila rujukan naik dari puskesmas ke RS. Dipakai RLS untuk menentukan dokter spesialis anak mana yang berhak melihat balita ini.';

-- ---------------------------------------------------------------------
-- BAGIAN 2: FUNGSI PEMBANTU
-- ---------------------------------------------------------------------

-- Fasilitas tempat pengguna bertugas. Nakes rumah sakit memakai faskes_id;
-- nakes puskesmas lama mungkin masih kosong sehingga puskesmas_id dipakai
-- sebagai cadangan.
create or replace function public.my_faskes_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.faskes_id, p.puskesmas_id)
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Apakah pengguna saat ini dokter spesialis anak yang sudah disetujui.
create or replace function public.is_spesialis_anak()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'dokter_spesialis_anak'
      and p.status_akun = 'disetujui'
  );
$$;

-- Aturan akses klinis dokter spesialis anak terhadap satu balita.
create or replace function public.spesialis_anak_boleh_lihat(
  p_balita_id  uuid,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_spesialis_anak()
     and (
       -- 1. Balita atau catatan yang ia input sendiri.
       (p_created_by is not null and p_created_by = auth.uid())
       -- 2. Balita yang dirujuk ke rumah sakit tempat ia bertugas.
       or exists (
            select 1
            from public.rujukan r
            where r.balita_id = p_balita_id
              and r.rs_tujuan_id is not null
              and r.rs_tujuan_id = public.my_faskes_id()
          )
     );
$$;

comment on function public.spesialis_anak_boleh_lihat(uuid, uuid) is
  'Dokter spesialis anak hanya melihat balita yang ia catat sendiri atau yang dirujuk ke rumah sakit tempat ia bertugas.';

-- Penentu cakupan data balita untuk SELURUH peran.
--
-- Cabang peran lama disalin apa adanya dari boleh_lihat() tiga argumen agar
-- perilaku yang berlaku hari ini tidak berubah sedikit pun. Yang bertambah
-- hanyalah cabang dokter spesialis anak. Argumen balita dan pencatat bersifat
-- opsional supaya pemanggil yang tidak memilikinya tetap dapat memakai fungsi
-- ini.
create or replace function public.boleh_akses_balita(
  p_posyandu_id  uuid,
  p_puskesmas_id uuid,
  p_kabupaten_id uuid,
  p_balita_id    uuid default null,
  p_created_by   uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.my_role() = 'dokter_spesialis_anak'
      then public.spesialis_anak_boleh_lihat(p_balita_id, p_created_by)
    when public.my_role() = 'admin'     then true
    when public.my_role() = 'kader'     then p_posyandu_id = public.my_posyandu_id()
    when public.my_role() = 'dokter'    then p_puskesmas_id = public.my_puskesmas_id()
    when public.my_role() = 'dietisien' then p_puskesmas_id = public.my_puskesmas_id()
    else false
  end;
$$;

comment on function public.boleh_akses_balita(uuid, uuid, uuid, uuid, uuid) is
  'Cakupan data balita per peran. Menggantikan pemakaian boleh_lihat() pada policy balita, skrining, dan evaluasi velocity.';

-- ---------------------------------------------------------------------
-- BAGIAN 3: BATASAN PADA PROFIL
-- ---------------------------------------------------------------------

-- STR wajib. Spesialis anak adalah tenaga kesehatan berizin praktik.
alter table public.profiles drop constraint if exists chk_str_nakes;
alter table public.profiles add constraint chk_str_nakes check (
  role not in ('dokter', 'dietisien', 'dokter_spesialis_anak')
  or (no_str is not null and length(no_str) >= 5)
);

-- Rujukan wilayah tetap wajib agar profil tidak menggantung tanpa induk.
alter table public.profiles drop constraint if exists chk_nakes_wajib_puskesmas;
alter table public.profiles add constraint chk_nakes_wajib_puskesmas check (
  role not in ('dokter', 'dietisien', 'dokter_spesialis_anak')
  or puskesmas_id is not null
);

-- Spesialis anak selalu tercatat bertugas di rumah sakit.
alter table public.profiles drop constraint if exists chk_spesialis_anak_di_rs;
alter table public.profiles add constraint chk_spesialis_anak_di_rs check (
  role <> 'dokter_spesialis_anak' or jenis_faskes = 'rumah_sakit'
);

-- ---------------------------------------------------------------------
-- BAGIAN 4: POLICY BALITA
-- ---------------------------------------------------------------------

drop policy if exists "baca balita sesuai cakupan" on public.balita;
create policy "baca balita sesuai cakupan" on public.balita
  for select to authenticated
  using (
    deleted_at is null
    and public.boleh_akses_balita(posyandu_id, puskesmas_id, kabupaten_id, id, created_by)
  );

drop policy if exists "tambah balita sesuai cakupan" on public.balita;
create policy "tambah balita sesuai cakupan" on public.balita
  for insert to authenticated
  with check (
    public.is_aktif()
    and created_by = auth.uid()
    and (
      public.boleh_akses_balita(posyandu_id, puskesmas_id, kabupaten_id, id, created_by)
      -- Spesialis anak mendaftarkan pasien barunya sendiri di rumah sakit.
      or public.is_spesialis_anak()
    )
  );

drop policy if exists "ubah balita sesuai cakupan" on public.balita;
create policy "ubah balita sesuai cakupan" on public.balita
  for update to authenticated
  using (
    public.is_aktif()
    and public.boleh_akses_balita(posyandu_id, puskesmas_id, kabupaten_id, id, created_by)
  )
  with check (
    public.boleh_akses_balita(posyandu_id, puskesmas_id, kabupaten_id, id, created_by)
  );

-- ---------------------------------------------------------------------
-- BAGIAN 5: POLICY SKRINING DAN EVALUASI VELOCITY
-- ---------------------------------------------------------------------

drop policy if exists "baca skrining sesuai cakupan" on public.skrining;
create policy "baca skrining sesuai cakupan" on public.skrining
  for select to authenticated
  using (
    deleted_at is null
    and public.boleh_akses_balita(posyandu_id, puskesmas_id, kabupaten_id, balita_id, created_by)
  );

drop policy if exists "tambah skrining sesuai cakupan" on public.skrining;
create policy "tambah skrining sesuai cakupan" on public.skrining
  for insert to authenticated
  with check (
    public.is_aktif()
    and created_by = auth.uid()
    and public.boleh_akses_balita(posyandu_id, puskesmas_id, kabupaten_id, balita_id, created_by)
  );

drop policy if exists "koreksi skrining terbatas" on public.skrining;
create policy "koreksi skrining terbatas" on public.skrining
  for update to authenticated
  using (
    public.is_admin()
    or (created_by = auth.uid() and created_at > now() - interval '24 hours')
  )
  with check (
    public.boleh_akses_balita(posyandu_id, puskesmas_id, kabupaten_id, balita_id, created_by)
  );

drop policy if exists "baca evaluasi via skrining" on public.evaluasi_velocity;
create policy "baca evaluasi via skrining" on public.evaluasi_velocity
  for select to authenticated
  using (exists (
    select 1 from public.skrining s
    where s.id = skrining_id
      and public.boleh_akses_balita(s.posyandu_id, s.puskesmas_id, s.kabupaten_id, s.balita_id, s.created_by)
  ));

drop policy if exists "tambah evaluasi via skrining" on public.evaluasi_velocity;
create policy "tambah evaluasi via skrining" on public.evaluasi_velocity
  for insert to authenticated
  with check (exists (
    select 1 from public.skrining s
    where s.id = skrining_id
      and public.boleh_akses_balita(s.posyandu_id, s.puskesmas_id, s.kabupaten_id, s.balita_id, s.created_by)
  ));

-- ---------------------------------------------------------------------
-- BAGIAN 6: POLICY RUJUKAN, ASUHAN GIZI, DAN PROFIL
-- ---------------------------------------------------------------------

-- Spesialis anak membaca rujukan yang ditujukan ke rumah sakitnya.
drop policy if exists "baca rujukan" on public.rujukan;
create policy "baca rujukan" on public.rujukan
  for select to authenticated
  using (
    public.is_admin()
    or puskesmas_id = public.my_puskesmas_id()
    or (rs_tujuan_id is not null and rs_tujuan_id = public.my_faskes_id())
  );

-- Spesialis anak membalas atau menutup rujukan yang masuk ke rumah sakitnya.
drop policy if exists "perbarui status rujukan" on public.rujukan;
create policy "perbarui status rujukan" on public.rujukan
  for update to authenticated
  using (
    public.is_admin()
    or (
      public.my_role() in ('dokter', 'dietisien')
      and puskesmas_id = public.my_puskesmas_id()
    )
    or (
      public.is_spesialis_anak()
      and rs_tujuan_id is not null
      and rs_tujuan_id = public.my_faskes_id()
    )
  )
  with check (true);

-- Asuhan gizi: spesialis anak boleh membaca dan menyusun untuk pasiennya.
drop policy if exists "baca asuhan gizi" on public.asuhan_gizi;
create policy "baca asuhan gizi" on public.asuhan_gizi
  for select to authenticated
  using (
    public.is_admin()
    or (
      public.my_role() in ('dokter', 'dietisien')
      and puskesmas_id = public.my_puskesmas_id()
    )
    or public.spesialis_anak_boleh_lihat(balita_id, dietisien_id)
  );

drop policy if exists "dietisien kelola asuhan gizi" on public.asuhan_gizi;
create policy "dietisien kelola asuhan gizi" on public.asuhan_gizi
  for insert to authenticated
  with check (
    public.is_aktif()
    and dietisien_id = auth.uid()
    and (
      (public.my_role() = 'dietisien' and puskesmas_id = public.my_puskesmas_id())
      or public.spesialis_anak_boleh_lihat(balita_id, auth.uid())
    )
  );

drop policy if exists "dietisien ubah asuhan gizi" on public.asuhan_gizi;
create policy "dietisien ubah asuhan gizi" on public.asuhan_gizi
  for update to authenticated
  using (dietisien_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or puskesmas_id = public.my_puskesmas_id()
    or public.is_spesialis_anak()
  );

-- Profil: spesialis anak tetap dapat melihat rekan satu wilayah pembinanya.
drop policy if exists "nakes baca profil satu puskesmas" on public.profiles;
create policy "nakes baca profil satu puskesmas" on public.profiles
  for select to authenticated
  using (
    public.my_role() in ('dokter', 'dietisien', 'dokter_spesialis_anak')
    and puskesmas_id = public.my_puskesmas_id()
  );
