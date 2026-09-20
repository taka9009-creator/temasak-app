import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import ToastContainer from './components/ToastContainer';
import Dashboard from './pages/Dashboard';
import ProjectManagement from './pages/ProjectManagement';
import ProjectRegistration from './pages/ProjectRegistration';
import WorkflowMap from './pages/WorkflowMap';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ImplementationDashboard from './pages/ImplementationDashboard';

import { ProjectProvider } from './context/ProjectContext';
import { NotificationProvider } from './context/NotificationContext';
import { MasterDataProvider } from './context/MasterDataContext';
import { WorkflowProvider } from './context/WorkflowContext';
import { RuleProvider } from './context/RuleContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';

// Helper component for protected routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    // Note: React Router's Navigate would be cleaner, but window.location works as a simple fallback
    // Actually, we can just render the Login component directly or use Navigate from react-router-dom
    // We'll import Navigate at the top
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function MainLayout({ isSidebarOpen, setIsSidebarOpen }: { isSidebarOpen: boolean, setIsSidebarOpen: (b: boolean) => void }) {
  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="main-content" style={{ flex: 1, overflowY: 'auto', padding: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <TopHeader onMenuClick={() => setIsSidebarOpen(true)} />
        <div style={{ padding: '2rem', flex: 1 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects/new" element={<ProjectRegistration />} />
            <Route path="/projects" element={<ProjectManagement />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <AuthProvider>
      <RuleProvider>
      <WorkflowProvider>
        <MasterDataProvider>
          <ProjectProvider>
            <NotificationProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route 
                    path="/*" 
                    element={
                      <ProtectedRoute>
                        <MainLayout isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
                      </ProtectedRoute>
                    } 
                  />
                </Routes>
                <ToastContainer />
              </BrowserRouter>
            </NotificationProvider>
          </ProjectProvider>
        </MasterDataProvider>
      </WorkflowProvider>
      </RuleProvider>
    </AuthProvider>
  );
}

export default App;
