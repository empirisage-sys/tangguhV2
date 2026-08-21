import { NextResponse } from 'next/server'
import { buatExcelRekap } from '@/lib/ekspor/excel'
import { SAMPLE_BALITA_DATABASE } from '@/lib/db/balita-mock'

export async function GET() {
  try {
    const buffer = await buatExcelRekap(SAMPLE_BALITA_DATABASE)
    const tgl = new Date().toISOString().slice(0, 10)
    const namaFile = `Rekap_TANGGUH_Gorontalo_${tgl}.xlsx`

    return new NextResponse(buffer as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${namaFile}"`,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal menghasilkan Excel'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
