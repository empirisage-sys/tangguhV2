"""
Menghasilkan src/lib/who/lms-harian-*.ts dari referensi/who-harian/lms-harian-bbu-tbu.json.

Isi JSON diambil langsung dari tabel z-score diperluas (expanded tables) WHO di
cdn.who.int, kolom Day, L, M, S, tanpa perubahan nilai. URL dan tanggal unduh
tercatat di bagian "sumber" pada berkas JSON.

Verifikasi yang dijalankan saat pembuatan (21 November 2026):
  1. 1857 baris per tabel, hari 0 sampai 1856 tanpa celah.
  2. Cocok dengan tabel bulanan di src/lib/who/lms-bbu-*.ts dan lms-tbu-*.ts
     pada setiap bulan 0-60 (selisih relatif M maksimal 1,7e-4; bulan 24 TB/U
     dibandingkan dengan hari 731 karena basisnya tinggi berdiri).
  3. PB/U dan TB/U identik dengan paket cgmzscore 3.3.1; BB/U berbeda paling
     besar 4,6e-4 relatif karena paket itu memangkas digit S.
Pemeriksaan butir 2 dijalankan ulang oleh uji
src/lib/zscore/__tests__/lms-harian.test.ts.

Jalankan: python3 scripts/who/hasilkan-tabel-harian.py
"""
import hashlib
import json
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
SUMBER = AKAR / 'referensi' / 'who-harian' / 'lms-harian-bbu-tbu.json'

TABEL = {
    'wfa_lk': ('lms-harian-bbu-lk', 'lmsHarianBBULk', 'Berat badan menurut umur (BB/U) — laki-laki'),
    'wfa_pr': ('lms-harian-bbu-pr', 'lmsHarianBBUPr', 'Berat badan menurut umur (BB/U) — perempuan'),
    'lhfa_lk': ('lms-harian-tbu-lk', 'lmsHarianTBULk', 'Panjang/tinggi badan menurut umur (PB/U dan TB/U) — laki-laki'),
    'lhfa_pr': ('lms-harian-tbu-pr', 'lmsHarianTBUPr', 'Panjang/tinggi badan menurut umur (PB/U dan TB/U) — perempuan'),
}


def fmt(x: float) -> str:
    s = repr(round(x, 6))
    return s[:-2] if s.endswith('.0') else s


def main() -> None:
    data = json.loads(SUMBER.read_text())
    src = data['sumber']
    for kunci, (berkas, ident, judul) in TABEL.items():
        baris = data[kunci]
        if len(baris) != 1857:
            raise SystemExit(f'{kunci}: {len(baris)} baris, seharusnya 1857')
        isi = ';'.join(f'{i},{fmt(a)},{fmt(b)},{fmt(c)}' for i, (a, b, c) in enumerate(baris))
        sha = hashlib.sha256(isi.encode()).hexdigest()
        keluaran = [
            '// BERKAS INI DIHASILKAN OTOMATIS. JANGAN DIEDIT MANUAL.',
            '// Dihasilkan oleh: scripts/who/hasilkan-tabel-harian.py',
            '// Sumber: WHO Child Growth Standards 2006, tabel z-score DIPERLUAS (harian)',
            f'//         {src["basis"]}{src[kunci]}',
            f'//         diunduh {src["diunduh"][:10]} langsung dari cdn.who.int',
            f'// Isi   : {judul}',
            '// Baris : 1857 (umur hari 0 sampai 1856; indeks senarai = umur dalam hari)',
            f'// SHA-256 isi (hari,L,M,S dipisah titik koma): {sha}',
            '//',
            '// Dipakai mesin z-score untuk BB/U dan TB/U sejak zscore-2.3.0. Tabel bulanan',
            '// tetap dipakai untuk kurva dan usia-tinggi. Lihat catatan versi di',
            '// src/lib/zscore/index.ts.',
            '',
            "import type { Lms } from './tipe'",
            '',
            f'export const {ident}: ReadonlyArray<Lms> = [',
            *[f'  [{fmt(a)}, {fmt(b)}, {fmt(c)}],' for a, b, c in baris],
            ']',
            '',
        ]
        (AKAR / 'src' / 'lib' / 'who' / f'{berkas}.ts').write_text('\n'.join(keluaran))
        print(berkas, sha[:16])


if __name__ == '__main__':
    main()
