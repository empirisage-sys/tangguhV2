import { describe, expect, it } from 'vitest'
import { hitungRekap, persen } from '@/lib/rekap/agregat'
import type { BalitaDetail } from '@/lib/db/balita'

const s = (tanggal: string, tbu: string, bbtb: string, rf = false) =>
  ({ id: tanggal, tanggal, statusTBU: tbu, statusBBTB: bbtb, isRedFlag: rf }) as never

const b = (id: string, kab: string, pos: string, riwayat: never[]): BalitaDetail =>
  ({ id, namaKabupaten: kab, namaPosyandu: pos, posyanduId: pos, namaPuskesmas: 'P', riwayat }) as never

const data = [
  b('1', 'Kota Gorontalo', 'Melati', [s('2026-10-05', 'normal', 'gizi_baik'), s('2026-11-03', 'pendek', 'gizi_baik')]),
  b('2', 'Kota Gorontalo', 'Melati', [s('2026-11-10', 'normal', 'gizi_buruk', true)]),
  b('3', 'Kabupaten Boalemo', 'Mawar', [s('2026-10-20', 'sangat_pendek', 'gizi_kurang', true)]),
]

describe('hitungRekap', () => {
  it('bulan November hanya menghitung balita yang ditimbang di November', () => {
    const r = hitungRekap(data, { bulan: '2026-11', kabupaten: 'semua' })
    expect(r.balitaDitimbang).toBe(2)
    expect(r.stunting).toBe(1)
    expect(r.wasting).toBe(1)
    expect(r.rujukan).toBe(1)
    expect(r.perPosyandu).toHaveLength(1)
  })
  it('bulan Oktober memakai pengukuran Oktober, bukan pengukuran terakhir sepanjang masa', () => {
    const r = hitungRekap(data, { bulan: '2026-10', kabupaten: 'semua' })
    expect(r.balitaDitimbang).toBe(2)
    expect(r.stunting).toBe(1) // hanya balita 3; balita 1 normal di Oktober
  })
  it('filter kabupaten', () => {
    const r = hitungRekap(data, { bulan: '', kabupaten: 'Kabupaten Boalemo' })
    expect(r.balitaDitimbang).toBe(1)
    expect(r.perPosyandu[0]?.posyandu).toBe('Mawar')
  })
  it('persen null bila penyebut nol', () => {
    expect(persen(0, 0)).toBeNull()
    expect(persen(1, 3)).toBe(33.3)
  })
})
