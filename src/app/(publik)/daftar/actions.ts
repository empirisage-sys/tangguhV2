'use server'

/**
 * Tindakan pendaftaran tenaga kesehatan dan kader posyandu.
 *
 * Mengikuti arsitektur registrasi baru:
 * - Seluruh peran, termasuk kader, masuk ke antrean verifikasi admin.
 * - Isian fasilitas / posyandu manual didaftarkan sebagai 'usulan' agar memiliki ID
 *   dan dinormalkan oleh admin ke fasilitas master saat verifikasi.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalkanNoHp, skemaPendaftaran } from '@/lib/validasi/pendaftaran'
import { PUSKESMAS_GORONTALO } from '@/lib/db/wilayah'

export type HasilTindakan = {
  ok: boolean
  pesan?: string
  galatMedan?: Record<string, string>
}

// Pemetaan statis UUID master dari database
const MAP_PROVINSI_UUID: Record<string, string> = {
  '75': '78169801-ff7f-4329-94f8-b497d16732a4', // Gorontalo
}

const MAP_KABUPATEN_UUID: Record<string, string> = {
  '7501': '598f5ad7-8f9a-4ff6-a7a5-becaa87b6e1a', // Boalemo
  '7502': 'e7c1ef6e-cc1c-4bf5-b254-716554de6daf', // Kab. Gorontalo
  '7503': '3a92d173-efde-4912-8665-1a5b1b34877e', // Pohuwato
  '7504': 'f094272a-9494-4b9b-9efc-e7b31b895f88', // Bone Bolango
  '7505': '8edf477b-5066-453f-b9e8-6e991abc4c54', // Gorontalo Utara
  '7571': '15d83e69-dee0-4430-a8b3-302bcd7a361a', // Kota Gorontalo
}

export async function daftar(formData: FormData): Promise<HasilTindakan> {
  const hasil = skemaPendaftaran.safeParse({
    email: formData.get('email'),
    sandi: formData.get('sandi'),
    ulangiSandi: formData.get('ulangiSandi'),
    namaLengkap: formData.get('namaLengkap'),
    peran: formData.get('peran'),
    noHp: formData.get('noHp'),
    noStr: formData.get('noStr') ?? '',
    provinsiId: formData.get('provinsiId'),
    kabupatenId: formData.get('kabupatenId') ?? '',
    kabupatenManual: formData.get('kabupatenManual') ?? '',
    jenisFaskes: formData.get('jenisFaskes'),
    faskesId: formData.get('faskesId') ?? '',
    faskesManual: formData.get('faskesManual') ?? '',
    posyanduManual: formData.get('posyanduManual') ?? '',
    setujuKetentuan: formData.get('setujuKetentuan') === 'on',
  })

  if (!hasil.success) {
    const galatMedan: Record<string, string> = {}
    for (const isu of hasil.error.issues) {
      const medan = String(isu.path[0] ?? 'umum')
      galatMedan[medan] ??= isu.message
    }
    return { ok: false, pesan: 'Periksa kembali data yang diisi.', galatMedan }
  }

  const d = hasil.data
  const supabase = await createClient()

  // Resolusi ID wilayah ke DB UUID
  const provKode = d.provinsiId?.replace(/^prov-/, '') || '75'
  let provinsiDbId = MAP_PROVINSI_UUID[provKode]
  if (!provinsiDbId) {
    const { data: provData } = await supabase.from('provinsi').select('id').eq('kode', provKode).maybeSingle()
    provinsiDbId = provData?.id || MAP_PROVINSI_UUID['75']
  }

  const kabKode = d.kabupatenId?.replace(/^kab-/, '') || '7571'
  let kabupatenDbId = MAP_KABUPATEN_UUID[kabKode] || MAP_KABUPATEN_UUID['7571']

  // Cari Puskesmas / Faskes yang sesuai di DB
  let puskesmasDbId: string | null = null
  let faskesNamaCari = ''

  if (d.faskesId && d.faskesId !== 'lainnya') {
    const pusObj = PUSKESMAS_GORONTALO.find((p) => p.id === d.faskesId)
    if (pusObj) faskesNamaCari = pusObj.nama
  }

  if (faskesNamaCari) {
    const { data: pkmData } = await supabase
      .from('puskesmas')
      .select('id')
      .ilike('nama', `%${faskesNamaCari}%`)
      .maybeSingle()
    puskesmasDbId = pkmData?.id ?? null
  }

  if (!puskesmasDbId) {
    // Ambil puskesmas pertama di kabupaten tersebut untuk memenuhi FK/check constraint
    const { data: pkmFallback } = await supabase
      .from('puskesmas')
      .select('id')
      .eq('kabupaten_id', kabupatenDbId)
      .limit(1)
      .maybeSingle()
    puskesmasDbId = pkmFallback?.id ?? null
  }

  // Jika masih null (misal kab luar Gorontalo), ambil sembarang puskesmas default
  if (!puskesmasDbId) {
    const { data: pkmAny } = await supabase.from('puskesmas').select('id').limit(1).maybeSingle()
    puskesmasDbId = pkmAny?.id ?? null
  }

  // Cari Posyandu yang sesuai di DB untuk kader
  let posyanduDbId: string | null = null
  if (d.peran === 'kader' && puskesmasDbId) {
    const { data: posData } = await supabase
      .from('posyandu')
      .select('id')
      .eq('puskesmas_id', puskesmasDbId)
      .limit(1)
      .maybeSingle()
    posyanduDbId = posData?.id ?? null

    if (!posyanduDbId) {
      const { data: posAny } = await supabase.from('posyandu').select('id').limit(1).maybeSingle()
      posyanduDbId = posAny?.id ?? null
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const { error } = await supabase.auth.signUp({
    email: d.email,
    password: d.sandi,
    options: {
      data: {
        nama_lengkap: d.namaLengkap,
        role: d.peran,
        no_hp: normalkanNoHp(d.noHp),
        no_str: (d.noStr ?? '').trim(),
        provinsi_id: provinsiDbId,
        kabupaten_id: kabupatenDbId,
        puskesmas_id: puskesmasDbId || '',
        posyandu_id: posyanduDbId || '',
        faskes_id: puskesmasDbId || '',
        jenis_faskes: d.jenisFaskes,
        kabupaten_manual: d.kabupatenManual?.trim() || '',
        faskes_manual: d.faskesManual?.trim() || '',
        posyandu_manual: d.posyanduManual?.trim() || '',
      },
      emailRedirectTo: `${siteUrl}/auth/konfirmasi`,
    },
  })

  if (error) {
    const pesan = error.message.toLowerCase()
    if (pesan.includes('already registered') || pesan.includes('already been registered')) {
      return {
        ok: false,
        pesan: 'Alamat email ini sudah terdaftar. Coba masuk, atau pakai menu lupa kata sandi.',
        galatMedan: { email: 'Email sudah terdaftar' },
      }
    }
    if (pesan.includes('rate limit') || pesan.includes('too many')) {
      return { ok: false, pesan: 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.' }
    }
    return {
      ok: false,
      pesan: 'Pendaftaran belum berhasil. Coba lagi beberapa saat, atau hubungi admin.',
    }
  }

  // Seluruh peran menunggu verifikasi admin
  redirect('/menunggu-verifikasi?baru=1')
}
