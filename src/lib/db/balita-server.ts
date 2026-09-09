/**
 * Pembacaan data balita dari Supabase. HANYA untuk sisi server.
 *
 * ==========================================================================
 * SATU-SATUNYA PINTU BACA
 *
 * Seluruh layar membaca balita lewat berkas ini. Sebelumnya masing-masing
 * halaman menyaring `SAMPLE_BALITA_DATABASE` dengan aturan wilayahnya sendiri —
 * lima salinan aturan yang saling berbeda, di atas senarai yang isinya kosong.
 *
 * Cakupan wilayah TIDAK disaring di sini. Policy RLS `baca balita sesuai
 * cakupan` dan `baca skrining sesuai cakupan` sudah menegakkannya di database
 * lewat `boleh_akses_balita`, lengkap dengan aturan khusus dokter spesialis
 * anak yang hanya boleh melihat balita rujukannya. Menyaring ulang di sini
 * membuat sumber kebenaran kedua; kalau keduanya berselisih, yang di layar
 * belum tentu yang benar.
 *
 * Galat TIDAK ditelan. Bentuk lama seluruh aplikasi ini memakai pola
 * `try { ... } catch { console.warn(...) }` lalu mengembalikan senarai kosong,
 * sehingga kegagalan pembacaan tampak sama dengan "belum ada data" — dan
 * halaman berkata "Belum ada balita" padahal databasenya menolak.
 * ==========================================================================
 */
import { createClient } from '@/lib/supabase/server'
import { petakanBalitaKeDetail, type BalitaDetail } from './balita'

/** Kolom balita beserta nama wilayahnya. Satu tempat, supaya tidak berbeda antar kueri. */
const KOLOM_BALITA = `
  id, nik, nama, tanggal_lahir, jenis_kelamin, nama_ibu, nama_ayah, no_hp_ortu,
  alamat, posyandu_id, puskesmas_id, kabupaten_id, bb_lahir_gram, pb_lahir_cm,
  usia_gestasi_minggu, created_by, created_at,
  posyandu:posyandu_id ( nama ),
  puskesmas:puskesmas_id ( nama ),
  kabupaten:kabupaten_id ( nama )
`

/** Kolom skrining yang dibutuhkan layar. */
const KOLOM_SKRINING = `
  id, balita_id, tanggal_periksa, umur_bulan, berat_kg, panjang_cm,
  panjang_terkoreksi_cm, posisi_ukur, lila_cm, edema,
  z_bbu, z_tbu, z_bbtb, status_bbu, status_tbu, status_bbtb, status_lila,
  is_red_flag, di_luar_rentang, catatan_di_luar_rentang,
  kalori_target_kkal, kalori_catchup_kkal, kalori_metode, engine_version
`

/**
 * Banyaknya kunjungan terakhir yang dibaca per balita.
 *
 * Kurva pertumbuhan, evaluasi kenaikan berat, dan tren Z semuanya bekerja pada
 * riwayat; 60 kunjungan sudah melampaui satu balita seumur program (0-60 bulan,
 * timbang bulanan), jadi batas ini tidak memotong data yang bermakna sekaligus
 * menjaga halaman daftar tidak menarik seluruh tabel.
 */
export const BATAS_RIWAYAT = 60

export type HasilBaca<T> =
  | { ok: true; data: T }
  | { ok: false; pesan: string }

/**
 * Daftar balita dalam cakupan pengguna, beserta riwayat skriningnya.
 *
 * `batasBalita` menjaga halaman daftar tetap ringan pada wilayah besar.
 */
