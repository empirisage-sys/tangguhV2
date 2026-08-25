'use server'

import { createClient } from '@/lib/supabase/server'
import { skemaLupaSandi } from '@/lib/validasi/pendaftaran'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

export async function mintaResetSandi(formData: FormData): Promise<HasilTindakan> {
  const hasil = skemaLupaSandi.safeParse({
    email: formData.get('email'),
  })

  if (!hasil.success) {
    return {
      ok: false,
      pesan: hasil.error.issues[0]?.message ?? 'Alamat email belum valid.',
    }
  }

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(hasil.data.email, {
      redirectTo: `${siteUrl}/atur-ulang-sandi`,
    })

    if (error) {
      console.warn('Gagal reset password email:', error)
      return {
        ok: false,
        pesan: 'Permohonan reset kata sandi gagal diproses. Pastikan email terdaftar atau hubungi admin.',
      }
    }
  } catch (err) {
    console.error('Error reset password:', err)
  }

  return {
    ok: true,
    pesan: 'Tautan pemulihan kata sandi telah dikirim ke email Anda. Silakan periksa kotak masuk atau folder spam Anda.',
  }
}
