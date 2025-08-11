import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables not found');
  console.warn('The app will use fallback configuration');
}

// Create Supabase client with fallback values to prevent crashes
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'cirplane-auth-token',
    debug: false
  },
  global: {
    headers: {
      'X-Client-Info': 'cirplane-web',
      'apikey': supabaseAnonKey || 'placeholder-key'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
});

// Database types
export interface Patient {
  id: string;
  name: string;
  address: string;
  contact: string;
  cpf: string;
  birth_date: string;
  comorbidities: string[];
  parent_name?: string;
  parent_cpf?: string;
  created_at: string;
}

export interface Doctor {
  id: string;
  name: string;
  cpf: string;
  crm: string;
  contact: string;
  pix_key: string;
  specialty?: string;
  user_id?: string;
  email?: string;
  created_at: string;
}

export interface Procedure {
  id: string;
  name: string;
  created_at: string;
}

export interface AnesthesiaType {
  id: string;
  type: string;
  created_at: string;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  contact: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  cnpj: string;
  created_at: string;
}

export interface OPME {
  id: string;
  name: string;
  brand: string;
  supplier_id: string;
  supplier?: Supplier;
  created_at: string;
}

export interface SurgeryRequest {
  id: string;
  patient_id: string;
  doctor_id: string;
  opme_requests: any;
  anesthesia_id: string;
  needs_icu: boolean;
  icu_days?: number;
  ward_days?: number;
  room_days?: number;
  hospital_equipment: string[];
  exams_during_stay: string[];
  procedure_duration: string;
  doctor_fee: number;
  blood_reserve: boolean;
  blood_units?: number;
  evoked_potential: boolean;
  created_at: string;
  patient?: Patient;
  doctor?: Doctor;
  anesthesia_type?: AnesthesiaType;
  procedures?: Procedure[];
}

export interface Budget {
  id: string;
  surgery_request_id: string;
  hospital_id: string;
  opme_quotes: any;
  icu_daily_cost?: number;
  ward_daily_cost?: number;
  room_daily_cost?: number;
  anesthetist_fee?: number;
  doctor_fee: number;
  evoked_potential_fee?: number;
  total_cost?: number;
  status: 'APPROVED' | 'AWAITING_QUOTE' | 'AWAITING_PATIENT' | 'AWAITING_PAYMENT' | 'CANCELED';
  created_at: string;
  surgery_request?: SurgeryRequest;
  hospital?: Hospital;
}

export interface AuditLog {
  id: string;
  budget_id: string;
  action: string;
  details: any;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  old_role: string;
  role: 'doctor' | 'secretary' | 'admin';
  crm?: string;
  specialty?: string;
  doctor_id?: string;
  is_admin?: boolean;
  email?: string;
  doctor?: UserProfile;
  created_at: string;
}