import { NextResponse } from 'next/server'
import { buatExcelRekap } from '@/lib/ekspor/excel'
import { bacaDaftarBalita } from '@/lib/db/balita-server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'

/**
 * Ekspor rekap seluruh balita dalam cakupan pengguna ke Excel.
 *
 * ==========================================================================
 * DUA HAL YANG DIPERBAIKI DI BERKAS INI
 *
 * TAHAP 2a  Bentuk lama mengekspor `SAMPLE_BALITA_DATABASE`, yang isinya `[]`.
 *           Berkas Excel yang diunduh karena itu selalu kosong, dan tidak ada
 *           apa pun di layar yang mengatakan demikian — pengguna menyimpulkan
 *           wilayahnya belum punya data.
 *
 * KEAMANAN  Rute ini TIDAK memiliki pemeriksaan kewenangan sama sekali. Selama
 *           datanya kosong hal itu tidak berakibat; begitu tersambung ke
 *           Supabase, sebuah titik ekspor tanpa penjaga peran adalah pintu yang
 *           tidak seharusnya ada. RLS memang membatasi baris menurut sesi
 *           pemanggil, tetapi mengandalkan RLS sendirian berarti akun yang
 *           belum disetujui pun boleh menekan tombol ekspor.
 * ==========================================================================
 */
export async function GET() {
  try {
    await wajibPeran(['kader', 'dokter', 'dokter_spesialis_anak', 'dietisien', 'admin'])

    const hasilBaca = await bacaDaftarBalita()
    if (!hasilBaca.ok) {
      return NextResponse.json(
        { error: `Data balita gagal dibaca: ${hasilBaca.pesan}` },
        { status: 500 },
      )
    }

    // Berkas kosong TIDAK dikirim diam-diam. Rekap kosong yang terunduh sebagai
    // berkas yang tampak sah adalah cara paling halus menyesatkan laporan.
    if (hasilBaca.data.length === 0) {
      return NextResponse.json(
        {
          error:
            'Tidak ada balita dalam cakupan Anda, sehingga tidak ada yang dapat diekspor.',
        },
        { status: 404 },
      )
    }

    const buffer = await buatExcelRekap(hasilBaca.data)
    const tgl = new Date().toISOString().slice(0, 10)
    const namaFile = `Rekap_TANGGUH_Gorontalo_${tgl}.xlsx`

    return new NextResponse(buffer as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${namaFile}"`,
      },
    })
  } catch (err: unknown) {
    if (err instanceof TidakBerwenangError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    const msg = err instanceof Error ? err.message : 'Gagal menghasilkan Excel'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
