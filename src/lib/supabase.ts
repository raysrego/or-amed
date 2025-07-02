import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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