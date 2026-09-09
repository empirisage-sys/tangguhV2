-- =====================================================================
-- APLIKASI TANGGUH - ANTREAN VERIFIKASI MENGENALI WILAYAH USULAN
--
-- Versi   : 1.9
-- Tanggal : 11 September 2026
--
-- TEMUAN R-8
--
-- `admin/verifikasi/page.tsx` sudah lama mengirimkan tujuh medan kepada
-- `FormulirVerifikasi`:
--
--     faskesId       = p.faskes_id
--     namaFaskes     = p.nama_faskes
--     statusFaskes   = p.status_faskes
--     kabupatenId    = p.kabupaten_id
--     jenisFaskes    = p.jenis_faskes
--     namaPosyandu   = p.nama_posyandu
--     statusPosyandu = p.status_posyandu
--
-- Sementara `v_antrean_verifikasi` hanya memuat: id, nama_lengkap, role,
-- no_str, no_hp, status_akun, diajukan_pada, lama_menunggu, nama_kabupaten,
-- nama_puskesmas, nama_posyandu, desa.
--
-- Lima dari tujuh medan itu karena itu bernilai `undefined`. Akibatnya
-- `statusFaskes` jatuh ke nilai bawaan 'master', dan seluruh kotak
-- normalisasi fasilitas usulan di formulir itu TIDAK PERNAH MUNCUL - padahal
-- kodenya sudah ditulis lengkap, termasuk pencarian fasilitas master yang
-- mirip dan tombol penautannya. Penjaga `if (!faskesId) return` pada
-- `handleSahkanFaskes` menelan pemanggilannya tanpa suara.
--
-- Sejak migrasi 20260910000000 keadaannya bertambah penting: nama puskesmas,
-- posyandu, dan rumah sakit yang diketik pendaftar sekarang benar-benar
-- tersimpan sebagai baris berstatus 'usulan'. Tanpa migrasi ini, admin tidak
-- punya satu pun cara melihat, apalagi menormalkan, usulan-usulan itu.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BAGIAN 1: VIEW ANTREAN MEMBAWA SELURUH MEDAN WILAYAH
--
-- `security_invoker` dipertahankan, sehingga policy RLS pemanggil tetap
-- berlaku dan view ini tidak menjadi celah baca.
-- ---------------------------------------------------------------------

drop view if exists public.v_antrean_verifikasi;

create view public.v_antrean_verifikasi
with (security_invoker = on) as
select
  p.id,
  p.nama_lengkap,
  p.role,
  p.no_str,
  p.no_hp,
  p.status_akun,
  p.created_at              as diajukan_pada,
  now() - p.created_at      as lama_menunggu,

  -- Wilayah administratif
  p.kabupaten_id,
  kab.nama                  as nama_kabupaten,

  -- Puskesmas. Kolom `status_puskesmas` BARU: sejak migrasi 20260910000000
  -- puskesmas pun dapat berstatus usulan.
  p.puskesmas_id,
  pkm.nama                  as nama_puskesmas,
  pkm.status                as status_puskesmas,

  -- Posyandu
  p.posyandu_id,
  psy.nama                  as nama_posyandu,
  psy.desa                  as desa,
  psy.status                as status_posyandu,

  -- Fasilitas tempat bertugas. Inilah lima medan yang selama ini hilang.
  p.faskes_id,
  fsk.nama                  as nama_faskes,
  fsk.status                as status_faskes,
  coalesce(fsk.jenis, p.jenis_faskes) as jenis_faskes,

  -- Penanda ringkas untuk menyaring di lapisan tampilan: apakah ADA sesuatu
  -- yang perlu dinormalkan pada pendaftaran ini.
  (
    coalesce(pkm.status::text, 'master') = 'usulan'
    or coalesce(psy.status::text, 'master') = 'usulan'
    or coalesce(fsk.status::text, 'master') = 'usulan'
  )                         as ada_wilayah_usulan

from public.profiles p
left join public.kabupaten kab on kab.id = p.kabupaten_id
left join public.puskesmas pkm on pkm.id = p.puskesmas_id
left join public.posyandu  psy on psy.id = p.posyandu_id
left join public.faskes    fsk on fsk.id = p.faskes_id
where p.status_akun = 'menunggu'
order by p.created_at;

comment on view public.v_antrean_verifikasi is
  'Antrean pendaftaran yang menunggu persetujuan, diurutkan dari yang paling lama menunggu. Memuat status master/usulan untuk puskesmas, posyandu, dan faskes, sehingga admin dapat menormalkan wilayah yang diketik pendaftar sebelum menyetujui akun.';

-- ---------------------------------------------------------------------
-- BAGIAN 2: MENGESAHKAN POSYANDU USULAN
--
-- Sejajar dengan `sahkan_faskes_usulan` yang sudah ada: admin dapat
-- menautkan usulan ke posyandu master yang sudah ada, atau mengesahkan
-- usulan itu menjadi master baru.
-- ---------------------------------------------------------------------

