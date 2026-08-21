import { describe, expect, it } from 'vitest'
import { hitungSkrining } from '@/lib/zscore'
import { hitungSkriningLama } from '@/../referensi/engine-lama'
import type { JenisKelamin } from '@/lib/who'

/**
 * UJI REGRESI TERHADAP APLIKASI VERSI FIREBASE
 *
 * Tujuan uji ini bukan membuktikan bahwa hasilnya identik. Hasilnya memang
 * disengaja berbeda pada beberapa hal. Tujuannya adalah membuktikan bahwa
 * SETIAP perbedaan dapat dijelaskan oleh salah satu dari enam perubahan yang
 * sudah diputuskan, dan tidak ada perbedaan yang tidak dapat dijelaskan.
 *
 * Enam perubahan yang disengaja:
 *   1. Nilai di luar rentang tabel ditolak, tidak dijepit ke tepi tabel.
 *   2. Ambang TB/U mengikuti Kemenkes: normal berlaku sampai +3 SD.
 *   3. Delta dikurangkan pada penilaian velocity.
 *   4. Kebutuhan gizi menghasilkan dua angka, termasuk target tumbuh kejar.
 *   5. Usia-tinggi diinterpolasi, tidak dibulatkan ke bulan terdekat.
 *   6. Kategori dikembalikan sebagai kode, bukan teks berikut kelas CSS.
 *
 * Perubahan 3, 4, 5, dan 6 diuji di berkas lain. Berkas ini memusatkan
 * perhatian pada nilai Z dan klasifikasi, yaitu bagian yang paling berbahaya
 * bila berubah tanpa disadari.
 *
 * BATAS CAKUPAN YANG PERLU DIKETAHUI
 * Porting engine lama di `referensi/engine-lama.ts` memakai tabel L/M/S yang
 * SAMA dengan engine baru, yaitu berkas di `src/lib/who/`. Karena itu uji di
 * berkas ini membandingkan ALGORITMA, bukan DATA TABEL.
 *
 * Konsekuensinya: satu koreksi data yang dilakukan pada tabel BB/PB perempuan
 * baris 95,5 cm tidak akan muncul sebagai perbedaan di sini, karena kedua
 * engine membaca nilai yang sudah dikoreksi. Kebenaran data tabel diuji
 * terpisah di `integritas-tabel.test.ts`, dan diverifikasi baris per baris
 * terhadap tabel terbitan WHO seperti dilaporkan di
 * `docs/VERIFIKASI_TABEL_WHO.md`.
 *
 * Pembagian ini disengaja: satu berkas uji menjaga algoritma, satu berkas uji
 * menjaga data. Mencampurnya akan membuat kedua jenis kesalahan saling menutupi.
 */

const ISO = (hariSejakLahir: number, lahir = Date.UTC(2021, 0, 1)): string =>
  new Date(lahir + hariSejakLahir * 86_400_000).toISOString().slice(0, 10)

const TGL_LAHIR = '2021-01-01'

type Kasus = {
  seks: JenisKelamin
  hari: number
  beratKg: number
  panjangCm: number
  posisi: 'terlentang' | 'berdiri'
}

/** Membangun kisi kasus yang menjangkau seluruh rentang operasional aplikasi. */
function kisiKasus(): Kasus[] {
  const kasus: Kasus[] = []
  // Kisi sengaja memuat nilai di dalam maupun di luar cakupan standar:
  //   hari 1826 = 59,99 bulan (batas atas yang masih sah)
  //   hari 1900 = 62,4 bulan (di luar cakupan, harus ditolak engine baru)
  //   panjang 130 cm di luar tabel BB/PB dan BB/TB
  const hariUji = [0, 30, 91, 182, 335, 700, 730, 731, 760, 1096, 1461, 1795, 1826, 1900]
  const beratUji = [3, 5, 7, 9, 11, 13, 16, 20]
  const panjangUji = [50, 60, 70, 80, 87, 95, 100, 108, 130]

  for (const seks of ['lk', 'pr'] as const) {
    for (const hari of hariUji) {
      for (const beratKg of beratUji) {
        for (const panjangCm of panjangUji) {
          for (const posisi of ['terlentang', 'berdiri'] as const) {
            kasus.push({ seks, hari, beratKg, panjangCm, posisi })
          }
        }
      }
    }
  }
  return kasus
}

