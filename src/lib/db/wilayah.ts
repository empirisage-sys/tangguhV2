/**
 * Master data wilayah & fasilitas kesehatan se-Indonesia (fokus 6 Kab/Kota Gorontalo).
 * Digunakan untuk formulir pendaftaran berjenjang, verifikasi admin, filter rekap, dan fallback offline.
 */

export type ProvinsiData = {
  id: string
  kode: string
  nama: string
}

export type KabupatenData = {
  id: string
  provinsiId: string
  kode: string
  nama: string
}

export type JenisFaskes = 'puskesmas' | 'rumah_sakit'
export type StatusFaskes = 'master' | 'usulan'

export type FaskesData = {
  id: string
  kabupatenId: string
  nama: string
  jenis: JenisFaskes
  status: StatusFaskes
  kodeKemenkes?: string
}

export type PosyanduData = {
  id: string
  puskesmasId: string
  kabupatenId?: string
  nama: string
  status?: StatusFaskes
}

// ---------------------------------------------------------------------------
// 38 PROVINSI SE-INDONESIA (Kemendagri / BPS)
// ---------------------------------------------------------------------------

export const PROVINSI_INDONESIA: ProvinsiData[] = [
  { id: 'prov-11', kode: '11', nama: 'Aceh' },
  { id: 'prov-12', kode: '12', nama: 'Sumatera Utara' },
  { id: 'prov-13', kode: '13', nama: 'Sumatera Barat' },
  { id: 'prov-14', kode: '14', nama: 'Riau' },
  { id: 'prov-15', kode: '15', nama: 'Jambi' },
  { id: 'prov-16', kode: '16', nama: 'Sumatera Selatan' },
  { id: 'prov-17', kode: '17', nama: 'Bengkulu' },
  { id: 'prov-18', kode: '18', nama: 'Lampung' },
  { id: 'prov-19', kode: '19', nama: 'Kepulauan Bangka Belitung' },
  { id: 'prov-21', kode: '21', nama: 'Kepulauan Riau' },
  { id: 'prov-31', kode: '31', nama: 'DKI Jakarta' },
  { id: 'prov-32', kode: '32', nama: 'Jawa Barat' },
  { id: 'prov-33', kode: '33', nama: 'Jawa Tengah' },
  { id: 'prov-34', kode: '34', nama: 'DI Yogyakarta' },
  { id: 'prov-35', kode: '35', nama: 'Jawa Timur' },
  { id: 'prov-36', kode: '36', nama: 'Banten' },
  { id: 'prov-51', kode: '51', nama: 'Bali' },
  { id: 'prov-52', kode: '52', nama: 'Nusa Tenggara Barat' },
  { id: 'prov-53', kode: '53', nama: 'Nusa Tenggara Timur' },
  { id: 'prov-61', kode: '61', nama: 'Kalimantan Barat' },
  { id: 'prov-62', kode: '62', nama: 'Kalimantan Tengah' },
  { id: 'prov-63', kode: '63', nama: 'Kalimantan Selatan' },
  { id: 'prov-64', kode: '64', nama: 'Kalimantan Timur' },
  { id: 'prov-65', kode: '65', nama: 'Kalimantan Utara' },
  { id: 'prov-71', kode: '71', nama: 'Sulawesi Utara' },
  { id: 'prov-72', kode: '72', nama: 'Sulawesi Tengah' },
  { id: 'prov-73', kode: '73', nama: 'Sulawesi Selatan' },
  { id: 'prov-74', kode: '74', nama: 'Sulawesi Tenggara' },
  { id: 'prov-75', kode: '75', nama: 'Gorontalo' },
  { id: 'prov-76', kode: '76', nama: 'Sulawesi Barat' },
  { id: 'prov-81', kode: '81', nama: 'Maluku' },
  { id: 'prov-82', kode: '82', nama: 'Maluku Utara' },
  { id: 'prov-91', kode: '91', nama: 'Papua Barat' },
  { id: 'prov-92', kode: '92', nama: 'Papua Barat Daya' },
  { id: 'prov-94', kode: '94', nama: 'Papua' },
  { id: 'prov-95', kode: '95', nama: 'Papua Selatan' },
  { id: 'prov-96', kode: '96', nama: 'Papua Tengah' },
  { id: 'prov-97', kode: '97', nama: 'Papua Pegunungan' },
].sort((a, b) => a.nama.localeCompare(b.nama))

