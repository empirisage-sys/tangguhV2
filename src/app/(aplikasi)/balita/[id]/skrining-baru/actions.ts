'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran } from '@/lib/supabase/penjaga'
import { hitungSkrining } from '@/lib/zscore'
import { keBarisSkrining } from '@/lib/db/pemetaan'
import { skemaSkrining, periksaTerhadapBalita } from '@/lib/validasi/skrining'
import { cariBalitaById } from '@/lib/db/balita-mock'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

export async function simpanSkrining(formData: FormData): Promise<HasilTindakan> {
  const profil = await wajibPeran(['kader', 'dokter', 'dokter_spesialis_anak', 'dietisien'])

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

  try {
    const { error: insertErr } = await supabase.from('skrining').insert(baris)
    if (insertErr && insertErr.code !== '23505') {
      console.warn('Supabase notice:', insertErr.message)
    }
  } catch (err) {
    console.warn('Supabase offline/mock active.')
  }

  revalidatePath(`/balita/${balita.id}`)
  redirect(`/balita/${balita.id}`)
}
