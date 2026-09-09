'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import { hitungSkrining } from '@/lib/zscore'
import { keBarisSkrining } from '@/lib/db/pemetaan'
import { skemaSkrining, periksaTerhadapBalita } from '@/lib/validasi/skrining'
import { cariBalitaById } from '@/lib/db/balita-mock'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

export async function simpanSkrining(formData: FormData): Promise<HasilTindakan> {
  // Galat izin dikembalikan sebagai pesan, bukan dilempar. Lemparan pada Server
  // Action menjadi HTTP 500 yang pesannya disembunyikan Next.js di produksi,
  // sehingga tombol simpan mati tanpa keterangan. Lihat catatan panjang di
  // `balita/baru/actions.ts`.
  let profil
  try {
    profil = await wajibPeran(['kader', 'dokter', 'dokter_spesialis_anak', 'dietisien'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const hasil = skemaSkrining.safeParse({
    balitaId: formData.get('balitaId'),
    tanggalPeriksa: formData.get('tanggalPeriksa'),
    beratKg: formData.get('beratKg'),
    panjangCm: formData.get('panjangCm'),
    posisiUkur: formData.get('posisiUkur'),
    lilaCm: formData.get('lilaCm') || undefined,
    lingkarKepalaCm: formData.get('lingkarKepalaCm') || undefined,
    edema: formData.get('edema') === 'true',
    catatan: formData.get('catatan') || undefined,
    clientUuid: formData.get('clientUuid'),
  })

  if (!hasil.success) {
    const galatMedan: Record<string, string> = {}
    for (const isu of hasil.error.issues) {
      const medan = String(isu.path[0] ?? 'umum')
      galatMedan[medan] ??= isu.message
    }
    return { ok: false, pesan: 'Periksa kembali angka pengukuran.', galatMedan }
  }

  const d = hasil.data
  const supabase = await createClient()

  // Ambil data balita (dengan fallback dataset mock bila Supabase belum tersambung)
  let balita: {
    id: string
    tanggal_lahir: string
    jenis_kelamin: string
    posyandu_id: string
    puskesmas_id: string
    kabupaten_id: string
  } | null = null

  try {
    const { data, error: balitaErr } = await supabase
      .from('balita')
      .select('id, tanggal_lahir, jenis_kelamin, posyandu_id, puskesmas_id, kabupaten_id')
      .eq('id', d.balitaId)
      .single()

    if (!balitaErr && data) {
      balita = data
    }
  } catch {
    // Database Supabase belum aktif di sesi lokal
  }

  if (!balita) {
    const mock = cariBalitaById(d.balitaId)
    if (mock) {
      balita = {
        id: mock.id,
        tanggal_lahir: mock.tanggalLahir,
        jenis_kelamin: mock.jenisKelamin,
        posyandu_id: mock.posyanduId,
        puskesmas_id: mock.puskesmasId,
        kabupaten_id: mock.kabupatenId,
      }
    }
  }

  if (!balita) {
    return { ok: false, pesan: 'Data balita tidak ditemukan di sistem.' }
  }

  const validasiTanggal = periksaTerhadapBalita(d, balita.tanggal_lahir)
  if (!validasiTanggal.ok) {
    return { ok: false, pesan: validasiTanggal.pesan }
  }

  // HITUNG ULANG DI SERVER DENGAN ENGINE WHO RESMI
  const hasilServer = hitungSkrining({
    tanggalLahir: balita.tanggal_lahir,
    tanggalPeriksa: d.tanggalPeriksa,
    jenisKelamin: balita.jenis_kelamin === 'L' ? 'lk' : 'pr',
    beratKg: d.beratKg,
    panjangCm: d.panjangCm,
    posisiUkur: d.posisiUkur,
    lilaCm: d.lilaCm,
    edema: d.edema,
  })

  const baris = keBarisSkrining(
    {
      clientUuid: d.clientUuid,
      balitaId: balita.id,
      tanggalPeriksa: d.tanggalPeriksa,
      beratKg: d.beratKg,
      panjangCm: d.panjangCm,
      posisiUkur: d.posisiUkur,
      lilaCm: d.lilaCm,
      lingkarKepalaCm: d.lingkarKepalaCm,
      edema: d.edema,
      catatan: d.catatan,
      createdBy: profil.id,
      posyanduId: balita.posyandu_id,
      puskesmasId: balita.puskesmas_id,
      kabupatenId: balita.kabupaten_id,
      asalData: 'input_langsung',
    },
    hasilServer,
  )

  // ======================================================================
  // TEMUAN AUDIT S-1: KEGAGALAN SIMPAN DAHULU DIBUANG TANPA SUARA
  //
  // Bentuk lama hanya menulis `console.warn` lalu tetap `redirect`. Kader
  // mendarat di halaman rincian balita seolah tersimpan, padahal barisnya tidak
  // ada di Postgres dan juga tidak pernah masuk antrean offline, sehingga tidak
  // ada sinkronisasi mana pun yang bisa memulihkannya. Penimbangan itu hilang.
  //
  // Yang membuatnya sering terjadi: halaman memilih jalur online berdasarkan
  // `navigator.onLine`, yang bernilai true pada jaringan yang tersambung tetapi
  // tanpa rute keluar — justru bentuk kegagalan khas di posyandu.
  //
  // Sekarang setiap kegagalan dikembalikan sebagai `{ ok: false }` disertai
  // penanda `simpanKeOutbox`, agar halaman dapat menyimpannya ke antrean lokal
  // alih-alih membuangnya.
  // ======================================================================
  try {
    const { error: insertErr } = await supabase.from('skrining').insert(baris)

    if (insertErr) {
      const jejak = `${insertErr.message ?? ''} ${(insertErr as { details?: string }).details ?? ''}`

      // Duplikat `client_uuid` berarti baris ini memang sudah tersimpan,
      // biasanya karena tombol ditekan dua kali. Itu keberhasilan.
      if (insertErr.code === '23505' && jejak.includes('client_uuid')) {
        revalidatePath(`/balita/${balita.id}`)
        redirect(`/balita/${balita.id}`)
      }

      // Duplikat (balita_id, tanggal_periksa): penimbangan lain sudah ada hari
      // itu. Bukan keberhasilan, dan menyimpannya ke antrean pun tidak menolong
      // karena server akan menolaknya lagi dengan alasan yang sama.
      if (insertErr.code === '23505') {
        return {
          ok: false,
          pesan:
            'Sudah ada penimbangan untuk balita ini pada tanggal tersebut. Buka penimbangan ' +
            'yang sudah tercatat lalu perbaiki angkanya, jangan menambah baris baru.',
        }
      }

      return {
        ok: false,
        pesan: `Gagal menyimpan ke server: ${insertErr.message}`,
        simpanKeOutbox: true,
      }
    }
  } catch (err) {
    // Jaringan mati di tengah jalan. Datanya masih dapat diselamatkan.
    return {
      ok: false,
      pesan:
        'Server tidak dapat dihubungi. Data akan disimpan di perangkat dan dikirim ' +
        'sendiri saat jaringan kembali.',
      simpanKeOutbox: true,
    }
  }

  revalidatePath(`/balita/${balita.id}`)
  redirect(`/balita/${balita.id}`)
}
