/**
 * Uji pengunci Tahap 2a: pemetaan baris Supabase menjadi bentuk layar.
 *
 * Lapisan ini adalah tempat paling mudah salah di seluruh patch: nama kolom
 * ditulis sebagai teks, satuan berbeda antara database dan layar, dan urutan
 * riwayat menentukan benar-tidaknya kurva pertumbuhan. Tidak ada pemeriksa tipe
 * yang menangkap `bb_lahir_gram` yang keliru dibaca sebagai kilogram.
 */
import { describe, expect, it } from 'vitest'
import { petakanBalitaKeDetail, petakanSkriningKeRiwayat, kunjunganTerakhir } from '@/lib/db/balita'

const barisBalita = {
  id: 'b-1',
  nik: '7571010101010001',
  nama: 'Aisyah Putri',
  tanggal_lahir: '2024-09-09',
  jenis_kelamin: 'P',
  nama_ibu: 'Ibu Sari',
  nama_ayah: 'Bapak Budi',
  no_hp_ortu: '0811000111',
  alamat: 'Jl. Contoh 1',
  posyandu_id: 'p-1',
  puskesmas_id: 'pk-1',
  kabupaten_id: 'kb-1',
  bb_lahir_gram: 3200,
  pb_lahir_cm: 49.5,
  usia_gestasi_minggu: 38,
  created_by: 'u-1',
  posyandu: { nama: 'Posyandu Melati' },
  puskesmas: { nama: 'Puskesmas Pilolodaa' },
  kabupaten: { nama: 'Kota Gorontalo' },
}

function barisSkrining(tanggal: string, berat: number, tambahan: Record<string, unknown> = {}) {
  return {
    id: `s-${tanggal}`,
    balita_id: 'b-1',
    tanggal_periksa: tanggal,
    umur_bulan: 24.5,
    berat_kg: berat,
    panjang_cm: 87,
    panjang_terkoreksi_cm: 87.7,
    posisi_ukur: 'recumbent',
    lila_cm: 13.2,
    edema: false,
    z_bbu: -1.234,
    z_tbu: -2.5,
    z_bbtb: -0.5,
    status_bbu: 'berat_badan_kurang',
    status_tbu: 'pendek',
    status_bbtb: 'gizi_baik',
    is_red_flag: false,
    di_luar_rentang: false,
    catatan_di_luar_rentang: null,
    kalori_target_kkal: 900,
    kalori_catchup_kkal: 1143,
    ...tambahan,
  }
}

describe('pemetaan balita dari Supabase', () => {
  it('berat lahir GRAM menjadi KILOGRAM', () => {
    const b = petakanBalitaKeDetail(barisBalita)
    // Kolom database bernama bb_lahir_gram. Membacanya apa adanya akan
    // menampilkan "3200 kg" di layar rincian balita.
    expect(b.bbLahirKg).toBe(3.2)
    expect(b.pbLahirCm).toBe(49.5)
  })

  it('berat lahir kosong tidak menjadi nol', () => {
    const b = petakanBalitaKeDetail({ ...barisBalita, bb_lahir_gram: null })
    // Nol berarti "ditimbang 0 kg", bukan "tidak dicatat".
    expect(b.bbLahirKg).toBeUndefined()
  })

  it('nama wilayah terbaca baik dari objek maupun dari senarai', () => {
    const objek = petakanBalitaKeDetail(barisBalita)
    expect(objek.namaPosyandu).toBe('Posyandu Melati')
    expect(objek.namaPuskesmas).toBe('Puskesmas Pilolodaa')
    expect(objek.namaKabupaten).toBe('Kota Gorontalo')

    // Supabase mengembalikan relasi sebagai senarai pada beberapa bentuk kueri.
    const senarai = petakanBalitaKeDetail({
      ...barisBalita,
      posyandu: [{ nama: 'Posyandu Melati' }],
      puskesmas: [{ nama: 'Puskesmas Pilolodaa' }],
      kabupaten: [{ nama: 'Kota Gorontalo' }],
    })
    expect(senarai.namaPosyandu).toBe('Posyandu Melati')
    expect(senarai.namaKabupaten).toBe('Kota Gorontalo')
  })

  it('relasi wilayah yang hilang menjadi teks kosong, bukan melempar', () => {
    const b = petakanBalitaKeDetail({ ...barisBalita, posyandu: null, puskesmas: undefined })
    expect(b.namaPosyandu).toBe('')
    expect(b.namaPuskesmas).toBe('')
  })

  it('jenis kelamin selain P selalu menjadi L', () => {
    expect(petakanBalitaKeDetail({ ...barisBalita, jenis_kelamin: 'L' }).jenisKelamin).toBe('L')
    expect(petakanBalitaKeDetail({ ...barisBalita, jenis_kelamin: 'P' }).jenisKelamin).toBe('P')
    expect(petakanBalitaKeDetail({ ...barisBalita, jenis_kelamin: null }).jenisKelamin).toBe('L')
  })
})

