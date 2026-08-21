'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { skemaMasuk } from '@/lib/validasi/pendaftaran'
import type { HasilTindakan } from '../daftar/actions'

export async function masuk(formData: FormData): Promise<HasilTindakan> {
  const hasil = skemaMasuk.safeParse({
    email: formData.get('email'),
    sandi: formData.get('sandi'),
  })

  if (!hasil.success) {
    return { ok: false, pesan: 'Email atau kata sandi belum diisi dengan benar.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: hasil.data.email,
    password: hasil.data.sandi,
  })

  if (error) {
    // Pesan disengaja tidak membedakan email yang tidak terdaftar dari kata sandi
    // yang salah. Membedakannya memungkinkan orang luar memastikan alamat email
    // mana yang terdaftar di sistem.
    return { ok: false, pesan: 'Email atau kata sandi salah.' }
  }

  const lanjut = String(formData.get('lanjut') ?? '')
  const tujuan = lanjut.startsWith('/') && !lanjut.startsWith('//') ? lanjut : '/dasbor'

  revalidatePath('/', 'layout')
  redirect(tujuan)
}

export async function keluar(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
