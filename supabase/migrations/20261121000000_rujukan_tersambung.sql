-- =====================================================================
-- RUJUKAN TERSAMBUNG KE DATABASE
--
-- Sampai migrasi ini, fitur Pasien Rujukan menyimpan rujukan di memori
-- peramban (`src/lib/db/rujukan.ts`). Tabel `rujukan` sudah ada tetapi tidak
-- pernah ditulis, sehingga rujukan hilang saat halaman dimuat ulang dan dokter
-- spesialis anak di rumah sakit tidak pernah menerimanya.
--
-- Migrasi ini:
--   1. Menambah kolom yang dipakai layar (diagnosis awal, balasan spesialis).
--   2. Mengetatkan policy INSERT. Bentuk lama hanya memeriksa
--      `is_aktif() and diajukan_oleh = auth.uid()`, sehingga pengguna aktif
--      mana pun dapat menulis rujukan untuk balita di luar wilayahnya. Karena
--      `spesialis_anak_boleh_lihat` membuka data balita kepada rumah sakit
--      tujuan, seorang spesialis anak dapat MEMBERI DIRINYA SENDIRI akses ke
--      balita mana pun dengan menulis rujukan palsu ke rumah sakitnya.
--   3. Mengganti `with check (true)` pada policy UPDATE, dan menambah trigger
--      yang mengunci kolom asal-usul rujukan (pengaju, balita, puskesmas,
--      alasan) serta memisahkan wewenang puskesmas dan rumah sakit.
--   4. Menegakkan batas akses 90 hari (AGENTS.md 3.6): data balita terbuka
--      bagi rumah sakit tujuan hanya selama 90 hari sejak rujukan diterbitkan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BAGIAN 1: KOLOM
-- ---------------------------------------------------------------------

alter table public.rujukan
  add column if not exists diagnosis_awal         text,
  add column if not exists diajukan_oleh_nama     text,
  add column if not exists nama_dokter_spesialis  text,
  add column if not exists diagnosis_definitif_rs text,
  add column if not exists tatalaksana_lanjutan   text,
  add column if not exists rekomendasi_pkmk       text,
  add column if not exists catatan_balasan        text,
  add column if not exists ditanggapi_oleh        uuid references public.profiles(id),
  add column if not exists diterima_pada          timestamptz,
  add column if not exists selesai_pada           timestamptz;

comment on column public.rujukan.diajukan_oleh_nama is
  'Nama pengaju saat rujukan diterbitkan. Disalin karena rumah sakit tujuan tidak berhak membaca profil puskesmas (policy profiles).';

create index if not exists idx_rujukan_balita on public.rujukan(balita_id);

-- ---------------------------------------------------------------------
-- BAGIAN 2: SIAPA YANG BOLEH MENERBITKAN
-- ---------------------------------------------------------------------

