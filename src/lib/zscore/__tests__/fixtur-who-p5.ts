// BERKAS UJI. Nilai persentil 5 resmi WHO, satuan gram.
// Diambil langsung dari kolom '5th' tabel WHO Growth Velocity Standards
// (weight increments, percentiles) di cdn.who.int, 19 Agustus 2026.
//
// Dipakai untuk membuktikan bahwa ambangP5Gram() menghasilkan nilai yang
// sama dengan tabel terbitan WHO, yaitu bahwa pengurangan delta sudah benar.

export const P5_RESMI_WHO: Record<string, Record<number, number>> = {
  'lk-1bln': { 0: 460, 1: 713, 2: 446, 3: 285, 4: 194, 5: 103, 6: 42, 7: -1, 8: -36, 9: -66, 10: -89, 11: -106 },
  'pr-1bln': { 0: 446, 1: 578, 2: 369, 3: 259, 4: 172, 5: 93, 6: 37, 7: -2, 8: -40, 9: -70, 10: -89, 11: -102 },
  'lk-2bln': { 0: 1443, 1: 1303, 2: 884, 3: 642, 4: 466, 5: 330, 6: 238, 7: 172, 8: 115, 9: 67, 10: 30, 11: -2, 12: -31, 13: -58, 14: -75, 15: -84, 16: -90, 17: -97, 18: -104, 19: -111, 20: -118, 21: -123, 22: -128 },
  'pr-2bln': { 0: 1216, 1: 1107, 2: 804, 3: 615, 4: 450, 5: 321, 6: 229, 7: 157, 8: 95, 9: 53, 10: 26, 11: 1, 12: -19, 13: -35, 14: -47, 15: -55, 16: -64, 17: -75, 18: -86, 19: -97, 20: -109, 21: -124, 22: -137 },
  'lk-3bln': { 0: 2083, 1: 1733, 2: 1284, 3: 940, 4: 707, 5: 550, 6: 436, 7: 346, 8: 271, 9: 210, 10: 159, 11: 119, 12: 88, 13: 65, 14: 49, 15: 38, 16: 32, 17: 28, 18: 26, 19: 24, 20: 19, 21: 10 },
  'pr-3bln': { 0: 1784, 1: 1542, 2: 1197, 3: 913, 4: 694, 5: 528, 6: 400, 7: 301, 8: 230, 9: 181, 10: 147, 11: 122, 12: 102, 13: 88, 14: 78, 15: 70, 16: 62, 17: 53, 18: 43, 19: 32, 20: 20, 21: 8 },
}

export const DELTA_RESMI_WHO: Record<string, number> = {
  'lk-1bln': 400,
  'pr-1bln': 400,
  'lk-2bln': 600,
  'pr-2bln': 600,
  'lk-3bln': 650,
  'pr-3bln': 800,
}