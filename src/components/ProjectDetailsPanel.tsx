import React, { useState } from 'react';
import type { Project, NextAction } from '../types';
import { differenceInDays, format } from 'date-fns';
import { X, CheckCircle2, AlertTriangle, Sparkles, Save, Loader2, Zap } from 'lucide-react';
import { useMasterData } from '../context/MasterDataContext';
import ProjectProgressMap from './workflow/ProjectProgressMap';
import { generateSummary } from '../utils/ai';

interface Props {
  project: Project | null;
  actions: NextAction[];
  onClose: () => void;
  onCompleteAction: (actionId: string) => void;
  onPostponeAction?: (actionId: string, days: number) => void;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => void;
}

export default function ProjectDetailsPanel({ project, actions, onClose, onCompleteAction, onPostponeAction, onUpdateProject }: Props) {
  const [activeTab, setActiveTab] = useState<'basicInfo' | 'pipelineMap' | 'activities' | 'deviceInfo' | 'prepStatus' | 'cashlessStatus' | 'installation'>('basicInfo');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [generatedSummary, setGeneratedSummary] = useState('');
  const { masterData } = useMasterData();
  
  if (!project) return null;

  const handleGenerateAISummary = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      // 案件の基本情報と活動履歴を統合したリッチなテキストを作成
      const contextText = `
【案件情報】
・案件名: ${project.clinicName}
・ステータス: ${project.status}
・確度: ${project.probability || '未設定'}
・営業担当: ${project.salesRep}
・現在のボール: ${project.ballHolder}

【活動履歴】
${(project.activities || []).map(a => `[${a.date}] ${a.type} - ${a.content}`).join('\n') || '活動履歴なし'}
      `.trim();
      
      const result = await generateSummary(contextText);
      setGeneratedSummary(result);
    } catch (err: any) {
      setAiError(err.message || 'エラーが発生しました');
    } finally {
      setAiLoading(false);
    }
  };

  const projectActions = actions.filter(a => a.projectId === project.id && a.status === '未完了');
  const mainAction = projectActions[0];

  const getHealthStatus = () => {
    if (!mainAction) return { color: 'dot-danger', label: '要対応', text: '次回アクション未設定' };
    const diff = differenceInDays(new Date(), new Date(project.lastActivityAt));
    if (diff >= 7 || new Date(mainAction.deadline) < new Date(format(new Date(), 'yyyy-MM-dd'))) {
      return { color: 'dot-danger', label: '要対応', text: diff >= 7 ? `${diff}日間動きなし` : '期限超過' };
    }
    if (diff >= 4 || format(new Date(mainAction.deadline), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
      return { color: 'dot-warning', label: '注意', text: '今日期限、または数日動きなし' };
    }
    return { color: 'dot-success', label: '順調', text: '順調に進行中' };
  };

  const health = getHealthStatus();
  
  // 新しい進捗フロー
  const pipelinePhases = ['問合せ', '初動', 'デモ', '見積', '受注', '楽々報告', 'KZ送客', 'CL希望', '補助受注', '現地調査', '設置日', '本番稼働'];

  const renderPipeline = (phases: string[], current: string) => {
    const currentIndex = phases.indexOf(current);
    // マッチしない場合（新規など）は0として扱う
    const activeIndex = currentIndex === -1 ? 0 : currentIndex;

    return (
      <div className="pipeline-progress" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        {phases.map((phase, idx) => {
          let stateClass = '';
          if (idx < activeIndex || current === '本番稼働') stateClass = 'completed';
          else if (idx === activeIndex) stateClass = 'active';
          
          return (
            <React.Fragment key={phase}>
              <div className={`pipeline-step ${stateClass}`} style={{ minWidth: '80px', marginBottom: '0.5rem' }}>
                {stateClass === 'completed' ? '☑' : stateClass === 'active' ? '●' : '○'}
                <span style={{ fontSize: '0.75rem' }}>{phase}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-content" onClick={e => e.stopPropagation()}>
        
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {project.clinicName}
              {project.probability && (
                <span className={`badge ${project.probability === 'A' ? 'success' : project.probability === 'B' ? 'info' : 'warning'}`}>
                  確度: {project.probability}
                </span>
              )}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fef3c7', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid #fde68a', marginRight: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309', marginRight: '0.25rem' }}>🏀 ボール:</span>
              <select 
                className="input-field" 
                style={{ padding: '0', fontSize: '0.75rem', border: 'none', backgroundColor: 'transparent', color: '#b45309', fontWeight: 600, outline: 'none', cursor: 'pointer', width: 'auto' }}
                value={project.ballHolder || ''}
                onChange={e => onUpdateProject?.(project.id, { ballHolder: e.target.value })}
              >
                <option value="">(未設定)</option>
                <option value={project.salesRep}>{project.salesRep} (営業)</option>
                <option value="クリニック">クリニック（確認待ち）</option>
                <option value="サポート窓口">サポート窓口</option>
                <option value="パートナー業者">パートナー業者</option>
                <option value="経理">経理</option>
              </select>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.5rem' }}><X size={24} color="var(--text-muted)"/></button>
          </div>
        </div>

        {/* AI要約パネル */}
        <div className="ai-summary-box" style={{ background: 'linear-gradient(to right, #f8fafc, #f0f9ff)', border: '1px solid #bae6fd', padding: '1rem', borderRadius: '0.5rem', margin: '0 1.5rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="ai-summary-header" style={{ margin: 0, padding: 0, background: 'none', border: 'none', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: '1rem' }}>活動履歴からの AI 要約</h3>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {!generatedSummary && !aiLoading && (
                <button onClick={handleGenerateAISummary} className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                  ✨ AIで要約を生成する
                </button>
              )}
              <a
                href="/email/compose"
                className="btn btn-outline"
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', color: '#6d28d9', borderColor: '#ddd6fe', backgroundColor: '#f5f3ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Sparkles size={14} /> ✉️ AI返信を作成
              </a>
            </div>
          </div>

          {aiLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem 0', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <Loader2 className="spin" size={20} />
              <span style={{ fontSize: '0.875rem' }}>AIが活動履歴を分析し、要約を生成しています...</span>
              <style>
                {`
                  @keyframes spin { 100% { transform: rotate(360deg); } }
                  .spin { animation: spin 1s linear infinite; }
                `}
              </style>
            </div>
          ) : aiError ? (
            <div style={{ padding: '1rem', backgroundColor: '#fee2e2', borderRadius: '0.5rem', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                <AlertTriangle size={16} /> 生成エラー
              </div>
              {aiError}
            </div>
          ) : generatedSummary ? (
            <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {generatedSummary}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '0.5rem 0' }}>
              右上のボタンを押すと、これまでの活動履歴をAIが解析し、現在の状況を要約します。
            </div>
          )}
        </div>

        {/* 上段：今どうなっている？ */}
        <div className="drawer-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <span className={`status-dot ${health.color}`}></span>
            <span style={{ fontWeight: 600 }}>{health.label}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>（{health.text}）</span>
          </div>
          
          <div className="two-col-grid" style={{ marginBottom: '1rem', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div><strong>ステータス：</strong> {project.status}</div>
            <div><strong>担当：</strong> {project.salesRep}</div>
            <div><strong>最終活動：</strong> {project.lastActivityAt}</div>
            <div><strong>経過：</strong> {differenceInDays(new Date(), new Date(project.lastActivityAt))}日</div>
            <div style={{ gridColumn: 'span 2' }}>
              <strong>ボール：</strong> <span className="badge neutral">{project.ballHolder}</span>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <strong style={{ fontSize: '0.875rem' }}>進捗フロー</strong>
            {renderPipeline(pipelinePhases, project.status)}
          </div>
        </div>

        {/* 中段：次に何をする？ */}
        <div className="drawer-section" style={{ borderLeft: '4px solid var(--warning)' }}>
          <h3>🔥 次にやること</h3>
          {mainAction ? (
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>{mainAction.title}</div>
              <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}><strong>期限：</strong> {mainAction.deadline}</div>
              <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}><strong>理由：</strong> {mainAction.memo}</div>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <button className="btn btn-primary" onClick={() => { onCompleteAction(mainAction.id); onClose(); }}>
                  <CheckCircle2 size={16} /> 完了にする
                </button>
                <div style={{ display: 'flex', gap: '0.25rem', borderLeft: '1px solid #cbd5e1', paddingLeft: '1rem', marginLeft: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>延期:</span>
                  <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => onPostponeAction?.(mainAction.id, 1)}>+1日</button>
                  <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => onPostponeAction?.(mainAction.id, 3)}>+3日</button>
                  <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => onPostponeAction?.(mainAction.id, 7)}>+1週</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={20} />
              <div>
                <strong>次回アクション未設定</strong><br/>
                <span style={{ fontSize: '0.875rem' }}>この案件が止まらないよう、次のアクションを設定してください。</span>
              </div>
            </div>
          )}
        </div>

        {/* 下段：タブエリア */}
        <div>
          <div className="tabs-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingBottom: '0.5rem' }}>
            <button className={`tab-button ${activeTab === 'basicInfo' ? 'active' : ''}`} onClick={() => setActiveTab('basicInfo')}>基本情報</button>
            <button className={`tab-button ${activeTab === 'pipelineMap' ? 'active' : ''}`} onClick={() => setActiveTab('pipelineMap')}>進捗ロードマップ</button>
            <button className={`tab-button ${activeTab === 'activities' ? 'active' : ''}`} onClick={() => setActiveTab('activities')}>活動履歴</button>
            <button className={`tab-button ${activeTab === 'deviceInfo' ? 'active' : ''}`} onClick={() => setActiveTab('deviceInfo')}>機器・補助金情報</button>
            <button className={`tab-button ${activeTab === 'prepStatus' ? 'active' : ''}`} onClick={() => setActiveTab('prepStatus')}>各種確認・準備状況</button>
            <button className={`tab-button ${activeTab === 'cashlessStatus' ? 'active' : ''}`} onClick={() => setActiveTab('cashlessStatus')}>キャッシュレス導入状況</button>
          </div>

          {activeTab === 'basicInfo' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>基本情報</h3>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                  onClick={() => {
                    if (onUpdateProject) {
                      const probability = (document.getElementById('edit-probability') as HTMLSelectElement)?.value || project.probability;
                      
                      onUpdateProject(project.id, {
                        address: (document.getElementById('auto-address') as HTMLInputElement).value,
                        phone: (document.getElementById('auto-phone') as HTMLInputElement).value,
                        email: (document.getElementById('auto-email') as HTMLInputElement).value,
                        clinicHours: (document.getElementById('auto-clinicHours') as HTMLInputElement).value,
                        closedDays: (document.getElementById('auto-closedDays') as HTMLInputElement).value,
                        reservationSystem: (document.getElementById('auto-reservation') as HTMLInputElement).value,
                        probability: probability as Project['probability'],
                        pipelineMap: {
                          ...project.pipelineMap,
                          corpId: (document.getElementById('auto-corpId') as HTMLInputElement).value,
                          establishedAt: (document.getElementById('auto-establishedAt') as HTMLInputElement).value,
                          director: (document.getElementById('auto-director') as HTMLInputElement).value,
                          department: (document.getElementById('auto-department') as HTMLInputElement).value,
                          receiptComputer: (document.getElementById('auto-receipt') as HTMLInputElement).value,
                          integrationMethod: (document.getElementById('auto-integration') as HTMLSelectElement).value,
                        }
                      });
                      alert('基本情報を保存しました。');
                    }
                  }}
                >
                  <Save size={14} /> 保存
                </button>
              </div>

              {/* 確度の編集エリアを追加 */}
              <div className="card" style={{ padding: '1rem', marginBottom: '1rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ fontWeight: 600 }}>確度:</label>
                <select id="edit-probability" className="mock-input" style={{ width: '200px', margin: 0 }} defaultValue={project.probability || '未設定'}>
                  <option value="未設定">未設定</option>
                  <option value="A">A (高い)</option>
                  <option value="B">B (普通)</option>
                  <option value="C">C (低い)</option>
                </select>
              </div>

              {/* URL自動取得モック */}
              <div className="card" style={{ padding: '1rem', marginBottom: '1rem', border: '1px solid #e2e8f0', backgroundColor: '#f0f9ff' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', color: '#0369a1' }}>ホームページURL（AI自動抽出）</label>
                    <input type="url" id="auto-website-url" className="mock-input" defaultValue={project.websiteUrl || ''} placeholder="https://example-clinic.com" style={{ borderColor: '#bae6fd' }} />
                  </div>
                  <button 
                    type="button"
                    className="btn btn-primary" 
                    style={{ padding: '0.35rem 1rem', whiteSpace: 'nowrap', backgroundColor: '#0284c7' }}
                    onClick={(e) => {
                      const btn = e.currentTarget;
                      const originalText = btn.innerHTML;
                      btn.innerHTML = '🔄 読み取り中...';
                      btn.disabled = true;
                      const urlInput = document.getElementById('auto-website-url') as HTMLInputElement;
                      if (!urlInput.value) {
                        alert('URLを入力してください');
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                        return;
                      }

                      fetch('https://extractclinicinfo-f4rmwiyjwq-an.a.run.app', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: urlInput.value })
                      })
                      .then(res => {
                        if (!res.ok) throw new Error('解析に失敗しました');
                        return res.json();
                      })
                      .then(data => {
                        if (data.address) (document.getElementById('auto-address') as HTMLInputElement).value = data.address;
                        if (data.phone) (document.getElementById('auto-phone') as HTMLInputElement).value = data.phone;
                        if (data.clinicHours) (document.getElementById('auto-clinicHours') as HTMLInputElement).value = data.clinicHours;
                        if (data.closedDays) (document.getElementById('auto-closedDays') as HTMLInputElement).value = data.closedDays;
                        if (data.director) (document.getElementById('auto-director') as HTMLInputElement).value = data.director;
                        
                        const resSys = document.getElementById('auto-reservation') as HTMLInputElement;
                        if (resSys && data.reservationSystem) resSys.value = data.reservationSystem;
                        
                        btn.innerHTML = '✨ 抽出完了';
                        btn.style.backgroundColor = '#16a34a';
                      })
                      .catch(err => {
                        console.error(err);
                        alert(err.message);
                        btn.innerHTML = '❌ エラー';
                        btn.style.backgroundColor = '#ef4444';
                      })
                      .finally(() => {
                        setTimeout(() => {
                          btn.innerHTML = originalText;
                          btn.style.backgroundColor = '#0284c7';
                          btn.disabled = false;
                        }, 3000);
                      });
                    }}
                  >
                    ✨ 情報を抽出
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: '0.5rem' }}>
                  ※URLを入力してボタンを押すと、AIがサイトを解析して住所や診療時間などを自動入力します。（現在はデモ稼働のためダミーデータが入ります）
                </div>
              </div>

              <div className="card" style={{ padding: '1rem' }}>
                <div className="two-col-grid" style={{ fontSize: '0.875rem', gap: '0.5rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}><strong>住所:</strong> <input type="text" id="auto-address" className="mock-input" defaultValue={project.address} /></div>
                  <div><strong>電話番号:</strong> <input type="text" id="auto-phone" className="mock-input" defaultValue={project.phone} /></div>
                  <div><strong>メール:</strong> <input type="text" id="auto-email" className="mock-input" defaultValue={project.email} /></div>
                  <div><strong>診療時間:</strong> <input type="text" id="auto-clinicHours" className="mock-input" defaultValue={project.clinicHours} /></div>
                  <div><strong>休診日:</strong> <input type="text" id="auto-closedDays" className="mock-input" defaultValue={project.closedDays} /></div>
                  
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }}></div>
                  
                  <div><strong>法人番号:</strong> <input type="text" id="auto-corpId" className="mock-input" defaultValue={project.pipelineMap?.corpId} /></div>
                  <div><strong>設立年月日:</strong> <input type="date" id="auto-establishedAt" className="mock-input" defaultValue={project.pipelineMap?.establishedAt} /></div>
                  <div><strong>院長:</strong> <input type="text" id="auto-director" className="mock-input" defaultValue={project.pipelineMap?.director} /></div>
                  <div><strong>予約システム:</strong> <input type="text" id="auto-reservation" className="mock-input" defaultValue={project.reservationSystem} /></div>
                  <div><strong>診療科目:</strong> <input type="text" id="auto-department" className="mock-input" defaultValue={project.pipelineMap?.department} /></div>
                  <div><strong>レセコン:</strong> <input type="text" id="auto-receipt" className="mock-input" defaultValue={project.pipelineMap?.receiptComputer} /></div>
                  <div><strong>連携方法:</strong>
                    <select id="auto-integration" className="mock-input" defaultValue={project.pipelineMap?.integrationMethod}>
                      <option value="">未選択</option>
                      <option value="API連携">API連携</option>
                      <option value="ファイル連携">ファイル連携</option>
                      <option value="バーコード連携">バーコード連携</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pipelineMap' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                案件の現在地（ワークフロー）
              </h3>
              <ProjectProgressMap project={project} />
            </div>
          )}

          {activeTab === 'deviceInfo' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>機器・補助金情報</h3>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                  onClick={() => {
                    if (onUpdateProject) {
                      const deviceType = (document.getElementById('edit-device-type') as HTMLSelectElement).value;
                      const bodyColor = (document.getElementById('edit-body-color') as HTMLSelectElement).value;
                      const changeMachineColor = (document.getElementById('edit-change-machine-color') as HTMLSelectElement).value;
                      const subsidyName = (document.getElementById('edit-subsidy-name') as HTMLSelectElement).value;
                      
                      onUpdateProject(project.id, {
                        pipelineMap: {
                          ...project.pipelineMap,
                          deviceType,
                          bodyColor,
                          changeMachineColor,
                          subsidyName
                        }
                      });
                      alert('機器・補助金情報を保存しました。');
                    }
                  }}
                >
                  <Save size={14} /> 保存
                </button>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div className="two-col-grid" style={{ fontSize: '0.875rem', gap: '0.5rem' }}>
                  <div>
                    <strong>タイプ:</strong> 
                    <select id="edit-device-type" className="mock-input" defaultValue={project.pipelineMap?.deviceType || 'テマサックPro スタンドタイプ'}>
                      <option value="テマサックPro スタンドタイプ">テマサックPro スタンドタイプ</option>
                      <option value="テマサックPro カウンタータイプ">テマサックPro カウンタータイプ</option>
                      <option value="テマサックLite（キャッシュレス専用タイプ）">テマサックLite（キャッシュレス専用タイプ）</option>
                    </select>
                  </div>
                  <div>
                    <strong>機器カラー:</strong> 
                    <select id="edit-body-color" className="mock-input" defaultValue={project.pipelineMap?.bodyColor || masterData.deviceColors[0]}>
                      {masterData.deviceColors.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <strong>釣銭機カラー:</strong> 
                    <select id="edit-change-machine-color" className="mock-input" defaultValue={project.pipelineMap?.changeMachineColor || masterData.changeMachineColors[0]}>
                      {masterData.changeMachineColors.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <strong>補助金:</strong> 
                    <select id="edit-subsidy-name" className="mock-input" defaultValue={project.pipelineMap?.subsidyName || '希望無し'}>
                      <option value="希望">希望</option>
                      <option value="希望無し">希望無し</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prepStatus' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>各種確認・準備状況</h3>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                  onClick={() => {
                    if (onUpdateProject) {
                      onUpdateProject(project.id, {
                        surveyDate: (document.getElementById('edit-survey-date') as HTMLInputElement).value,
                        installationDate: (document.getElementById('edit-install-date') as HTMLInputElement).value
                      });
                      alert('準備状況・日程を保存しました。');
                    }
                  }}
                >
                  <Save size={14} /> 保存
                </button>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>現地調査日</label>
                    <input type="date" id="edit-survey-date" className="mock-input" defaultValue={project.surveyDate || ''} style={{ width: '100%' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>設置工事日</label>
                    <input type="date" id="edit-install-date" className="mock-input" defaultValue={project.installationDate || ''} style={{ width: '100%' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.triggerMethodCheck} /> トリガー方法確認</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.hpsEstimateReply} /> HPS見積注文書返信</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.magnetPrep} /> マグネット準備</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.signageData} /> サイネージデータ</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.threePieceSetPrep} /> 3点セット準備</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.bmposPcPrep} /> BMPOS用PC準備</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.constructionCheck} /> 工事手配確認</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.shippingCheck} /> 出荷手配確認</label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cashlessStatus' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>キャッシュレス導入状況</h3>
                <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}><Save size={14} /> 保存</button>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div className="two-col-grid" style={{ fontSize: '0.875rem', gap: '0.5rem' }}>
                  <div><strong>クレカ:</strong> <input type="text" className="mock-input" defaultValue={project.pipelineMap?.creditStatus} /></div>
                  <div><strong>電子マネー:</strong> <input type="text" className="mock-input" defaultValue={project.pipelineMap?.emoneyStatus} /></div>
                  <div><strong>QR:</strong> <input type="text" className="mock-input" defaultValue={project.pipelineMap?.qrStatus} /></div>
                </div>
              </div>
            </div>
          )}

          <style>{`
            .mock-input {
              width: 100%;
              padding: 0.25rem;
              border: 1px solid var(--border-color);
              border-radius: 0.25rem;
              margin-top: 0.25rem;
            }
            
            /* Add webkit scrollbar hiding for horizontal scroll */
            .tabs-container::-webkit-scrollbar {
              display: none;
            }
            .tabs-container {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>

          {activeTab === 'activities' && (
            <div className="drawer-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>これまでの活動</h3>
                <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>+ 活動を記録</button>
              </div>
              
              {project.activities && project.activities.length > 0 ? (
                project.activities.map(act => (
                  <div key={act.id} className="timeline-item">
                    <div className="timeline-date">{act.date.substring(5)}</div>
                    <div className="timeline-content">
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {act.type}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{act.content}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>活動履歴はありません。</div>
              )}
            </div>
          )}

          {activeTab === 'installation' && (
            <div className="drawer-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>現地写真</h3>
                <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>+ 写真を追加</button>
              </div>

              {project.photos && project.photos.length > 0 ? (
                <div className="photo-grid">
                  {project.photos.map(photo => (
                    <div key={photo.id} className="photo-item">
                      <img src={photo.url} alt={photo.type} />
                      <div className="photo-caption">{photo.type}</div>
                      {photo.comment && <div className="photo-comment">{photo.comment}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>登録されている写真はありません。</div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
