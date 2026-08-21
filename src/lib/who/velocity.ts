// BERKAS INI DIHASILKAN OTOMATIS. JANGAN DIEDIT MANUAL.
// Dihasilkan oleh: scripts/hasilkan-tabel-who.ts
//
// Sumber : WHO Child Growth Standards - Growth velocity based on weight,
//          length and head circumference (WHO Multicentre Growth Reference
//          Study Group, 2009). Tabel percentiles untuk weight increments.
//          Diambil dari cdn.who.int pada 19 Agustus 2026.
//
// Verifikasi: seluruh 114 baris (L, M, S) telah dibandingkan satu per satu
//          dengan tabel resmi WHO dan SAMA PERSIS dengan nilai di
//          constants.ts aplikasi versi Firebase. Tidak ada nilai yang diubah.
//
// Yang DITAMBAHKAN pada berkas ini adalah parameter delta, yang tidak ada di
// aplikasi lama. Tanpa pengurangan delta, ambang kenaikan berat minimal
// terlalu tinggi sebesar delta pada setiap penilaian.
//
//   interval   delta laki-laki   delta perempuan
//   1 bulan          400 g             400 g
//   2 bulan          600 g             600 g
//   3 bulan          650 g             800 g   <- berbeda antar jenis kelamin

import type { TabelVelocity } from './tipe'

/** Laki-laki, kenaikan berat interval 1 bulan. Interval mulai bulan 0 sampai 11. Delta 400 g. */
export const velocity1BlnLk: TabelVelocity = {
  deltaGram: 400,
  bulanAwalMin: 0,
  bulanAwalMaks: 11,
  hariStandar: 30.4375,
  baris: {
    0: [1.3828, 1423.0783, 0.22048],
    1: [0.7241, 1596.347, 0.19296],
    2: [0.659, 1215.3989, 0.19591],
    3: [0.7003, 1017.0488, 0.20965],
    4: [0.7419, 921.6249, 0.2279],
    5: [0.7668, 822.1842, 0.24854],
    6: [0.7688, 756.5306, 0.26783],
    7: [0.7624, 715.6257, 0.28677],
    8: [0.762, 684.7459, 0.30439],
    9: [0.7659, 658.5809, 0.32154],
    10: [0.7713, 643.4374, 0.33882],
    11: [0.7761, 639.4743, 0.35502],
  },
}

/** Laki-laki, kenaikan berat interval 2 bulan. Interval mulai bulan 0 sampai 22. Delta 600 g. */
export const velocity2BlnLk: TabelVelocity = {
  deltaGram: 600,
  bulanAwalMin: 0,
  bulanAwalMaks: 22,
  hariStandar: 60.875,
  baris: {
    0: [0.7188, 2815.612, 0.17422],
    1: [0.6464, 2592.0761, 0.17025],
    2: [0.6071, 2038.1036, 0.17559],
    3: [0.5915, 1744.8197, 0.18708],
    4: [0.5891, 1541.367, 0.2013],
    5: [0.5954, 1377.6979, 0.21318],
    6: [0.6088, 1272.5277, 0.22426],
    7: [0.627, 1201.4599, 0.23472],
    8: [0.6486, 1143.8903, 0.24611],
    9: [0.6725, 1101.6312, 0.25918],
    10: [0.6959, 1077.9049, 0.27217],
    11: [0.7191, 1057.9071, 0.28462],
    12: [0.7399, 1037.0541, 0.29479],
    13: [0.7597, 1014.185, 0.30285],
    14: [0.7771, 1000.5821, 0.30864],
    15: [0.7929, 999.4661, 0.3129],
    16: [0.8078, 1000.968, 0.31615],
    17: [0.821, 998.4215, 0.31858],
    18: [0.8335, 992.804, 0.32058],
    19: [0.8447, 986.9799, 0.32222],
    20: [0.8554, 981.7965, 0.32377],
    21: [0.8655, 978.4016, 0.32529],
    22: [0.8748, 976.3696, 0.32673],
  },
}

/** Laki-laki, kenaikan berat interval 3 bulan. Interval mulai bulan 0 sampai 21. Delta 650 g. */
export const velocity3BlnLk: TabelVelocity = {
  deltaGram: 650,
  bulanAwalMin: 0,
  bulanAwalMaks: 21,
  hariStandar: 91.3125,
  baris: {
    0: [0.6854, 3638.873, 0.15801],
    1: [0.6503, 3215.101, 0.16539],
    2: [0.5884, 2661.5629, 0.17708],
    3: [0.5368, 2231.9042, 0.1885],
    4: [0.4999, 1939.0717, 0.19877],
    5: [0.4819, 1745.5952, 0.20848],
    6: [0.4866, 1611.6464, 0.21853],
    7: [0.5135, 1514.8958, 0.2294],
    8: [0.5582, 1442.6013, 0.24108],
    9: [0.6092, 1387.884, 0.25261],
    10: [0.658, 1346.3553, 0.26315],
    11: [0.7, 1314.9304, 0.27214],
    12: [0.7323, 1291.3726, 0.27922],
    13: [0.755, 1273.886, 0.28446],
    14: [0.7695, 1261.0053, 0.28821],
    15: [0.7769, 1251.6296, 0.29074],
    16: [0.7781, 1244.9248, 0.29231],
    17: [0.774, 1240.2027, 0.29311],
    18: [0.7663, 1235.8993, 0.2935],
    19: [0.7569, 1229.8975, 0.29388],
    20: [0.7475, 1220.6029, 0.2946],
    21: [0.7393, 1206.8517, 0.29591],
  },
}

