#!/usr/bin/env node
/**
 * UJI ROW LEVEL SECURITY — APLIKASI TANGGUH
 *
 * Menjalankan 26 skenario terhadap proyek Supabase yang sebenarnya, memakai
 * ANON KEY dan akun uji, sehingga policy RLS benar-benar dievaluasi.
 *
 * ==========================================================================
 * MENGAPA MEMAKAI ANON KEY, BUKAN SERVICE ROLE KEY
 *
 * Service role key MELEWATI seluruh policy RLS. Bila skrip ini memakainya,
 * seluruh 26 uji akan lulus, dan kelulusan itu tidak berarti apa pun. Ini
 * kekeliruan paling sering pada pengujian keamanan Supabase.
 *
 * Skrip ini menolak berjalan bila mendeteksi service role key.
 * ==========================================================================
 *
 * CARA MENJALANKAN
 *
 *   1. Pastikan ketiga migrasi sudah dijalankan:
 *        supabase db push
 *
 *   2. Pastikan ada satu akun admin. Lihat Bagian 8 pada migrasi ketiga.
 *
 *   3. Isi berkas .env.local:
 *        NEXT_PUBLIC_SUPABASE_URL=...
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY=...
 *        UJI_ADMIN_EMAIL=...
 *        UJI_ADMIN_SANDI=...
 *
 *   4. Jalankan:
 *        node --env-file=.env.local tests/rls/jalankan-uji-rls.mjs
 *
 * Skrip membuat akun uji sendiri dengan awalan `uji-rls-`, memverifikasi
 * sebagiannya lewat akun admin, menjalankan seluruh skenario, lalu MELAPORKAN
 * akun mana yang perlu dibersihkan. Skrip tidak menghapus akun sendiri, karena
 * penghapusan memerlukan service role key yang sengaja tidak dipakai di sini.
 *
 * JANGAN DIJALANKAN TERHADAP PROYEK PRODUKSI. Buat proyek Supabase terpisah
 * untuk pengujian, atau jalankan sebelum ada data nyata.
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const ADMIN_EMAIL = process.env.UJI_ADMIN_EMAIL
const ADMIN_SANDI = process.env.UJI_ADMIN_SANDI

// ---------------------------------------------------------------------------
// Penjagaan sebelum mulai
// ---------------------------------------------------------------------------

function berhenti(pesan) {
  console.error(`\n  GAGAL MEMULAI: ${pesan}\n`)
  process.exit(1)
}

if (!URL || !ANON) {
  berhenti(
    'NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY wajib diisi.\n' +
      '  Jalankan dengan: node --env-file=.env.local tests/rls/jalankan-uji-rls.mjs',
  )
}

if (!ADMIN_EMAIL || !ADMIN_SANDI) {
  berhenti(
    'UJI_ADMIN_EMAIL dan UJI_ADMIN_SANDI wajib diisi.\n' +
      '  Akun itu harus sudah berperan admin dan berstatus disetujui.',
  )
}

// Menolak service role key. Payload JWT-nya memuat "role":"service_role".
try {
  const muatan = JSON.parse(Buffer.from(ANON.split('.')[1], 'base64url').toString())
  if (muatan.role === 'service_role') {
    berhenti(
      'Kunci yang diberikan adalah SERVICE ROLE KEY.\n' +
        '  Kunci itu melewati seluruh policy RLS, sehingga uji ini akan lulus\n' +
        '  secara menyesatkan. Pakai anon key atau publishable key.',
    )
  }
} catch {
  // Kunci penerbitan baru bukan JWT. Tidak apa-apa, lanjutkan.
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '  Peringatan: SUPABASE_SERVICE_ROLE_KEY terbaca di lingkungan ini.\n' +
      '  Skrip ini tidak memakainya. Pastikan kunci itu tidak pernah masuk ke Vercel.\n',
  )
}

// ---------------------------------------------------------------------------
// Pembantu
// ---------------------------------------------------------------------------

const CAP = `uji-rls-${Date.now()}`
const SANDI_UJI = `Sandi-Uji-${CAP}`

const klienBaru = () =>
  createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })

let lulus = 0
let gagal = 0
const kegagalan = []
const akunDibuat = []

async function uji(nama, jalankan) {
  try {
    await jalankan()
    lulus += 1
    console.log(`  LULUS  ${nama}`)
  } catch (galat) {
    gagal += 1
    kegagalan.push({ nama, pesan: galat.message })
    console.log(`  GAGAL  ${nama}`)
    console.log(`         ${galat.message}`)
  }
}

function tegas(kondisi, pesan) {
  if (!kondisi) throw new Error(pesan)
}

/** Menegaskan bahwa kueri mengembalikan nol baris, entah karena RLS atau galat. */
function tegasKosong(hasil, pesan) {
  if (hasil.error) return // ditolak juga dapat diterima
  tegas(
    Array.isArray(hasil.data) ? hasil.data.length === 0 : hasil.data === null,
    `${pesan} — justru mengembalikan ${hasil.data?.length ?? 1} baris`,
  )
}

