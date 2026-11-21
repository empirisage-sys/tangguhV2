/**
 * Agregasi rekapitulasi bulanan.
 *
 * ==========================================================================
 * TEMUAN AUDIT 21 NOVEMBER 2026: FILTER REKAP TIDAK BERPENGARUH
 *
 * Halaman Rekapitulasi menampilkan pilihan "Bulan Pemeriksaan" dan
 * "Kabupaten/Kota", tetapi keduanya tidak dipakai menghitung apa pun. Angka
 * yang tampil adalah pengukuran TERAKHIR setiap balita sepanjang masa, untuk
 * seluruh wilayah, apa pun bulan dan kabupaten yang dipilih. Tabel "per
 * posyandu" juga hanya berisi satu baris gabungan.
 *
 * Aturan yang dipakai sekarang:
 *   - penyebut  = balita yang ditimbang pada bulan terpilih (di wilayah terpilih)
 *   - pembilang = balita yang pengukuran TERAKHIRNYA pada bulan itu berstatus
 *                 stunting (TB/U < -2), wasting (BB/TB < -2), atau berpenanda
 *                 rujukan menurut mesin (`isRedFlag`)
 *   - satu balita dihitung satu kali per bulan
 *
 * Murni dan tanpa teks pengguna (AGENTS.md 2.4).
 * ==========================================================================
 */
import type { BalitaDetail, SkriningRiwayatItem } from '@/lib/db/balita'

export type FilterRekap = {
  /** 'YYYY-MM'. Kosong berarti seluruh waktu (pengukuran terakhir tiap balita). */
  bulan: string
  /** Nama kabupaten persis seperti di data, atau 'semua'. */
  kabupaten: string
}

export type BarisRekap = {
  kunci: string
  posyandu: string
  puskesmas: string
  kabupaten: string
  balita: number
  stunting: number
  wasting: number
  rujukan: number
}

export type HasilRekap = {
  balitaDitimbang: number
  jumlahPengukuran: number
  stunting: number
  wasting: number
  rujukan: number
  perPosyandu: BarisRekap[]
}

function stunting(s: SkriningRiwayatItem): boolean {
  return s.statusTBU === 'pendek' || s.statusTBU === 'sangat_pendek'
}
function wasting(s: SkriningRiwayatItem): boolean {
  return s.statusBBTB === 'gizi_kurang' || s.statusBBTB === 'gizi_buruk'
}

export function hitungRekap(daftar: BalitaDetail[], f: FilterRekap): HasilRekap {
  const baris = new Map<string, BarisRekap>()
  const hasil: HasilRekap = { balitaDitimbang: 0, jumlahPengukuran: 0, stunting: 0, wasting: 0, rujukan: 0, perPosyandu: [] }

  for (const b of daftar) {
    if (f.kabupaten !== 'semua' && b.namaKabupaten !== f.kabupaten) continue
    const dalamPeriode = f.bulan
      ? b.riwayat.filter((s) => (s.tanggal ?? '').slice(0, 7) === f.bulan)
      : b.riwayat
    if (dalamPeriode.length === 0) continue
    // Riwayat terurut dari paling lama; ambil yang paling akhir pada periode.
    const akhir = [...dalamPeriode].sort((x, y) => x.tanggal.localeCompare(y.tanggal)).at(-1)!

    hasil.balitaDitimbang++
    hasil.jumlahPengukuran += dalamPeriode.length
    const st = stunting(akhir), ws = wasting(akhir), rf = akhir.isRedFlag
    if (st) hasil.stunting++
    if (ws) hasil.wasting++
    if (rf) hasil.rujukan++

    const kunci = b.posyanduId || b.namaPosyandu
    const r = baris.get(kunci) ?? {
      kunci,
      posyandu: b.namaPosyandu,
      puskesmas: b.namaPuskesmas,
      kabupaten: b.namaKabupaten,
      balita: 0,
      stunting: 0,
      wasting: 0,
      rujukan: 0,
    }
    r.balita++
    if (st) r.stunting++
    if (ws) r.wasting++
    if (rf) r.rujukan++
    baris.set(kunci, r)
  }

  hasil.perPosyandu = [...baris.values()].sort(
    (a, b) => a.kabupaten.localeCompare(b.kabupaten) || a.puskesmas.localeCompare(b.puskesmas) || a.posyandu.localeCompare(b.posyandu),
  )
  return hasil
}

/** Persen dengan satu desimal; `null` bila penyebut nol. */
export function persen(pembilang: number, penyebut: number): number | null {
  if (penyebut <= 0) return null
  return Math.round((pembilang / penyebut) * 1000) / 10
}
