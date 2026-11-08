import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { Zap, LayoutDashboard, Settings, UserPlus, Briefcase, X, BarChart3 } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { projects } = useProjects();

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
            <div>
              <h1 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>テマサック営業OS</h1>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>KPI・案件・AIナレッジ統合</div>
            </div>
          </div>
          <button className="mobile-close-btn" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', display: 'none' }}>
            <X size={24} />
          </button>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose} end>
            <Zap size={20} color="#fbbf24" />
            <span style={{ fontWeight: 700 }}>⚡ 超かんたん司令室 ({projects.length}件)</span>
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose} end>
            <Briefcase size={20} />
            <span>案件カンバン・カレンダー</span>
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <BarChart3 size={20} />
            <span>KPI・ファネル分析</span>
          </NavLink>
          <NavLink to="/projects/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <UserPlus size={20} />
            <span>新規案件の追加</span>
          </NavLink>
          <NavLink to="/classic-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <LayoutDashboard size={20} />
            <span>旧ダッシュボード</span>
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
          <div style={{ fontSize: '0.75rem' }}>{user?.role === 'admin' ? '北海道・東北 統括担当' : '営業担当'}</div>
        </div>
      </div>
    </>
  );
}