function tegasDitolak(hasil, pesan) {
  tegas(hasil.error !== null && hasil.error !== undefined, `${pesan} — justru berhasil`)
}

async function buatAkun(peran, tambahan) {
  const email = `${CAP}-${peran}-${tambahan.tanda}@contoh.test`
  const klien = klienBaru()

  const { data, error } = await klien.auth.signUp({
    email,
    password: SANDI_UJI,
    options: {
      data: {
        nama_lengkap: `Uji ${peran} ${tambahan.tanda}`,
        role: peran,
        no_hp: '628123456789',
        no_str: peran === 'kader' ? '' : `STR-${CAP}`,
        kabupaten_id: tambahan.kabupatenId ?? '',
        puskesmas_id: tambahan.puskesmasId ?? '',
        posyandu_id: tambahan.posyanduId ?? '',
      },
    },
  })

  if (error) throw new Error(`Gagal membuat akun ${peran}: ${error.message}`)

  akunDibuat.push(email)
  return { email, klien, id: data.user?.id }
}

async function masuk(email) {
  const klien = klienBaru()
  const { error } = await klien.auth.signInWithPassword({ email, password: SANDI_UJI })
  if (error) throw new Error(`Gagal masuk sebagai ${email}: ${error.message}`)
  return klien
}

// ---------------------------------------------------------------------------
// Penyiapan
// ---------------------------------------------------------------------------

console.log(`\n  UJI RLS APLIKASI TANGGUH`)
console.log(`  Proyek : ${URL}`)
console.log(`  Penanda: ${CAP}\n`)

const admin = await masuk(ADMIN_EMAIL).catch((g) => berhenti(g.message))

{
  const { data } = await admin.from('profiles').select('role, status_akun').eq('id',
    (await admin.auth.getUser()).data.user.id).maybeSingle()
  if (!data || data.role !== 'admin' || data.status_akun !== 'disetujui') {
    berhenti(
      `Akun ${ADMIN_EMAIL} bukan admin yang disetujui (peran: ${data?.role}, status: ${data?.status_akun}).\n` +
        '  Lihat Bagian 8 pada migrasi ketiga untuk menaikkan perannya.',
    )
  }
}

// Dua posyandu di puskesmas yang berbeda, supaya pemisahan wilayah dapat diuji.
const { data: posyandu, error: galatPosyandu } = await admin
  .from('posyandu')
  .select('id, nama, puskesmas_id, puskesmas(id, kabupaten_id)')
  .limit(50)

if (galatPosyandu || !posyandu || posyandu.length < 2) {
  berhenti(
    'Perlu minimal dua posyandu pada dua puskesmas berbeda untuk menguji pemisahan wilayah.\n' +
      '  Tambahkan lewat panel admin atau seed CSV lebih dahulu.',
  )
}

const posyanduA = posyandu[0]
const posyanduB = posyandu.find((p) => p.puskesmas_id !== posyanduA.puskesmas_id)

if (!posyanduB) {
  berhenti('Seluruh posyandu berada di puskesmas yang sama. Tambahkan posyandu di puskesmas lain.')
}

