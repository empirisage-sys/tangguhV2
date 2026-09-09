import { NextResponse } from 'next/server'
import { buatPdfSkriningBalita } from '@/lib/ekspor/pdf'
import { bacaBalitaById } from '@/lib/db/balita-server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import { bolehLihatBalita } from '@/lib/tampilan/akses'
import { ambilSemuaRujukan } from '@/lib/db/rujukan'

/**
 * Lembar laporan skrining satu balita dalam PDF.
 *
 * Sama seperti rute ekspor Excel: bentuk lama membaca senarai kosong sehingga
 * selalu 404, dan tidak memeriksa kewenangan sama sekali. Keduanya diperbaiki.
 * Cakupan wilayah ditegakkan RLS, lalu `bolehLihatBalita` dipakai sebagai
 * lapisan kedua — dokumen berisi rekam medis satu anak, jadi pantas dijaga dua
 * kali.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profil = await wajibPeran([
      'kader',
      'dokter',
      'dokter_spesialis_anak',
      'dietisien',
      'admin',
    ])

    const { id } = await params
    const hasilBaca = await bacaBalitaById(id)

    if (!hasilBaca.ok) {
      return NextResponse.json(
        { error: `Data balita gagal dibaca: ${hasilBaca.pesan}` },
        { status: 500 },
      )
    }

    const balita = hasilBaca.data
    if (!balita) {
      return NextResponse.json({ error: 'Balita tidak ditemukan' }, { status: 404 })
    }

    if (!bolehLihatBalita(balita, profil, ambilSemuaRujukan())) {
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
    if (err instanceof TidakBerwenangError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    const msg = err instanceof Error ? err.message : 'Gagal menghasilkan PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
