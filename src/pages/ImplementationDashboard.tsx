import React, { useState } from 'react';
import { useProjects } from '../context/ProjectContext';
import { Truck, LayoutList, Calendar as CalendarIcon } from 'lucide-react';
import ProjectCalendar from '../components/ProjectCalendar';
import ProjectDetailsPanel from '../components/ProjectDetailsPanel';

export default function ImplementationDashboard() {
  const { projects, actions, handleCompleteAction } = useProjects();
  const [viewMode, setViewMode] = useState<'cards' | 'calendar'>('cards');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const implProjects = projects.filter(p => p.isImplementationProject && p.status !== '失注');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  const getStatusIcon = (status: '✅' | '⏳' | '─' | string) => {
    switch (status) {
      case '✅': return <span style={{ color: 'var(--success)' }}>✅</span>;
      case '⏳': return <span style={{ color: 'var(--warning)' }}>⏳</span>;
      case '─': return <span style={{ color: 'var(--text-muted)' }}>─</span>;
      default: return <span>{status}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Truck size={24} /> 導入プロジェクト</h2>
        <div style={{ display: 'flex', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', overflow: 'hidden' }}>
          <button 
            style={{ padding: '0.5rem 1rem', border: 'none', background: viewMode === 'cards' ? 'var(--primary)' : 'transparent', color: viewMode === 'cards' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => setViewMode('cards')}
          >
            <LayoutList size={16} /> 進捗カード
          </button>
          <button 
            style={{ padding: '0.5rem 1rem', border: 'none', background: viewMode === 'calendar' ? 'var(--primary)' : 'transparent', color: viewMode === 'calendar' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => setViewMode('calendar')}
          >
            <CalendarIcon size={16} /> カレンダー
          </button>
        </div>
      </div>

      {viewMode === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {implProjects.map(project => {
          // 判定ロジック
          // 1. 契約: 実装プロジェクトなので常に完了とする
          const contractStatus = '✅';
          
          // 2. キャッシュレス: creditStatus, emoneyStatus, qrStatusのいずれかが入力されていれば✅、そうでなければ⏳
          const pm = project.pipelineMap || {};
          const hasCashless = !!(pm.creditStatus || pm.emoneyStatus || pm.qrStatus);
          const cashlessStatus = hasCashless ? '✅' : '⏳';
          
          // 3. カラー: bodyColorが入力されていれば✅
          const colorStatus = pm.bodyColor ? '✅' : '⏳';
          
          // 4. 現調: surveyDateが入っていれば✅
          const surveyStatus = project.surveyDate ? '✅' : '⏳';
          
          // 5. 設置日: installationDateが入っていればその日付、なければ未定
          const installDateStr = project.installationDate ? project.installationDate.substring(5).replace('-', '/') : '未定';
          
          // 6. 設置: statusが '完了' または '本番稼働' なら✅、それ以外は─
          const installStatus = (project.status === '完了' || project.status === '本番稼働') ? '✅' : '─';
          
          // 7. 稼働: statusが '本番稼働' なら✅、それ以外は─
          const goliveStatus = project.status === '本番稼働' ? '✅' : '─';

          return (
            <div key={project.id} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                {project.clinicName}
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
                <div style={{ color: 'var(--text-muted)' }}>契約</div>
                <div>{getStatusIcon(contractStatus)}</div>
                
                <div style={{ color: 'var(--text-muted)' }}>キャッシュレス</div>
                <div>{getStatusIcon(cashlessStatus)}</div>
                
                <div style={{ color: 'var(--text-muted)' }}>カラー</div>
                <div>{getStatusIcon(colorStatus)}</div>
                
                <div style={{ color: 'var(--text-muted)' }}>現調</div>
                <div>{getStatusIcon(surveyStatus)}</div>
                
                <div style={{ color: 'var(--text-muted)' }}>設置日</div>
                <div style={{ fontWeight: 600 }}>{installDateStr}</div>
                
                <div style={{ color: 'var(--text-muted)' }}>設置</div>
                <div>{getStatusIcon(installStatus)}</div>
                
                <div style={{ color: 'var(--text-muted)' }}>稼働</div>
                <div>{getStatusIcon(goliveStatus)}</div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {viewMode === 'calendar' && (
        <ProjectCalendar 
          projects={implProjects}
          onProjectClick={(p) => setSelectedProjectId(p.id)}
        />
      )}
      
      {implProjects.length === 0 && viewMode === 'cards' && (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--card-bg)', borderRadius: '0.5rem', color: 'var(--text-muted)' }}>
          現在進行中の導入プロジェクトはありません。
        </div>
      )}

      {selectedProjectId && (
        <ProjectDetailsPanel 
          project={selectedProject}
          actions={actions}
          onCompleteAction={handleCompleteAction}
          onClose={() => setSelectedProjectId(null)}
        />
      )}
    </div>
  );
}
