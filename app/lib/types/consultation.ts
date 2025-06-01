// 상담 관리 시스템 타입 정의

export interface NotionConsultationData {
  id: string;
  consultation_id: string;
  customer_id: string;
  consult_date: string;
  symptoms: string;
  patient_condition?: string;
  tongue_analysis?: string;
  special_notes?: string;
  prescription?: string;
  result?: string;
  image_files: NotionImageFile[];
  created_at: string;
}

export interface NotionImageFile {
  name: string;
  type: 'external' | 'file';
  external?: { url: string };
  file?: { url: string; expiry_time: string };
}

export interface SupabaseConsultationData {
  id?: string;
  consultation_id: string;
  customer_id: string;
  consult_date: string;
  symptoms: string;
  patient_condition?: string;
  tongue_analysis?: string;
  special_notes?: string;
  prescription?: string;
  result?: string;
  image_urls: string[];
  created_at?: string;
  updated_at?: string;
}

export interface MigrationProgress {
  total: number;
  completed: number;
  failed: number;
  errors: MigrationError[];
}

export interface MigrationError {
  consultation_id: string;
  error: string;
  timestamp: string;
}

// Supabase 데이터베이스 타입 (자동 생성될 예정)
export interface Database {
  public: {
    Tables: {
      consultations: {
        Row: SupabaseConsultationData;
        Insert: Omit<SupabaseConsultationData, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SupabaseConsultationData, 'id' | 'created_at'>>;
      };
      consultation_migration_log: {
        Row: {
          id: string;
          consultation_id: string;
          migration_status: 'pending' | 'completed' | 'failed';
          notion_id?: string;
          supabase_id?: string;
          image_count: number;
          migrated_image_count: number;
          error_message?: string;
          created_at: string;
          completed_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['consultation_migration_log']['Row'], 'id' | 'created_at'>;
        Update: Partial<Omit<Database['public']['Tables']['consultation_migration_log']['Row'], 'id' | 'created_at'>>;
      };
    };
  };
} 