const POSISI_LAMA = { terlentang: 'recumbent', berdiri: 'standing' } as const

type Perbedaan = {
  kasus: Kasus
  jenis: string
  detail: string
}

function bandingkan(k: Kasus): Perbedaan[] {
  const baru = hitungSkrining({
    tanggalLahir: TGL_LAHIR,
    tanggalPeriksa: ISO(k.hari),
    jenisKelamin: k.seks,
    beratKg: k.beratKg,
    panjangCm: k.panjangCm,
    posisiUkur: k.posisi,
  })

  const lama = hitungSkriningLama({
    tanggalLahir: TGL_LAHIR,
    tanggalPeriksa: ISO(k.hari),
    jenisKelamin: k.seks,
    beratKg: k.beratKg,
    panjangCm: k.panjangCm,
    posisiUkur: POSISI_LAMA[k.posisi],
  })

  const beda: Perbedaan[] = []

  // Kesetaraan dasar: umur dan panjang terkoreksi harus identik.
  if (Math.abs(baru.umurBulan - lama.umurBulan) > 0.01) {
    beda.push({
      kasus: k,
      jenis: 'TIDAK_DIHARAPKAN_umur',
      detail: `baru ${baru.umurBulan} vs lama ${lama.umurBulan}`,
    })
  }
  if (Math.abs(baru.panjangTerkoreksiCm - lama.panjangTerkoreksi) > 0.001) {
    beda.push({
      kasus: k,
      jenis: 'TIDAK_DIHARAPKAN_panjang_terkoreksi',
      detail: `baru ${baru.panjangTerkoreksiCm} vs lama ${lama.panjangTerkoreksi}`,
    })
  }

  const indikator: Array<['bbu' | 'tbu' | 'bbtb', number | null, number | null]> = [
    ['bbu', baru.bbu.z, lama.zBbu],
    ['tbu', baru.tbu.z, lama.zTbu],
    ['bbtb', baru.bbtb.z, lama.zBbtb],
  ]

  for (const [nama, zBaru, zLama] of indikator) {
    if (zBaru === null && zLama !== null) {
      beda.push({
        kasus: k,
        jenis: 'DISENGAJA_1_di_luar_rentang_ditolak',
        detail: `${nama}: baru null, lama ${zLama.toFixed(3)}`,
      })
      continue
    }
    if (zBaru !== null && zLama === null) {
      beda.push({
        kasus: k,
        jenis: 'TIDAK_DIHARAPKAN_baru_menilai_lama_tidak',
        detail: `${nama}: baru ${zBaru.toFixed(3)}, lama null`,
      })
      continue
    }
    if (zBaru !== null && zLama !== null && Math.abs(zBaru - zLama) > 0.001) {
      beda.push({
        kasus: k,
        jenis: 'TIDAK_DIHARAPKAN_nilai_z_berbeda',
        detail: `${nama}: baru ${zBaru.toFixed(4)} vs lama ${zLama.toFixed(4)}`,
      })
    }
  }

  // Perbedaan klasifikasi TB/U yang disengaja: rentang +2 sampai +3.
  if (baru.statusTBU !== null && lama.statusTbu !== null) {
    const petaLama: Record<string, string> = {
      'Sangat Pendek': 'sangat_pendek',
      Pendek: 'pendek',
      Normal: 'normal',
      Tinggi: 'tinggi',
      'Sangat Tinggi': 'tinggi',
    }
    const lamaSetara = petaLama[lama.statusTbu]
    if (lamaSetara !== baru.statusTBU) {
      const zTbu = baru.tbu.z ?? 0
      const dalamRentangDisengaja = zTbu > 2 && zTbu <= 3
      beda.push({
        kasus: k,
        jenis: dalamRentangDisengaja
          ? 'DISENGAJA_2_ambang_tbu_kemenkes'
          : 'TIDAK_DIHARAPKAN_klasifikasi_tbu',
        detail: `z ${zTbu.toFixed(3)}: baru ${baru.statusTBU}, lama ${lama.statusTbu}`,
      })
    }
  }

  return beda
}

