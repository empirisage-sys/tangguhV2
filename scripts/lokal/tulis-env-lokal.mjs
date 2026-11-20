/**
 * Menulis .env.development.local dari Supabase lokal yang sedang berjalan.
 *
 * `npm run dev` membaca .env.development.local lebih dulu daripada .env.local,
 * jadi aplikasi lokal tersambung ke Supabase lokal tanpa mengubah .env.local
 * yang berisi kunci produksi. `npm run build` tidak membaca berkas ini.
 *
 * Jalankan setelah `npx supabase@2.122.1 start`:
 *   node scripts/lokal/tulis-env-lokal.mjs
 */
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const keluaran = execSync('npx supabase@2.122.1 status -o env', { encoding: 'utf8' })
const nilai = Object.fromEntries(
  keluaran
    .split(/\r?\n/)
    .map((baris) => baris.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
)

const url = nilai.API_URL
const anon = nilai.ANON_KEY || nilai.PUBLISHABLE_KEY
const service = nilai.SERVICE_ROLE_KEY || nilai.SECRET_KEY

if (!url || !anon || !service) {
  console.error('Supabase lokal belum berjalan atau keluaran status tidak dikenali.')
  process.exit(1)
}
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
  console.error(`URL ${url} bukan Supabase lokal. Berkas tidak ditulis.`)
  process.exit(1)
}

writeFileSync(
  '.env.development.local',
  [
    '# Dibuat otomatis oleh scripts/lokal/tulis-env-lokal.mjs. Hanya untuk Supabase lokal.',
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    'NEXT_PUBLIC_SITE_URL=http://localhost:3000',
    '',
  ].join('\n'),
)
console.log(`.env.development.local ditulis. Aplikasi lokal memakai ${url}`)
