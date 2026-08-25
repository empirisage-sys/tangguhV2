import { NextResponse } from 'next/server'
import { buatPdfSkriningBalita } from '@/lib/ekspor/pdf'
import { cariBalitaById, SAMPLE_BALITA_DATABASE } from '@/lib/db/balita-mock'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const balita = cariBalitaById(id)

    if (!balita) {
      return NextResponse.json({ error: 'Balita tidak ditemukan' }, { status: 404 })
    }

    const pdfBuffer = await buatPdfSkriningBalita(balita)
    const namaFile = `Laporan_Skrining_${balita.nama.replace(/\s+/g, '_')}.pdf`

    return new NextResponse(pdfBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${namaFile}"`,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal menghasilkan PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
