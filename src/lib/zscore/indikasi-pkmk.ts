import type { StatusBBU, StatusBBTB, StatusTBU, StatusVelocity } from './tipe'

export type InputIndikasiPKMK = {
  statusBBTB: StatusBBTB | null | undefined
  statusTBU: StatusTBU | null | undefined
  statusBBU: StatusBBU | null | undefined
  statusVelocity?: StatusVelocity | null | undefined
  edema?: boolean
}

/**
 * Menentukan apakah seorang balita memiliki indikasi klinis untuk tata laksana PKMK
 * (Pangan Olahan untuk Keperluan Medis Khusus).
 *
 * Pedoman Klinis:
 * 1. Anak dengan BB/TB Gizi Baik dan TB/U & BB/U Normal -> TIDAK PERLU PKMK.
 * 2. Anak dengan BB/TB Gizi Kurang dan TB/U & BB/U Normal -> TIDAK PERLU PKMK.
 * 3. Tata laksana PKMK HANYA diindikasikan pada kondisi risiko malnutrisi spesifik:
 *    - Gizi Buruk (BB/TB gizi buruk atau edema bilateral)
 *    - Stunting / Perawakan Pendek (TB/U sangat pendek atau pendek)
 *    - Underweight / Berat Badan Sangat Kurang / Kurang (BB/U sangat kurang atau kurang)
 *    - Terbukti Growth Faltering (Kenaikan BB tidak adekuat di bawah standar WHO)
 */
export function apakahPerluPKMK(input: InputIndikasiPKMK): boolean {
  // 1. Jika ada edema atau gizi buruk, mutlak perlu tatalaksana PKMK
  if (input.edema || input.statusBBTB === 'gizi_buruk') {
    return true
  }

  const isTbuBermasalah =
    input.statusTBU === 'sangat_pendek' || input.statusTBU === 'pendek'
  const isBbuBermasalah =
    input.statusBBU === 'berat_badan_sangat_kurang' ||
    input.statusBBU === 'berat_badan_kurang'
  const isGrowthFaltering = input.statusVelocity === 'growth_faltering'

  // 2. Jika TB/U bermasalah (stunting), BB/U bermasalah (underweight), atau growth faltering
  if (isTbuBermasalah || isBbuBermasalah || isGrowthFaltering) {
    return true
  }

  // 3. Untuk kasus BB/TB gizi baik maupun BB/TB gizi kurang dengan TB/U & BB/U normal: tidak perlu PKMK
  return false
}
