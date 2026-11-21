/**
 * Titik masuk middleware untuk Next.js 15.
 *
 * ==========================================================================
 * TEMUAN AUDIT 21 NOVEMBER 2026: `proxy.ts` TIDAK PERNAH BERJALAN
 *
 * Nama berkas `proxy.ts` baru dikenali Next.js 16. Aplikasi ini memakai
 * Next.js 15.5, yang hanya memuat `middleware.ts`, sehingga manifest build
 * berisi `"middleware": {}`. Akibatnya di produksi:
 *   - halaman aplikasi tampil tanpa login (dengan profil "Petugas Demo"),
 *   - token sesi tidak pernah diperbarui di server, sehingga pengguna dapat
 *     terlempar setelah token kedaluwarsa,
 *   - pengguna yang sudah login tetap melihat halaman Masuk dan Daftar.
 *
 * Seluruh logika tetap di `proxy.ts`. Saat aplikasi naik ke Next.js 16,
 * hapus berkas ini dan biarkan `proxy.ts` yang dipakai.
 * ==========================================================================
 */
export { proxy as middleware } from './proxy'

// Wajib ditulis langsung di berkas ini: Next.js membaca `config` secara statis.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon-.*|.*\\.(?:svg|png|jpg|jpeg|webp|woff2)$).*)',
  ],
}
