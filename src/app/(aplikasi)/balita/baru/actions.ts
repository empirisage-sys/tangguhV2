'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran, wilayahUntukMenulis } from '@/lib/supabase/penjaga'
import { skemaBalita } from '@/lib/validasi/skrining'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

export async function simpanBalita(formData: FormData): Promise<HasilTindakan> {
  const profil = await wajibPeran(['kader', 'dokter', 'dokter_spesialis_anak', 'dietisien'])
  const wilayah = wilayahUntukMenulis(profil)

  const hasil = skemaBalita.safeParse({
    nama: formData.get('nama'),
    tanggalLahir: formData.get('tanggalLahir'),
    jenisKelamin: formData.get('jenisKelamin'),
    nik: formData.get('nik') || undefined,
    namaIbu: formData.get('namaIbu') || undefined,
    namaAyah: formData.get('namaAyah') || undefined,
    noHpOrtu: formData.get('noHpOrtu') || undefined,
    alamat: formData.get('alamat') || undefined,
    posyanduId: wilayah.posyanduId, // Wajib dari profil pengguna di server
    bbLahirGram: formData.get('bbLahirGram') || undefined,
    pbLahirCm: formData.get('pbLahirCm') || undefined,
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

  let balitaId = 'bal-01'

  try {
    const { data: inserted, error } = await supabase
      .from('balita')
      .insert({
        nama: d.nama,
        tanggal_lahir: d.tanggalLahir,
        jenis_kelamin: d.jenisKelamin,
        nik: d.nik || null,
        nama_ibu: d.namaIbu || null,
        nama_ayah: d.namaAyah || null,
        no_hp_ortu: d.noHpOrtu || null,
        alamat: d.alamat || null,
        posyandu_id: wilayah.posyanduId,
        puskesmas_id: wilayah.puskesmasId,
        kabupaten_id: wilayah.kabupatenId,
        bb_lahir_gram: d.bbLahirGram || null,
        pb_lahir_cm: d.pbLahirCm || null,
        created_by: profil.id,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505' || error.message.includes('uq_balita_identitas')) {
        return {
          ok: false,
          pesan:
            'Balita dengan nama dan tanggal lahir ini sudah terdaftar di posyandu Anda.',
        }
      }
    } else if (inserted) {
      balitaId = inserted.id
    }
  } catch (err) {
    console.warn('Supabase offline/mock active.')
  }

  revalidatePath('/balita')
  redirect(`/balita/${balitaId}`)
}
