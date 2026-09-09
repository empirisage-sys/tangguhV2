import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
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
      .select('id, nama, tanggal_lahir, jenis_kelamin, posyandu_id, puskesmas_id, kabupaten_id, usia_gestasi_minggu')
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
      // Lihat temuan audit T-2. Tanpa ini, hasil hitung ulang server berbeda
      // dari hasil perangkat pada setiap bayi prematur.
      usiaGestasiMinggu: balita.usia_gestasi_minggu ?? undefined,
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
        usiaGestasiMinggu: balita.usia_gestasi_minggu ?? undefined,
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
      // ====================================================================
      // TEMUAN AUDIT S-2: DUA KENDALA UNIK, SATU KODE GALAT
      //
      // Tabel `skrining` punya DUA kendala unik yang keduanya memicu 23505:
      //   - `client_uuid` unik          -> idempotensi sinkronisasi, memang
      //                                    kita inginkan, aman dianggap sukses
      //   - `uq_skrining_harian`        -> (balita_id, tanggal_periksa)
      //                                    penimbangan lain sudah ada hari itu
      //
      // Bentuk lama memperlakukan SETIAP 23505 sebagai "sudah tersinkron".
      // Akibatnya, ketika kader mencatat penimbangan koreksi pada hari yang
      // sama karena timbangan salah baca, baris koreksi itu ditolak database
      // lalu dilaporkan ke perangkat sebagai berhasil, dihapus dari antrean,
      // dan hilang selamanya — sambil layar berkata "berhasil dikirim".
      //
      // Kedua kendala dibedakan dari nama kendala dan rinciannya.
      // ====================================================================
      const jejak = `${insertErr.message ?? ''} ${(insertErr as { details?: string }).details ?? ''}`
      const duplikatClientUuid = insertErr.code === '23505' && jejak.includes('client_uuid')

      if (duplikatClientUuid) {
        return NextResponse.json({ success: true, duplikat: true })
      }

      if (insertErr.code === '23505') {
        return NextResponse.json(
          {
            error:
              'Sudah ada penimbangan lain untuk balita ini pada tanggal tersebut. ' +
              'Data ini tidak dapat disimpan sebagai baris baru. Periksa penimbangan ' +
              'yang sudah tercatat, lalu perbaiki yang benar.',
            kendala: 'skrining_harian_ganda',
          },
          { status: 409 },
        )
      }

      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: masukan.clientUuid })
  } catch (err: unknown) {
    // Bentuk lama mengembalikan 401 untuk SETIAP pengecualian, termasuk body
    // JSON yang rusak dan galat pemrograman. Perangkat lalu mencatatnya sebagai
    // gagal tanpa tahu apa yang salah, dan pengguna yang sah tampak seperti
    // tidak berwenang. Hanya galat kewenangan yang 401 (temuan audit S-7).
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    if (err instanceof TidakBerwenangError) {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    console.error('[TANGGUH Sync] Galat tak terduga:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
