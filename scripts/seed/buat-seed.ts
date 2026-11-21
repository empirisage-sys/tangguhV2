/**
 * Pembuat supabase/seed.sql untuk Supabase LOKAL.
 *
 * Membaca scripts/seed/simulasi_tangguh_20_balita.json, menghitung setiap
 * pengukuran lewat mesin aplikasi (hitungSkrining + keBarisSkrining), lalu
 * menulis SQL yang dijalankan otomatis oleh `supabase db reset`.
 *
 * Seluruh data fiktif: nama berawalan SIM-, NIK berawalan 99.
 * Tanggal ditulis relatif terhadap current_date, sehingga kunjungan terakhir
 * selalu jatuh hari ini. Umur anak tidak berubah karena tanggal lahir ikut
 * bergeser, jadi nilai Z tetap sama dengan yang dihitung di sini.
 *
 * Jalankan: npx tsx scripts/seed/buat-seed.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { hitungSkrining } from '../../src/lib/zscore'
import { keBarisSkrining } from '../../src/lib/db/pemetaan'

type Json = {
  meta: { tanggal_acuan: string }
  puskesmas: { kode: string; nama: string; kabupaten: string; posyandu: [string, string][] }[]
  balita: {
    id: string; nama: string; nik: string; jenis_kelamin: 'L' | 'P'; tanggal_lahir: string
    usia_kehamilan_minggu: number | null; posyandu: string; skenario: string
  }[]
  pengukuran: {
    balita_id: string; tanggal_ukur: string; berat_kg: number; tinggi_cm: number; posisi: string
    lila_cm: number | null; lingkar_kepala_cm: number | null; edema_bilateral: boolean
  }[]
  rujukan: { balita_id: string; status: string }[]
}

const data: Json = JSON.parse(readFileSync('scripts/seed/simulasi_tangguh_20_balita.json', 'utf8'))
const ACUAN = new Date(data.meta.tanggal_acuan + 'T00:00:00Z')

/** UUID tetap dari sebuah kunci, agar seed dapat dijalankan berulang. */
const uid = (kunci: string) => {
  const h = createHash('sha1').update('tangguh-sim:' + kunci).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}
const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null'
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  return `'${String(v).replace(/'/g, "''")}'`
}
const hariSebelumAcuan = (tgl: string) =>
  Math.round((ACUAN.getTime() - new Date(tgl + 'T00:00:00Z').getTime()) / 86400000)
const tglRelatif = (tgl: string) => `(current_date - ${hariSebelumAcuan(tgl)})`

// ------------------------------------------------------------------ akun uji
const SANDI = 'TangguhLokal#2026' // hanya untuk Supabase lokal
const RS_ID = uid('rs')
const pkm = data.puskesmas.map((p) => ({ ...p, id: uid(p.kode) }))
const posy = new Map<string, { id: string; pkm: (typeof pkm)[number] }>()
for (const p of pkm) for (const [kode] of p.posyandu) posy.set(kode, { id: uid(kode), pkm: p })

type Akun = { kunci: string; email: string; nama: string; role: string; pkm?: number; posyandu?: string; rs?: boolean }
const akun: Akun[] = [
  { kunci: 'admin', email: 'admin@tangguh.lokal', nama: 'SIM Admin Dinas', role: 'admin' },
  { kunci: 'kader1', email: 'kader1@tangguh.lokal', nama: 'SIM Kader Melati', role: 'kader', pkm: 0, posyandu: 'SIM-POS-01' },
  { kunci: 'dokter1', email: 'dokter1@tangguh.lokal', nama: 'SIM dr. Puskesmas Satu', role: 'dokter', pkm: 0 },
  { kunci: 'dokter2', email: 'dokter2@tangguh.lokal', nama: 'SIM dr. Puskesmas Dua', role: 'dokter', pkm: 1 },
  { kunci: 'dietisien1', email: 'dietisien1@tangguh.lokal', nama: 'SIM Dietisien Satu', role: 'dietisien', pkm: 0 },
  { kunci: 'dsa', email: 'dsa@tangguh.lokal', nama: 'SIM dr. Spesialis Anak', role: 'dokter_spesialis_anak', rs: true },
]

