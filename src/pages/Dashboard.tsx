import React, { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, ArrowRight, BarChart3, Clock, Settings, X, GripVertical, Check, Sparkles, PlusCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useProjects } from '../context/ProjectContext';
import { useWorkflow } from '../context/WorkflowContext';
import { useAuth } from '../context/AuthContext';
import { generateFieldTestSamples } from '../utils/sampleDataGenerator';
import type { Project } from '../types';

interface WidgetConfig {
  id: string;
  title: string;
  visible: boolean;
}

const defaultWidgets: WidgetConfig[] = [
  { id: 'today', title: '今日やること', visible: true },
  { id: 'stalled', title: '要対応（危険・停滞案件）', visible: true },
  { id: 'stats', title: '案件の進捗状況', visible: true },
  { id: 'schedule', title: '現調・設置スケジュール', visible: true }
];

export default function Dashboard() {
  const { projects, actions, handleCompleteAction, postponeAction, addProject } = useProjects();
  const { user } = useAuth();
  const { kanbanColumns, nodes, edges } = useWorkflow();
  const [postponeMenuId, setPostponeMenuId] = useState<string | null>(null);
  const [isInjectingSample, setIsInjectingSample] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem('temasak-dashboard-widgets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return defaultWidgets;
      }
    }
    return defaultWidgets;
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem('temasak-dashboard-widgets', JSON.stringify(widgets));
  }, [widgets]);

  // 外側クリックで延期メニューを閉じる
  useEffect(() => {
    if (!postponeMenuId) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.postpone-container')) {
        setPostponeMenuId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [postponeMenuId]);

  const getProject = (id: string) => projects.find(p => p.id === id);

  const handleInjectSamples = async () => {
    if (window.confirm('現場テスト用のリアルなサンプル案件・ToDo（さくら内科、中央整形外科、ひまわり小児科、緑が丘眼科の4件）を一括投入しますか？')) {
      setIsInjectingSample(true);
      try {
        const samples = generateFieldTestSamples(user?.name || '松浦 貴文');
        for (let i = 0; i < samples.projects.length; i++) {
          await addProject(samples.projects[i], samples.actions[i]);
        }
        alert('現場テスト用のサンプル案件・ToDo（4件）を投入しました！');
      } catch (e: any) {
        console.error('Error injecting samples:', e);
        alert('サンプル投入中にエラーが発生しました。');
      } finally {
        setIsInjectingSample(false);
      }
    }
  };

  // 1. 今日やること
  const activeActions = actions.filter(a => a.status === '未完了');
  const overdueActions = activeActions.filter(a => new Date(a.deadline) < new Date(format(new Date(), 'yyyy-MM-dd')));
  const todayActions = activeActions.filter(a => {
    try { return format(new Date(a.deadline), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'); } 
    catch (e) { return false; }
  });
  const tomorrowActions = activeActions.filter(a => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return format(new Date(a.deadline), 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd');
    } catch (e) { return false; }
  });
  const totalTodayAndOverdue = overdueActions.length + todayActions.length;

  // 端末ノード（後続がないノード）を完了・失注とみなす
  const terminalStatuses = nodes.filter(n => !edges.some(e => e.source === n.id)).map(n => n.data.label as string);

  // 2. 要対応
  const stalledProjects = projects.filter(p => {
    const diff = differenceInDays(new Date(), new Date(p.lastActivityAt));
    return diff >= 7 && !terminalStatuses.includes(p.status);
  });

  const getStalledReason = (project: Project) => {
    const diff = differenceInDays(new Date(), new Date(project.lastActivityAt));
    if (diff >= 7) return `${diff}日間動きなし`;
    return '要確認';
  };

  // 3. 案件進捗
  const salesProjects = projects.filter(p => !p.isImplementationProject && p.status !== '完了' && p.status !== '失注');
  const implProjects = projects.filter(p => p.isImplementationProject && p.status !== '完了' && p.status !== '失注');

  const countByStatus = (statusList: string[], isImpl: boolean) => {
    const list = isImpl ? implProjects : salesProjects;
    return statusList.reduce((acc, status) => {
      acc[status] = list.filter(p => p.status === status).length;
      return acc;
    }, {} as Record<string, number>);
  };

  const salesStatuses = kanbanColumns.filter(c => c.phase === 'sales').map(c => c.id);
  const implStatuses = kanbanColumns.filter(c => c.phase === 'implementation').map(c => c.id);

  const salesStats = countByStatus(salesStatuses, false);
  const implStats = countByStatus(implStatuses, true);

  // 4. スケジュール
  const scheduledProjects = projects
    .filter(p => p.isImplementationProject && (p.surveyDate || p.installationDate) && !terminalStatuses.includes(p.status))
    .sort((a, b) => {
      const d1 = new Date(a.installationDate || a.surveyDate || '').getTime();
      const d2 = new Date(b.installationDate || b.surveyDate || '').getTime();
      return d1 - d2;
    });

  const renderActionList = (actionList: typeof activeActions, type: 'overdue' | 'today' | 'tomorrow') => (
    actionList.map(action => {
      const project = getProject(action.projectId);
      const isOverdue = type === 'overdue';
      const isToday = type === 'today';
      
      let overdueDays = 0;
      if (isOverdue && action.deadline) {
        overdueDays = Math.max(1, differenceInDays(new Date(), new Date(action.deadline)));
      }

      return (
        <div 
          key={action.id} 
          className="card task-card"
          style={{
            borderLeft: isOverdue ? '5px solid var(--danger)' : isToday ? '5px solid var(--warning)' : '5px solid var(--info)',
            backgroundColor: isOverdue ? '#fff5f5' : '#ffffff',
            boxShadow: isOverdue ? '0 4px 12px rgba(239, 68, 68, 0.12)' : 'var(--shadow-sm)',
            marginBottom: '0.75rem',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              {isOverdue && (
                <span className="badge" style={{ backgroundColor: 'var(--danger)', color: 'white', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <AlertTriangle size={12} /> 期限超過 ({overdueDays}日遅れ)
                </span>
              )}
              {isToday && (
                <span className="badge" style={{ backgroundColor: 'var(--warning)', color: 'white', fontWeight: 700 }}>
                  本日締切
                </span>
              )}
              {!isOverdue && !isToday && (
                <span className="badge" style={{ backgroundColor: 'var(--info)', color: 'white' }}>
                  明日締切
                </span>
              )}
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                {project?.clinicName || '案件'}
              </span>
              {project?.contactPerson && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>({project.contactPerson} 様)</span>
              )}
            </div>
            
            <div style={{ color: 'var(--text-main)', fontSize: '0.925rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: isOverdue ? 'var(--danger)' : 'var(--primary)' }}>{action.title}</span>
              {action.memo && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  — {action.memo}
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              期限: <strong>{action.deadline}</strong> | 担当: {project?.salesRep || '未定'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
            {/* 延期クイックメニュー */}
            <div className="postpone-container" style={{ position: 'relative' }}>
              <button 
                type="button"
                className="btn btn-outline"
                onClick={() => setPostponeMenuId(postponeMenuId === action.id ? null : action.id)}
                style={{
                  minHeight: '44px',
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: 'var(--text-main)',
                  backgroundColor: '#ffffff'
                }}
                title="期日を延期する"
              >
                <Clock size={15} color="var(--text-muted)" />
                <span>延期</span>
              </button>

              {postponeMenuId === action.id && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  bottom: '100%',
                  marginBottom: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                  zIndex: 50,
                  minWidth: '140px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <button 
                    type="button"
                    onClick={() => { postponeAction(action.id, 1); setPostponeMenuId(null); }}
                    style={{ padding: '0.6rem 0.85rem', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9' }}
                    className="hover-bg-gray"
                  >
                    📅 明日へ (+1日)
                  </button>
                  <button 
                    type="button"
                    onClick={() => { postponeAction(action.id, 3); setPostponeMenuId(null); }}
                    style={{ padding: '0.6rem 0.85rem', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9' }}
                    className="hover-bg-gray"
                  >
                    ⏩ +3日後へ
                  </button>
                  <button 
                    type="button"
                    onClick={() => { postponeAction(action.id, 7); setPostponeMenuId(null); }}
                    style={{ padding: '0.6rem 0.85rem', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                    className="hover-bg-gray"
                  >
                    🗓️ 来週へ (+7日)
                  </button>
                </div>
              )}
            </div>

            {/* 完了ボタン */}
            <button 
              className="btn"
              onClick={() => handleCompleteAction(action.id)}
              style={{
                minHeight: '44px',
                padding: '0.5rem 1.25rem',
                backgroundColor: isOverdue ? 'var(--danger)' : 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: isOverdue ? '0 2px 8px rgba(239, 68, 68, 0.3)' : '0 2px 8px rgba(79, 70, 229, 0.25)'
              }}
            >
              <Check size={16} /> 完了にする
            </button>
          </div>
        </div>
      );
    })
  );

  // Widget Renderers
  const widgetRenderers: Record<string, () => React.ReactNode> = {
    today: () => (
      <section key="today" style={{ marginBottom: '2.5rem' }}>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={24} color={overdueActions.length > 0 ? "var(--danger)" : "var(--warning)"} /> 
            <span>今日やること (ToDo)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {overdueActions.length > 0 && (
              <span style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 600, backgroundColor: '#fee2e2', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>
                ⚠️ 期限切れタスクがあります！
              </span>
            )}
            <button
              type="button"
              onClick={handleInjectSamples}
              disabled={isInjectingSample}
              style={{
                fontSize: '0.75rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '1rem',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              title="現場テスト用のサンプル案件4件を一括投入します"
            >
              <Sparkles size={13} color="var(--primary)" />
              <span>{isInjectingSample ? '投入中...' : '🧪 テスト用データ投入'}</span>
            </button>
          </div>
        </div>

        <div className="summary-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <div className="summary-large" style={{ fontWeight: 700, fontSize: '1.25rem' }}>計 {totalTodayAndOverdue}件</div>
          <div className="summary-item" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: overdueActions.length > 0 ? 700 : 400, color: overdueActions.length > 0 ? 'var(--danger)' : 'inherit' }}>
            <span className="status-dot dot-danger"></span> 期限超過 {overdueActions.length}件
          </div>
          <div className="summary-item" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="status-dot dot-warning"></span> 今日期限 {todayActions.length}件
          </div>
          <div className="summary-item" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="status-dot dot-success"></span> 明日期限 {tomorrowActions.length}件
          </div>
        </div>

        {renderActionList(overdueActions, 'overdue')}
        {renderActionList(todayActions, 'today')}
        {totalTodayAndOverdue === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem 1.5rem' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              🎉 現在対応が必要な急ぎのToDoはありません。順調です！
            </p>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              右上の「🎙️ 喋って作成」や「新規案件登録」からToDoを登録するか、テスト用サンプルデータを投入して動作をお試しください。
            </p>
            <button
              type="button"
              onClick={handleInjectSamples}
              disabled={isInjectingSample}
              className="btn btn-outline"
              style={{ margin: '0 auto', fontSize: '0.875rem', gap: '0.4rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              <Sparkles size={16} />
              <span>現場テスト用のサンプル案件（4件）を投入してみる</span>
            </button>
          </div>
        )}
      </section>
    ),
    stalled: () => (
      <section key="stalled" style={{ marginBottom: '2.5rem' }}>
        <div className="section-title" style={{ color: 'var(--danger)' }}>
          <AlertTriangle size={24} /> 要対応（危険・停滞案件）
        </div>
        <div className="card" style={{ padding: '0.5rem 1.5rem' }}>
          {stalledProjects.map(project => (
            <div key={project.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ minWidth: '150px' }}>
                <span className="status-dot dot-danger"></span> <strong>{project.clinicName}</strong>
              </div>
              <div style={{ flex: 1, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {getStalledReason(project)} <ArrowRight size={14} style={{ verticalAlign: 'middle' }} /> 状況確認
              </div>
              <div style={{ minWidth: '100px' }}>
                <span className="badge neutral">ボール: {project.ballHolder}</span>
              </div>
            </div>
          ))}
          {stalledProjects.length === 0 && <p style={{ padding: '1rem 0', color: 'var(--text-muted)' }}>現在、要対応の案件はありません。</p>}
        </div>
      </section>
    ),
    stats: () => (
      <section key="stats" style={{ marginBottom: '2.5rem' }}>
        <div className="section-title">
          <BarChart3 size={24} color="var(--primary)" /> 案件の進捗状況
        </div>
        <div className="two-col-grid" style={{ marginBottom: 0 }}>
          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>営業案件</h3>
            <table className="stats-table">
              <tbody>
                {Object.entries(salesStats).map(([key, val]) => (
                  <tr key={key}><td>{key}</td><td>{val}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>導入案件</h3>
            <table className="stats-table">
              <tbody>
                {Object.entries(implStats).map(([key, val]) => (
                  <tr key={key}><td>{key}</td><td>{val}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    ),
    schedule: () => (
      <section key="schedule" style={{ marginBottom: '2.5rem' }}>
        <div className="section-title">
          <Clock size={24} color="var(--info)" /> 現調・設置スケジュール
        </div>
        <div className="card">
          {scheduledProjects.map(p => {
            const targetDateStr = p.installationDate || p.surveyDate || '';
            const typeLabel = p.installationDate ? '設置' : '現調';
            const daysLeft = differenceInDays(new Date(targetDateStr), new Date());
            
            let dotClass = 'dot-success';
            if (daysLeft < 3 && p.status !== '設置準備') dotClass = 'dot-danger';
            else if (p.status !== '設置準備' && typeLabel === '設置') dotClass = 'dot-warning';

            return (
              <div key={p.id} className="calendar-row">
                <div className="calendar-date">{format(new Date(targetDateStr), 'M/d')} ({typeLabel})</div>
                <div className="calendar-clinic">{p.clinicName}</div>
                <div className="calendar-status" style={{ minWidth: '100px' }}>
                  <span className={`status-dot ${dotClass}`}></span> あと {daysLeft} 日
                </div>
              </div>
            );
          })}
          {scheduledProjects.length === 0 && <p style={{ color: 'var(--text-muted)' }}>予定はありません。</p>}
        </div>
      </section>
    )
  };

  // Drag and drop handlers
  const onDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    
    const newWidgets = [...widgets];
    const draggedItem = newWidgets[draggedItemIndex];
    newWidgets.splice(draggedItemIndex, 1);
    newWidgets.splice(index, 0, draggedItem);
    
    setDraggedItemIndex(index);
    setWidgets(newWidgets);
  };

  const onDragEnd = () => {
    setDraggedItemIndex(null);
  };

  const toggleWidget = (id: string) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  return (
    <div style={{ paddingBottom: '4rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0 }}>ダッシュボード</h2>
        <button className="btn btn-outline" onClick={() => setIsSettingsOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fff' }}>
          <Settings size={16} /> カスタマイズ
        </button>
      </div>

      <div className="dashboard-content">
        {widgets.filter(w => w.visible).map(w => widgetRenderers[w.id] && widgetRenderers[w.id]())}
      </div>

      {/* 設定ドロワー */}
      {isSettingsOpen && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }} onClick={() => setIsSettingsOpen(false)} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', backgroundColor: '#fff', zIndex: 101, boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Settings size={20} /> ダッシュボード設定</h3>
              <button onClick={() => setIsSettingsOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--text-muted)" /></button>
            </div>
            
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                見たい情報を自由にON/OFFし、ドラッグ＆ドロップで表示順を入れ替えることができます。
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {widgets.map((widget, index) => (
                  <div 
                    key={widget.id} 
                    draggable
                    onDragStart={() => onDragStart(index)}
                    onDragOver={(e) => onDragOver(e, index)}
                    onDragEnd={onDragEnd}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '1rem', 
                      backgroundColor: '#fff', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '0.5rem',
                      cursor: 'grab',
                      boxShadow: draggedItemIndex === index ? '0 4px 12px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
                      opacity: draggedItemIndex === index ? 0.5 : 1,
                      transform: draggedItemIndex === index ? 'scale(1.02)' : 'none',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                  >
                    <GripVertical size={16} color="var(--text-muted)" style={{ marginRight: '1rem', cursor: 'grab' }} />
                    <div style={{ flex: 1, fontWeight: 600 }}>{widget.title}</div>
                    
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <div 
                        onClick={() => toggleWidget(widget.id)}
                        style={{ 
                          width: '44px', height: '24px', 
                          borderRadius: '12px', 
                          backgroundColor: widget.visible ? 'var(--success)' : '#e2e8f0',
                          position: 'relative',
                          transition: 'background-color 0.2s',
                        }}
                      >
                        <div style={{ 
                          width: '20px', height: '20px', 
                          borderRadius: '50%', 
                          backgroundColor: '#fff', 
                          position: 'absolute', 
                          top: '2px', 
                          left: widget.visible ? '22px' : '2px',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }} />
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} onClick={() => setIsSettingsOpen(false)}>
                <Check size={16} /> 保存して閉じる
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
