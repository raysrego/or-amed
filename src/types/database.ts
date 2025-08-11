export interface Orcamento {
  id: string;
  paciente_id?: string;
  hospital_id?: string;
  medico_id?: string;
  data: string;
  status: 'aguardando' | 'aprovado' | 'recusado' | 'pago';
  valor_total?: number;
  forma_pagamento?: string;
  observacoes?: string;
  created_at: string;
  paciente?: Paciente;
  medico?: Medico;
  hospital?: Hospital;
}

export interface Paciente {
  id: string;
  nome: string;
  data_nascimento?: string;
  telefone?: string;
  email?: string;
  created_at: string;
}

export interface Medico {
  id: string;
  nome: string;
  crm: string;
  especialidade?: string;
  telefone?: string;
  email?: string;
  created_at: string;
}

export interface Hospital {
  id: string;
  nome: string;
  endereco?: string;
  possui_uti?: boolean;
  contato_setor_cirurgia?: string;
  contato_setor_marcacao?: string;
  created_at: string;
}