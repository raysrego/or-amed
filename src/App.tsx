import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/patients" element={<Patients />} />
                    <Route path="/doctors" element={<div>Médicos em desenvolvimento</div>} />
                    <Route path="/procedures" element={<div>Procedimentos em desenvolvimento</div>} />
                    <Route path="/hospitals" element={<div>Hospitais em desenvolvimento</div>} />
                    <Route path="/suppliers" element={<div>Fornecedores em desenvolvimento</div>} />
                    <Route path="/opmes" element={<div>OPMEs em desenvolvimento</div>} />
                    <Route path="/surgery-requests" element={<div>Pedidos de Cirurgia em desenvolvimento</div>} />
                    <Route path="/budgets" element={<div>Orçamentos em desenvolvimento</div>} />
                    <Route path="/audit-logs" element={<div>Logs de Auditoria em desenvolvimento</div>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;