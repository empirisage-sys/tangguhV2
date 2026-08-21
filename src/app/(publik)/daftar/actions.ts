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

export type HasilTindakan = {
  ok: boolean
  pesan?: string
  galatMedan?: Record<string, string>
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

  // Tentukan id faskes atau usulan nama faskes
  const faskesIdFix = d.faskesId === 'lainnya' ? '' : (d.faskesId ?? '')

  const { error } = await supabase.auth.signUp({
    email: d.email,
    password: d.sandi,
    options: {
      data: {
        nama_lengkap: d.namaLengkap,
        role: d.peran,
        no_hp: normalkanNoHp(d.noHp),
        no_str: (d.noStr ?? '').trim(),
        provinsi_id: d.provinsiId,
        kabupaten_id: d.kabupatenId || d.kabupatenManual || '',
        jenis_faskes: d.jenisFaskes,
        faskes_id: faskesIdFix,
        faskes_manual: d.faskesManual?.trim() || '',
        posyandu_manual: d.posyanduManual?.trim() || '',
        // Fallback untuk skema legacy
        puskesmas_id: faskesIdFix,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/konfirmasi`,
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
      pesan: 'Pendaftaran belum berhasil. Coba lagi beberapa saat, atau hubungi admin dinas kesehatan.',
    }
  }

  // Seluruh peran menunggu verifikasi admin
  redirect('/menunggu-verifikasi?baru=1')
}
