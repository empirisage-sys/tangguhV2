/**
 * Pemformatan untuk tampilan dan cetakan.
 *
 * Seluruh angka memakai gaya Indonesia: koma sebagai pemisah desimal dan titik
 * sebagai pemisah ribuan. Ini bukan soal selera, melainkan agar angka yang
 * dibaca kader dan yang tercetak di laporan resmi seragam.
 */

const ID = 'id-ID'

/** Menampilkan nilai Z dengan dua desimal dan tanda plus yang eksplisit. */
export function formatZ(z: number | null): string {
  if (z === null || !Number.isFinite(z)) return 'tidak dinilai'
  const teks = Math.abs(z).toLocaleString(ID, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (z > 0) return `+${teks}`
  if (z < 0) return `-${teks}`
  return teks
}

export function formatBerat(kg: number | null): string {
  if (kg === null || !Number.isFinite(kg)) return '-'
  return `${kg.toLocaleString(ID, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`
}

export function formatPanjang(cm: number | null): string {
  if (cm === null || !Number.isFinite(cm)) return '-'
  return `${cm.toLocaleString(ID, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} cm`
}

export function formatKalori(kkal: number | null): string {
  if (kkal === null || !Number.isFinite(kkal)) return '-'
  return `${Math.round(kkal).toLocaleString(ID)} kkal`
}

export function formatGram(gram: number | null): string {
  if (gram === null || !Number.isFinite(gram)) return '-'
  return `${Math.round(gram).toLocaleString(ID)} g`
}

export function formatRentangProtein(min: number | null, maks: number | null): string {
  if (min === null || maks === null) return '-'
  const f = (n: number) =>
    n.toLocaleString(ID, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${f(min)} sampai ${f(maks)} g`
}

/**
 * Umur dalam bentuk yang dipakai kader: tahun dan bulan, bukan desimal.
 * Contoh: "2 tahun 1 bulan", "7 bulan", "baru lahir".
 */
export function formatUmur(tahun: number, bulanSisa: number): string {
  if (tahun === 0 && bulanSisa === 0) return 'Baru lahir'
  const bagian: string[] = []
  if (tahun > 0) bagian.push(`${tahun} tahun`)
  if (bulanSisa > 0) bagian.push(`${bulanSisa} bulan`)
  return bagian.join(' ')
}

export function formatUmurBulan(bulan: number): string {
  return `${bulan} bulan`
}

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** Tanggal YYYY-MM-DD menjadi "19 Agustus 2026". Tidak memakai zona waktu. */
export function formatTanggal(iso: string): string {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!cocok) return iso
  const tahun = cocok[1] as string
  const bulan = BULAN_ID[Number(cocok[2]) - 1] ?? cocok[2]
  const hari = Number(cocok[3])
  return `${hari} ${bulan} ${tahun}`
}

/** Bentuk ringkas untuk tabel: "19/08/2026". */
export function formatTanggalRingkas(iso: string): string {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!cocok) return iso
  return `${cocok[3]}/${cocok[2]}/${cocok[1]}`
}

/**
 * Nama berkas untuk unduhan. Tanpa spasi, tanpa tanda baca, agar aman di
 * semua sistem berkas dan mudah diurutkan.
 */
export function namaBerkas(
  awalan: string,
  namaBalita: string,
  tanggal: string,
  ekstensi: string,
): string {
  const bersih = namaBalita
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${awalan}-${bersih || 'tanpa-nama'}-${tanggal}.${ekstensi}`
}
