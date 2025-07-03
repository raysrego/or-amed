import React from 'react';
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
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
  useEffect(() => {
    console.log('App component mounted');
  }, []);

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
                    {/* Dashboard - Default route */}
                    <Route path="/" element={<Dashboard />} />
                    
                    {/* User Module Routes */}
                    <Route path="/user-profile" element={<UserProfile />} />
                    <Route path="/user-surgery-requests" element={<UserSurgeryRequest />} />
                    <Route path="/user-budget-tracking" element={<UserBudgetTracking />} />
                    
                    {/* Admin Routes - Now available to all users */}
                    <Route path="/patients" element={<Patients />} />
                    <Route path="/doctors" element={<Doctors />} />
                    <Route path="/procedures" element={<Procedures />} />
                    <Route path="/anesthesia-types" element={<AnesthesiaTypes />} />
                    <Route path="/hospitals" element={<Hospitals />} />
                    <Route path="/suppliers" element={<Suppliers />} />
                    <Route path="/opmes" element={<OPMEs />} />
                    <Route path="/surgery-requests" element={<SurgeryRequests />} />
                    <Route path="/budgets" element={<Budgets />} />
                    <Route path="/audit-logs" element={<div>Logs de Auditoria em desenvolvimento</div>} />
                    <Route path="/user-management" element={<UserManagement />} />
                    
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
  );
}

export default App;