import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { MasukanSkrining } from '@/lib/validasi/skrining'
import type { HasilSkrining } from '@/lib/zscore/tipe'

export type SkriningOutboxItem = {
  clientUuid: string
  balitaId: string
  masukan: MasukanSkrining
  hasilLokal: HasilSkrining
  namaBalita: string
  posyanduId: string
  puskesmasId: string
  kabupatenId: string
  dibuatPada: string
  statusSinkron: 'tertunda' | 'sedang_kirim' | 'terkirim' | 'gagal'
  pesanGalat?: string
  waktuKirim?: string
}

export type BalitaLokalItem = {
  id: string
  nama: string
  nik?: string
  tanggalLahir: string
  jenisKelamin: 'L' | 'P'
  namaIbu?: string
  posyanduId: string
  puskesmasId: string
  kabupatenId: string
  terakhirDiperbarui: string
}

interface TangguhDB extends DBSchema {
  outbox_skrining: {
    key: string
    value: SkriningOutboxItem
    indexes: {
      'by-status': string
      'by-balita': string
      'by-tanggal': string
    }
  }
  cache_balita: {
    key: string
    value: BalitaLokalItem
    indexes: {
      'by-posyandu': string
      'by-nama': string
    }
  }
}

const DB_NAME = 'tangguh_offline_db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<TangguhDB>> | null = null

export function getOfflineDB(): Promise<IDBPDatabase<TangguhDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB hanya tersedia di browser'))
  }

  if (!dbPromise) {
    dbPromise = openDB<TangguhDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('outbox_skrining')) {
          const store = db.createObjectStore('outbox_skrining', {
            keyPath: 'clientUuid',
          })
          store.createIndex('by-status', 'statusSinkron')
          store.createIndex('by-balita', 'balitaId')
          store.createIndex('by-tanggal', 'dibuatPada')
        }

        if (!db.objectStoreNames.contains('cache_balita')) {
          const storeBalita = db.createObjectStore('cache_balita', {
            keyPath: 'id',
          })
          storeBalita.createIndex('by-posyandu', 'posyanduId')
          storeBalita.createIndex('by-nama', 'nama')
        }
      },
    })
  }

  return dbPromise
}