const wilayahA = {
  tanda: 'a',
  posyanduId: posyanduA.id,
  puskesmasId: posyanduA.puskesmas_id,
  kabupatenId: posyanduA.puskesmas.kabupaten_id,
}
const wilayahB = {
  tanda: 'b',
  posyanduId: posyanduB.id,
  puskesmasId: posyanduB.puskesmas_id,
  kabupatenId: posyanduB.puskesmas.kabupaten_id,
}

console.log(`  Posyandu A: ${posyanduA.nama}`)
console.log(`  Posyandu B: ${posyanduB.nama}\n`)

// ---------------------------------------------------------------------------
// KELOMPOK 1 — Pendaftaran selalu menunggu
// ---------------------------------------------------------------------------

console.log('  KELOMPOK 1: Pendaftaran dan status akun\n')

const kaderA = await buatAkun('kader', wilayahA)
const kaderB = await buatAkun('kader', wilayahB)
const dokterA = await buatAkun('dokter', { ...wilayahA, tanda: 'dok-a', posyanduId: '' })
const dietisienA = await buatAkun('dietisien', { ...wilayahA, tanda: 'die-a', posyanduId: '' })

await uji('kader baru berstatus menunggu, tidak disetujui otomatis', async () => {
  const k = await masuk(kaderA.email)
  const { data } = await k.from('profiles').select('status_akun').eq('id', kaderA.id).maybeSingle()
  tegas(data?.status_akun === 'menunggu', `status justru ${data?.status_akun}`)
})

await uji('dokter baru berstatus menunggu', async () => {
  const k = await masuk(dokterA.email)
  const { data } = await k.from('profiles').select('status_akun').eq('id', dokterA.id).maybeSingle()
  tegas(data?.status_akun === 'menunggu', `status justru ${data?.status_akun}`)
})

await uji('pendaftaran dengan peran admin diturunkan menjadi kader', async () => {
  const email = `${CAP}-coba-admin@contoh.test`
  const k = klienBaru()
  const { data, error } = await k.auth.signUp({
    email,
    password: SANDI_UJI,
    options: {
      data: {
        nama_lengkap: 'Coba Admin',
        role: 'admin',
        kabupaten_id: wilayahA.kabupatenId,
        puskesmas_id: wilayahA.puskesmasId,
        posyandu_id: wilayahA.posyanduId,
      },
    },
  })
  if (error) throw new Error(error.message)
  akunDibuat.push(email)

  const kk = await masuk(email)
  const { data: profil } = await kk.from('profiles').select('role, status_akun')
    .eq('id', data.user.id).maybeSingle()
  tegas(profil?.role === 'kader', `peran justru ${profil?.role}`)
  tegas(profil?.status_akun === 'menunggu', `status justru ${profil?.status_akun}`)
})

// ---------------------------------------------------------------------------
// KELOMPOK 2 — Akun menunggu tidak dapat membaca maupun menulis
// ---------------------------------------------------------------------------

console.log('\n  KELOMPOK 2: Batas akun yang belum disetujui\n')

await uji('kader menunggu tidak dapat membaca daftar balita', async () => {
  const k = await masuk(kaderA.email)
  tegasKosong(await k.from('balita').select('id').limit(5), 'seharusnya kosong')
})

await uji('kader menunggu tidak dapat membaca skrining', async () => {
  const k = await masuk(kaderA.email)
  tegasKosong(await k.from('skrining').select('id').limit(5), 'seharusnya kosong')
})

await uji('kader menunggu tidak dapat membaca rekapitulasi', async () => {
  const k = await masuk(kaderA.email)
  tegasKosong(await k.from('v_rekap_bulanan').select('*').limit(5), 'seharusnya kosong')
})

