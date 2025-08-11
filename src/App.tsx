import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Procedures from './pages/Procedures';
import AnesthesiaTypes from './pages/AnesthesiaTypes';
import Hospitals from './pages/Hospitals';
import Suppliers from './pages/Suppliers';
import OPMEs from './pages/OPMEs';
import SurgeryRequests from './pages/SurgeryRequests';
import UserProfile from './pages/UserProfile';
import UserSurgeryRequest from './pages/UserSurgeryRequest';
import UserBudgetTracking from './pages/UserBudgetTracking';
import UserManagement from './pages/UserManagement';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      {/* Dashboard - Default route */}
                      <Route path="/" element={<Dashboard />} />
                      
                      {/* User Module Routes */}
                      <Route path="/user-profile" element={<UserProfile />} />
                      <Route path="/user-surgery-requests" element={
                        <ProtectedRoute roles={['doctor', 'secretary']}>
                          <UserSurgeryRequest />
                        </ProtectedRoute>
                      } />
                      <Route path="/user-budget-tracking" element={
                        <ProtectedRoute roles={['doctor', 'secretary']}>
                          <UserBudgetTracking />
                        </ProtectedRoute>
                      } />
                      
                      {/* System Routes with Role-based Access */}
                      <Route path="/patients" element={
                        <ProtectedRoute roles={['doctor', 'secretary']}>
                          <Patients />
                        </ProtectedRoute>
                      } />
                      <Route path="/doctors" element={
                        <ProtectedRoute adminOnly>
                          <Doctors />
                        </ProtectedRoute>
                      } />
                      <Route path="/procedures" element={
                        <ProtectedRoute roles={['doctor', 'secretary']}>
                          <Procedures />
                        </ProtectedRoute>
                      } />
                      <Route path="/anesthesia-types" element={
                        <ProtectedRoute adminOnly>
                          <AnesthesiaTypes />
                        </ProtectedRoute>
                      } />
                      <Route path="/hospitals" element={
                        <ProtectedRoute adminOnly>
                          <Hospitals />
                        </ProtectedRoute>
                      } />
                      <Route path="/suppliers" element={
                        <ProtectedRoute adminOnly>
                          <Suppliers />
                        </ProtectedRoute>
                      } />
                      <Route path="/opmes" element={
                        <ProtectedRoute roles={['doctor', 'secretary']}>
                          <OPMEs />
                        </ProtectedRoute>
                      } />
                      <Route path="/surgery-requests" element={
                        <ProtectedRoute roles={['doctor', 'secretary']}>
                          <SurgeryRequests />
                        </ProtectedRoute>
                      } />
                      <Route path="/budgets" element={
                        <div className="p-8">
                          <h1 className="text-3xl font-bold text-gray-900">Orçamentos</h1>
                          <p className="text-gray-600 mt-2">Módulo em desenvolvimento</p>
                        </div>
                      } />
                      <Route path="/audit-logs" element={
                        <div className="p-8">
                          <h1 className="text-3xl font-bold text-gray-900">Logs de Auditoria</h1>
                          <p className="text-gray-600 mt-2">Módulo em desenvolvimento</p>
                        </div>
                      } />
                      <Route path="/user-management" element={
                        <ProtectedRoute adminOnly>
                          <UserManagement />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin/users" element={
                        <ProtectedRoute adminOnly>
                          <UserManagement />
                        </ProtectedRoute>
                      } />
                      
                      {/* Redirect unknown routes to dashboard */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </div>
  );
}

export default App;