'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import { skemaAsuhanGizi, bacaFormAsuhanGizi } from '@/lib/validasi/asuhan-gizi'
import { keBarisAsuhanGizi, barisAsuhanKonsisten } from '@/lib/db/asuhan-gizi'
import { hitungTakaran } from '@/lib/pkmk/hitung'
import { bacaProdukPKMKAktifById } from '@/lib/db/pkmk-server'
import { ringkasanTakaran } from '@/lib/pkmk/teks'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

export type HasilSimpanAsuhan = HasilTindakan & {
  ringkasan?: string
  kkalDiberikan?: number
}

/**
 * Menyimpan asuhan gizi PKMK.
 *
 * Server MENGHITUNG ULANG takarannya dari masukan mentah. Tidak ada satu angka
 * hasil pun yang diterima dari formulir lalu disimpan apa adanya (AGENTS.md 1.7).
 * Nilai yang tersimpan karena itu selalu konsisten dengan takaran yang tersimpan,
 * apa pun yang dikirim klien.
 */
export async function simpanAsuhanGizi(formData: FormData): Promise<HasilSimpanAsuhan> {
  let profil
  try {
    profil = await wajibPeran(['dietisien', 'dokter', 'dokter_spesialis_anak'])
  } catch (err) {
    if (err instanceof TidakBerwenangError) return { ok: false, pesan: err.message }
    throw err
  }

  const terbaca = skemaAsuhanGizi.safeParse(bacaFormAsuhanGizi(formData))
  if (!terbaca.success) {
    const galatMedan: Record<string, string> = {}
    for (const isu of terbaca.error.issues) {
      const medan = String(isu.path[0] ?? 'umum')
      galatMedan[medan] ??= isu.message
    }
    return { ok: false, pesan: 'Periksa kembali isian formulasi.', galatMedan }
  }

  const d = terbaca.data

  if (d.mode === 'dari_takaran' && d.sendokPerSaji === undefined) {
    return {
      ok: false,
      pesan: 'Jumlah sendok per saji belum dipilih.',
      galatMedan: { sendokPerSaji: 'Pilih jumlah sendok takar per saji.' },
    }
  }

  // Produk dibaca dari MASTER DATA, bukan dari daftar statis. Dengan begitu
  // perhitungan ulang di server memakai spesifikasi yang sama dengan yang
  // dikelola admin, dan produk yang sudah dinonaktifkan tidak dapat
  // diresepkan pada asuhan gizi baru (temuan audit T-0).
  const produk = await bacaProdukPKMKAktifById(d.produkId)
  if (!produk) {
    return {
      ok: false,
      pesan: 'Produk PKMK tidak dikenali atau sudah tidak aktif.',
      galatMedan: {
        produkId: 'Pilih produk dari daftar yang tersedia pada master data terbaru.',
      },
    }
  }

  const supabase = await createClient()

  // Kebutuhan energi tumbuh kejar DIBACA DARI DATABASE, bukan dari formulir.
  // Bila diambil dari formulir, seseorang dapat mengirim target apa pun dan
  // membuat baris tersimpan tampak sesuai target padahal tidak.
  let totalKebutuhanKkal: number | null = null
  let skriningId: string | null = d.skriningId ?? null
  let puskesmasId: string | null = null

  const { data: skrining } = await supabase
    .from('skrining')
    .select('id, kalori_catchup_kkal, kalori_target_kkal, puskesmas_id, balita_id')
    .eq('balita_id', d.balitaId)
    .order('tanggal_periksa', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (skrining) {
    totalKebutuhanKkal = skrining.kalori_catchup_kkal ?? skrining.kalori_target_kkal ?? null
    skriningId ??= skrining.id
    puskesmasId = skrining.puskesmas_id
  }

  if (totalKebutuhanKkal === null) {
    return {
      ok: false,
      pesan:
        'Kebutuhan energi balita belum tersedia. Lakukan skrining antropometri terlebih dahulu, karena target PKMK dihitung dari hasil skrining.',
    }
  }

  puskesmasId ??= profil.puskesmasId
  if (!puskesmasId) {
    return {
      ok: false,
      pesan: 'Puskesmas pada profil Anda belum lengkap. Hubungi admin untuk melengkapinya.',
    }
  }

  // HITUNG ULANG DI SERVER.
  const hasil = hitungTakaran({
    produk,
    mode: d.mode,
    frekuensiPerHari: d.frekuensiPerHari,
    sendokPerSaji: d.sendokPerSaji,
    targetKkal: Math.round((totalKebutuhanKkal * d.targetPersen) / 100),
  })

  const baris = keBarisAsuhanGizi(
    {
      balitaId: d.balitaId,
      skriningId,
      dietisienId: profil.id,
      puskesmasId,
      tataLaksana: d.tataLaksana,
      targetPersen: d.targetPersen,
      totalKebutuhanKkal,
      tanggalEvaluasi: d.tanggalEvaluasi ?? null,
      catatan: d.catatan ?? null,
    },
    hasil,
  )

  // Jaring pengaman terakhir sebelum menulis.
  if (!barisAsuhanKonsisten(baris, produk.kkalPerSendok)) {
    return {
      ok: false,
      pesan: 'Perhitungan takaran tidak konsisten. Asuhan gizi tidak disimpan.',
    }
  }

  const { error } = await supabase.from('asuhan_gizi').insert(baris)
  if (error) {
    return {
      ok: false,
      pesan: `Asuhan gizi belum tersimpan: ${error.message}`,
    }
  }

  revalidatePath('/dietisien')
  revalidatePath(`/balita/${d.balitaId}`)

  return {
    ok: true,
    pesan: 'Asuhan gizi tersimpan.',
    ringkasan: ringkasanTakaran(hasil),
    kkalDiberikan: hasil.kkalDiberikan,
  }
}
