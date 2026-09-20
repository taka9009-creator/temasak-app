import React, { useState, useEffect } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useWorkflow } from '../context/WorkflowContext';
import ProjectDetailsPanel from '../components/ProjectDetailsPanel';
import { TrendingUp, TrendingDown, Filter, FileText, AlertTriangle, ArrowDown, Settings, X, GripVertical, Check } from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface WidgetConfig {
  id: string;
  title: string;
  visible: boolean;
}

const defaultWidgets: WidgetConfig[] = [
  { id: 'kpi', title: '主要KPI（新規案件・契約率など）', visible: true },
  { id: 'funnel', title: '営業ファネル分析', visible: true },
  { id: 'bottleneck', title: 'ボトルネック・放置案件ランキング', visible: true },
  { id: 'source', title: '流入経路別 分析', visible: true },
  { id: 'receipt', title: 'レセコン・補助金 分析', visible: true },
];

export default function Reports() {
  const { projects, actions, handleCompleteAction } = useProjects();
  const { kanbanColumns, nodes, edges } = useWorkflow();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem('temasak-reports-widgets');
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
    localStorage.setItem('temasak-reports-widgets', JSON.stringify(widgets));
  }, [widgets]);

  // モック用のフィルター状態
  const [filterPeriod, setFilterPeriod] = useState('今月');
  const [filterRep, setFilterRep] = useState('全営業');

  // 端末ノード
  const terminalStatuses = nodes.filter(n => !edges.some(e => e.source === n.id)).map(n => n.data.label as string);

  // ブロック3：放置案件ランキング
  const stagnantProjects = projects
    .filter(p => !p.isImplementationProject && !terminalStatuses.includes(p.status))
    .map(p => ({
      ...p,
      days: differenceInDays(new Date(), new Date(p.lastActivityAt))
    }))
    .filter(p => p.days >= 7)
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  const widgetRenderers: Record<string, () => React.ReactNode> = {
    kpi: () => {
      const salesStatuses = kanbanColumns.filter(c => c.phase === 'sales');
      const firstStatus = salesStatuses.length > 0 ? salesStatuses[0].id : '';
      const implStatuses = kanbanColumns.filter(c => c.phase === 'implementation');
      const wonStatus = implStatuses.length > 0 ? implStatuses[0].id : '契約'; 
      
      const newProjectsCount = projects.filter(p => p.status === firstStatus).length;
      const wonProjectsCount = projects.filter(p => p.status === wonStatus || p.isImplementationProject).length;
      const negotiationCount = projects.filter(p => !p.isImplementationProject && p.status !== firstStatus && !terminalStatuses.includes(p.status)).length;
      
      const rate = projects.length > 0 ? ((wonProjectsCount / projects.length) * 100).toFixed(1) : '0.0';

      return (
        <div key="kpi" className="report-grid" style={{ marginBottom: '2rem' }}>
          <div className="kpi-card">
            <div className="kpi-title">新規案件 ({firstStatus})</div>
            <div className="kpi-value">{newProjectsCount}<span style={{ fontSize: '1rem', fontWeight: 400 }}>件</span></div>
            <div className="kpi-trend down"><TrendingDown size={14}/> 15.8% ↓ (前月比)</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">商談進行中</div>
            <div className="kpi-value">{negotiationCount}<span style={{ fontSize: '1rem', fontWeight: 400 }}>件</span></div>
            <div className="kpi-trend up"><TrendingUp size={14}/> 5.0% ↑ (前月比)</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">導入フェーズ</div>
            <div className="kpi-value">{wonProjectsCount}<span style={{ fontSize: '1rem', fontWeight: 400 }}>件</span></div>
            <div className="kpi-trend up"><TrendingUp size={14}/> 40.0% ↑ (前月比)</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">契約率 (擬似)</div>
            <div className="kpi-value">{rate}<span style={{ fontSize: '1rem', fontWeight: 400 }}>%</span></div>
            <div className="kpi-trend up"><TrendingUp size={14}/> 2.1% ↑ (前月比)</div>
          </div>
        </div>
      );
    },
    funnel: () => {
      const salesStatuses = kanbanColumns.filter(c => c.phase === 'sales' && c.id !== '未分類');
      let cumulative = 0;
      const implCount = projects.filter(p => p.isImplementationProject).length;
      
      const funnelData = salesStatuses.slice().reverse().map((c, i) => {
        const count = projects.filter(p => p.status === c.id).length;
        cumulative += count;
        const val = cumulative + implCount;
        return { label: c.id, val };
      }).reverse();
      
      const maxVal = funnelData.length > 0 ? funnelData[0].val : 1;
      const funnelStages = funnelData.map((d, i) => {
        const rate = i === 0 ? '-' : ((d.val / maxVal) * 100).toFixed(0) + '%';
        const colors = ['var(--primary)', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#e0f2fe'];
        return { ...d, rate, color: colors[i % colors.length] };
      });

      return (
        <section key="funnel" className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>営業ファネル (動的生成)</h3>
          <div className="funnel-container">
            {funnelStages.map((stage, idx, arr) => (
              <React.Fragment key={stage.label}>
                {idx > 0 && (
                  <div className="funnel-arrow">
                    <ArrowDown size={20} color="var(--border-color)" />
                    <span className="funnel-rate">{stage.rate}</span>
                  </div>
                )}
                <div className="funnel-stage" style={{ backgroundColor: stage.color, width: `${Math.max(30, (stage.val / maxVal) * 100)}%` }}>
                  <span className="funnel-label">{stage.label}</span>
                  <span className="funnel-value">{stage.val}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </section>
      );
    },
    bottleneck: () => (
      <section key="bottleneck" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--warning)', backgroundColor: '#fffbeb' }}>
          <h3 style={{ fontSize: '1rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={18} /> 今月のボトルネック
          </h3>
          <p style={{ fontSize: '0.875rem', margin: 0 }}>
            <strong>見積 → 契約</strong> の転換率が先月より12%低下しています。<br/>
            特に「価格」を理由とする失注が増えています。
          </p>
        </div>

        <div className="card" style={{ flex: 1 }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>放置案件ランキング</h3>
          {stagnantProjects.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>順位</th>
                  <th>医院名</th>
                  <th>滞留日数</th>
                </tr>
              </thead>
              <tbody>
                {stagnantProjects.map((p, idx) => (
                  <tr key={p.id} onClick={() => setSelectedProjectId(p.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600 }}>{idx + 1}</td>
                    <td>{p.clinicName}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{p.days}日</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>現在、7日以上放置されている案件はありません。</p>
          )}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem' }}>※行をクリックすると案件詳細が開き、すぐに対応できます。</p>
        </div>
      </section>
    ),
    source: () => (
      <section key="source" className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>流入経路別 分析</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>流入経路</th>
              <th>案件</th>
              <th>商談</th>
              <th>契約</th>
              <th>契約率</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Web資料請求</td>
              <td>50</td>
              <td>30</td>
              <td>6</td>
              <td>12%</td>
            </tr>
            <tr style={{ backgroundColor: '#f0fdf4' }}>
              <td>紹介 <span className="badge success" style={{ marginLeft: '0.5rem' }}>好調</span></td>
              <td>15</td>
              <td>13</td>
              <td>7</td>
              <td style={{ fontWeight: 700, color: 'var(--success)' }}>47%</td>
            </tr>
            <tr>
              <td>展示会</td>
              <td>20</td>
              <td>12</td>
              <td>3</td>
              <td>15%</td>
            </tr>
            <tr>
              <td>電話</td>
              <td>10</td>
              <td>8</td>
              <td>2</td>
              <td>20%</td>
            </tr>
          </tbody>
        </table>
      </section>
    ),
    receipt: () => (
      <section key="receipt" className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>レセコン・補助金 分析</h3>
        <div className="two-col-grid" style={{ gap: '2rem' }}>
          <div>
            <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>レセコン別 契約率</h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th>レセコン</th>
                  <th>案件</th>
                  <th>契約率</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ORCA</td>
                  <td>45</td>
                  <td style={{ fontWeight: 600, color: 'var(--success)' }}>35%</td>
                </tr>
                <tr>
                  <td>MICS</td>
                  <td>20</td>
                  <td>20%</td>
                </tr>
                <tr>
                  <td>その他</td>
                  <td>15</td>
                  <td>10%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>補助金利用状況</h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th>補助金</th>
                  <th>利用件数</th>
                  <th>採択率</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>IT導入補助金(通常)</td>
                  <td>30</td>
                  <td style={{ fontWeight: 600, color: 'var(--success)' }}>80%</td>
                </tr>
                <tr>
                  <td>IT導入補助金(インボイス)</td>
                  <td>15</td>
                  <td>90%</td>
                </tr>
              </tbody>
            </table>
          </div>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>分析・レポート</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={() => setIsSettingsOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fff' }}>
            <Settings size={16} /> カスタマイズ
          </button>
          <button className="btn btn-primary" onClick={() => setShowReportModal(true)}>
            <FileText size={16} /> 月次レポート作成
          </button>
        </div>
      </div>

      {/* グローバルフィルター */}
      <section className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <Filter size={20} color="var(--secondary)" />
        <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)' }}>
          <option>今月</option>
          <option>先月</option>
          <option>今四半期</option>
          <option>今年</option>
        </select>
      </section>

      {/* ウィジェット描画エリア */}
      <div className="reports-content" style={{ display: 'flex', flexDirection: 'column' }}>
        {widgets.filter(w => w.visible).map(w => widgetRenderers[w.id] && widgetRenderers[w.id]())}
      </div>

      {/* 詳細パネル（放置案件クリック用） */}
      {selectedProjectId && (
        <ProjectDetailsPanel 
          project={selectedProject}
          actions={actions}
          onClose={() => setSelectedProjectId(null)}
          onCompleteAction={handleCompleteAction}
        />
      )}

      {/* 月次レポート自動生成モーダル */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={24} /> {filterPeriod} 営業レポート
            </h2>
            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '0.5rem', fontFamily: 'monospace', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
{`■ 新規案件
32件

■ 商談
21件

■ 契約
7件

■ 契約率
21.9%

■ 前月比
契約数 +40%

■ 好調な流入経路
紹介（契約率47%）

■ ボトルネック
見積→契約

■ 失注理由
価格 35%

■ 長期停滞
${stagnantProjects.length}件

■ 改善提案
見積提出後3日以内のフォローを徹底する`}
            </div>
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setShowReportModal(false)}>閉じる</button>
              <button className="btn btn-primary" onClick={() => { alert('PDF出力機能はモックです'); setShowReportModal(false); }}>PDF出力</button>
            </div>
          </div>
        </div>
      )}

      {/* 設定ドロワー */}
      {isSettingsOpen && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }} onClick={() => setIsSettingsOpen(false)} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', backgroundColor: '#fff', zIndex: 101, boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Settings size={20} /> レポート設定</h3>
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
