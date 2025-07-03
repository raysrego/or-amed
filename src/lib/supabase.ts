import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check for missing or placeholder values
const isPlaceholderUrl = !supabaseUrl || 
  supabaseUrl.includes('ixqjqjqjqjqjqjqj') || 
  supabaseUrl === 'your-project-url' ||
  supabaseUrl === 'https://your-project-id.supabase.co';

const isPlaceholderKey = !supabaseAnonKey || 
  supabaseAnonKey.includes('example_key_here') || 
  supabaseAnonKey === 'your-anon-key' ||
  supabaseAnonKey === 'your-anon-key-here';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
  console.error('Current values:');
  console.error('VITE_SUPABASE_URL:', supabaseUrl || 'undefined');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '[HIDDEN]' : 'undefined');
}

if (isPlaceholderUrl || isPlaceholderKey) {
  console.warn('⚠️ Placeholder Supabase credentials detected');
  console.warn('For production use, please:');
  console.warn('1. Create a Supabase project at https://supabase.com');
  console.warn('2. Go to Settings > API in your Supabase dashboard');
  console.warn('3. Copy your Project URL and anon/public key');
  console.warn('4. Update your .env file with the real values');
  console.warn('Current URL:', supabaseUrl);
  console.warn('Key status:', isPlaceholderKey ? 'Placeholder detected' : 'Appears valid');
}

// Create Supabase client with fallback for development
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
      'apikey': supabaseAnonKey
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

// Test connection only if we have valid credentials
if (supabaseUrl && supabaseAnonKey && !isPlaceholderUrl && !isPlaceholderKey) {
  supabase.from('user_profiles').select('count', { count: 'exact', head: true })
    .then(({ error }) => {
      if (error) {
        console.error('❌ Database connection test failed:', error.message);
        console.error('Please verify your Supabase project is active and your credentials are correct.');
      } else {
        console.log('✅ Database connection successful');
      }
    })
    .catch((err) => {
      console.error('❌ Network error connecting to Supabase:', err.message);
      console.error('Please check your internet connection and Supabase project status.');
    });
} else {
  console.log('⏳ Supabase client created with placeholder credentials - connection test skipped');
}

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