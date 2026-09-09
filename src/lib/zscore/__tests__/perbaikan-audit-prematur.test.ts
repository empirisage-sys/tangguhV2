/**
 * Uji pengunci temuan audit T-1 dan T-2: koreksi prematuritas pada kedua menu.
 *
 * Mesinnya sendiri sudah benar sejak perbaikan Z-4 dan sudah teruji. Yang salah
 * adalah PEMANGGILNYA: halaman tamu menyuntikkan tanggal lahir palsu sehingga
 * mengoreksi terlalu jauh, dan jalur nakes tidak pernah membaca usia gestasi
 * sama sekali sehingga tidak mengoreksi sama sekali. Keduanya lolos dari 523
 * uji yang ada karena semua uji memanggil mesin secara langsung.
 */
import { describe, expect, it } from 'vitest'
import { hitungSkrining, tanggalLahirEfektif, hitungUsiaKoreksi } from '@/lib/zscore'

const dasar = {
  tanggalPeriksa: '2026-09-09',
  jenisKelamin: 'lk' as const,
  posisiUkur: 'otomatis' as const,
}

/** Pola LAMA halaman tamu: geser tanggal lahir sebesar defisit, tanpa syarat. */
function tanggalLahirPalsu(tanggalLahir: string, usiaGestasiMinggu: number): string {
  const defisitHari = Math.max(0, 40 - usiaGestasiMinggu) * 7
  const ms = new Date(tanggalLahir + 'T00:00:00Z').getTime()
  return new Date(ms + defisitHari * 86_400_000).toISOString().slice(0, 10)
}

describe('T-1 menu tamu: koreksi tidak boleh melewati batas umur', () => {
  it('anak 30 bulan lahir 32 minggu TIDAK dikoreksi, dan itu berbeda nyata', () => {
    const lahir = '2024-03-09' // sekitar 30 bulan pada 2026-09-09
    const ukur = { beratKg: 11, panjangCm: 87 }

    const caraLama = hitungSkrining({
      ...dasar,
      ...ukur,
      tanggalLahir: tanggalLahirPalsu(lahir, 32),
    })
    const caraBaru = hitungSkrining({
      ...dasar,
      ...ukur,
      tanggalLahir: lahir,
      usiaGestasiMinggu: 32,
    })

    // Mesin menolak koreksi di atas 24 bulan, dan menandainya.
    expect(caraBaru.koreksiPrematurKedaluwarsa).toBe(true)
    expect(caraBaru.umurDikoreksiPrematur).toBe(false)
    expect(caraBaru.umurBulan).toBeCloseTo(30.03, 1)

    // Cara lama tetap mengurangi 56 hari, dan hasilnya lebih baik daripada
    // keadaan sebenarnya — arah yang paling berbahaya untuk alat skrining.
    expect(caraLama.umurBulan).toBeCloseTo(28.19, 1)
    expect(caraLama.tbu.z as number).toBeGreaterThan(caraBaru.tbu.z as number)
    expect(Math.abs((caraLama.tbu.z as number) - (caraBaru.tbu.z as number))).toBeGreaterThan(0.3)
  })

  it('di bawah batas umur, kedua cara menghasilkan umur yang sama', () => {
    const lahir = '2026-03-09' // sekitar 6 bulan
    const ukur = { beratKg: 6.5, panjangCm: 63 }

    const caraLama = hitungSkrining({
      ...dasar,
      ...ukur,
      tanggalLahir: tanggalLahirPalsu(lahir, 32),
    })
    const caraBaru = hitungSkrining({
      ...dasar,
      ...ukur,
      tanggalLahir: lahir,
      usiaGestasiMinggu: 32,
    })

    expect(caraBaru.umurBulan).toBeCloseTo(caraLama.umurBulan, 2)
    expect(caraBaru.tbu.z).toBeCloseTo(caraLama.tbu.z as number, 3)
  })

  it('jejak koreksi hanya ada pada cara baru', () => {
    const h = hitungSkrining({
      ...dasar,
      tanggalLahir: '2026-03-09',
      beratKg: 6.5,
      panjangCm: 63,
      usiaGestasiMinggu: 32,
    })

    // Inti kedua dari T-1: cara lama melaporkan `false` dan `0`, sehingga baris
    // yang umurnya dikoreksi tidak dapat dibedakan dari yang tidak.
    expect(h.umurDikoreksiPrematur).toBe(true)
    expect(h.defisitPrematurHari).toBe(56)
    expect(h.umurKronologisBulan).toBeGreaterThan(h.umurBulan)
  })

  it('bayi cukup bulan tidak terpengaruh sama sekali', () => {
    const tanpa = hitungSkrining({
      ...dasar,
      tanggalLahir: '2026-03-09',
      beratKg: 6.5,
      panjangCm: 63,
    })
    const dengan = hitungSkrining({
      ...dasar,
      tanggalLahir: '2026-03-09',
      beratKg: 6.5,
      panjangCm: 63,
      usiaGestasiMinggu: 39,
    })
    expect(dengan.umurBulan).toBe(tanpa.umurBulan)
    expect(dengan.umurDikoreksiPrematur).toBe(false)
  })
})

describe('T-2 menu nakes: usia gestasi wajib ikut ke mesin', () => {
  it('tanpa usia gestasi, bayi prematur salah dinyatakan pendek', () => {
    const lahir = '2026-03-09' // sekitar 6 bulan
    const ukur = { beratKg: 6.5, panjangCm: 63 }

    const tanpaGestasi = hitungSkrining({ ...dasar, ...ukur, tanggalLahir: lahir })
    const denganGestasi = hitungSkrining({
      ...dasar,
      ...ukur,
      tanggalLahir: lahir,
      usiaGestasiMinggu: 32,
    })

    // Inilah akibat T-2 pada jalur nakes: diagnosis stunting PALSU pada bayi
    // prematur, di aplikasi yang tugasnya mendeteksi stunting.
    expect(tanpaGestasi.statusTBU).toBe('pendek')
    expect(denganGestasi.statusTBU).toBe('normal')
    expect(Math.abs((tanpaGestasi.tbu.z as number) - (denganGestasi.tbu.z as number))).toBeGreaterThan(
      1.5,
    )
  })
})

describe('tanggalLahirEfektif memakai aturan mesin, bukan aturan sendiri', () => {
  it('mengoreksi selama koreksi masih berlaku', () => {
    const hasil = tanggalLahirEfektif('2026-03-09', '2026-09-09', 32)
    expect(hasil).toBe('2026-05-04') // 2026-03-09 + 56 hari
  })

  it('TIDAK mengoreksi setelah melewati batas umur', () => {
    // Inilah yang membedakannya dari rumus lokal halaman tamu.
    const lahir = '2024-03-09'
    expect(hitungUsiaKoreksi(lahir, '2026-09-09', 32).koreksiKedaluwarsa).toBe(true)
    expect(tanggalLahirEfektif(lahir, '2026-09-09', 32)).toBe(lahir)
  })

  it('tidak mengoreksi bayi cukup bulan maupun gestasi kosong', () => {
    expect(tanggalLahirEfektif('2026-03-09', '2026-09-09', 39)).toBe('2026-03-09')
    expect(tanggalLahirEfektif('2026-03-09', '2026-09-09', undefined)).toBe('2026-03-09')
  })

  it('tidak mengoreksi gestasi di luar rentang wajar', () => {
    expect(tanggalLahirEfektif('2026-03-09', '2026-09-09', 12)).toBe('2026-03-09')
    expect(tanggalLahirEfektif('2026-03-09', '2026-09-09', 50)).toBe('2026-03-09')
  })
})