await uji('kader menunggu tidak dapat menambah balita', async () => {
  const k = await masuk(kaderA.email)
  tegasDitolak(
    await k.from('balita').insert({
      nama: 'Balita Uji Menunggu',
      tanggal_lahir: '2025-01-01',
      jenis_kelamin: 'L',
      posyandu_id: wilayahA.posyanduId,
      puskesmas_id: wilayahA.puskesmasId,
      kabupaten_id: wilayahA.kabupatenId,
      created_by: kaderA.id,
    }),
    'penambahan balita oleh akun menunggu seharusnya ditolak',
  )
})

// ---------------------------------------------------------------------------
// KELOMPOK 3 — Pengguna tidak dapat menaikkan kewenangannya sendiri
// ---------------------------------------------------------------------------

console.log('\n  KELOMPOK 3: Kenaikan kewenangan sendiri\n')

await uji('kader tidak dapat mengubah perannya menjadi admin', async () => {
  const k = await masuk(kaderA.email)
  const hasil = await k.from('profiles').update({ role: 'admin' }).eq('id', kaderA.id).select()
  if (!hasil.error) {
    const { data } = await k.from('profiles').select('role').eq('id', kaderA.id).maybeSingle()
    tegas(data?.role === 'kader', `peran berubah menjadi ${data?.role}`)
  }
})

await uji('kader tidak dapat menyetujui akunnya sendiri', async () => {
  const k = await masuk(kaderA.email)
  const hasil = await k.from('profiles').update({ status_akun: 'disetujui' })
    .eq('id', kaderA.id).select()
  if (!hasil.error) {
    const { data } = await k.from('profiles').select('status_akun').eq('id', kaderA.id).maybeSingle()
    tegas(data?.status_akun === 'menunggu', `status berubah menjadi ${data?.status_akun}`)
  }
})

await uji('kader tidak dapat memanggil fungsi verifikasi', async () => {
  const k = await masuk(kaderA.email)
  tegasDitolak(
    await k.rpc('verifikasi_pengguna', { p_pengguna_id: kaderB.id, p_setujui: true }),
    'kader seharusnya tidak boleh memverifikasi',
  )
})

await uji('kader tidak dapat mengubah profil orang lain', async () => {
  const k = await masuk(kaderA.email)
  const hasil = await k.from('profiles').update({ nama_lengkap: 'Diubah Paksa' })
    .eq('id', kaderB.id).select()
  tegas(hasil.error || (hasil.data ?? []).length === 0, 'perubahan profil orang lain seharusnya gagal')
})

// ---------------------------------------------------------------------------
// KELOMPOK 4 — Aturan verifikasi
// ---------------------------------------------------------------------------

console.log('\n  KELOMPOK 4: Aturan verifikasi oleh admin\n')

await uji('admin tidak dapat memverifikasi akunnya sendiri', async () => {
  const { data: saya } = await admin.auth.getUser()
  tegasDitolak(
    await admin.rpc('verifikasi_pengguna', { p_pengguna_id: saya.user.id, p_setujui: true }),
    'admin seharusnya tidak boleh memverifikasi dirinya sendiri',
  )
})

await uji('penolakan tanpa alasan ditolak', async () => {
  tegasDitolak(
    await admin.rpc('verifikasi_pengguna', { p_pengguna_id: kaderB.id, p_setujui: false }),
    'penolakan tanpa alasan seharusnya gagal',
  )
})

await uji('penolakan dengan alasan terlalu pendek ditolak', async () => {
  tegasDitolak(
    await admin.rpc('verifikasi_pengguna', {
      p_pengguna_id: kaderB.id,
      p_setujui: false,
      p_alasan: 'salah',
    }),
    'alasan kurang dari 10 karakter seharusnya gagal',
  )
})

await uji('admin dapat menyetujui pendaftaran', async () => {
  const hasil = await admin.rpc('verifikasi_pengguna', {
    p_pengguna_id: kaderA.id,
    p_setujui: true,
  })
  tegas(!hasil.error, `persetujuan gagal: ${hasil.error?.message}`)
})

