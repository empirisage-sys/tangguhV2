import { describe, expect, it } from 'vitest'
import { apakahPerluPKMK } from '../indikasi-pkmk'

describe('Indikasi Tata Laksana PKMK', () => {
  it('tidak menampilkan PKMK untuk anak BB/TB gizi baik dengan TB/U & BB/U normal', () => {
    const hasil = apakahPerluPKMK({
      statusBBTB: 'gizi_baik',
      statusTBU: 'normal',
      statusBBU: 'berat_badan_normal',
    })
    expect(hasil).toBe(false)
  })

  it('tidak menampilkan PKMK untuk anak BB/TB gizi baik dengan TB/U tinggi', () => {
    const hasil = apakahPerluPKMK({
      statusBBTB: 'gizi_baik',
      statusTBU: 'tinggi',
      statusBBU: 'berat_badan_normal',
    })
    expect(hasil).toBe(false)
  })

  it('tidak menampilkan PKMK untuk anak BB/TB gizi kurang dengan TB/U & BB/U normal (cukup PMBA & konseling)', () => {
    const hasil = apakahPerluPKMK({
      statusBBTB: 'gizi_kurang',
      statusTBU: 'normal',
      statusBBU: 'berat_badan_normal',
    })
    expect(hasil).toBe(false)
  })

  it('menampilkan PKMK jika anak mengalami Gizi Buruk', () => {
    const hasil = apakahPerluPKMK({
      statusBBTB: 'gizi_buruk',
      statusTBU: 'normal',
      statusBBU: 'berat_badan_normal',
    })
    expect(hasil).toBe(true)
  })

  it('menampilkan PKMK jika terdapat edema bilateral', () => {
    const hasil = apakahPerluPKMK({
      statusBBTB: 'gizi_baik',
      statusTBU: 'normal',
      statusBBU: 'berat_badan_normal',
      edema: true,
    })
    expect(hasil).toBe(true)
  })

  it('menampilkan PKMK jika anak mengalami Stunting (TB/U pendek atau sangat pendek)', () => {
    expect(
      apakahPerluPKMK({
        statusBBTB: 'gizi_baik',
        statusTBU: 'pendek',
        statusBBU: 'berat_badan_normal',
      }),
    ).toBe(true)

    expect(
      apakahPerluPKMK({
        statusBBTB: 'gizi_kurang',
        statusTBU: 'sangat_pendek',
        statusBBU: 'berat_badan_normal',
      }),
    ).toBe(true)
  })

  it('menampilkan PKMK jika anak mengalami Underweight (BB/U kurang atau sangat kurang)', () => {
    expect(
      apakahPerluPKMK({
        statusBBTB: 'gizi_baik',
        statusTBU: 'normal',
        statusBBU: 'berat_badan_kurang',
      }),
    ).toBe(true)

    expect(
      apakahPerluPKMK({
        statusBBTB: 'gizi_kurang',
        statusTBU: 'normal',
        statusBBU: 'berat_badan_sangat_kurang',
      }),
    ).toBe(true)
  })

  it('menampilkan PKMK jika balita terdeteksi Growth Faltering', () => {
    const hasil = apakahPerluPKMK({
      statusBBTB: 'gizi_baik',
      statusTBU: 'normal',
      statusBBU: 'berat_badan_normal',
      statusVelocity: 'growth_faltering',
    })
    expect(hasil).toBe(true)
  })
})
