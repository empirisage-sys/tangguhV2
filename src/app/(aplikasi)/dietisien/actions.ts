'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import { skemaAsuhanGizi, bacaFormAsuhanGizi } from '@/lib/validasi/asuhan-gizi'
import { keBarisAsuhanGizi, barisAsuhanKonsisten } from '@/lib/db/asuhan-gizi'
import { hitungTakaran } from '@/lib/pkmk/hitung'
import { produkSesuaiUmur } from '@/lib/pkmk/produk'
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

  // ======================================================================
  // TEMUAN AUDIT P-3: `skriningId` YANG DIKIRIM DIABAIKAN
  //
  // Bentuk lama SELALU mengambil skrining terbaru balita itu, lalu menyimpan
  // `skrining_id` yang dikirim formulir apa adanya. Akibatnya sebuah baris bisa
  // tersimpan dengan `skrining_id = X` sementara `kalori_target` diturunkan
  // dari skrining Y yang lebih baru — misalnya ketika kader mencatat
  // penimbangan baru sementara dietisien masih membuka kunjungan sebelumnya.
  // Takarannya lalu tidak dapat ditelusuri kembali ke skrining yang tercatat
  // pada barisnya sendiri, yang justru tujuan kolom itu ada.
  //
  // Sekarang bila formulir menyebut satu skrining, ITU yang dibaca. Kalau
  // rujukannya tidak sah, permintaannya ditolak alih-alih diam-diam
  // dialihkan ke baris lain.
  // ======================================================================
  const kueriSkrining = supabase
    .from('skrining')
    .select('id, kalori_catchup_kkal, kalori_target_kkal, puskesmas_id, balita_id, umur_bulan')
    .eq('balita_id', d.balitaId)

  const { data: skrining } = skriningId
    ? await kueriSkrining.eq('id', skriningId).maybeSingle()
    : await kueriSkrining
        .order('tanggal_periksa', { ascending: false })
        .limit(1)
        .maybeSingle()

  if (!skrining && skriningId) {
    return {
      ok: false,
      pesan:
        'Hasil skrining yang dirujuk tidak ditemukan pada balita ini. Muat ulang halaman, ' +
        'lalu pilih kembali hasil skrining yang menjadi dasar peresepan.',
    }
  }

  if (skrining) {
    totalKebutuhanKkal = skrining.kalori_catchup_kkal ?? skrining.kalori_target_kkal ?? null
    skriningId ??= skrining.id
    puskesmasId = skrining.puskesmas_id
  }

  // ======================================================================
  // TEMUAN AUDIT P-2: BATAS UMUR PRODUK TIDAK DITEGAKKAN DI SERVER
  //
  // Penyaring umur dahulu hanya ada di layar, dan bahkan di sana batas atas
  // `maks_usia_bulan` tidak pernah dibaca. Server tidak memeriksa umur sama
  // sekali, sehingga permintaan yang disusun tangan dapat meresepkan produk
  // untuk balita di luar rentang indikasinya.
  //
  // Umur diambil dari `umur_bulan` pada skrining yang menjadi dasar peresepan
  // — bukan umur hari ini — supaya angka yang diperiksa sama dengan angka yang
  // dipakai menghitung kebutuhan energinya.
  // ======================================================================
  const umurBulanSkrining = typeof skrining?.umur_bulan === 'number' ? skrining.umur_bulan : null

  if (umurBulanSkrining !== null && !produkSesuaiUmur(produk, umurBulanSkrining)) {
    const batasAtas =
      produk.maksUsiaBulan != null ? ` sampai ${produk.maksUsiaBulan} bulan` : ' ke atas'
    return {
      ok: false,
      pesan:
        `${produk.nama} berindikasi untuk umur ${produk.minUsiaBulan} bulan${batasAtas}, ` +
        `sedangkan balita ini berumur ${Math.round(umurBulanSkrining)} bulan. ` +
        'Pilih produk yang sesuai umur, atau perbarui indikasi umur produk ini pada master data.',
      galatMedan: { produkId: 'Produk ini di luar rentang umur balita.' },
    }
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
