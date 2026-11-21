import { NextResponse } from 'next/server'
import { buatPdfSkriningBalita, type GiziUntukCetak } from '@/lib/ekspor/pdf'
import { hitungSkrining } from '@/lib/zscore'
import type { BalitaDetail } from '@/lib/db/balita'
import { bacaBalitaById } from '@/lib/db/balita-server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import { bolehLihatBalita } from '@/lib/tampilan/akses'
import { bacaRujukanUntukAkses } from '@/lib/db/rujukan-server'

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

    if (!bolehLihatBalita(balita, profil, await bacaRujukanUntukAkses())) {
      return NextResponse.json({ error: 'Balita tidak ditemukan' }, { status: 404 })
    }

    const pdfBuffer = await buatPdfSkriningBalita(balita, giziUntukCetak(balita))
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

/**
 * Kebutuhan gizi untuk lembar PDF, DIHITUNG ULANG di server dari pengukuran
 * terakhir (AGENTS.md 1.7).
 *
 * Temuan uji tulis 21 November 2026: rute ini tidak pernah mengirim kebutuhan
 * gizi ke pembuat PDF, sehingga tabel "Rekomendasi Kebutuhan Nutrisi Harian"
 * SELALU kosong dengan catatan "belum dapat dihitung", padahal layar aplikasi
 * menampilkan angkanya (mis. 910 kkal dan 990 kkal).
 */
function giziUntukCetak(balita: BalitaDetail): GiziUntukCetak | undefined {
  const s = balita.riwayat[balita.riwayat.length - 1]
  if (!s) return undefined
  try {
    const hasil = hitungSkrining({
      tanggalLahir: balita.tanggalLahir,
      tanggalPeriksa: s.tanggal,
      jenisKelamin: balita.jenisKelamin === 'P' ? 'pr' : 'lk',
      beratKg: s.beratKg,
      panjangCm: s.panjangCm,
      posisiUkur: s.posisiUkur,
      edema: s.edema ?? false,
      lilaCm: s.lilaCm ?? undefined,
      usiaGestasiMinggu: balita.usiaGestasiMinggu,
    })
    const g = hasil.gizi
    if (!g || g.kaloriPemeliharaanKkal == null) return undefined
    return {
      kaloriPemeliharaanKkal: g.kaloriPemeliharaanKkal,
      proteinPemeliharaanMinGram: g.proteinPemeliharaanMinGram,
      proteinPemeliharaanMaksGram: g.proteinPemeliharaanMaksGram,
      kaloriCatchUpKkal: g.kaloriCatchUpKkal ?? null,
      proteinCatchUpMinGram: g.proteinCatchUpMinGram ?? null,
      proteinCatchUpMaksGram: g.proteinCatchUpMaksGram ?? null,
    }
  } catch {
    return undefined
  }
}
