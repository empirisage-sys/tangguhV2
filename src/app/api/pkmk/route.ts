import { NextResponse } from 'next/server'
import { bacaProdukPKMKAktif } from '@/lib/db/pkmk-server'
import type { ProdukPKMK } from '@/lib/db/pkmk'

export const dynamic = 'force-dynamic'

/**
 * GET /api/pkmk
 * Mengembalikan daftar produk susu PKMK yang berstatus aktif.
 *
 * TIDAK ADA CADANGAN KE DAFTAR STATIS.
 *
 * Versi sebelumnya menyajikan `PRODUK_PKMK_LIST` bila kueri gagal atau tabel
 * kosong. Endpoint ini dipakai untuk PERESEPAN, sehingga menyajikan produk yang
 * tidak ada di master data berarti dokter dapat meresepkan produk yang tidak
 * pernah diverifikasi admin — dan produk yang sudah dinonaktifkan karena ditarik
 * dari peredaran akan tetap muncul. Lebih baik gagal dengan jujur.
 * Lihat temuan audit T-12.
 */
export async function GET() {
  const { produk, jumlahDitolak, masterTidakTersedia } = await bacaProdukPKMKAktif()

  if (masterTidakTersedia) {
    return NextResponse.json(
      {
        ok: false,
        pesan:
          'Master data produk PKMK belum tersedia atau tidak dapat dibaca. ' +
          'Peresepan PKMK tidak dapat dilakukan sampai master data terisi.',
      },
      { status: 503 },
    )
  }

  if (jumlahDitolak > 0) {
    console.warn(`${jumlahDitolak} baris produk_pkmk disingkirkan: angka label tidak lengkap`)
  }

  const muatan: { ok: true; data: ProdukPKMK[]; jumlahDitolak?: number } = {
    ok: true,
    data: produk,
  }
  if (jumlahDitolak > 0) muatan.jumlahDitolak = jumlahDitolak

  return NextResponse.json(muatan)
}
