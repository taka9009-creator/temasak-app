import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import ToastContainer from './components/ToastContainer';
import AllInOneSalesOS from './pages/AllInOneSalesOS';
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
import { EmailProvider } from './context/EmailContext';
import Login from './pages/Login';

// Helper component for protected routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function MainLayout({ isSidebarOpen, setIsSidebarOpen }: { isSidebarOpen: boolean, setIsSidebarOpen: (b: boolean) => void }) {
  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="main-content" style={{ flex: 1, minWidth: 0, maxWidth: '100%', overflowY: 'auto', overflowX: 'hidden', padding: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <TopHeader onMenuClick={() => setIsSidebarOpen(true)} />
        <div style={{ padding: '1.25rem 1.5rem', flex: 1, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
          <Routes>
            {/* 超かんたん統合オールインワン画面（デフォルト） */}
            <Route path="/" element={<AllInOneSalesOS />} />
            <Route path="/classic-dashboard" element={<Dashboard />} />
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
              <EmailProvider>
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
              </EmailProvider>
            </ProjectProvider>
          </MasterDataProvider>
        </WorkflowProvider>
      </RuleProvider>
    </AuthProvider>
  );
}

export default App;
