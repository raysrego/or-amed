import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Procedures from './pages/Procedures';
import AnesthesiaTypes from './pages/AnesthesiaTypes';
import Hospitals from './pages/Hospitals';
import Suppliers from './pages/Suppliers';
import OPMEs from './pages/OPMEs';
import SurgeryRequests from './pages/SurgeryRequests';
import Budgets from './pages/Budgets';
import UserProfile from './pages/UserProfile';
import UserSurgeryRequest from './pages/UserSurgeryRequest';
import UserBudgetTracking from './pages/UserBudgetTracking';
import UserManagement from './pages/UserManagement';

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
                    {/* User Module Routes - Available to all authenticated users */}
                    <Route path="/user-profile" element={<UserProfile />} />
                    <Route path="/user-surgery-requests" element={<UserSurgeryRequest />} />
                    <Route path="/user-budget-tracking" element={<UserBudgetTracking />} />
                    
                    {/* Admin Routes - Only for administrators */}
                    <Route path="/" element={<AdminRoute><Dashboard /></AdminRoute>} />
                    <Route path="/patients" element={<AdminRoute><Patients /></AdminRoute>} />
                    <Route path="/doctors" element={<AdminRoute><Doctors /></AdminRoute>} />
                    <Route path="/procedures" element={<AdminRoute><Procedures /></AdminRoute>} />
                    <Route path="/anesthesia-types" element={<AdminRoute><AnesthesiaTypes /></AdminRoute>} />
                    <Route path="/hospitals" element={<AdminRoute><Hospitals /></AdminRoute>} />
                    <Route path="/suppliers" element={<AdminRoute><Suppliers /></AdminRoute>} />
                    <Route path="/opmes" element={<AdminRoute><OPMEs /></AdminRoute>} />
                    <Route path="/surgery-requests" element={<AdminRoute><SurgeryRequests /></AdminRoute>} />
                    <Route path="/budgets" element={<AdminRoute><Budgets /></AdminRoute>} />
                    <Route path="/audit-logs" element={<AdminRoute><div>Logs de Auditoria em desenvolvimento</div></AdminRoute>} />
                    <Route path="/user-management" element={<AdminRoute><UserManagement /></AdminRoute>} />
                    
                    {/* Default redirect to user profile for non-admin users */}
                    <Route path="*" element={<Navigate to="/user-profile" replace />} />
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