-- Penerbit rujukan adalah nakes puskesmas tempat balita terdaftar. Admin
-- diperbolehkan untuk keperluan koreksi data. Tujuan harus rumah sakit.
create or replace function public.boleh_terbitkan_rujukan(
  p_balita_id    uuid,
  p_puskesmas_id uuid,
  p_rs_tujuan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_aktif()
     and (
       public.is_admin()
       or (
         public.my_role() in ('dokter', 'dietisien')
         and p_puskesmas_id = public.my_puskesmas_id()
       )
     )
     and exists (
       select 1 from public.balita b
       where b.id = p_balita_id
         and b.puskesmas_id = p_puskesmas_id
         and b.deleted_at is null
     )
     and (
       p_rs_tujuan_id is null
       or exists (
         select 1 from public.faskes f
         where f.id = p_rs_tujuan_id and f.jenis = 'rumah_sakit'
       )
     );
$$;

revoke execute on function public.boleh_terbitkan_rujukan(uuid, uuid, uuid) from public, anon;
grant execute on function public.boleh_terbitkan_rujukan(uuid, uuid, uuid) to authenticated;

drop policy if exists "ajukan rujukan" on public.rujukan;
create policy "ajukan rujukan" on public.rujukan
  for insert to authenticated
  with check (
    diajukan_oleh = auth.uid()
    and public.boleh_terbitkan_rujukan(balita_id, puskesmas_id, rs_tujuan_id)
  );

-- ---------------------------------------------------------------------
-- BAGIAN 3: PEMBARUAN
-- ---------------------------------------------------------------------

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
  with check (
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
  );

-- Policy menentukan BARIS mana yang boleh diubah; trigger ini menentukan
-- KOLOM dan perpindahan status mana yang boleh. Tanpa trigger, spesialis anak
-- dapat menimpa nama pengaju dan alasan rujukan yang ditulis puskesmas.
create or replace function public.jaga_perubahan_rujukan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pihak_rs  boolean;
  v_pihak_pkm boolean;
begin
  -- Tanpa pengguna (migrasi, seed, service role): tidak dibatasi.
  if auth.uid() is null or public.is_admin() then
    if new.status = 'diterima' and old.status <> 'diterima' and new.diterima_pada is null then
      new.diterima_pada := now();
    end if;
    if new.status = 'selesai' and old.status <> 'selesai' and new.selesai_pada is null then
      new.selesai_pada := now();
    end if;
    return new;
  end if;

  -- Asal-usul rujukan tidak pernah berubah.
  if new.balita_id is distinct from old.balita_id
     or new.skrining_id is distinct from old.skrining_id
     or new.puskesmas_id is distinct from old.puskesmas_id
     or new.diajukan_oleh is distinct from old.diajukan_oleh
     or new.diajukan_oleh_nama is distinct from old.diajukan_oleh_nama
     or new.alasan is distinct from old.alasan
     or new.diagnosis_awal is distinct from old.diagnosis_awal
     or new.created_at is distinct from old.created_at then
    raise exception 'Data asal rujukan (pengaju, balita, puskesmas, alasan) tidak dapat diubah.';
  end if;

  v_pihak_rs := public.is_spesialis_anak()
                and old.rs_tujuan_id is not null
                and old.rs_tujuan_id = public.my_faskes_id();
  v_pihak_pkm := public.my_role() in ('dokter', 'dietisien')
                 and old.puskesmas_id = public.my_puskesmas_id();

  if v_pihak_rs then
    if new.rs_tujuan_id is distinct from old.rs_tujuan_id
       or new.tujuan is distinct from old.tujuan then
      raise exception 'Rumah sakit tujuan tidak dapat dipindahkan oleh rumah sakit penerima.';
    end if;
    if old.status = 'batal' then
      raise exception 'Rujukan ini sudah dibatalkan puskesmas.';
    end if;
    if new.status not in ('diterima', 'selesai')
       or (old.status = 'selesai' and new.status <> 'selesai') then
      raise exception 'Perubahan status rujukan ini tidak diperbolehkan.';
    end if;
    new.ditanggapi_oleh := auth.uid();
    if new.status in ('diterima', 'selesai') and new.diterima_pada is null then
      new.diterima_pada := coalesce(old.diterima_pada, now());
    end if;
    if new.status = 'selesai' and old.status <> 'selesai' then
      new.selesai_pada := now();
    end if;
    return new;
  end if;

  if v_pihak_pkm then
    -- Puskesmas hanya boleh membatalkan rujukan yang belum ditanggapi.
    if new.nama_dokter_spesialis is distinct from old.nama_dokter_spesialis
       or new.diagnosis_definitif_rs is distinct from old.diagnosis_definitif_rs
       or new.tatalaksana_lanjutan is distinct from old.tatalaksana_lanjutan
       or new.rekomendasi_pkmk is distinct from old.rekomendasi_pkmk
       or new.catatan_balasan is distinct from old.catatan_balasan
       or new.ditanggapi_oleh is distinct from old.ditanggapi_oleh
       or new.diterima_pada is distinct from old.diterima_pada
       or new.selesai_pada is distinct from old.selesai_pada then
      raise exception 'Balasan rujukan hanya dapat diisi dokter spesialis anak rumah sakit tujuan.';
    end if;
    if new.status is distinct from old.status
       and not (old.status = 'diajukan' and new.status = 'batal') then
      raise exception 'Puskesmas hanya dapat membatalkan rujukan yang belum ditanggapi rumah sakit.';
    end if;
    if new.rs_tujuan_id is distinct from old.rs_tujuan_id and old.status <> 'diajukan' then
      raise exception 'Rumah sakit tujuan tidak dapat diganti setelah rujukan ditanggapi.';
    end if;
    return new;
  end if;

  raise exception 'Tidak berwenang mengubah rujukan ini.';
end;
$$;

drop trigger if exists trg_jaga_perubahan_rujukan on public.rujukan;
create trigger trg_jaga_perubahan_rujukan
  before update on public.rujukan
  for each row execute function public.jaga_perubahan_rujukan();

-- ---------------------------------------------------------------------
-- BAGIAN 4: AKSES RUMAH SAKIT 90 HARI (AGENTS.md 3.6)
-- ---------------------------------------------------------------------

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
       -- 2. Balita yang dirujuk ke rumah sakit tempat ia bertugas, selama 90
       --    hari sejak rujukan diterbitkan dan rujukan tidak dibatalkan.
       or exists (
            select 1
            from public.rujukan r
            where r.balita_id = p_balita_id
              and r.rs_tujuan_id is not null
              and r.rs_tujuan_id = public.my_faskes_id()
              and r.status <> 'batal'
              and r.created_at >= now() - interval '90 days'
          )
     );
$$;
