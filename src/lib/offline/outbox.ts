import { getOfflineDB, type SkriningOutboxItem, type BalitaLokalItem, type StatusSinkron } from './db'

/**
 * Antrean skrining offline.
 *
 * ==========================================================================
 * TEMUAN AUDIT S-3: `sedang_kirim` DAHULU ADALAH KEADAAN AKHIR
 *
 * `jalankanSinkronisasi` menandai baris `sedang_kirim` SEBELUM memanggil
 * jaringan, sedangkan kedua fungsi di bawah dahulu hanya mengambil `tertunda`
 * dan `gagal`, dan tidak ada satu pun jalur kode yang pernah mengembalikan
 * `sedang_kirim` ke keadaan lain.
 *
 * Akibatnya, bila kader menutup tab atau Android mematikan aplikasi tepat saat
 * POST sedang berjalan — kejadian sehari-hari di posyandu — barisnya menjadi
 * tidak terkirim DAN tidak terlihat: `hitungAntreanTertunda()` mengembalikan 0,
 * sehingga penunjuk di layar mengatakan tidak ada yang menunggu. Kader tidak
 * punya isyarat apa pun bahwa penimbangan itu harus dicatat ulang.
 *
 * Sekarang `sedang_kirim` ikut diambil kembali. Ini aman karena server
 * idempoten terhadap `client_uuid`: pengiriman ganda menghasilkan jawaban
 * duplikat, bukan baris ganda.
 * ==========================================================================
 */

/** Keadaan yang masih perlu dikirim. `terkirim` dan `ditolak` sudah selesai. */
const PERLU_DIKIRIM: StatusSinkron[] = ['tertunda', 'gagal', 'sedang_kirim']

/** Banyaknya percobaan gagal sebelum sebuah baris dinyatakan perlu campur tangan. */
export const BATAS_PERCOBAAN = 5

/**
 * Menyimpan skrining ke antrean outbox IndexedDB.
 */
export async function simpanKeOutbox(item: Omit<SkriningOutboxItem, 'statusSinkron' | 'dibuatPada'>): Promise<void> {
  const db = await getOfflineDB()
  const dataLengkap: SkriningOutboxItem = {
    ...item,
    statusSinkron: 'tertunda',
    dibuatPada: new Date().toISOString(),
    percobaan: 0,
  }
  await db.put('outbox_skrining', dataLengkap)
}

/**
 * Mengambil daftar skrining yang belum tersinkronisasi.
 */
export async function ambilSkriningTertunda(): Promise<SkriningOutboxItem[]> {
  const db = await getOfflineDB()
  const semua = await db.getAll('outbox_skrining')
  return semua.filter((s) => PERLU_DIKIRIM.includes(s.statusSinkron))
}

/**
 * Menghitung jumlah antrean outbox yang belum terkirim.
 */
export async function hitungAntreanTertunda(): Promise<number> {
  const db = await getOfflineDB()
  const semua = await db.getAll('outbox_skrining')
  return semua.filter((s) => PERLU_DIKIRIM.includes(s.statusSinkron)).length
}

/**
 * Baris yang ditolak permanen dan menunggu campur tangan kader.
 *
 * WAJIB ditampilkan terpisah. Baris ini tidak akan terkirim sendiri, jadi
 * menyembunyikannya berarti menghilangkan penimbangan tanpa jejak.
 */
export async function ambilSkriningDitolak(): Promise<SkriningOutboxItem[]> {
  const db = await getOfflineDB()
  const semua = await db.getAll('outbox_skrining')
  return semua.filter((s) => s.statusSinkron === 'ditolak')
}

export async function hitungAntreanDitolak(): Promise<number> {
  return (await ambilSkriningDitolak()).length
}

/**
 * Memperbarui status item outbox.
 *
 * Percobaan gagal dihitung, supaya `jalankanSinkronisasi` dapat berhenti
 * mencoba dan meminta campur tangan alih-alih berputar tanpa ujung.
 */
export async function updateStatusOutbox(
  clientUuid: string,
  status: StatusSinkron,
  pesanGalat?: string,
  /**
   * `false` untuk kegagalan yang BUKAN salah datanya, yaitu jaringan mati.
   * Keadaan itu justru wajib dicoba lagi, jadi tidak boleh menghabiskan kuota
   * percobaan — kader di posyandu tanpa sinyal bisa gagal berkali-kali dalam
   * satu hari tanpa ada yang salah pada penimbangannya.
   */
  hitungPercobaan = true,
): Promise<void> {
  const db = await getOfflineDB()
  const item = await db.get('outbox_skrining', clientUuid)
  if (!item) return

  item.statusSinkron = status
  if (pesanGalat !== undefined) item.pesanGalat = pesanGalat
  if (status === 'terkirim') item.waktuKirim = new Date().toISOString()
  if (hitungPercobaan && (status === 'gagal' || status === 'ditolak')) {
    item.percobaan = (item.percobaan ?? 0) + 1
  }

  await db.put('outbox_skrining', item)
}

/** Membaca satu baris antrean. Dipakai untuk memeriksa jumlah percobaannya. */
export async function ambilItemOutbox(clientUuid: string): Promise<SkriningOutboxItem | undefined> {
  const db = await getOfflineDB()
  return db.get('outbox_skrining', clientUuid)
}

/**
 * Menyimpan cache daftar balita ke IndexedDB untuk keperluan offline posyandu.
 */
export async function simpanCacheBalita(balitaList: BalitaLokalItem[]): Promise<void> {
  const db = await getOfflineDB()
  const tx = db.transaction('cache_balita', 'readwrite')
  for (const b of balitaList) {
    await tx.store.put(b)
  }
  await tx.done
}

/**
 * Mengambil balita dari cache IndexedDB.
 */
export async function ambilCacheBalita(posyanduId?: string): Promise<BalitaLokalItem[]> {
  const db = await getOfflineDB()
  if (posyanduId) {
    return db.getAllFromIndex('cache_balita', 'by-posyandu', posyanduId)
  }
  return db.getAll('cache_balita')
}
