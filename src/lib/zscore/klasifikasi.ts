/**
 * Klasifikasi status gizi.
 *
 * Ambang mengikuti Standar Antropometri Anak Kementerian Kesehatan RI
 * (Peraturan Menteri Kesehatan Nomor 2 Tahun 2020), yang menurunkan ambangnya
 * dari WHO Child Growth Standards 2006.
 *
 * Fungsi di berkas ini HANYA mengembalikan kode kategori, tidak pernah teks
 * yang dibaca pengguna dan tidak pernah nama kelas CSS. Aplikasi versi Firebase
 * mengembalikan teks berikut kelas Tailwind dari lapisan logika, lalu di tempat
 * lain mencocokkan teks itu dengan `includes()`. Pola tersebut sudah terbukti
 * menimbulkan kekeliruan: penyaring di KaderDashboard dan DietisienDashboard
 * mencari 'Gizi kurang' dengan huruf k kecil, sementara teks yang dihasilkan
 * adalah 'Gizi Kurang (Wasted)', sehingga pencocokan selalu gagal.
 * Lihat TELAAH_KODE_LAMA_TANGGUH.md temuan T-5.
 *
 * Pemetaan kode kategori menjadi label bahasa Indonesia dan warna dilakukan
 * di lapisan tampilan, bukan di sini.
 */
import type { StatusBBU, StatusTBU, StatusBBTB } from './tipe'

/**
 * Berat badan menurut umur (BB/U).
 *
 *   Z < -3            berat badan sangat kurang
 *   -3 <= Z < -2      berat badan kurang
 *   -2 <= Z <= +1     berat badan normal
 *   Z > +1            risiko berat badan lebih
 *
 * Sama dengan perilaku aplikasi versi Firebase; sudah sesuai standar.
 */
export function klasifikasiBBU(z: number | null): StatusBBU | null {
  if (z === null || !Number.isFinite(z)) return null
  if (z < -3) return 'berat_badan_sangat_kurang'
  if (z < -2) return 'berat_badan_kurang'
  if (z > 1) return 'risiko_berat_badan_lebih'
  return 'berat_badan_normal'
}

/**
 * Panjang atau tinggi badan menurut umur (PB/U atau TB/U).
 *
 *   Z < -3            sangat pendek
 *   -3 <= Z < -2      pendek
 *   -2 <= Z <= +3     normal
 *   Z > +3            tinggi
 *
 * PERBEDAAN DENGAN APLIKASI LAMA: aplikasi versi Firebase menetapkan Z > +2
 * sebagai 'Tinggi' dan Z > +3 sebagai 'Sangat Tinggi'. Standar Kemenkes
 * menyatakan normal berlaku sampai +3 SD dan tidak mengenal kategori
 * 'sangat tinggi'. Akibat perubahan ini, anak dengan Z antara +2 dan +3
 * berpindah label dari 'Tinggi' menjadi 'Normal'.
 * Lihat TELAAH_KODE_LAMA_TANGGUH.md temuan T-4 dan keputusan D-4.
 */
export function klasifikasiTBU(z: number | null): StatusTBU | null {
  if (z === null || !Number.isFinite(z)) return null
  if (z < -3) return 'sangat_pendek'
  if (z < -2) return 'pendek'
  if (z > 3) return 'tinggi'
  return 'normal'
}

/**
 * Berat badan menurut panjang atau tinggi badan (BB/PB atau BB/TB).
 *
 *   Z < -3            gizi buruk
 *   -3 <= Z < -2      gizi kurang
 *   -2 <= Z <= +1     gizi baik
 *   +1 < Z <= +2      risiko gizi lebih
 *   +2 < Z <= +3      gizi lebih
 *   Z > +3            obesitas
 *
 * Sama dengan perilaku aplikasi versi Firebase; sudah sesuai standar.
 */
export function klasifikasiBBTB(z: number | null): StatusBBTB | null {
  if (z === null || !Number.isFinite(z)) return null
  if (z < -3) return 'gizi_buruk'
  if (z < -2) return 'gizi_kurang'
  if (z > 3) return 'obesitas'
  if (z > 2) return 'gizi_lebih'
  if (z > 1) return 'risiko_gizi_lebih'
  return 'gizi_baik'
}

/** Menandai status yang menuntut tindak lanjut gizi, dipakai untuk daftar prioritas dietisien. */
export function perluIntervensiGizi(
  statusBBU: StatusBBU | null,
  statusTBU: StatusTBU | null,
  statusBBTB: StatusBBTB | null,
): boolean {
  return (
    statusBBU === 'berat_badan_kurang' ||
    statusBBU === 'berat_badan_sangat_kurang' ||
    statusTBU === 'pendek' ||
    statusTBU === 'sangat_pendek' ||
    statusBBTB === 'gizi_kurang' ||
    statusBBTB === 'gizi_buruk'
  )
}
