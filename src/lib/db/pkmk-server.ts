/**
 * Pembacaan master produk PKMK dari basis data, khusus sisi server.
 *
 * ==========================================================================
 * SATU MASTER DATA UNTUK SELURUH APLIKASI (temuan audit T-0)
 *
 * Sebelum perbaikan ini ada DUA master data yang tidak pernah bertemu:
 *
 *   dunia basis data  : tabel `produk_pkmk`, dipakai halaman admin
 *   dunia statis      : array `PRODUK_PKMK` yang di-hardcode di
 *                       `src/lib/pkmk/produk.ts`, dipakai layar peresepan
 *                       dietisien dan skrining tamu
 *
 * Akibatnya seluruh fitur halaman admin tidak berdampak pada peresepan:
 * menambah produk tidak memunculkannya di layar dietisien, mengubah kkal per
 * saji tidak mengubah resep, dan MENONAKTIFKAN produk yang ditarik dari
 * peredaran tidak menghilangkannya dari daftar pilihan dokter. Kedua dunia juga
 * memuat angka berbeda untuk produk yang sama: SGM Gain 100 tercatat 30 ml air
 * per sendok dan usia minimal 0 bulan di basis data, tetapi 18 ml dan 12 bulan
 * pada daftar statis.
 *
 * Berkas ini menjadikan tabel `produk_pkmk` satu-satunya sumber. Daftar statis
 * hanya boleh dipakai sebagai cadangan yang DITANDAI JELAS di antarmuka, tidak
 * pernah secara senyap.
 * ==========================================================================
 */

import { createClient } from '@/lib/supabase/server'
import { petakanDaftarProdukDb, petakanProdukDbKeModel, type ProdukPKMK } from './pkmk'

export type HasilBacaProduk = {
  produk: ProdukPKMK[]
  /** Baris yang disingkirkan karena angka labelnya tidak lengkap. */
  jumlahDitolak: number
  /** `true` bila master data tidak dapat dibaca atau kosong. */
  masterTidakTersedia: boolean
}

/** Membaca seluruh produk PKMK yang berstatus aktif, urut menurut nama. */
export async function bacaProdukPKMKAktif(): Promise<HasilBacaProduk> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('produk_pkmk')
      .select('*')
      .eq('is_active', true)
      .order('nama', { ascending: true })

    if (error) {
      console.warn('Gagal membaca produk_pkmk aktif:', error)
      return { produk: [], jumlahDitolak: 0, masterTidakTersedia: true }
    }

    const { produk, jumlahDitolak } = petakanDaftarProdukDb(data ?? [])
    return { produk, jumlahDitolak, masterTidakTersedia: produk.length === 0 }
  } catch (err) {
    console.warn('Galat membaca produk_pkmk aktif:', err)
    return { produk: [], jumlahDitolak: 0, masterTidakTersedia: true }
  }
}

/**
 * Mengambil satu produk PKMK menurut id, dari basis data.
 *
 * Dipakai server action penyimpanan asuhan gizi agar perhitungan ulang di
 * server memakai spesifikasi yang sama dengan yang dilihat dietisien. Versi
 * sebelumnya memakai `produkById` dari daftar statis, sehingga angka yang
 * dipakai server bisa berbeda dari master data yang dikelola admin.
 *
 * Hanya produk AKTIF yang dikembalikan: produk yang sudah dinonaktifkan tidak
 * boleh lagi diresepkan pada asuhan gizi baru.
 */
export async function bacaProdukPKMKAktifById(id: string): Promise<ProdukPKMK | null> {
  if (!id) return null
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('produk_pkmk')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !data) return null
    return petakanProdukDbKeModel(data)
  } catch (err) {
    console.warn('Galat membaca produk_pkmk by id:', err)
    return null
  }
}
