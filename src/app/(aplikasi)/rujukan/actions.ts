'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import { bacaBalitaRingkas } from '@/lib/db/balita-server'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

/**
 * Penulisan rujukan. Wewenang yang sebenarnya ditegakkan database:
 *   - policy INSERT `ajukan rujukan` + fungsi `boleh_terbitkan_rujukan`
 *   - policy UPDATE `perbarui status rujukan` + trigger `jaga_perubahan_rujukan`
 * Pemeriksaan di sini hanya untuk memberi pesan yang dapat dibaca pengguna.
 */

const teksWajib = (nama: string, min: number) =>
  z.string().trim().min(min, `${nama} minimal ${min} karakter.`).max(4000)
const teksOpsional = z.string().trim().max(4000).optional().transform((v) => (v ? v : null))

const skemaTerbitkan = z.object({
  balitaId: z.string().uuid(),
  rsTujuanId: z.string().uuid('Pilih rumah sakit tujuan.'),
  diagnosisAwal: teksWajib('Diagnosis kerja', 3),
  alasan: teksWajib('Alasan rujukan', 10),
  setujuAkses: z.literal(true, {
    errorMap: () => ({ message: 'Persetujuan pembukaan akses 90 hari wajib dicentang.' }),
  }),
})

const skemaTanggapi = z.object({
  rujukanId: z.string().uuid(),
  status: z.enum(['diterima', 'selesai']),
  namaDokterSpesialis: teksWajib('Nama dokter spesialis', 3),
  diagnosisDefinitif: teksOpsional,
  tatalaksana: teksOpsional,
  rekomendasiPkmk: teksOpsional,
  catatan: teksOpsional,
}).superRefine((d, ctx) => {
  // Rujuk balik tanpa diagnosis dan catatan tidak memberi puskesmas apa pun untuk ditindaklanjuti.
  if (d.status === 'selesai') {
    if (!d.diagnosisDefinitif || d.diagnosisDefinitif.length < 3) {
      ctx.addIssue({ code: 'custom', path: ['diagnosisDefinitif'], message: 'Diagnosis definitif wajib diisi untuk rujuk balik.' })
    }
    if (!d.catatan || d.catatan.length < 10) {
      ctx.addIssue({ code: 'custom', path: ['catatan'], message: 'Catatan balasan untuk puskesmas minimal 10 karakter.' })
    }
  }
})

function galatValidasi(e: z.ZodError): HasilTindakan {
  const galatMedan: Record<string, string> = {}
  for (const isu of e.issues) {
    const kunci = String(isu.path[0] ?? 'umum')
    if (!galatMedan[kunci]) galatMedan[kunci] = isu.message
  }
  return { ok: false, pesan: Object.values(galatMedan)[0], galatMedan }
}

/** Pesan galat database yang aman diteruskan apa adanya (dari trigger kita sendiri). */
function pesanDatabase(pesan: string): string {
  if (/row-level security/i.test(pesan)) {
    return 'Anda tidak berwenang melakukan tindakan ini pada rujukan tersebut.'
  }
  return pesan
}