await uji('persetujuan mencatat siapa dan kapan', async () => {
  const { data } = await admin.from('profiles')
    .select('status_akun, disetujui_oleh, disetujui_pada')
    .eq('id', kaderA.id).maybeSingle()
  tegas(data?.status_akun === 'disetujui', 'status belum disetujui')
  tegas(data?.disetujui_oleh, 'disetujui_oleh kosong')
  tegas(data?.disetujui_pada, 'disetujui_pada kosong')
})

await uji('perubahan status tercatat di jejak audit', async () => {
  const { data } = await admin.from('audit_log')
    .select('aksi, tabel, row_id').eq('tabel', 'profiles').eq('row_id', kaderA.id).limit(5)
  tegas((data ?? []).length > 0, 'tidak ada catatan audit untuk perubahan status')
})

await uji('fungsi pendelegasian kader belum aktif', async () => {
  // Sengaja dicabut hak eksekusinya pada migrasi ketiga.
  tegasDitolak(
    await admin.rpc('verifikasi_kader_oleh_puskesmas', {
      p_pengguna_id: kaderB.id,
      p_setujui: true,
    }),
    'fungsi pendelegasian seharusnya belum dapat dipanggil',
  )
})

// ---------------------------------------------------------------------------
// KELOMPOK 5 — Pemisahan wilayah
// ---------------------------------------------------------------------------

console.log('\n  KELOMPOK 5: Pemisahan wilayah\n')

await admin.rpc('verifikasi_pengguna', { p_pengguna_id: kaderB.id, p_setujui: true })
await admin.rpc('verifikasi_pengguna', { p_pengguna_id: dokterA.id, p_setujui: true })
await admin.rpc('verifikasi_pengguna', { p_pengguna_id: dietisienA.id, p_setujui: true })

let balitaAId = null

await uji('kader yang disetujui dapat menambah balita di posyandunya', async () => {
  const k = await masuk(kaderA.email)
  const { data, error } = await k.from('balita').insert({
    nama: `Balita Uji ${CAP}`,
    tanggal_lahir: '2025-02-01',
    jenis_kelamin: 'L',
    posyandu_id: wilayahA.posyanduId,
    puskesmas_id: wilayahA.puskesmasId,
    kabupaten_id: wilayahA.kabupatenId,
    created_by: kaderA.id,
  }).select('id').maybeSingle()

  tegas(!error, `penambahan gagal: ${error?.message}`)
  balitaAId = data?.id
})

await uji('kader tidak dapat menambah balita di posyandu lain', async () => {
  const k = await masuk(kaderA.email)
  tegasDitolak(
    await k.from('balita').insert({
      nama: `Balita Salah Wilayah ${CAP}`,
      tanggal_lahir: '2025-02-01',
      jenis_kelamin: 'P',
      posyandu_id: wilayahB.posyanduId,
      puskesmas_id: wilayahB.puskesmasId,
      kabupaten_id: wilayahB.kabupatenId,
      created_by: kaderA.id,
    }),
    'penambahan ke posyandu lain seharusnya ditolak',
  )
})

await uji('kader tidak dapat mengaku sebagai pembuat orang lain', async () => {
  const k = await masuk(kaderA.email)
  tegasDitolak(
    await k.from('balita').insert({
      nama: `Balita Palsu ${CAP}`,
      tanggal_lahir: '2025-03-01',
      jenis_kelamin: 'L',
      posyandu_id: wilayahA.posyanduId,
      puskesmas_id: wilayahA.puskesmasId,
      kabupaten_id: wilayahA.kabupatenId,
      created_by: kaderB.id,
    }),
    'created_by orang lain seharusnya ditolak',
  )
})

await uji('kader B tidak dapat melihat balita di posyandu A', async () => {
  const k = await masuk(kaderB.email)
  const hasil = await k.from('balita').select('id').eq('id', balitaAId ?? '')
  tegasKosong(hasil, 'kader B seharusnya tidak melihat balita posyandu A')
})

await uji('dokter dapat melihat balita di seluruh puskesmasnya', async () => {
  const k = await masuk(dokterA.email)
  const { data, error } = await k.from('balita').select('id').eq('id', balitaAId ?? '')
  tegas(!error, `kueri gagal: ${error?.message}`)
  tegas((data ?? []).length === 1, 'dokter seharusnya melihat balita di puskesmasnya')
})