export async function bacaDaftarBalita(
  batasBalita = 500,
): Promise<HasilBaca<BalitaDetail[]>> {
  const supabase = await createClient()

  const { data: barisBalita, error: galatBalita } = await supabase
    .from('balita')
    .select(KOLOM_BALITA)
    .order('nama', { ascending: true })
    .limit(batasBalita)

  if (galatBalita) {
    return { ok: false, pesan: galatBalita.message }
  }
  if (!barisBalita || barisBalita.length === 0) {
    return { ok: true, data: [] }
  }

  const idBalita = barisBalita.map((b) => String((b as Record<string, unknown>).id))

  // Satu kueri untuk seluruh skrining, bukan satu kueri per balita. Pola
  // per-balita menghasilkan ratusan perjalanan jaringan pada satu halaman.
  const { data: barisSkrining, error: galatSkrining } = await supabase
    .from('skrining')
    .select(KOLOM_SKRINING)
    .in('balita_id', idBalita)
    .order('tanggal_periksa', { ascending: false })

  if (galatSkrining) {
    return { ok: false, pesan: galatSkrining.message }
  }

  const perBalita = new Map<string, Record<string, unknown>[]>()
  for (const s of (barisSkrining ?? []) as Record<string, unknown>[]) {
    const kunci = String(s.balita_id ?? '')
    const daftar = perBalita.get(kunci)
    if (daftar) daftar.push(s)
    else perBalita.set(kunci, [s])
  }

  const data = (barisBalita as unknown as Record<string, unknown>[]).map((b) =>
    petakanBalitaKeDetail(b, (perBalita.get(String(b.id)) ?? []).slice(0, BATAS_RIWAYAT)),
  )

  return { ok: true, data }
}

/**
 * Satu balita beserta riwayatnya.
 *
 * `null` pada `data` berarti balita itu tidak ada ATAU berada di luar cakupan
 * pengguna — keduanya tidak dibedakan, dan itu memang disengaja: membedakannya
 * memberi tahu penanya bahwa ada balita dengan id itu di posyandu lain.
 */
export async function bacaBalitaById(
  id: string,
): Promise<HasilBaca<BalitaDetail | null>> {
  const supabase = await createClient()

  const { data: baris, error } = await supabase
    .from('balita')
    .select(KOLOM_BALITA)
    .eq('id', id)
    .maybeSingle()

  if (error) return { ok: false, pesan: error.message }
  if (!baris) return { ok: true, data: null }

  const { data: barisSkrining, error: galatSkrining } = await supabase
    .from('skrining')
    .select(KOLOM_SKRINING)
    .eq('balita_id', id)
    .order('tanggal_periksa', { ascending: false })
    .limit(BATAS_RIWAYAT)

  if (galatSkrining) return { ok: false, pesan: galatSkrining.message }

  return {
    ok: true,
    data: petakanBalitaKeDetail(
      baris as unknown as Record<string, unknown>,
      (barisSkrining ?? []) as unknown as Record<string, unknown>[],
    ),
  }
}

/**
 * Bentuk ringkas untuk penjagaan sisi server: wilayah dan tanggal lahir saja.
 *
 * Dipakai jalur penyimpanan skrining, yang hanya perlu memastikan balitanya ada
 * di dalam cakupan penulis dan mengambil tanggal lahirnya. Membaca seluruh
 * riwayat untuk keperluan itu hanya membebani tanpa guna.
 */
export type BalitaRingkas = {
  id: string
  nama: string
  tanggalLahir: string
  jenisKelamin: 'L' | 'P'
  posyanduId: string
  puskesmasId: string
  kabupatenId: string
  usiaGestasiMinggu?: number
}

export async function bacaBalitaRingkas(id: string): Promise<BalitaRingkas | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('balita')
    .select(
      'id, nama, tanggal_lahir, jenis_kelamin, posyandu_id, puskesmas_id, kabupaten_id, usia_gestasi_minggu',
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null

  const gestasi = Number(data.usia_gestasi_minggu)
  return {
    id: String(data.id),
    nama: String(data.nama),
    tanggalLahir: String(data.tanggal_lahir),
    jenisKelamin: data.jenis_kelamin === 'P' ? 'P' : 'L',
    posyanduId: String(data.posyandu_id),
    puskesmasId: String(data.puskesmas_id),
    kabupatenId: String(data.kabupaten_id),
    usiaGestasiMinggu: Number.isFinite(gestasi) ? gestasi : undefined,
  }
}