describe('regresi terhadap engine aplikasi versi Firebase', () => {
  const kasus = kisiKasus()
  const semuaBeda = kasus.flatMap(bandingkan)

  it('kisi kasus cukup luas untuk bermakna', () => {
    expect(kasus.length).toBeGreaterThan(3000)
  })

  it('tidak ada perbedaan yang tidak dapat dijelaskan', () => {
    const takTerduga = semuaBeda.filter((b) => b.jenis.startsWith('TIDAK_DIHARAPKAN'))

    if (takTerduga.length > 0) {
      const contoh = takTerduga
        .slice(0, 10)
        .map(
          (b) =>
            `  ${b.jenis} | ${b.kasus.seks} ${b.kasus.hari}h ${b.kasus.beratKg}kg ` +
            `${b.kasus.panjangCm}cm ${b.kasus.posisi} -> ${b.detail}`,
        )
        .join('\n')
      throw new Error(
        `Ditemukan ${takTerduga.length} perbedaan yang tidak dapat dijelaskan ` +
          `dari ${kasus.length} kasus:\n${contoh}`,
      )
    }

    expect(takTerduga).toHaveLength(0)
  })

  it('nilai Z identik pada seluruh kasus yang dinilai kedua engine', () => {
    // Ini pembuktian utama bahwa pemindahan tabel dan rumus dilakukan setia.
    const zBerbeda = semuaBeda.filter((b) => b.jenis === 'TIDAK_DIHARAPKAN_nilai_z_berbeda')
    expect(zBerbeda).toHaveLength(0)
  })

  it('perbedaan penolakan nilai di luar rentang memang terjadi dan terhitung', () => {
    const ditolak = semuaBeda.filter(
      (b) => b.jenis === 'DISENGAJA_1_di_luar_rentang_ditolak',
    )
    // Kisi memuat kasus umur di atas 60 bulan dan panjang di luar tabel,
    // jadi perbedaan ini harus muncul. Bila tidak muncul, kisi terlalu sempit
    // atau penolakan tidak berjalan.
    expect(ditolak.length).toBeGreaterThan(0)
  })

  it('perbedaan ambang TB/U hanya muncul pada Z antara +2 dan +3', () => {
    const ambang = semuaBeda.filter((b) => b.jenis === 'DISENGAJA_2_ambang_tbu_kemenkes')
    for (const b of ambang) {
      const cocok = /z (-?\d+\.\d+)/.exec(b.detail)
      const z = Number(cocok?.[1])
      expect(z).toBeGreaterThan(2)
      expect(z).toBeLessThanOrEqual(3)
    }
  })

  it('ringkasan perbedaan tercatat untuk dibawa ke verifikasi klinis', () => {
    const ringkasan = new Map<string, number>()
    for (const b of semuaBeda) {
      ringkasan.set(b.jenis, (ringkasan.get(b.jenis) ?? 0) + 1)
    }

    // Dicetak agar terlihat di keluaran uji dan dapat dilampirkan ke dokumen validasi.
    const baris = [...ringkasan.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([jenis, jumlah]) => `    ${jenis}: ${jumlah}`)
      .join('\n')
    console.info(
      `\n  Regresi ${kasus.length} kasus, ${semuaBeda.length} perbedaan:\n${baris || '    (tidak ada)'}\n`,
    )

    for (const jenis of ringkasan.keys()) {
      expect(jenis.startsWith('DISENGAJA_')).toBe(true)
    }
  })
})
