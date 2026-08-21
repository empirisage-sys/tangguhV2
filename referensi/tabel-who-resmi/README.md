# Tabel Resmi WHO untuk Verifikasi

Berkas di folder ini adalah transkripsi kolom L, M, dan S dari tabel z-scores
resmi WHO yang diunduh dari cdn.who.int pada 19 Agustus 2026. Dipakai untuk
memverifikasi tabel di `src/lib/who/` baris per baris.

Format: satu baris per titik data, dipisah spasi.

| Berkas | Kolom | Sumber WHO |
|---|---|---|
| `wfa_boys.txt`, `wfa_girls.txt` | umur_bulan L M S | `wfa-{boys,girls}-0-5-zscores.pdf` |
| `tbu_boys.txt`, `tbu_girls.txt` | umur_bulan L M S | `lfa_*_0_2` (bulan 0-23) + `hfa_*_2_5` (bulan 24-60) |
| `bbpb_boys.txt`, `bbpb_girls.txt` | panjang_cm M S | `wfl-{boys,girls}-0-2-zscores.pdf` |
| `bbtb_boys.txt`, `bbtb_girls.txt` | tinggi_cm M S | `wfh-{boys,girls}-2-5-zscores.pdf` |

Pada berkas BB/PB dan BB/TB, kolom L tidak dicantumkan karena nilainya tetap:
-0,3521 untuk laki-laki dan -0,3833 untuk perempuan pada kedua tabel. Sifat itu
sendiri diuji di `integritas-tabel.test.ts`.

Laporan hasil perbandingan ada di `docs/VERIFIKASI_TABEL_WHO.md`.
