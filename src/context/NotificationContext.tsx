import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useProjects } from './ProjectContext';
import { differenceInDays } from 'date-fns';

export type NotificationType = 'task' | 'alert' | 'info';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  isRead: boolean;
  actionable?: boolean;
  actionData?: any;
}

export interface NotificationSettings {
  showToasts: boolean;
  showBadge: boolean;
  emailAlerts: boolean;
  slackIntegration: boolean;
  dangerAlertDaysBeforeInstall: number;
  dangerAlertCheckColor: boolean;
  dangerAlertCheckCashless: boolean;
  focusMode: boolean;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  toasts: AppNotification[];
  removeToast: (id: string) => void;
  settings: NotificationSettings;
  updateSettings: (newSettings: Partial<NotificationSettings>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};

const initialNotifications: AppNotification[] = [
  {
    id: 'n1',
    title: '本日期限のタスク',
    message: '「△△医院」の見積作成タスクが本日期限です。',
    type: 'task',
    createdAt: new Date().toISOString(),
    isRead: false,
    actionable: true,
    actionData: { taskId: 'a-1' }
  },
  {
    id: 'n2',
    title: '⚠️ 危険アラート',
    message: '「〇〇クリニック」の設置日まであと3日ですが、カラーが未定です。',
    type: 'alert',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    isRead: false,
  },
  {
    id: 'n3',
    title: '契約獲得🎉',
    message: '「鈴木歯科」の見積が承認され、契約となりました！',
    type: 'info',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    isRead: true,
  }
];

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const { actions, projects } = useProjects();
  
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem('temasak-notification-settings');
    return saved ? JSON.parse(saved) : {
      showToasts: true,
      showBadge: true,
      emailAlerts: true,
      slackIntegration: false,
      dangerAlertDaysBeforeInstall: 3,
      dangerAlertCheckColor: true,
      dangerAlertCheckCashless: false,
      focusMode: false
    };
  });

  // 危険アラートの生成ロジック
  useEffect(() => {
    projects.forEach(p => {
      // 導入プロジェクトで、設置日が決まっている場合
      if (p.isImplementationProject && p.installationDate) {
        const diff = differenceInDays(new Date(p.installationDate), new Date());
        
        // 設定された日数以内で、必須項目が未定の場合
        if (diff >= 0 && diff <= (settings.dangerAlertDaysBeforeInstall || 3)) {
          // カラー未定チェック
          if (settings.dangerAlertCheckColor && !p.pipelineMap?.bodyColor) {
            setNotifications(prev => {
              const alreadyExists = prev.some(n => n.type === 'alert' && n.actionData?.projectId === p.id && n.actionData?.alertType === 'missing_color');
              if (alreadyExists) return prev;
              
              const newAlert: AppNotification = {
                id: uuidv4(),
                title: '⚠️ 危険アラート',
                message: `「${p.clinicName}」の設置日まであと${diff}日ですが、カラーが未定です！`,
                type: 'alert',
                createdAt: new Date().toISOString(),
                isRead: false,
                actionable: true,
                actionData: { projectId: p.id, alertType: 'missing_color' }
              };
              
              if (settings.showToasts) {
                setToasts(t => [...t, newAlert]);
              }
              
              return [newAlert, ...prev];
            });
          }

          // キャッシュレス未定チェック
          const hasCashless = !!(p.pipelineMap?.creditStatus || p.pipelineMap?.emoneyStatus || p.pipelineMap?.qrStatus);
          if (settings.dangerAlertCheckCashless && !hasCashless) {
            setNotifications(prev => {
              const alreadyExists = prev.some(n => n.type === 'alert' && n.actionData?.projectId === p.id && n.actionData?.alertType === 'missing_cashless');
              if (alreadyExists) return prev;
              
              const newAlert: AppNotification = {
                id: uuidv4(),
                title: '⚠️ 危険アラート',
                message: `「${p.clinicName}」の設置日まであと${diff}日ですが、キャッシュレス審査が完了していません！`,
                type: 'alert',
                createdAt: new Date().toISOString(),
                isRead: false,
                actionable: true,
                actionData: { projectId: p.id, alertType: 'missing_cashless' }
              };
              
              if (settings.showToasts) {
                setToasts(t => [...t, newAlert]);
              }
              
              return [newAlert, ...prev];
            });
          }
        }
      }
    });
  }, [projects, settings]);
  
  useEffect(() => {
    localStorage.setItem('temasak-notification-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // プロジェクト（タスク）側で完了になったら、連動して通知も既読・トースト消去にする
  useEffect(() => {
    const completedTaskIds = actions.filter(a => a.status === '完了').map(a => a.id);
    
    if (completedTaskIds.length === 0) return;

    setNotifications(prev => {
      let hasChanges = false;
      const next = prev.map(n => {
        if (!n.isRead && n.type === 'task' && n.actionData?.taskId && completedTaskIds.includes(n.actionData.taskId)) {
          hasChanges = true;
          return { ...n, isRead: true };
        }
        return n;
      });
      return hasChanges ? next : prev;
    });

    setToasts(prev => {
      const next = prev.filter(n => {
        if (n.type === 'task' && n.actionData?.taskId && completedTaskIds.includes(n.actionData.taskId)) {
          return false; // delete
        }
        return true;
      });
      return next.length !== prev.length ? next : prev;
    });
  }, [actions]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const addNotification = (n: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => {
    const newNotification: AppNotification = {
      ...n,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
    
    // トーストとしても表示する（設定でONの場合のみ）
    if (settings.showToasts) {
      if (!settings.focusMode || newNotification.type === 'alert') {
        setToasts(prev => [...prev, newNotification]);
        
        // 5秒後にトーストを自動で消す（アクション不要なものだけ）
        if (!newNotification.actionable) {
          setTimeout(() => {
            removeToast(newNotification.id);
          }, 5000);
        }
      }
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(n => n.id !== id));
  };

  // 初回ロード時にモックのトーストを1つだけ出す（デモ用）
  useEffect(() => {
    setTimeout(() => {
      // settings.showToasts を直接参照するとクロージャで初期値に固定される可能性があるが
      // ここは初回のみのデモ用なので、localStorage から直接確認する
      const saved = localStorage.getItem('temasak-notification-settings');
      const show = saved ? JSON.parse(saved).showToasts : true;
      if (show) {
        setToasts([initialNotifications[0]]);
      }
    }, 2000);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, addNotification, markAsRead, markAllAsRead, removeNotification, toasts, removeToast, settings, updateSettings
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