/** Perempuan, kenaikan berat interval 1 bulan. Interval mulai bulan 0 sampai 11. Delta 400 g. */
export const velocity1BlnPr: TabelVelocity = {
  deltaGram: 400,
  bulanAwalMin: 0,
  bulanAwalMaks: 11,
  hariStandar: 30.4375,
  baris: {
    0: [0.7781, 1279.4834, 0.21479],
    1: [0.7781, 1411.1075, 0.19384],
    2: [0.7781, 1118.0098, 0.19766],
    3: [0.7781, 984.8825, 0.20995],
    4: [0.7781, 888.9803, 0.22671],
    5: [0.7781, 801.391, 0.24596],
    6: [0.7781, 744.3023, 0.26515],
    7: [0.7781, 710.6923, 0.28409],
    8: [0.7781, 672.6072, 0.30106],
    9: [0.7781, 644.6032, 0.31676],
    10: [0.7781, 633.2166, 0.33208],
    11: [0.7781, 631.7383, 0.34627],
  },
}

/** Perempuan, kenaikan berat interval 2 bulan. Interval mulai bulan 0 sampai 22. Delta 600 g. */
export const velocity2BlnPr: TabelVelocity = {
  deltaGram: 600,
  bulanAwalMin: 0,
  bulanAwalMaks: 22,
  hariStandar: 60.875,
  baris: {
    0: [0.4599, 2497.0406, 0.18],
    1: [0.3294, 2314.2285, 0.17612],
    2: [0.3128, 1907.0116, 0.17761],
    3: [0.356, 1673.5778, 0.18421],
    4: [0.4264, 1482.7466, 0.19524],
    5: [0.5002, 1342.3734, 0.20864],
    6: [0.5699, 1251.4869, 0.22315],
    7: [0.6268, 1181.4135, 0.23586],
    8: [0.673, 1116.8192, 0.2468],
    9: [0.7102, 1078.3961, 0.25656],
    10: [0.7382, 1058.4112, 0.26494],
    11: [0.7605, 1040.8737, 0.27292],
    12: [0.7762, 1027.9459, 0.28011],
    13: [0.7864, 1019.687, 0.28705],
    14: [0.7913, 1016.4898, 0.29343],
    15: [0.7922, 1017.5335, 0.29961],
    16: [0.7902, 1017.2241, 0.30592],
    17: [0.7866, 1012.8511, 0.31201],
    18: [0.7827, 1007.2711, 0.31824],
    19: [0.7795, 1001.8324, 0.32415],
    20: [0.7771, 993.3265, 0.33014],
    21: [0.7755, 980.7096, 0.33605],
    22: [0.7743, 967.2057, 0.34166],
  },
}

/** Perempuan, kenaikan berat interval 3 bulan. Interval mulai bulan 0 sampai 21. Delta 800 g. */
export const velocity3BlnPr: TabelVelocity = {
  deltaGram: 800,
  bulanAwalMin: 0,
  bulanAwalMaks: 21,
  hariStandar: 91.3125,
  baris: {
    0: [0.2298, 3403.924, 0.16227],
    1: [0.0924, 3054.3512, 0.15958],
    2: [0.0599, 2618.644, 0.16338],
    3: [0.13, 2277.5681, 0.1699],
    4: [0.2404, 2030.2917, 0.1796],
    5: [0.358, 1855.0162, 0.19157],
    6: [0.4576, 1724.5802, 0.20334],
    7: [0.5317, 1624.4588, 0.2135],
    8: [0.5891, 1552.7117, 0.22168],
    9: [0.6373, 1506.412, 0.22796],
    10: [0.6806, 1476.5227, 0.23285],
    11: [0.7211, 1455.9527, 0.23682],
    12: [0.7527, 1442.0871, 0.2404],
    13: [0.7679, 1434.2381, 0.24403],
    14: [0.7642, 1431.1099, 0.24794],
    15: [0.7482, 1429.1551, 0.25198],
    16: [0.7267, 1425.3256, 0.25598],
    17: [0.7032, 1418.4764, 0.25989],
    18: [0.6782, 1409.2288, 0.26384],
    19: [0.6522, 1398.1693, 0.26792],
    20: [0.6262, 1385.3711, 0.27191],
    21: [0.6013, 1370.5464, 0.27539],
  },
}
