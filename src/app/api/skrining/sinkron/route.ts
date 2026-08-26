import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran } from '@/lib/supabase/penjaga'
import { hitungSkrining } from '@/lib/zscore'
import { keBarisSkrining, bandingkanHasil } from '@/lib/db/pemetaan'
import { skemaSkrining, periksaTerhadapBalita } from '@/lib/validasi/skrining'

export async function POST(request: Request) {
  try {
    const profil = await wajibPeran(['kader', 'dokter', 'dokter_spesialis_anak', 'dietisien'])
    const body = await request.json()
    const validasi = skemaSkrining.safeParse(body.masukan)

    if (!validasi.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', issues: validasi.error.flatten() },
        { status: 400 },
      )
    }

    const masukan = validasi.data
    const supabase = await createClient()

    // Ambil data balita untuk validasi tanggal lahir dan jenis kelamin
    const { data: balita, error: balitaErr } = await supabase
      .from('balita')
      .select('id, nama, tanggal_lahir, jenis_kelamin, posyandu_id, puskesmas_id, kabupaten_id')
      .eq('id', masukan.balitaId)
      .single()

    if (balitaErr || !balita) {
      return NextResponse.json({ error: 'Balita tidak ditemukan' }, { status: 404 })
    }

    const cekTgl = periksaTerhadapBalita(masukan, balita.tanggal_lahir)
    if (!cekTgl.ok) {
      return NextResponse.json({ error: cekTgl.pesan }, { status: 400 })
    }

    // HITUNG ULANG DI SERVER (Aturan Keamanan Medis Kritis)
    const hasilServer = hitungSkrining({
      tanggalLahir: balita.tanggal_lahir,
      tanggalPeriksa: masukan.tanggalPeriksa,
      jenisKelamin: balita.jenis_kelamin === 'L' ? 'lk' : 'pr',
      beratKg: masukan.beratKg,
      panjangCm: masukan.panjangCm,
      posisiUkur: masukan.posisiUkur,
      lilaCm: masukan.lilaCm,
      edema: masukan.edema,
    })

    if (body.hasilKlien) {
      const perbandingan = bandingkanHasil(body.hasilKlien, hasilServer)
      if (!perbandingan.cocok) {
        console.warn(
          `[TANGGUH Sync] Selisih hitung perangkat vs server pada clientUuid: ${masukan.clientUuid}`,
          perbandingan.selisih,
        )
      }
    }

    const baris = keBarisSkrining(
      {
        clientUuid: masukan.clientUuid,
        balitaId: balita.id,
        tanggalPeriksa: masukan.tanggalPeriksa,
        beratKg: masukan.beratKg,
        panjangCm: masukan.panjangCm,
        posisiUkur: masukan.posisiUkur,
        lilaCm: masukan.lilaCm,
        lingkarKepalaCm: masukan.lingkarKepalaCm,
        edema: masukan.edema,
        catatan: masukan.catatan,
        createdBy: profil.id,
        posyanduId: balita.posyandu_id,
        puskesmasId: balita.puskesmas_id,
        kabupatenId: balita.kabupaten_id,
        asalData: 'sinkronisasi_offline',
      },
      hasilServer,
    )

    const { error: insertErr } = await supabase.from('skrining').insert(baris)

    if (insertErr) {
      // Jika kode error duplikasi unik client_uuid (23505), anggap sukses
      if (insertErr.code === '23505' || insertErr.message?.includes('duplicate key')) {
        return NextResponse.json({ success: true, duplikat: true })
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: masukan.clientUuid })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