create or replace function public.sahkan_posyandu_usulan(
  p_usulan_id uuid,
  p_master_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pkm_usulan uuid;
  v_pkm_master uuid;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang berwenang mengesahkan usulan posyandu.';
  end if;

  select s.puskesmas_id into v_pkm_usulan
  from public.posyandu s where s.id = p_usulan_id;

  if v_pkm_usulan is null then
    raise exception 'Posyandu usulan tidak ditemukan.';
  end if;

  if p_master_id is null then
    update public.posyandu
    set status = 'master'
    where id = p_usulan_id;
    return;
  end if;

  -- Penautan ke master hanya sah bila keduanya bernaung pada puskesmas yang
  -- SAMA. Tanpa pemeriksaan ini, penautan memindahkan kader ke wilayah lain
  -- sekaligus melanggar trigger keselarasan pada migrasi 20260910000000.
  select s.puskesmas_id into v_pkm_master
  from public.posyandu s where s.id = p_master_id;

  if v_pkm_master is null then
    raise exception 'Posyandu master tujuan tidak ditemukan.';
  end if;
  if v_pkm_master <> v_pkm_usulan then
    raise exception
      'Posyandu master tujuan berada di puskesmas yang berbeda. Penautan akan memindahkan kader ke wilayah lain.';
  end if;

  -- Alihkan seluruh rujukan sebelum baris usulan dihapus, agar tidak ada
  -- kunci asing yang menggantung.
  update public.profiles set posyandu_id = p_master_id where posyandu_id = p_usulan_id;
  update public.balita    set posyandu_id = p_master_id where posyandu_id = p_usulan_id;
  update public.skrining  set posyandu_id = p_master_id where posyandu_id = p_usulan_id;

  delete from public.posyandu where id = p_usulan_id and status = 'usulan';
end;
$$;

comment on function public.sahkan_posyandu_usulan(uuid, uuid) is
  'Menormalkan posyandu yang diketik kader: ditautkan ke posyandu master di puskesmas yang sama, atau disahkan menjadi master baru.';

-- ---------------------------------------------------------------------
-- BAGIAN 3: MENGESAHKAN PUSKESMAS USULAN
--
-- Lebih berhati-hati daripada dua fungsi di atas, karena satu puskesmas
-- memiliki DUA baris dengan id yang sama - satu di `puskesmas`, satu di
-- `faskes` - dan menjadi induk bagi baris posyandu.
-- ---------------------------------------------------------------------

create or replace function public.sahkan_puskesmas_usulan(
  p_usulan_id uuid,
  p_master_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang berwenang mengesahkan usulan puskesmas.';
  end if;

  if not exists (select 1 from public.puskesmas p where p.id = p_usulan_id) then
    raise exception 'Puskesmas usulan tidak ditemukan.';
  end if;

  if p_master_id is null then
    -- Sahkan menjadi master, pada KEDUA tabel sekaligus.
    update public.puskesmas set status = 'master' where id = p_usulan_id;
    update public.faskes
    set status = 'master', perlu_verifikasi = false, updated_at = now()
    where id = p_usulan_id;
    return;
  end if;

  if not exists (select 1 from public.puskesmas p where p.id = p_master_id) then
    raise exception 'Puskesmas master tujuan tidak ditemukan.';
  end if;

  -- Posyandu di bawah usulan dipindahkan lebih dahulu. Bila tidak, kunci
  -- asing `posyandu.puskesmas_id` menahan penghapusan, dan kader yang
  -- bernaung padanya akan melanggar trigger keselarasan wilayah.
  update public.posyandu set puskesmas_id = p_master_id where puskesmas_id = p_usulan_id;

  -- Profil dialihkan pada KEDUA kolom. `faskes_id` ikut hanya bila memang
  -- menunjuk baris puskesmas yang sama; profil yang bertugas di rumah sakit
  -- tidak boleh tersentuh.
  update public.profiles set puskesmas_id = p_master_id where puskesmas_id = p_usulan_id;
  update public.profiles set faskes_id = p_master_id where faskes_id = p_usulan_id;

  update public.balita   set puskesmas_id = p_master_id where puskesmas_id = p_usulan_id;
  update public.skrining set puskesmas_id = p_master_id where puskesmas_id = p_usulan_id;

  delete from public.faskes    where id = p_usulan_id and status = 'usulan';
  delete from public.puskesmas where id = p_usulan_id and status = 'usulan';
end;
$$;

comment on function public.sahkan_puskesmas_usulan(uuid, uuid) is
  'Menormalkan puskesmas yang diketik pendaftar. Memindahkan posyandu, profil, balita, dan skrining lebih dahulu, lalu menghapus baris usulan di tabel puskesmas maupun faskes.';

-- ---------------------------------------------------------------------
-- BAGIAN 4: DAFTAR CALON MASTER UNTUK DITAWARKAN KEPADA ADMIN
--
-- `FormulirVerifikasi` selama ini mencari fasilitas master yang mirip dari
-- senarai statis di `src/lib/db/wilayah.ts`. Senarai itu memuat 95 puskesmas
-- Gorontalo, sehingga tidak mengenal puskesmas atau posyandu yang lahir
-- setelahnya - dan tidak mengenal posyandu sama sekali.
--
-- Fungsi ini mencari calon dari DATABASE, dengan kemiripan nama, dan hanya
-- yang berada di wilayah yang sah untuk ditautkan.
-- ---------------------------------------------------------------------

-- Peringkat kemiripan yang TIDAK bergantung pada ekstensi apa pun.
--
-- Percobaan pertama memakai `similarity()` dari pg_trgm dan gagal:
-- fungsi ini berjalan dengan `set search_path = ''` demi keamanan, sehingga
-- `similarity` tidak terjangkau tanpa awalan skema - dan skema tempat
-- pg_trgm dipasang berbeda antara Supabase (`extensions`) dan pemasangan
-- biasa (`public`), sehingga mengawalinya justru rapuh.
--
-- Peringkat di bawah ini cukup untuk menawarkan calon kepada admin, dan
-- perilakunya dapat diramalkan: sama persis, berawalan sama, memuat, lalu
-- sisanya menurut abjad.
create or replace function public.peringkat_kemiripan_nama(
  p_calon text,
  p_acuan text
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(btrim(p_calon)) = lower(btrim(p_acuan)) then 0
    when lower(btrim(p_calon)) like lower(btrim(p_acuan)) || '%' then 1
    when lower(btrim(p_acuan)) like lower(btrim(p_calon)) || '%' then 2
    when position(lower(btrim(p_acuan)) in lower(btrim(p_calon))) > 0 then 3
    when position(lower(btrim(p_calon)) in lower(btrim(p_acuan))) > 0 then 4
    else 5
  end;
$$;

comment on function public.peringkat_kemiripan_nama(text, text) is
  'Peringkat kemiripan nama tanpa ketergantungan ekstensi. Dipakai calon_master_wilayah, yang berjalan dengan search_path kosong sehingga similarity() dari pg_trgm tidak terjangkau.';

create or replace function public.calon_master_wilayah(
  p_jenis text,      -- 'puskesmas' | 'posyandu' | 'rumah_sakit'
  p_usulan_id uuid
)
returns table (id uuid, nama text, keterangan text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nama text;
  v_kab  uuid;
  v_pkm  uuid;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang berwenang membaca calon master wilayah.';
  end if;

  if p_jenis = 'posyandu' then
    select s.nama, s.puskesmas_id into v_nama, v_pkm
    from public.posyandu s where s.id = p_usulan_id;
    if v_nama is null then return; end if;

    return query
    select s.id, s.nama,
           coalesce('Desa ' || s.desa, 'Posyandu master')::text
    from public.posyandu s
    where s.status = 'master'
      and s.puskesmas_id = v_pkm
      and s.id <> p_usulan_id
    order by public.peringkat_kemiripan_nama(s.nama, v_nama), s.nama
    limit 8;

  elsif p_jenis = 'puskesmas' then
    select p.nama, p.kabupaten_id into v_nama, v_kab
    from public.puskesmas p where p.id = p_usulan_id;
    if v_nama is null then return; end if;

    return query
    select p.id, p.nama, 'Puskesmas master'::text
    from public.puskesmas p
    where p.status = 'master'
      and p.kabupaten_id = v_kab
      and p.id <> p_usulan_id
    order by public.peringkat_kemiripan_nama(p.nama, v_nama), p.nama
    limit 8;

  else
    select f.nama, f.kabupaten_id into v_nama, v_kab
    from public.faskes f where f.id = p_usulan_id;
    if v_nama is null then return; end if;

    return query
    select f.id, f.nama, ('Faskes master, ' || f.jenis::text)::text
    from public.faskes f
    where f.status = 'master'
      and f.jenis = 'rumah_sakit'
      and (v_kab is null or f.kabupaten_id is not distinct from v_kab)
      and f.id <> p_usulan_id
    order by public.peringkat_kemiripan_nama(f.nama, v_nama), f.nama
    limit 8;
  end if;
end;
$$;

comment on function public.calon_master_wilayah(text, uuid) is
  'Calon baris master untuk menautkan sebuah usulan wilayah, dicari dari database berdasarkan kemiripan nama dan kesahihan wilayah. Menggantikan pencarian pada senarai statis di src/lib/db/wilayah.ts yang tidak mengenal posyandu maupun data yang lahir setelah seed.';
