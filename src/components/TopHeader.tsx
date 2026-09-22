import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, AlertTriangle, Info, Check, Search, User, Menu, Settings, LogOut, Mic } from 'lucide-react';
import VoiceActionModal from './VoiceActionModal';
import { useNotifications } from '../context/NotificationContext';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface TopHeaderProps {
  onMenuClick: () => void;
}

export default function TopHeader({ onMenuClick }: TopHeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, settings } = useNotifications();
  const { handleCompleteAction } = useProjects();
  const [isOpen, setIsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'action' | 'info'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'task': return <CheckCircle2 size={16} color="var(--primary)" />;
      case 'alert': return <AlertTriangle size={16} color="var(--danger)" />;
      default: return <Info size={16} color="var(--info)" />;
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'action') return n.type === 'task' || n.type === 'alert';
    if (activeTab === 'info') return n.type === 'info';
    return true;
  });

  return (
    <header className="top-header" style={{ 
      height: '60px', 
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(0,0,0,0.05)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'flex-end', 
      padding: '0 2rem',
      gap: '1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      
      <button 
        className="mobile-menu-btn" 
        onClick={onMenuClick}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'none', color: 'var(--text-main)', padding: '8px' }}
      >
        <Menu size={24} />
      </button>

      {/* スペーサー */}
      <div style={{ marginRight: 'auto' }} />

      {/* 🎙️ 音声で一瞬作成ボタン */}
      <button
        onClick={() => setIsVoiceModalOpen(true)}
        className="btn-voice-trigger"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.45rem 0.9rem',
          minHeight: '38px',
          borderRadius: '2rem',
          border: '1px solid rgba(79, 70, 229, 0.2)',
          backgroundColor: '#eef2ff',
          color: 'var(--primary)',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(79, 70, 229, 0.1)',
          transition: 'all 0.2s ease'
        }}
        title="スマホで喋って一瞬でスケジュール作成"
      >
        <Mic size={16} color="var(--primary)" />
        <span className="voice-trigger-text">喋って作成</span>
      </button>

      {/* 音声入力モーダル */}
      <VoiceActionModal 
        isOpen={isVoiceModalOpen} 
        onClose={() => setIsVoiceModalOpen(false)} 
      />

      {/* 通知センター */}
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          className="hover-bg-gray"
        >
          <Bell size={20} color="var(--text-main)" />
          {settings.showBadge && unreadCount > 0 && (
            <span style={{ position: 'absolute', top: '2px', right: '4px', backgroundColor: 'var(--danger)', color: '#fff', fontSize: '0.65rem', fontWeight: 'bold', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div style={{ position: 'absolute', top: '100%', right: '0', width: '360px', backgroundColor: '#fff', borderRadius: '0.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', overflow: 'hidden', marginTop: '0.5rem' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>通知センター</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Check size={14} /> すべて既読にする
                </button>
              )}
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
              <button onClick={() => setActiveTab('all')} style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'all' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'all' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'all' ? 600 : 400, cursor: 'pointer', fontSize: '0.875rem' }}>すべて</button>
              <button onClick={() => setActiveTab('action')} style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'action' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'action' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'action' ? 600 : 400, cursor: 'pointer', fontSize: '0.875rem' }}>要対応</button>
              <button onClick={() => setActiveTab('info')} style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'info' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'info' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'info' ? 600 : 400, cursor: 'pointer', fontSize: '0.875rem' }}>参考情報</button>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {filteredNotifications.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  通知はありません
                </div>
              ) : (
                filteredNotifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => !n.isRead && markAsRead(n.id)}
                    style={{ 
                      padding: '1rem', 
                      borderBottom: '1px solid var(--border-color)', 
                      backgroundColor: n.isRead ? '#fff' : '#f0f9ff',
                      cursor: n.isRead ? 'default' : 'pointer',
                      display: 'flex',
                      gap: '0.75rem',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div style={{ flexShrink: 0, marginTop: '2px' }}>
                      {getIcon(n.type)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                        <div style={{ fontWeight: n.isRead ? 400 : 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>{n.title}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ja })}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {n.message}
                      </div>
                      {n.actionable && !n.isRead && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              markAsRead(n.id);
                              if (n.actionData?.taskId) {
                                handleCompleteAction(n.actionData.taskId);
                              }
                            }}
                            className="btn btn-primary" 
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                          >
                            完了にする
                          </button>
                        </div>
                      )}
                    </div>
                    {!n.isRead && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', flexShrink: 0, alignSelf: 'center' }} />
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div style={{ padding: '0.75rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
              <button 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
                onClick={() => {
                  setIsOpen(false);
                  navigate('/settings#notifications');
                }}
              >
                通知設定を開く
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ユーザープロフィール */}
      <div style={{ position: 'relative' }} ref={userMenuRef}>
        <div 
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '20px' }}
          className="hover-bg-gray"
        >
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <User size={16} />
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, display: 'none' }}>{user?.name || 'ゲスト'}</div>
        </div>

        {isUserMenuOpen && (
          <div style={{ position: 'absolute', top: '100%', right: '0', width: '200px', backgroundColor: '#fff', borderRadius: '0.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', overflow: 'hidden', marginTop: '0.5rem' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user?.name || 'ゲスト'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.role || 'ゲストユーザー'}</div>
            </div>
            <div style={{ padding: '0.5rem' }}>
              <button 
                onClick={() => { setIsUserMenuOpen(false); navigate('/settings'); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.875rem', borderRadius: '0.25rem' }}
                className="hover-bg-gray"
              >
                <Settings size={16} /> 設定
              </button>
              <button 
                onClick={() => { setIsUserMenuOpen(false); logout(); navigate('/login'); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.875rem', borderRadius: '0.25rem', color: 'var(--danger)' }}
                className="hover-bg-gray"
              >
                <LogOut size={16} /> ログアウト
              </button>
            </div>
          </div>
        )}
      </div>
      
    </header>
  );
}