// ---------------------------------------------------------------------------
// 6 KABUPATEN / KOTA PROVINSI GORONTALO (75)
// ---------------------------------------------------------------------------

export const KABUPATEN_GORONTALO: KabupatenData[] = [
  { id: 'kab-7501', provinsiId: 'prov-75', kode: '7501', nama: 'Kabupaten Boalemo' },
  { id: 'kab-7502', provinsiId: 'prov-75', kode: '7502', nama: 'Kabupaten Gorontalo' },
  { id: 'kab-7503', provinsiId: 'prov-75', kode: '7503', nama: 'Kabupaten Pohuwato' },
  { id: 'kab-7504', provinsiId: 'prov-75', kode: '7504', nama: 'Kabupaten Bone Bolango' },
  { id: 'kab-7505', provinsiId: 'prov-75', kode: '7505', nama: 'Kabupaten Gorontalo Utara' },
  { id: 'kab-7571', provinsiId: 'prov-75', kode: '7571', nama: 'Kota Gorontalo' },
]

// ---------------------------------------------------------------------------
// 95 PUSKESMAS MASTER PROVINSI GORONTALO (Seed Resmi)
// ---------------------------------------------------------------------------

export const PUSKESMAS_GORONTALO: FaskesData[] = [
  // Kota Gorontalo (12)
  { id: 'pus-7571-01', kabupatenId: 'kab-7571', nama: 'Puskesmas Kota Tengah', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7571-02', kabupatenId: 'kab-7571', nama: 'Puskesmas Kota Selatan', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7571-03', kabupatenId: 'kab-7571', nama: 'Puskesmas Dungingi', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7571-04', kabupatenId: 'kab-7571', nama: 'Puskesmas Kota Barat', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7571-05', kabupatenId: 'kab-7571', nama: 'Puskesmas Hulonthalangi', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7571-06', kabupatenId: 'kab-7571', nama: 'Puskesmas Kota Utara', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7571-07', kabupatenId: 'kab-7571', nama: 'Puskesmas Pilolodaa', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7571-08', kabupatenId: 'kab-7571', nama: 'Puskesmas Buladu', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7571-09', kabupatenId: 'kab-7571', nama: 'Puskesmas Limba B', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7571-10', kabupatenId: 'kab-7571', nama: 'Puskesmas Tamalate', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7571-11', kabupatenId: 'kab-7571', nama: 'Puskesmas Dumbo Raya', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7571-12', kabupatenId: 'kab-7571', nama: 'Puskesmas Sipatana', jenis: 'puskesmas', status: 'master' },

  // Kabupaten Gorontalo (21)
  { id: 'pus-7502-01', kabupatenId: 'kab-7502', nama: 'Puskesmas Limboto', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-02', kabupatenId: 'kab-7502', nama: 'Puskesmas Limboto Barat', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-03', kabupatenId: 'kab-7502', nama: 'Puskesmas Telaga', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-04', kabupatenId: 'kab-7502', nama: 'Puskesmas Tibawa', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-05', kabupatenId: 'kab-7502', nama: 'Puskesmas Pulubala', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-06', kabupatenId: 'kab-7502', nama: 'Puskesmas Batudaa Pantai', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-07', kabupatenId: 'kab-7502', nama: 'Puskesmas Biluhu', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-08', kabupatenId: 'kab-7502', nama: 'Puskesmas Batudaa', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-09', kabupatenId: 'kab-7502', nama: 'Puskesmas Dungaliyo', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-10', kabupatenId: 'kab-7502', nama: 'Puskesmas Molopatodu', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-11', kabupatenId: 'kab-7502', nama: 'Puskesmas Tabongo', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-12', kabupatenId: 'kab-7502', nama: 'Puskesmas Buhu', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-13', kabupatenId: 'kab-7502', nama: 'Puskesmas Boliyohuto', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-14', kabupatenId: 'kab-7502', nama: 'Puskesmas Bilato', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-15', kabupatenId: 'kab-7502', nama: 'Puskesmas Mootilango', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-16', kabupatenId: 'kab-7502', nama: 'Puskesmas Tolangohula', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-17', kabupatenId: 'kab-7502', nama: 'Puskesmas Asparaga', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-18', kabupatenId: 'kab-7502', nama: 'Puskesmas Pilohayanga', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-19', kabupatenId: 'kab-7502', nama: 'Puskesmas Telaga Biru', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-20', kabupatenId: 'kab-7502', nama: 'Puskesmas Tilango', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7502-21', kabupatenId: 'kab-7502', nama: 'Puskesmas Telaga Jaya', jenis: 'puskesmas', status: 'master' },

  // Kabupaten Boalemo (11)
  { id: 'pus-7501-01', kabupatenId: 'kab-7501', nama: 'Puskesmas Tilamuta', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7501-02', kabupatenId: 'kab-7501', nama: 'Puskesmas Dulupi', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7501-03', kabupatenId: 'kab-7501', nama: 'Puskesmas Paguyaman', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7501-04', kabupatenId: 'kab-7501', nama: 'Puskesmas Botumoito', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7501-05', kabupatenId: 'kab-7501', nama: 'Puskesmas Mananggu', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7501-06', kabupatenId: 'kab-7501', nama: 'Puskesmas Pangi', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7501-07', kabupatenId: 'kab-7501', nama: 'Puskesmas Bongo II', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7501-08', kabupatenId: 'kab-7501', nama: 'Puskesmas Bongo Nol', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7501-09', kabupatenId: 'kab-7501', nama: 'Puskesmas Berlian', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7501-10', kabupatenId: 'kab-7501', nama: 'Puskesmas Sari Tani', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7501-11', kabupatenId: 'kab-7501', nama: 'Puskesmas Paguyaman Pantai', jenis: 'puskesmas', status: 'master' },

  // Kabupaten Pohuwato (16)
  { id: 'pus-7503-01', kabupatenId: 'kab-7503', nama: 'Puskesmas Marisa', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-02', kabupatenId: 'kab-7503', nama: 'Puskesmas Paguat', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-03', kabupatenId: 'kab-7503', nama: 'Puskesmas Randangan', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-04', kabupatenId: 'kab-7503', nama: 'Puskesmas Popayato', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-05', kabupatenId: 'kab-7503', nama: 'Puskesmas Popayato Barat', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-06', kabupatenId: 'kab-7503', nama: 'Puskesmas Popayato Timur', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-07', kabupatenId: 'kab-7503', nama: 'Puskesmas Lemito', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-08', kabupatenId: 'kab-7503', nama: 'Puskesmas Wonggarasi I', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-09', kabupatenId: 'kab-7503', nama: 'Puskesmas Wonggarasi II', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-10', kabupatenId: 'kab-7503', nama: 'Puskesmas Wanggarasi', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-11', kabupatenId: 'kab-7503', nama: 'Puskesmas Patilanggio', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-12', kabupatenId: 'kab-7503', nama: 'Puskesmas Buntulia', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-13', kabupatenId: 'kab-7503', nama: 'Puskesmas Duhiadaa', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-14', kabupatenId: 'kab-7503', nama: 'Puskesmas Motolohu', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-15', kabupatenId: 'kab-7503', nama: 'Puskesmas Pancakarsa I', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7503-16', kabupatenId: 'kab-7503', nama: 'Puskesmas Dengilo', jenis: 'puskesmas', status: 'master' },

  // Kabupaten Bone Bolango (20)
  { id: 'pus-7504-01', kabupatenId: 'kab-7504', nama: 'Puskesmas Suwawa', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-02', kabupatenId: 'kab-7504', nama: 'Puskesmas Kabila', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-03', kabupatenId: 'kab-7504', nama: 'Puskesmas Tapa', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-04', kabupatenId: 'kab-7504', nama: 'Puskesmas Botupingge', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-05', kabupatenId: 'kab-7504', nama: 'Puskesmas Bone Pantai', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-06', kabupatenId: 'kab-7504', nama: 'Puskesmas Bulango Selatan', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-07', kabupatenId: 'kab-7504', nama: 'Puskesmas Bulango Timur', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-08', kabupatenId: 'kab-7504', nama: 'Puskesmas Bulango Utara', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-09', kabupatenId: 'kab-7504', nama: 'Puskesmas Bulango Ulu', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-10', kabupatenId: 'kab-7504', nama: 'Puskesmas Tilongkabila', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-11', kabupatenId: 'kab-7504', nama: 'Puskesmas Toto Utara', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-12', kabupatenId: 'kab-7504', nama: 'Puskesmas Ulantha', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-13', kabupatenId: 'kab-7504', nama: 'Puskesmas Suwawa Selatan', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-14', kabupatenId: 'kab-7504', nama: 'Puskesmas Suwawa Tengah', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-15', kabupatenId: 'kab-7504', nama: 'Puskesmas Dumbayabulan', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-16', kabupatenId: 'kab-7504', nama: 'Puskesmas Pinogu', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-17', kabupatenId: 'kab-7504', nama: 'Puskesmas Kabila Bone', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-18', kabupatenId: 'kab-7504', nama: 'Puskesmas Tombulilato', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-19', kabupatenId: 'kab-7504', nama: 'Puskesmas Bone', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7504-20', kabupatenId: 'kab-7504', nama: 'Puskesmas Bulawa', jenis: 'puskesmas', status: 'master' },

  // Kabupaten Gorontalo Utara (15)
  { id: 'pus-7505-01', kabupatenId: 'kab-7505', nama: 'Puskesmas Kwandang', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-02', kabupatenId: 'kab-7505', nama: 'Puskesmas Atinggola', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-03', kabupatenId: 'kab-7505', nama: 'Puskesmas Sumalata', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-04', kabupatenId: 'kab-7505', nama: 'Puskesmas Anggrek', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-05', kabupatenId: 'kab-7505', nama: 'Puskesmas Gentuma', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-06', kabupatenId: 'kab-7505', nama: 'Puskesmas Molingkapoto', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-07', kabupatenId: 'kab-7505', nama: 'Puskesmas Ponelo', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-08', kabupatenId: 'kab-7505', nama: 'Puskesmas Dambalo', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-09', kabupatenId: 'kab-7505', nama: 'Puskesmas Monano', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-10', kabupatenId: 'kab-7505', nama: 'Puskesmas Ilangata', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-11', kabupatenId: 'kab-7505', nama: 'Puskesmas Dulukapa', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-12', kabupatenId: 'kab-7505', nama: 'Puskesmas Buloila', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-13', kabupatenId: 'kab-7505', nama: 'Puskesmas Tolinggula', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-14', kabupatenId: 'kab-7505', nama: 'Puskesmas Biawu', jenis: 'puskesmas', status: 'master' },
  { id: 'pus-7505-15', kabupatenId: 'kab-7505', nama: 'Puskesmas Limbato', jenis: 'puskesmas', status: 'master' },
]

export const RUMAH_SAKIT_GORONTALO: FaskesData[] = [
  { id: 'rs-7571-01', kabupatenId: 'kab-7571', nama: 'RSUD Prof. Dr. H. Aloei Saboe (RS Rujukan Utama)', jenis: 'rumah_sakit', status: 'master' },
  { id: 'rs-7571-02', kabupatenId: 'kab-7571', nama: 'RSUD dr. Hasri Ainun Habibie Provinsi Gorontalo', jenis: 'rumah_sakit', status: 'master' },
  { id: 'rs-7571-03', kabupatenId: 'kab-7571', nama: 'RSUD Otanaha Kota Gorontalo', jenis: 'rumah_sakit', status: 'master' },
  { id: 'rs-7502-01', kabupatenId: 'kab-7502', nama: 'RSUD MM Dunda Limboto Kab. Gorontalo', jenis: 'rumah_sakit', status: 'master' },
  { id: 'rs-7504-01', kabupatenId: 'kab-7504', nama: 'RSUD Toto Kabila Bone Bolango', jenis: 'rumah_sakit', status: 'master' },
  { id: 'rs-7501-01', kabupatenId: 'kab-7501', nama: 'RSUD Dr. Iwan Bokings Boalemo', jenis: 'rumah_sakit', status: 'master' },
  { id: 'rs-7503-01', kabupatenId: 'kab-7503', nama: 'RSUD Bumi Panua Pohuwato', jenis: 'rumah_sakit', status: 'master' },
  { id: 'rs-7505-01', kabupatenId: 'kab-7505', nama: 'RSUD dr. Zainal Umar Sidiki Gorontalo Utara', jenis: 'rumah_sakit', status: 'master' },
]

export const POSYANDU_GORONTALO: PosyanduData[] = [
  { id: 'pos-7571-01-01', puskesmasId: 'pus-7571-01', nama: 'Posyandu Mawar Dulalowo', status: 'master' },
  { id: 'pos-7571-01-02', puskesmasId: 'pus-7571-01', nama: 'Posyandu Melati Pulubala', status: 'master' },
  { id: 'pos-7571-01-03', puskesmasId: 'pus-7571-01', nama: 'Posyandu Anggrek Liluwo', status: 'master' },
  { id: 'pos-7502-01-01', puskesmasId: 'pus-7502-01', nama: 'Posyandu Cempaka Kayubulan', status: 'master' },
  { id: 'pos-7502-01-02', puskesmasId: 'pus-7502-01', nama: 'Posyandu Teratai Hiyalo', status: 'master' },
  { id: 'pos-7502-01-03', puskesmasId: 'pus-7502-01', nama: 'Posyandu Kenanga Biyonga', status: 'master' },
  { id: 'pos-7504-01-01', puskesmasId: 'pus-7504-01', nama: 'Posyandu Dahlia Ulanta', status: 'master' },
  { id: 'pos-7504-01-02', puskesmasId: 'pus-7504-01', nama: 'Posyandu Flamboyan Boludawa', status: 'master' },
  { id: 'pos-7501-01-01', puskesmasId: 'pus-7501-01', nama: 'Posyandu Kasih Ibu Mohungo', status: 'master' },
  { id: 'pos-7501-01-02', puskesmasId: 'pus-7501-01', nama: 'Posyandu Balita Sehat Hungayonaa', status: 'master' },
  { id: 'pos-7503-01-01', puskesmasId: 'pus-7503-01', nama: 'Posyandu Mekar Pohuwato Timur', status: 'master' },
  { id: 'pos-7503-01-02', puskesmasId: 'pus-7503-01', nama: 'Posyandu Tunas Harapan Marisa', status: 'master' },
  { id: 'pos-7505-01-01', puskesmasId: 'pus-7505-01', nama: 'Posyandu Beringin Moluo', status: 'master' },
  { id: 'pos-7505-01-02', puskesmasId: 'pus-7505-01', nama: 'Posyandu Bina Gizi Titidu', status: 'master' },
]

// ---------------------------------------------------------------------------
// HELPER LOOKUP & NORMALISASI
// ---------------------------------------------------------------------------

export function getKabupatenByProvinsi(provinsiId: string): KabupatenData[] {
  return KABUPATEN_GORONTALO.filter((k) => k.provinsiId === provinsiId)
}

export function getPuskesmasByKabupaten(kabupatenId: string): FaskesData[] {
  return PUSKESMAS_GORONTALO.filter((p) => p.kabupatenId === kabupatenId)
}

export function getPosyanduByPuskesmas(puskesmasId: string): PosyanduData[] {
  return POSYANDU_GORONTALO.filter((p) => p.puskesmasId === puskesmasId)
}

/**
 * Mencari fasilitas master yang memiliki kemiripan nama (Levenshtein / Substring)
 * untuk membantu admin menormalkan nama usulan saat verifikasi akun.
 */
export function cariFaskesMiripLokal(
  namaUsulan: string,
  kabupatenId?: string,
  jenis?: JenisFaskes,
): FaskesData[] {
  const q = namaUsulan.toLowerCase().trim().replace(/^(puskesmas|pkm|rsud|rs|rumah sakit)\s+/i, '')
  if (!q) return []

  const list = [...PUSKESMAS_GORONTALO, ...RUMAH_SAKIT_GORONTALO]

  return list
    .filter((f) => {
      if (kabupatenId && f.kabupatenId !== kabupatenId) return false
      if (jenis && f.jenis !== jenis) return false
      const fnama = f.nama.toLowerCase()
      return fnama.includes(q) || q.includes(fnama.replace(/^(puskesmas|rsud|rs)\s+/i, ''))
    })
    .slice(0, 3)
}