describe('pemetaan riwayat skrining', () => {
  it('riwayat diurutkan dari paling lama ke paling baru', () => {
    // Kueri mengambil TERBARU lebih dahulu supaya batas jumlahnya bermakna.
    // Kurva pertumbuhan dan evaluasi kenaikan berat menuntut urutan sebaliknya;
    // bila terbalik, `hitungVelocity` akan menerima tanggal akhir yang lebih
    // awal daripada tanggal awal dan melaporkan 'urutan_tanggal_salah'.
    const b = petakanBalitaKeDetail(barisBalita, [
      barisSkrining('2026-09-09', 11.0),
      barisSkrining('2026-08-09', 10.6),
      barisSkrining('2026-07-09', 10.2),
    ])

    expect(b.riwayat.map((r) => r.tanggal)).toEqual([
      '2026-07-09',
      '2026-08-09',
      '2026-09-09',
    ])
    expect(kunjunganTerakhir(b)?.tanggal).toBe('2026-09-09')
    expect(kunjunganTerakhir(b)?.beratKg).toBe(11.0)
  })

  it('nilai Z dibaca apa adanya, tidak dihitung ulang', () => {
    // Yang tersimpan adalah hasil hitung server saat pencatatan, dan itulah
    // rekam medisnya. Menghitung ulang saat menampilkan membuat angka di layar
    // berbeda dari angka yang tercatat begitu mesin naik versi.
    const r = petakanSkriningKeRiwayat(barisSkrining('2026-09-09', 11.0))
    expect(r.zBbu).toBe(-1.234)
    expect(r.z_bbu).toBe(-1.234)
    expect(r.zTbu).toBe(-2.5)
    expect(r.statusTBU).toBe('pendek')
    expect(r.statusBBTB).toBe('gizi_baik')
  })

  it('id baris skrining ikut terbawa', () => {
    // Dibutuhkan agar peresepan PKMK dapat menyebut skrining yang menjadi
    // dasarnya (temuan audit P-3). Tanpa id, server jatuh ke skrining terbaru.
    const r = petakanSkriningKeRiwayat(barisSkrining('2026-09-09', 11.0))
    expect(r.id).toBe('s-2026-09-09')
  })

  it('kebutuhan energi tumbuh kejar terbawa dari kolomnya', () => {
    // Inilah angka yang dahulu digantikan literal 770 di panel PKMK (P-1).
    const r = petakanSkriningKeRiwayat(barisSkrining('2026-09-09', 11.0))
    expect(r.kaloriCatchUpKkal).toBe(1143)
    expect(r.kaloriPemeliharaanKkal).toBe(900)
  })

  it('kebutuhan tumbuh kejar yang null tetap null, bukan nol', () => {
    const r = petakanSkriningKeRiwayat(
      barisSkrining('2026-09-09', 11.0, { kalori_catchup_kkal: null }),
    )
    // Nol akan membuat panel PKMK menghitung target 0 kkal; null membuatnya
    // menolak menghitung, yang benar.
    expect(r.kaloriCatchUpKkal).toBeNull()
  })

  it('posisi ukur diterjemahkan dari enum database', () => {
    expect(petakanSkriningKeRiwayat(barisSkrining('2026-09-09', 11, { posisi_ukur: 'recumbent' })).posisiUkur).toBe('terlentang')
    expect(petakanSkriningKeRiwayat(barisSkrining('2026-09-09', 11, { posisi_ukur: 'standing' })).posisiUkur).toBe('berdiri')
    expect(petakanSkriningKeRiwayat(barisSkrining('2026-09-09', 11, { posisi_ukur: 'auto' })).posisiUkur).toBe('otomatis')
  })

  it('panjang terkoreksi dipakai kurva, panjang mentah tetap tersimpan', () => {
    const r = petakanSkriningKeRiwayat(barisSkrining('2026-09-09', 11.0))
    expect(r.panjangCm).toBe(87)
    expect(r.panjangTerkoreksiCm).toBe(87.7)
  })

  it('penanda rujukan dan keadaan di luar rentang terbawa', () => {
    const r = petakanSkriningKeRiwayat(
      barisSkrining('2026-09-09', 8.0, {
        is_red_flag: true,
        di_luar_rentang: true,
        catatan_di_luar_rentang: 'Periksa ulang timbangan.',
        edema: true,
      }),
    )
    expect(r.isRedFlag).toBe(true)
    expect(r.diLuarRentang).toBe(true)
    expect(r.catatanDiLuarRentang).toContain('Periksa ulang')
    expect(r.edema).toBe(true)
  })

  it('balita tanpa riwayat tidak melempar', () => {
    const b = petakanBalitaKeDetail(barisBalita, [])
    expect(b.riwayat).toEqual([])
    expect(kunjunganTerakhir(b)).toBeNull()
  })
})