export async function terbitkanRujukan(masukan: unknown): Promise<HasilTindakan> {
  let profil
  try {
    profil = await wajibPeran(['dokter', 'dietisien', 'admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) {
      return { ok: false, pesan: `${galat.message} Rujukan diterbitkan oleh dokter atau dietisien puskesmas.` }
    }
    throw galat
  }

  const v = skemaTerbitkan.safeParse(masukan)
  if (!v.success) return galatValidasi(v.error)
  const d = v.data

  // Puskesmas diambil dari data balita di server, tidak pernah dari formulir.
  const balita = await bacaBalitaRingkas(d.balitaId)
  if (!balita) return { ok: false, pesan: 'Balita tidak ditemukan atau berada di luar wilayah Anda.' }

  const supabase = await createClient()

  const { data: rs } = await supabase
    .from('faskes')
    .select('id, nama, jenis')
    .eq('id', d.rsTujuanId)
    .maybeSingle()
  if (!rs || rs.jenis !== 'rumah_sakit') {
    return { ok: false, pesan: 'Rumah sakit tujuan tidak ditemukan.', galatMedan: { rsTujuanId: 'Pilih rumah sakit dari daftar.' } }
  }

  // Satu balita hanya punya satu rujukan yang sedang berjalan.
  const { data: berjalan, error: galatCek } = await supabase
    .from('rujukan')
    .select('id')
    .eq('balita_id', balita.id)
    .in('status', ['diajukan', 'diterima'])
    .limit(1)
  if (galatCek) return { ok: false, pesan: galatCek.message }
  if (berjalan && berjalan.length > 0) {
    return { ok: false, pesan: 'Balita ini masih memiliki rujukan yang sedang berjalan.' }
  }

  const { data: skrining } = await supabase
    .from('skrining')
    .select('id')
    .eq('balita_id', balita.id)
    .order('tanggal_periksa', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('rujukan').insert({
    balita_id: balita.id,
    skrining_id: skrining?.id ?? null,
    puskesmas_id: balita.puskesmasId,
    rs_tujuan_id: rs.id,
    tujuan: rs.nama,
    alasan: d.alasan,
    diagnosis_awal: d.diagnosisAwal,
    diajukan_oleh: profil.id,
    diajukan_oleh_nama: profil.namaLengkap,
  })
  if (error) return { ok: false, pesan: pesanDatabase(error.message) }

  revalidatePath('/rujukan')
  revalidatePath(`/balita/${balita.id}`)
  revalidatePath('/dasbor')
  return { ok: true, pesan: `Rujukan ke ${rs.nama} berhasil diterbitkan.` }
}

export async function tanggapiRujukan(masukan: unknown): Promise<HasilTindakan> {
  try {
    await wajibPeran(['dokter_spesialis_anak', 'admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) {
      return { ok: false, pesan: `${galat.message} Balasan rujukan diisi dokter spesialis anak rumah sakit tujuan.` }
    }
    throw galat
  }

  const v = skemaTanggapi.safeParse(masukan)
  if (!v.success) return galatValidasi(v.error)
  const d = v.data

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rujukan')
    .update({
      status: d.status,
      nama_dokter_spesialis: d.namaDokterSpesialis,
      diagnosis_definitif_rs: d.diagnosisDefinitif,
      tatalaksana_lanjutan: d.tatalaksana,
      rekomendasi_pkmk: d.rekomendasiPkmk,
      catatan_balasan: d.catatan,
    })
    .eq('id', d.rujukanId)
    .select('balita_id')

  if (error) return { ok: false, pesan: pesanDatabase(error.message) }
  // RLS menyaring baris di luar wewenang tanpa galat: nol baris berarti ditolak.
  if (!data || data.length === 0) {
    return { ok: false, pesan: 'Rujukan tidak ditemukan atau bukan ditujukan ke rumah sakit Anda.' }
  }

  revalidatePath('/rujukan')
  revalidatePath(`/balita/${data[0].balita_id}`)
  revalidatePath('/dasbor')
  return { ok: true, pesan: d.status === 'selesai' ? 'Balasan rujuk balik tersimpan.' : 'Rujukan ditandai sedang ditangani.' }
}

export async function batalkanRujukan(rujukanId: string): Promise<HasilTindakan> {
  try {
    await wajibPeran(['dokter', 'dietisien', 'admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }
  if (!z.string().uuid().safeParse(rujukanId).success) {
    return { ok: false, pesan: 'Rujukan tidak dikenal.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rujukan')
    .update({ status: 'batal' })
    .eq('id', rujukanId)
    .eq('status', 'diajukan')
    .select('balita_id')

  if (error) return { ok: false, pesan: pesanDatabase(error.message) }
  if (!data || data.length === 0) {
    return { ok: false, pesan: 'Rujukan tidak dapat dibatalkan: sudah ditanggapi rumah sakit atau di luar wewenang Anda.' }
  }

  revalidatePath('/rujukan')
  revalidatePath(`/balita/${data[0].balita_id}`)
  revalidatePath('/dasbor')
  return { ok: true, pesan: 'Rujukan dibatalkan.' }
}