const L: string[] = []
L.push('-- =====================================================================')
L.push('-- SEED SUPABASE LOKAL TANGGUH — DIBUAT OTOMATIS, JANGAN DIEDIT TANGAN')
L.push('-- Sumber: scripts/seed/simulasi_tangguh_20_balita.json')
L.push('-- Pembuat: npx tsx scripts/seed/buat-seed.ts')
L.push('-- DATA FIKTIF. DILARANG DIJALANKAN DI PROYEK PRODUKSI.')
L.push('-- =====================================================================')
L.push('')
L.push('do $$ begin')
L.push('  -- Pengaman: produksi selalu berisi pengguna nyata, jadi seed berhenti di sana.')
L.push("  if exists (select 1 from public.profiles where nama_lengkap not like 'SIM %') then")
L.push("    raise exception 'Database ini berisi pengguna nyata. Seed simulasi dibatalkan.'; end if;")
L.push('end $$;')
L.push('')
L.push('-- Master wilayah simulasi -------------------------------------------')
for (const p of pkm) {
  const kab = `(select id from public.kabupaten where nama = ${q(p.kabupaten)})`
  L.push(`insert into public.puskesmas (id, kabupaten_id, kode, nama, status) values (${q(p.id)}, ${kab}, ${q(p.kode)}, ${q(p.nama)}, 'master') on conflict (id) do nothing;`)
  L.push(`insert into public.faskes (id, nama, jenis, status, kabupaten_id, sumber_data) values (${q(p.id)}, ${q(p.nama)}, 'puskesmas', 'master', ${kab}, 'simulasi_lokal') on conflict (id) do nothing;`)
  for (const [kode, nama] of p.posyandu)
    L.push(`insert into public.posyandu (id, puskesmas_id, nama, desa, status) values (${q(uid(kode))}, ${q(p.id)}, ${q(nama)}, 'Desa Simulasi', 'master') on conflict (id) do nothing;`)
}
L.push(`insert into public.faskes (id, nama, jenis, status, kabupaten_id, sumber_data) values (${q(RS_ID)}, 'SIM RSUD Uji', 'rumah_sakit', 'master', (select id from public.kabupaten where nama = 'Kota Gorontalo'), 'simulasi_lokal') on conflict (id) do nothing;`)
L.push('')
L.push(`-- Akun uji (sandi semua akun: ${SANDI}) ------------------------------`)
for (const a of akun) {
  const id = uid('akun:' + a.kunci)
  const meta = { nama_lengkap: a.nama, role: a.role, no_str: a.role === 'kader' || a.role === 'admin' ? null : 'SIM-STR-00000' }
  const p = a.pkm !== undefined ? pkm[a.pkm] : undefined
  const kab = p ? `(select id from public.kabupaten where nama = ${q(p.kabupaten)})` : `(select id from public.kabupaten where nama = 'Kota Gorontalo')`
  // Metadata pendaftaran sesuai yang dibaca trigger handle_new_user.
  const metaSql = `jsonb_build_object('nama_lengkap', ${q(meta.nama_lengkap)}, 'role', ${q(a.role === 'admin' ? 'kader' : a.role)}, 'no_str', ${q(meta.no_str)},`
    + ` 'jenis_faskes', ${q(a.rs ? 'rumah_sakit' : 'puskesmas')}, 'kabupaten_id', ${kab}::text,`
    + ` 'puskesmas_id', ${q(p ? p.id : a.rs ? null : pkm[0].id)}, 'faskes_id', ${q(a.rs ? RS_ID : p ? p.id : pkm[0].id)},`
    + ` 'posyandu_id', ${q(a.posyandu ? uid(a.posyandu) : a.role === 'admin' ? uid('SIM-POS-01') : null)})`
  L.push(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)`)
  L.push(`  values ('00000000-0000-0000-0000-000000000000', ${q(id)}, 'authenticated', 'authenticated', ${q(a.email)}, extensions.crypt(${q(SANDI)}, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, ${metaSql}, now(), now(), '', '', '', '') on conflict (id) do nothing;`)
  L.push(`insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)`)
  L.push(`  values (${q(id)}, ${q(id)}, ${q(id)}, ${q({ sub: id, email: a.email, email_verified: true })}, 'email', now(), now(), now()) on conflict do nothing;`)
  L.push(`update public.profiles set nama_lengkap = ${q(a.nama)}, role = ${q(a.role)}, status_akun = 'disetujui', disetujui_pada = now(), disetujui_oleh = ${q(uid('akun:admin'))},`)
  L.push(`  no_str = ${q(meta.no_str)}, provinsi_id = (select provinsi_id from public.kabupaten where nama = 'Kota Gorontalo'), kabupaten_id = ${kab},`)
  L.push(`  puskesmas_id = ${p ? q(p.id) : 'null'}, posyandu_id = ${a.posyandu ? q(uid(a.posyandu)) : 'null'},`)
  L.push(`  faskes_id = ${p ? q(p.id) : a.rs ? q(RS_ID) : 'null'}, jenis_faskes = ${a.role === 'admin' ? 'null' : a.rs ? "'rumah_sakit'" : "'puskesmas'"}`)
  L.push(`  where id = ${q(id)};`)
}
L.push('')

// ------------------------------------------------------------ balita & skrining
const KADER = uid('akun:kader1')
const DOKTER = [uid('akun:dokter1'), uid('akun:dokter2')]
const ringkas: string[] = []
let jumlahSkrining = 0
L.push('-- Balita simulasi ---------------------------------------------------')
for (const b of data.balita) {
  const p = posy.get(b.posyandu)!
  const kab = `(select id from public.kabupaten where nama = ${q(p.pkm.kabupaten)})`
  L.push(`insert into public.balita (id, nik, nama, tanggal_lahir, jenis_kelamin, nama_ibu, alamat, posyandu_id, puskesmas_id, kabupaten_id, faskes_id, usia_gestasi_minggu, created_by)`)
  L.push(`  values (${q(uid(b.id))}, ${q(b.nik)}, ${q(b.nama)}, ${tglRelatif(b.tanggal_lahir)}, ${q(b.jenis_kelamin)}, 'SIM Ibu Uji', 'Desa Simulasi', ${q(p.id)}, ${q(p.pkm.id)}, ${kab}, ${q(p.pkm.id)}, ${q(b.usia_kehamilan_minggu)}, ${q(KADER)}) on conflict (id) do nothing;`)
}
L.push('')
L.push('-- Skrining (dihitung oleh mesin aplikasi) ---------------------------')
for (const u of data.pengukuran) {
  const b = data.balita.find((x) => x.id === u.balita_id)!
  const p = posy.get(b.posyandu)!
  const posisi = u.posisi === 'Terlentang' ? 'terlentang' : 'berdiri'
  const hasil = hitungSkrining({
    tanggalLahir: b.tanggal_lahir, tanggalPeriksa: u.tanggal_ukur, jenisKelamin: b.jenis_kelamin === 'L' ? 'lk' : 'pr',
    beratKg: u.berat_kg, panjangCm: u.tinggi_cm, posisiUkur: posisi, lilaCm: u.lila_cm ?? undefined,
    edema: u.edema_bilateral, usiaGestasiMinggu: b.usia_kehamilan_minggu ?? undefined,
  } as Parameters<typeof hitungSkrining>[0])
  // Database menolak umur > 60 bulan (chk_umur, AGENTS.md 2.6). Anak itu tetap
  // terdaftar sebagai balita, tetapi tanpa skrining, sama seperti di aplikasi.
  if (hasil.umurKronologisHari > 1826) { ringkas.push(`${b.id} | ${u.tanggal_ukur} | dilewati: umur di atas 60 bulan`); continue }
  const baris = keBarisSkrining({
    clientUuid: uid('skr:' + b.id + u.tanggal_ukur), balitaId: uid(b.id), tanggalPeriksa: u.tanggal_ukur,
    beratKg: u.berat_kg, panjangCm: u.tinggi_cm, posisiUkur: posisi, lilaCm: u.lila_cm ?? undefined,
    lingkarKepalaCm: u.lingkar_kepala_cm ?? undefined, edema: u.edema_bilateral,
    usiaGestasiMinggu: b.usia_kehamilan_minggu ?? undefined, catatan: 'SIM ' + b.skenario, createdBy: KADER,
    posyanduId: p.id, puskesmasId: p.pkm.id, kabupatenId: '__KAB__', asalData: 'input_langsung',
  } as Parameters<typeof keBarisSkrining>[0], hasil) as unknown as Record<string, unknown>
  const kolom = Object.keys(baris)
  const nilai = kolom.map((k) =>
    k === 'tanggal_periksa' ? tglRelatif(u.tanggal_ukur)
      : k === 'kabupaten_id' ? `(select id from public.kabupaten where nama = ${q(p.pkm.kabupaten)})`
      : q(baris[k]))
  L.push(`insert into public.skrining (${kolom.join(', ')})`)
  L.push(`  values (${nilai.join(', ')}) on conflict (client_uuid) do nothing;`)
  jumlahSkrining++
  ringkas.push([b.id, u.tanggal_ukur, baris.z_bbu, baris.z_tbu, baris.z_bbtb, baris.status_bbtb, baris.is_red_flag].join(' | '))
}
L.push('')
L.push('-- Rujukan -----------------------------------------------------------')
const STATUS: Record<string, string> = { MENUNGGU_RS: 'diajukan', DITANGANI_RS: 'diterima', SELESAI_RUJUK_BALIK: 'selesai' }
for (const r of data.rujukan) {
  const b = data.balita.find((x) => x.id === r.balita_id)!
  const p = posy.get(b.posyandu)!
  const pIdx = pkm.findIndex((x) => x.id === p.pkm.id)
  const skr = uid('skr:' + b.id + data.meta.tanggal_acuan)
  const st = STATUS[r.status]
  const balas = st === 'selesai'
    ? { nama: 'SIM dr. Spesialis Anak', dx: 'SIM diagnosis definitif', tl: 'SIM tatalaksana lanjutan', pkmk: 'SIM rekomendasi PKMK', cat: 'SIM catatan rujuk balik' }
    : null
  L.push(`insert into public.rujukan (id, balita_id, skrining_id, tujuan, alasan, diagnosis_awal, status, diajukan_oleh, diajukan_oleh_nama, puskesmas_id, rs_tujuan_id,`)
  L.push(`  nama_dokter_spesialis, diagnosis_definitif_rs, tatalaksana_lanjutan, rekomendasi_pkmk, catatan_balasan, ditanggapi_oleh, diterima_pada, selesai_pada)`)
  L.push(`  values (${q(uid('ruj:' + b.id))}, ${q(uid(b.id))}, (select id from public.skrining where client_uuid = ${q(skr)}), 'SIM RSUD Uji', ${q('SIM ' + b.skenario)}, ${q('SIM ' + b.skenario)}, ${q(st)}, ${q(DOKTER[pIdx])}, ${q(akun[2 + pIdx].nama)}, ${q(p.pkm.id)}, ${q(RS_ID)},`)
  L.push(`  ${q(balas?.nama)}, ${q(balas?.dx)}, ${q(balas?.tl)}, ${q(balas?.pkmk)}, ${q(balas?.cat)}, ${st === 'diajukan' ? 'null' : q(uid('akun:dsa'))}, ${st === 'diajukan' ? 'null' : 'now()'}, ${st === 'selesai' ? 'now()' : 'null'}) on conflict (id) do nothing;`)
}
L.push('')
writeFileSync('supabase/seed.sql', L.join('\n') + '\n')
// ringkas tersedia untuk pemeriksaan manual bila diperlukan
console.log(`seed.sql: ${data.balita.length} balita, ${jumlahSkrining} skrining, ${data.rujukan.length} rujukan, ${akun.length} akun`)