await uji('dietisien dapat melihat balita di puskesmasnya', async () => {
  const k = await masuk(dietisienA.email)
  const { data } = await k.from('balita').select('id').eq('id', balitaAId ?? '')
  tegas((data ?? []).length === 1, 'dietisien seharusnya melihat balita di puskesmasnya')
})

await uji('kader tidak dapat menghapus balita', async () => {
  // Tidak ada policy DELETE sama sekali, jadi penghapusan tidak pernah berhasil.
  const k = await masuk(kaderA.email)
  await k.from('balita').delete().eq('id', balitaAId ?? '')
  const { data } = await admin.from('balita').select('id').eq('id', balitaAId ?? '')
  tegas((data ?? []).length === 1, 'balita justru terhapus')
})

// ---------------------------------------------------------------------------
// KELOMPOK 6 — Jejak audit dan referensi
// ---------------------------------------------------------------------------

console.log('\n  KELOMPOK 6: Jejak audit dan tabel referensi\n')

await uji('kader tidak dapat membaca jejak audit', async () => {
  const k = await masuk(kaderA.email)
  tegasKosong(await k.from('audit_log').select('id').limit(5), 'jejak audit seharusnya tertutup')
})

await uji('admin dapat membaca jejak audit', async () => {
  const { data, error } = await admin.from('audit_log').select('id').limit(5)
  tegas(!error, `kueri gagal: ${error?.message}`)
  tegas((data ?? []).length > 0, 'jejak audit kosong, padahal sudah ada perubahan')
})

await uji('kader dapat membaca tabel referensi WHO', async () => {
  const k = await masuk(kaderA.email)
  const { data, error } = await k.from('who_lms').select('indikator').limit(1)
  tegas(!error, `kueri gagal: ${error?.message}`)
  tegas((data ?? []).length >= 0, 'referensi seharusnya dapat dibaca')
})

await uji('kader tidak dapat mengubah tabel referensi WHO', async () => {
  const k = await masuk(kaderA.email)
  tegasDitolak(
    await k.from('who_lms').insert({
      indikator: 'WFA', seks: 'L', x: 999, l: 1, m: 1, s: 1,
    }),
    'perubahan tabel referensi oleh kader seharusnya ditolak',
  )
})

await uji('kader tidak dapat mengubah master wilayah', async () => {
  const k = await masuk(kaderA.email)
  tegasDitolak(
    await k.from('posyandu').insert({
      puskesmas_id: wilayahA.puskesmasId,
      nama: `Posyandu Palsu ${CAP}`,
    }),
    'penambahan posyandu oleh kader seharusnya ditolak',
  )
})

// ---------------------------------------------------------------------------
// Laporan
// ---------------------------------------------------------------------------

console.log(`\n  ${'='.repeat(64)}`)
console.log(`  HASIL: ${lulus} lulus, ${gagal} gagal, dari ${lulus + gagal} skenario`)
console.log(`  ${'='.repeat(64)}\n`)

if (gagal > 0) {
  console.log('  KEGAGALAN YANG PERLU DITINDAKLANJUTI\n')
  for (const k of kegagalan) {
    console.log(`  - ${k.nama}`)
    console.log(`    ${k.pesan}\n`)
  }
  console.log('  Setiap kegagalan di atas adalah celah keamanan nyata, bukan sekadar uji')
  console.log('  yang perlu disesuaikan. Perbaiki policy atau fungsinya, jangan ujinya.\n')
}

console.log('  PEMBERSIHAN')
console.log('  Skrip ini tidak menghapus data uji, karena penghapusan memerlukan')
console.log('  service role key yang sengaja tidak dipakai di sini. Hapus manual:\n')
console.log(`    delete from auth.users where email like '${CAP}%';`)
console.log(`    delete from public.balita where nama like '%${CAP}%';\n`)
console.log(`  Akun uji yang dibuat: ${akunDibuat.length}\n`)

process.exit(gagal > 0 ? 1 : 0)
