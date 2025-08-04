# CirPlane API

API Express para gerenciamento de usuários do sistema CirPlane.

## 🚀 Instalação

```bash
cd api
npm install
```

## ⚙️ Configuração

1. Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

2. Configure as variáveis no arquivo `.env`:
```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
NODE_ENV=development
```

## 🏃‍♂️ Executar

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm start
```

## 📋 Rotas da API

### Health Check
```http
GET /api/health
```

### Criar Usuário
```http
POST /api/admin/create-user
Content-Type: application/json

{
  "email": "usuario@exemplo.com",
  "password": "senha123", // opcional
  "name": "Nome do Usuário",
  "role": "doctor", // admin, doctor, secretary
  "crm": "123456", // obrigatório para doctor
  "specialty": "Cardiologia", // obrigatório para doctor
  "doctor_id": "uuid" // obrigatório para secretary
}
```

### Listar Médicos
```http
GET /api/doctors
```

## 📝 Regras de Negócio

### Administrador (`admin`)
- `is_admin: true`
- Não precisa de CRM ou especialidade

### Médico (`doctor`)
- `is_admin: false`
- Obrigatório: `crm`, `specialty`
- Criado também na tabela `doctors`

### Secretária (`secretary`)
- `is_admin: false`
- Obrigatório: `doctor_id` (vinculação com médico)

## 🔒 Validações

- Email deve ser válido
- Não permite emails duplicados
- Campos obrigatórios por role
- Verifica se médico existe ao vincular secretária
- Senha gerada automaticamente se não informada

## 🛠️ Tecnologias

- Node.js
- Express.js
- Supabase (Auth + Database)
- CORS
- dotenv