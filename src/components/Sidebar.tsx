import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Settings, UserPlus, Briefcase, X, Mail } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 998 }}
        />
      )}
      
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/app-icon.png" alt="Temasak App Icon" style={{ width: '36px', height: '36px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)', objectFit: 'cover' }} />
            <h1 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>テマサック管理</h1>
          </div>
          <button className="mobile-close-btn" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', display: 'none' }}>
            <X size={24} />
          </button>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose} end>
            <LayoutDashboard size={20} />
            <span>ダッシュボード</span>
          </NavLink>
          <NavLink to="/projects/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <UserPlus size={20} />
            <span>新規案件登録</span>
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose} end>
            <Briefcase size={20} />
            <span>案件管理</span>
          </NavLink>
          <NavLink to="/email" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <Mail size={20} />
            <span>メール配信</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <Settings size={20} />
            <span>設定</span>
          </NavLink>
        </nav>
      </div>
      
      <div style={{ position: 'absolute', bottom: '2rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#94a3b8' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
          松
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f8fafc' }}>{user?.name || '松浦 貴文'}</div>
          <div style={{ fontSize: '0.75rem' }}>{user?.role === 'admin' ? '管理者' : '営業担当'}</div>
        </div>
      </div>
    </>
  );
}
