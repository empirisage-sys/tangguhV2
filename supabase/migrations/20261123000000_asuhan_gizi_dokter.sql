-- =====================================================================
-- Dokter puskesmas dapat menyimpan asuhan gizi
--
-- Temuan uji tulis 21 November 2026: menyimpan asuhan gizi dari akun dokter
-- puskesmas ditolak database dengan pesan
--   new row violates row-level security policy for table "asuhan_gizi"
--
-- Server Action `simpanAsuhanGizi` dan menu "Dietisien & PKMK" mengizinkan
-- dokter, dan policy BACA sudah menyertakan dokter, tetapi policy TAMBAH hanya
-- mengenal dietisien dan dokter spesialis anak. Policy ini menyamakannya:
-- dokter dan dietisien menulis untuk puskesmasnya sendiri, spesialis anak
-- untuk balita dalam cakupannya.
--
-- Aman dijalankan ulang.
-- =====================================================================

drop policy if exists "dietisien kelola asuhan gizi" on public.asuhan_gizi;
create policy "dietisien kelola asuhan gizi" on public.asuhan_gizi
  for insert to authenticated
  with check (
    public.is_aktif()
    and dietisien_id = auth.uid()
    and (
      (public.my_role() in ('dietisien', 'dokter') and puskesmas_id = public.my_puskesmas_id())
      or public.spesialis_anak_boleh_lihat(balita_id, auth.uid())
    )
  );
