export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  role: 'doctor' | 'secretary' | 'admin';
  crm?: string;
  specialty?: string;
  doctor_id?: string;
  is_admin?: boolean;
  doctor?: UserProfile;
  created_at: string;
}

export interface UserSurgeryRequest {
  id: string;
  user_profile_id: string;
  patient_name: string;
  patient_cpf: string;
  patient_birth_date: string;
  patient_contact: string;
  procedure_description: string;
  urgency_level: 'low' | 'medium' | 'high' | 'urgent';
  preferred_date?: string;
  observations?: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_progress';
  created_at: string;
  user_profile?: UserProfile;
}

export interface UserBudgetTracking {
  id: string;
  surgery_request_id: string;
  budget_id?: string;
  status: 'in_progress' | 'awaiting_patient' | 'approved' | 'revision_requested' | 'rejected';
  user_approval?: 'approved' | 'revision_requested' | 'rejected';
  user_feedback?: string;
  created_at: string;
  updated_at: string;
  surgery_request?: UserSurgeryRequest;
  budget?: any;
}