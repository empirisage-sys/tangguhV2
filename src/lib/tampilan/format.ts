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

/**
 * Gram dengan tanda yang benar, termasuk untuk angka negatif.
 *
 * TEMUAN AUDIT W-3b. Empat halaman menuliskan ambang kenaikan sebagai
 * `+${ambang} g` tanpa syarat, sehingga ambang persentil 5 WHO yang bernilai
 * negatif tersaji sebagai "+-105 g" dan "Min -0.11 kg". Ambang WHO memang
 * negatif pada 33 dari 114 kombinasi umur, interval, dan jenis kelamin —
 * artinya sebaran normal masih mencakup penurunan berat pada umur itu — jadi
 * bentuk rusak itu sering terlihat, bukan kasus tepi.
 */
export function formatGramBertanda(gram: number | null): string {
  if (gram === null || !Number.isFinite(gram)) return '-'
  const bulat = Math.round(gram)
  const tanda = bulat > 0 ? '+' : ''
  return `${tanda}${bulat.toLocaleString(ID)} g`
}

/** Kilogram dengan tanda yang benar, dua desimal. Pasangan `formatGramBertanda`. */
export function formatKiloBertanda(gram: number | null): string {
  if (gram === null || !Number.isFinite(gram)) return '-'
  const kg = Math.round(gram) / 1000
  const tanda = kg > 0 ? '+' : ''
  return `${tanda}${kg.toLocaleString(ID, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`
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

/**
 * Umur dalam bulan dengan pemisah desimal Indonesia.
 *
 * TEMUAN AUDIT R-3. Bentuk lama menyisipkan angka apa adanya, sehingga tabel
 * riwayat menampilkan "23.98 bulan" dengan TITIK sementara seluruh aplikasi
 * memakai KOMA lewat `formatZ` dan `angka`. Dua gaya angka pada satu baris
 * tabel membuat pembacanya ragu apakah keduanya berasal dari sumber yang sama.
 */
export function formatUmurBulan(bulan: number | null): string {
  if (bulan === null || !Number.isFinite(bulan)) return '-'
  return `${bulan.toLocaleString(ID, { maximumFractionDigits: 1 })} bulan`
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
