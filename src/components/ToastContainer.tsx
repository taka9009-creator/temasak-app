import React from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useProjects } from '../context/ProjectContext';
import { X, CheckCircle2, AlertTriangle, Info, Calendar } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast, markAsRead } = useNotifications();
  const { handleCompleteAction } = useProjects();

  if (toasts.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'task': return <CheckCircle2 size={20} color="var(--primary)" />;
      case 'alert': return <AlertTriangle size={20} color="var(--danger)" />;
      default: return <Info size={20} color="var(--info)" />;
    }
  };

  const handleAction = (toast: any, actionType: string) => {
    if (actionType === 'complete') {
      markAsRead(toast.id);
      if (toast.actionData?.taskId) {
        handleCompleteAction(toast.actionData.taskId);
      }
    }
    removeToast(toast.id);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      zIndex: 9999,
      pointerEvents: 'none' // コンテナ自体はクリック不可に
    }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          backgroundColor: '#fff',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
          width: '320px',
          pointerEvents: 'auto', // トースト自体はクリック可能に
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <div style={{ padding: '1rem', display: 'flex', gap: '0.75rem', position: 'relative' }}>
            <button 
              onClick={() => removeToast(toast.id)}
              style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
            
            <div style={{ flexShrink: 0 }}>
              {getIcon(toast.type)}
            </div>
            
            <div style={{ flex: 1, paddingRight: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>
                {toast.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {toast.message}
              </div>
            </div>
          </div>
          
          {toast.actionable && (
            <div style={{ display: 'flex', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
              <button 
                onClick={() => handleAction(toast, 'complete')}
                style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: 'none', borderRight: '1px solid var(--border-color)', color: 'var(--primary)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}
                className="hover-bg-gray"
              >
                <CheckCircle2 size={14} /> 完了にする
              </button>
              <button 
                onClick={() => handleAction(toast, 'postpone')}
                style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}
                className="hover-bg-gray"
              >
                <Calendar size={14} /> 明日に延期
              </button>
            </div>
          )}
        </div>
      ))}
      <style>
        {`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .hover-bg-gray:hover {
            background-color: #f1f5f9 !important;
          }
        `}
      </style>
    </div>
  );
}
