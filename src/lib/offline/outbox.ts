import { getOfflineDB, type SkriningOutboxItem, type BalitaLokalItem } from './db'

/**
 * Menyimpan skrining ke antrean outbox IndexedDB.
 */
export async function simpanKeOutbox(item: Omit<SkriningOutboxItem, 'statusSinkron' | 'dibuatPada'>): Promise<void> {
  const db = await getOfflineDB()
  const dataLengkap: SkriningOutboxItem = {
    ...item,
    statusSinkron: 'tertunda',
    dibuatPada: new Date().toISOString(),
  }
  await db.put('outbox_skrining', dataLengkap)
}

/**
 * Mengambil daftar skrining yang belum tersinkronisasi.
 */
export async function ambilSkriningTertunda(): Promise<SkriningOutboxItem[]> {
  const db = await getOfflineDB()
  const semua = await db.getAll('outbox_skrining')
  return semua.filter((s) => s.statusSinkron === 'tertunda' || s.statusSinkron === 'gagal')
}

/**
 * Menghitung jumlah antrean outbox yang belum terkirim.
 */
export async function hitungAntreanTertunda(): Promise<number> {
  const db = await getOfflineDB()
  const semua = await db.getAll('outbox_skrining')
  return semua.filter((s) => s.statusSinkron === 'tertunda' || s.statusSinkron === 'gagal').length
}

/**
 * Memperbarui status item outbox.
 */
export async function updateStatusOutbox(
  clientUuid: string,
  status: SkriningOutboxItem['statusSinkron'],
  pesanGalat?: string,
): Promise<void> {
  const db = await getOfflineDB()
  const item = await db.get('outbox_skrining', clientUuid)
  if (!item) return

  item.statusSinkron = status
  if (pesanGalat !== undefined) item.pesanGalat = pesanGalat
  if (status === 'terkirim') item.waktuKirim = new Date().toISOString()

  await db.put('outbox_skrining', item)
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
