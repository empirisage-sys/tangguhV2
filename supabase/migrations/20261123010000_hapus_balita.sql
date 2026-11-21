-- =====================================================================
-- Menu "Hapus Balita" (hapus lunak)
--
-- Sebelumnya tidak ada cara menghapus balita yang salah input selain SQL
-- langsung. Data medis tidak boleh dihapus keras (AGENTS.md 1.6), jadi yang
-- dilakukan adalah menandai `deleted_at` pada balita dan seluruh skriningnya,
-- dengan pencatatan SIAPA dan MENGAPA.
--
-- Wewenang mengikuti cakupan data (`boleh_akses_balita`): kader untuk
-- posyandunya, dokter dan dietisien untuk puskesmasnya, dokter spesialis anak
-- untuk balita yang ia input, admin untuk seluruh provinsi. Balita yang masih
-- memiliki rujukan berjalan tidak dapat dihapus.
--
-- Aman dijalankan ulang.
-- =====================================================================

alter table public.balita
  add column if not exists dihapus_oleh uuid references public.profiles(id),
  add column if not exists alasan_hapus text;

comment on column public.balita.alasan_hapus is
  'Alasan penghapusan lunak, wajib minimal 10 karakter. Diisi fungsi hapus_balita.';

-- Jejak audit balita, sama seperti skrining dan profil.
drop trigger if exists trg_audit_balita on public.balita;
create trigger trg_audit_balita
  after update or delete on public.balita
  for each row execute function public.tulis_audit();

create or replace function public.hapus_balita(p_balita_id uuid, p_alasan text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.balita;
begin
  if not public.is_aktif() then
    raise exception 'Akun Anda belum aktif.';
  end if;

  if p_alasan is null or length(btrim(p_alasan)) < 10 then
    raise exception 'Alasan penghapusan wajib diisi minimal 10 karakter.';
  end if;

  select * into v from public.balita where id = p_balita_id and deleted_at is null;
  if v.id is null then
    raise exception 'Balita tidak ditemukan atau sudah dihapus.';
  end if;

  if not public.boleh_akses_balita(v.posyandu_id, v.puskesmas_id, v.kabupaten_id, v.id, v.created_by) then
    raise exception 'Balita ini berada di luar wewenang Anda.';
  end if;

  if exists (
    select 1 from public.rujukan r
    where r.balita_id = v.id and r.status in ('diajukan', 'diterima')
  ) then
    raise exception 'Balita ini masih memiliki rujukan yang berjalan. Batalkan atau selesaikan rujukannya dahulu.';
  end if;

  update public.skrining
     set deleted_at = now()
   where balita_id = v.id and deleted_at is null;

  update public.balita
     set deleted_at   = now(),
         dihapus_oleh = auth.uid(),
         alasan_hapus = btrim(p_alasan)
   where id = v.id;
end;
$$;

revoke execute on function public.hapus_balita(uuid, text) from public, anon;
grant execute on function public.hapus_balita(uuid, text) to authenticated;

comment on function public.hapus_balita(uuid, text) is
  'Hapus lunak balita beserta skriningnya, dengan wewenang sesuai cakupan data dan alasan tercatat.';
