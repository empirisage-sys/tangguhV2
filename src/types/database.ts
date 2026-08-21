export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      provinsi: {
        Row: {
          id: string
          kode: string
          nama: string
          created_at: string
        }
        Insert: {
          id?: string
          kode: string
          nama: string
          created_at?: string
        }
        Update: {
          id?: string
          kode?: string
          nama?: string
          created_at?: string
        }
        Relationships: []
      }
      kabupaten: {
        Row: {
          id: string
          kode: string
          nama: string
          provinsi_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          kode: string
          nama: string
          provinsi_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          kode?: string
          nama?: string
          provinsi_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      faskes: {
        Row: {
          id: string
          nama: string
          jenis: 'puskesmas' | 'rumah_sakit'
          status: 'master' | 'usulan'
          kabupaten_id: string | null
          diusulkan_oleh: string | null
          sumber_data: string
          kode_kemenkes: string | null
          perlu_verifikasi: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nama: string
          jenis?: 'puskesmas' | 'rumah_sakit'
          status?: 'master' | 'usulan'
          kabupaten_id?: string | null
          diusulkan_oleh?: string | null
          sumber_data?: string
          kode_kemenkes?: string | null
          perlu_verifikasi?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nama?: string
          jenis?: 'puskesmas' | 'rumah_sakit'
          status?: 'master' | 'usulan'
          kabupaten_id?: string | null
          diusulkan_oleh?: string | null
          sumber_data?: string
          kode_kemenkes?: string | null
          perlu_verifikasi?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      puskesmas: {
        Row: {
          id: string
          kabupaten_id: string
          nama: string
          created_at: string
        }
        Insert: {
          id?: string
          kabupaten_id: string
          nama: string
          created_at?: string
        }
        Update: {
          id?: string
          kabupaten_id?: string
          nama?: string
          created_at?: string
        }
        Relationships: []
      }
      posyandu: {
        Row: {
          id: string
          puskesmas_id: string
          kabupaten_id: string
          nama: string
          desa: string | null
          status: 'master' | 'usulan'
          diusulkan_oleh: string | null
          created_at: string
        }
        Insert: {
          id?: string
          puskesmas_id: string
          kabupaten_id: string
          nama: string
          desa?: string | null
          status?: 'master' | 'usulan'
          diusulkan_oleh?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          puskesmas_id?: string
          kabupaten_id?: string
          nama?: string
          desa?: string | null
          status?: 'master' | 'usulan'
          diusulkan_oleh?: string | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          nama_lengkap: string
          role: string
          no_hp: string | null
          no_str: string | null
          provinsi_id: string | null
          kabupaten_id: string | null
          faskes_id: string | null
          puskesmas_id: string | null
          posyandu_id: string | null
          jenis_faskes: 'puskesmas' | 'rumah_sakit' | null
          status_akun: string
          alasan_tolak: string | null
          diverifikasi_oleh: string | null
          diverifikasi_pada: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nama_lengkap: string
          role?: string
          no_hp?: string | null
          no_str?: string | null
          provinsi_id?: string | null
          kabupaten_id?: string | null
          faskes_id?: string | null
          puskesmas_id?: string | null
          posyandu_id?: string | null
          jenis_faskes?: 'puskesmas' | 'rumah_sakit' | null
          status_akun?: string
          alasan_tolak?: string | null
          diverifikasi_oleh?: string | null
          diverifikasi_pada?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nama_lengkap?: string
          role?: string
          no_hp?: string | null
          no_str?: string | null
          kabupaten_id?: string | null
          puskesmas_id?: string | null
          posyandu_id?: string | null
          status_akun?: string
          alasan_tolak?: string | null
          diverifikasi_oleh?: string | null
          diverifikasi_pada?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      balita: {
        Row: {
          id: string
          nama: string
          nik: string | null
          tanggal_lahir: string
          jenis_kelamin: string
          nama_ibu: string | null
          nama_ayah: string | null
          no_hp_ortu: string | null
          alamat: string | null
          bb_lahir_gram: number | null
          pb_lahir_cm: number | null
          posyandu_id: string
          puskesmas_id: string
          kabupaten_id: string
          created_by: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          nama: string
          nik?: string | null
          tanggal_lahir: string
          jenis_kelamin: string
          nama_ibu?: string | null
          nama_ayah?: string | null
          no_hp_ortu?: string | null
          alamat?: string | null
          bb_lahir_gram?: number | null
          pb_lahir_cm?: number | null
          posyandu_id: string
          puskesmas_id: string
          kabupaten_id: string
          created_by: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          nama?: string
          nik?: string | null
          tanggal_lahir?: string
          jenis_kelamin?: string
          nama_ibu?: string | null
          nama_ayah?: string | null
          no_hp_ortu?: string | null
          alamat?: string | null
          bb_lahir_gram?: number | null
          pb_lahir_cm?: number | null
          posyandu_id?: string
          puskesmas_id?: string
          kabupaten_id?: string
          created_by?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      skrining: {
        Row: {
          id: string
          client_uuid: string
          balita_id: string
          tanggal_periksa: string
          umur_hari: number
          umur_bulan: number
          berat_kg: number
          panjang_cm: number
          posisi_ukur: string
          panjang_terkoreksi_cm: number
          lila_cm: number | null
          lingkar_kepala_cm: number | null
          edema: boolean
          z_bbu: number | null
          z_tbu: number | null
          z_bbtb: number | null
          status_bbu: string | null
          status_tbu: string | null
          status_bbtb: string | null
          is_red_flag: boolean
          bb_ideal_kg: number | null
          usia_tinggi_bulan: number | null
          rda_kkal_per_kg: number | null
          kalori_target_kkal: number | null
          protein_min_gram: number | null
          protein_max_gram: number | null
          kalori_catchup_kkal: number | null
          protein_catchup_min_gram: number | null
          protein_catchup_max_gram: number | null
          kalori_metode: string
          di_luar_rentang: boolean
          catatan_di_luar_rentang: string | null
          engine_version: string
          dihitung_di: string
          catatan: string | null
          posyandu_id: string
          puskesmas_id: string
          kabupaten_id: string
          created_by: string
          asal_data: string
          ref_firestore_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          client_uuid: string
          balita_id: string
          tanggal_periksa: string
          umur_hari: number
          umur_bulan: number
          berat_kg: number
          panjang_cm: number
          posisi_ukur?: string
          panjang_terkoreksi_cm: number
          lila_cm?: number | null
          lingkar_kepala_cm?: number | null
          edema?: boolean
          z_bbu?: number | null
          z_tbu?: number | null
          z_bbtb?: number | null
          status_bbu?: string | null
          status_tbu?: string | null
          status_bbtb?: string | null
          is_red_flag?: boolean
          bb_ideal_kg?: number | null
          usia_tinggi_bulan?: number | null
          rda_kkal_per_kg?: number | null
          kalori_target_kkal?: number | null
          protein_min_gram?: number | null
          protein_max_gram?: number | null
          kalori_catchup_kkal?: number | null
          protein_catchup_min_gram?: number | null
          protein_catchup_max_gram?: number | null
          kalori_metode?: string
          di_luar_rentang?: boolean
          catatan_di_luar_rentang?: string | null
          engine_version: string
          dihitung_di?: string
          catatan?: string | null
          posyandu_id: string
          puskesmas_id: string
          kabupaten_id: string
          created_by: string
          asal_data?: string
          ref_firestore_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          client_uuid?: string
          balita_id?: string
          tanggal_periksa?: string
          umur_hari?: number
          umur_bulan?: number
          berat_kg?: number
          panjang_cm?: number
          posisi_ukur?: string
          panjang_terkoreksi_cm?: number
          lila_cm?: number | null
          lingkar_kepala_cm?: number | null
          edema?: boolean
          z_bbu?: number | null
          z_tbu?: number | null
          z_bbtb?: number | null
          status_bbu?: string | null
          status_tbu?: string | null
          status_bbtb?: string | null
          is_red_flag?: boolean
          bb_ideal_kg?: number | null
          usia_tinggi_bulan?: number | null
          rda_kkal_per_kg?: number | null
          kalori_target_kkal?: number | null
          protein_min_gram?: number | null
          protein_max_gram?: number | null
          kalori_catchup_kkal?: number | null
          protein_catchup_min_gram?: number | null
          protein_catchup_max_gram?: number | null
          kalori_metode?: string
          di_luar_rentang?: boolean
          catatan_di_luar_rentang?: string | null
          engine_version?: string
          dihitung_di?: string
          catatan?: string | null
          posyandu_id?: string
          puskesmas_id?: string
          kabupaten_id?: string
          created_by?: string
          asal_data?: string
          ref_firestore_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      produk_pkmk: {
        Row: {
          id: string
          nama: string
          merek: string
          kkal_per_ml: number
          sendok_per_saji: number | null
          kkal_per_saji: number | null
          ml_per_saji: number | null
          ml_air_per_sendok: number | null
          densitas_kkal_per_ml: number | null
          kkal_per_sendok: number | null
          min_usia_bulan: number
          anjuran_klinis: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nama: string
          merek: string
          kkal_per_ml: number
          sendok_per_saji?: number | null
          kkal_per_saji?: number | null
          ml_per_saji?: number | null
          ml_air_per_sendok?: number | null
          densitas_kkal_per_ml?: number | null
          min_usia_bulan?: number
          anjuran_klinis?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nama?: string
          merek?: string
          kkal_per_ml?: number
          sendok_per_saji?: number | null
          kkal_per_saji?: number | null
          ml_per_saji?: number | null
          ml_air_per_sendok?: number | null
          densitas_kkal_per_ml?: number | null
          min_usia_bulan?: number
          anjuran_klinis?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_rekap_bulanan: {
        Row: {
          kabupaten_id: string
          puskesmas_id: string
          posyandu_id: string
          bulan: string
          total_skrining: number
          total_balita: number
          jumlah_di_luar_rentang: number
          jumlah_stunting: number
          jumlah_sangat_pendek: number
          jumlah_gizi_buruk: number
          jumlah_gizi_kurang: number
          jumlah_lila_gizi_buruk: number
          jumlah_edema: number
          jumlah_red_flag: number
          jumlah_target_catchup: number
          penyebut_tbu: number
          penyebut_bbtb: number
          rerata_z_tbu: number | null
        }
        Relationships: []
      }
      v_antrean_verifikasi: {
        Row: {
          id: string
          nama_lengkap: string
          role: string
          no_hp: string | null
          no_str: string | null
          nama_kabupaten: string | null
          nama_puskesmas: string | null
          nama_posyandu: string | null
          desa: string | null
          diajukan_pada: string
        }
        Relationships: []
      }
    }
    Functions: {
      verifikasi_pengguna: {
        Args: {
          p_pengguna_id: string
          p_setujui: boolean
          p_alasan?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
