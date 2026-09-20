import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Zap, Database, Bell, Link2, Plus, ArrowRight, Save, ToggleRight, ToggleLeft, Key, Bot, X, Trash2, Edit2 } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { getAISettings, saveAISettings, type AISettings } from '../utils/ai';
import { useMasterData, type MasterData } from '../context/MasterDataContext';
import { useRules, type GlobalRule } from '../context/RuleContext';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'rules' | 'master' | 'notifications' | 'integrations'>(() => {
    if (window.location.hash === '#notifications') return 'notifications';
    return 'rules';
  });
  
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#notifications') {
        setActiveTab('notifications');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const { settings: notifSettings, updateSettings } = useNotifications();
  const [aiSettings, setAiSettings] = useState<AISettings>(getAISettings);
  const { rules, toggleRule, deleteRule, addRule, updateRule } = useRules();
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  
  const defaultNewRule: Partial<GlobalRule> = {
    name: '',
    isActive: true,
    triggerType: 'status_changed',
    triggerValue: '',
    actionType: 'create_task',
    actionTitle: '',
    actionDaysToDeadline: 0,
    actionAssignee: '松浦 貴文',
    actionPriority: '中',
    actionMemo: '',
    conditionField: undefined,
    conditionOperator: 'equals',
    conditionValue: ''
  };
  const [newRule, setNewRule] = useState<Partial<GlobalRule>>(defaultNewRule);

  const startEditRule = (rule: GlobalRule) => {
    setEditingRuleId(rule.id);
    setIsAddingRule(true);
    setNewRule(rule);
  };

  const handleAddRuleSubmit = () => {
    if (!newRule.name || !newRule.triggerValue || !newRule.actionTitle) {
      alert('必須項目を入力してください');
      return;
    }
    
    if (editingRuleId) {
      updateRule(editingRuleId, newRule as Partial<GlobalRule>);
      setEditingRuleId(null);
    } else {
      addRule(newRule as Omit<GlobalRule, 'id'>);
    }
    
    setIsAddingRule(false);
    setNewRule(defaultNewRule);
  };

  const cancelAddRule = () => {
    setIsAddingRule(false);
    setEditingRuleId(null);
    setNewRule(defaultNewRule);
  };

  const handleSaveAISettings = () => {
    saveAISettings(aiSettings);
    alert('AI設定を保存しました。');
  };


  const { masterData, addItem, removeItem } = useMasterData();

  const renderRuleForm = () => (
    <div className="card" style={{ padding: '0', marginBottom: '1.5rem', border: '1px solid var(--primary-color)', overflow: 'hidden' }}>
      <div style={{ backgroundColor: '#f8fafc', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-color)' }}>
          {editingRuleId ? 'ルールの編集' : '新しいルールの追加'}
        </h3>
      </div>
      
      <div style={{ padding: '1.5rem' }}>
        {/* ルール名 */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ルール名（管理用）</label>
          <input type="text" className="input-field" style={{ width: '100%', maxWidth: '400px', fontSize: '1rem', fontWeight: 500 }} value={newRule.name} onChange={e => setNewRule({...newRule, name: e.target.value})} placeholder="例: 初回連絡フォロー" />
        </div>

        {/* ブロック1: WHEN */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flexShrink: 0, width: '60px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#e2e8f0', color: '#475569', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0', borderRadius: '4px' }}>WHEN</div>
            <div style={{ height: 'calc(100% - 20px)', width: '2px', backgroundColor: '#e2e8f0', margin: '0.5rem auto 0' }}></div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', lineHeight: '2' }}>
              <select className="input-field" style={{ width: 'auto', backgroundColor: 'white' }} value={newRule.triggerType} onChange={e => setNewRule({...newRule, triggerType: e.target.value as any})}>
                <option value="status_changed">ステータス</option>
                <option value="task_completed">タスク</option>
              </select>
              <span>「</span>
              <input type="text" className="input-field" style={{ width: '150px', backgroundColor: 'white' }} value={newRule.triggerValue} onChange={e => setNewRule({...newRule, triggerValue: e.target.value})} placeholder="例: 新規登録" />
              <span>」 が {newRule.triggerType === 'status_changed' ? 'に変わったら' : '完了したら'}、</span>
            </div>
          </div>
        </div>

        {/* ブロック2: IF */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flexShrink: 0, width: '60px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#fef3c7', color: '#d97706', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0', borderRadius: '4px' }}>IF</div>
            <div style={{ height: 'calc(100% - 20px)', width: '2px', backgroundColor: '#fde68a', margin: '0.5rem auto 0' }}></div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#fffbeb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #fde68a' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer', color: '#92400e', marginBottom: newRule.conditionField ? '1rem' : 0 }}>
              <input type="checkbox" checked={!!newRule.conditionField} onChange={e => {
                  if (e.target.checked) setNewRule({...newRule, conditionField: 'subsidyName', conditionOperator: 'equals', conditionValue: ''});
                  else setNewRule({...newRule, conditionField: undefined, conditionOperator: undefined, conditionValue: undefined});
                }} />
              さらに細かい発動条件（AND条件）を指定する
            </label>
            {newRule.conditionField !== undefined && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', lineHeight: '2', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <select 
                  className="input-field" 
                  style={{ width: 'auto', backgroundColor: 'white' }} 
                  value={
                    ['clinicName', 'probability', 'salesRep', 'deviceType', 'bodyColor', 'subsidyName', 'creditStatus', 'emoneyStatus', 'qrStatus'].includes(newRule.conditionField || '') 
                      ? newRule.conditionField 
                      : 'custom'
                  } 
                  onChange={e => {
                    if (e.target.value === 'custom') {
                      setNewRule({...newRule, conditionField: ''});
                    } else {
                      setNewRule({...newRule, conditionField: e.target.value as any});
                    }
                  }}
                >
                  <optgroup label="基本情報">
                    <option value="clinicName">クリニック名</option>
                    <option value="probability">契約確度</option>
                    <option value="salesRep">営業担当者</option>
                  </optgroup>
                  <optgroup label="案件詳細・審査">
                    <option value="deviceType">機器タイプ</option>
                    <option value="bodyColor">本体カラー</option>
                    <option value="subsidyName">利用予定の補助金</option>
                    <option value="creditStatus">クレカ審査状況</option>
                    <option value="emoneyStatus">電マネ審査状況</option>
                    <option value="qrStatus">QR審査状況</option>
                  </optgroup>
                  <optgroup label="その他">
                    <option value="custom">直接入力（カスタム項目）...</option>
                  </optgroup>
                </select>
                {!['clinicName', 'probability', 'salesRep', 'deviceType', 'bodyColor', 'subsidyName', 'creditStatus', 'emoneyStatus', 'qrStatus'].includes(newRule.conditionField || '') && (
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ width: '120px', backgroundColor: 'white' }} 
                    value={newRule.conditionField} 
                    onChange={e => setNewRule({...newRule, conditionField: e.target.value})} 
                    placeholder="英字項目名" 
                  />
                )}
              </div>
                <span>が「</span>
                <input type="text" className="input-field" style={{ width: '120px', backgroundColor: 'white' }} value={newRule.conditionValue} onChange={e => setNewRule({...newRule, conditionValue: e.target.value})} placeholder="例: 希望" />
                <span>」と</span>
                <select className="input-field" style={{ width: 'auto', backgroundColor: 'white' }} value={newRule.conditionOperator} onChange={e => setNewRule({...newRule, conditionOperator: e.target.value as any})}>
                  <option value="equals">等しい</option>
                  <option value="not_equals">等しくない</option>
                </select>
                <span>場合のみ、</span>
              </div>
            )}
          </div>
        </div>

        {/* ブロック3: THEN */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flexShrink: 0, width: '60px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#e0e7ff', color: '#4338ca', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0', borderRadius: '4px' }}>THEN</div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#e0e7ff', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #c7d2fe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', lineHeight: '2', marginBottom: '1rem' }}>
              <span>発動から</span>
              <input type="number" className="input-field" style={{ width: '70px', backgroundColor: 'white' }} value={newRule.actionDaysToDeadline} onChange={e => setNewRule({...newRule, actionDaysToDeadline: Number(e.target.value)})} min="0" />
              <span>日後に、</span>
              <span>担当者：</span>
              <input type="text" className="input-field" style={{ width: '120px', backgroundColor: 'white' }} value={newRule.actionAssignee} onChange={e => setNewRule({...newRule, actionAssignee: e.target.value})} />
              <span>へ、</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', lineHeight: '2', marginBottom: '1rem' }}>
              <span>優先度：</span>
              <select className="input-field" style={{ width: 'auto', backgroundColor: 'white' }} value={newRule.actionPriority} onChange={e => setNewRule({...newRule, actionPriority: e.target.value as any})}>
                <option value="高">高</option>
                <option value="中">中</option>
                <option value="低">低</option>
              </select>
              <span>で、タスク「</span>
              <input type="text" className="input-field" style={{ width: '250px', backgroundColor: 'white', fontWeight: 'bold' }} value={newRule.actionTitle} onChange={e => setNewRule({...newRule, actionTitle: e.target.value})} placeholder="例: 見積書作成" />
              <span>」を自動追加する。</span>
            </div>

            <div style={{ width: '100%' }}>
              <input type="text" className="input-field" style={{ width: '100%', backgroundColor: 'white' }} value={newRule.actionMemo} onChange={e => setNewRule({...newRule, actionMemo: e.target.value})} placeholder="タスクの補足メモ（任意）..." />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <button className="btn btn-outline" onClick={cancelAddRule}>キャンセル</button>
          <button className="btn btn-primary" onClick={handleAddRuleSubmit}>
            <Save size={16} style={{ marginRight: '0.25rem' }} /> ルールを保存する
          </button>
        </div>
      </div>
    </div>
  );

  const renderRulesTab = () => (
    <div className="settings-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>自動化ルール（ルールエンジン）</h2>
        <button className="btn btn-primary" onClick={() => isAddingRule ? cancelAddRule() : setIsAddingRule(true)}>
          {isAddingRule ? 'キャンセル' : <><Plus size={16} /> ルールを追加</>}
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        ステータス変更時やタスク完了時に、システムが自動的に行うアクション（タスクの生成や担当変更など）を設定します。
      </p>

      {isAddingRule && !editingRuleId && renderRuleForm()}

      {rules.map(rule => (
        <React.Fragment key={rule.id}>
          {editingRuleId === rule.id ? (
            renderRuleForm()
          ) : (
            <div className="rule-card">
              <div className="rule-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button 
                    onClick={() => toggleRule(rule.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                  >
                    {rule.isActive ? <ToggleRight size={28} color="var(--success)" /> : <ToggleLeft size={28} color="var(--text-muted)" />}
                  </button>
                  <div style={{ fontWeight: 600, fontSize: '1.125rem', color: rule.isActive ? 'inherit' : 'var(--text-muted)' }}>{rule.name}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => startEditRule(rule)} className="btn" style={{ padding: '0.25rem', color: 'var(--primary-color)', background: 'transparent', border: 'none' }}>
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => { if(confirm('本当に削除しますか？')) deleteRule(rule.id); }} className="btn" style={{ padding: '0.25rem', color: 'var(--danger)', background: 'transparent', border: 'none' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="rule-condition" style={{ opacity: rule.isActive ? 1 : 0.6 }}>
                <span className="rule-badge">{rule.triggerType === 'status_changed' ? 'ステータスが' : 'タスクが'}</span> 
                <span className="rule-badge" style={{ backgroundColor: '#e2e8f0' }}>{rule.triggerValue}</span>
                {rule.triggerType === 'status_changed' ? 'に変わったら' : '完了したら'} 
                
                {rule.conditionField && (
                  <>
                    <br />
                    <span style={{ display: 'inline-block', margin: '0.5rem 0 0 1.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>AND</span>
                      <span className="rule-badge" style={{ backgroundColor: '#f1f5f9', marginLeft: '0.5rem' }}>
                        {rule.conditionField === 'subsidyName' ? '利用予定の補助金' : rule.conditionField === 'deviceType' ? '機器タイプ' : '契約確度'}
                      </span>
                      が
                      <span className="rule-badge" style={{ backgroundColor: '#f1f5f9' }}>{rule.conditionValue}</span>
                      と {rule.conditionOperator === 'equals' ? '等しい' : '等しくない'} 場合のみ
                    </span>
                  </>
                )}

                <br />
                <ArrowRight className="rule-arrow" size={16} /> 
                <span className="rule-badge" style={{ backgroundColor: '#e0e7ff', color: '#4338ca' }}>
                  {rule.actionDaysToDeadline === 0 ? '即時' : `${rule.actionDaysToDeadline}日後`}
                </span> 
                に以下を実行する
              </div>
              <div className="rule-action" style={{ marginTop: '1rem', opacity: rule.isActive ? 1 : 0.6 }}>
                <Zap size={20} color={rule.isActive ? "#d97706" : "var(--text-muted)"} />
                <div>
                  <div style={{ fontWeight: 600 }}>タスク生成：「{rule.actionTitle}」</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    担当: {rule.actionAssignee} / 優先度: {rule.actionPriority} {rule.actionMemo && ` / メモ: ${rule.actionMemo}`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
  const [newItems, setNewItems] = useState<{ [key: string]: string }>({});

  const handleAddItem = (category: keyof MasterData) => {
    const item = newItems[category];
    if (item) {
      addItem(category, item);
      setNewItems({ ...newItems, [category]: '' });
    }
  };

  const renderMasterList = (title: string, category: keyof MasterData) => (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', margin: 0 }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input 
          type="text" 
          className="mock-input" 
          value={newItems[category] || ''}
          onChange={e => setNewItems({ ...newItems, [category]: e.target.value })}
          placeholder="新しい項目..."
          onKeyDown={e => e.key === 'Enter' && handleAddItem(category)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleAddItem(category)}>
          <Plus size={14} /> 追加
        </button>
      </div>
      <table className="data-table">
        <tbody>
          {masterData[category].map(item => (
            <tr key={item}>
              <td>{item}</td>
              <td style={{ textAlign: 'right', width: '50px' }}>
                <button 
                  onClick={() => removeItem(category, item)}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderMasterTab = () => (
    <div className="settings-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>マスタデータ管理</h2>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        各種ドロップダウンで選択できる項目をカスタマイズします。
      </p>

      <div className="two-col-grid">
        {renderMasterList('機器カラー', 'deviceColors')}
        {renderMasterList('釣銭機カラー', 'changeMachineColors')}
      </div>

      <div className="card" style={{ marginTop: '2rem', border: '1px solid var(--danger)', backgroundColor: '#fef2f2' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--danger)', marginBottom: '0.5rem', marginTop: 0 }}>データの初期化（リセット）</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          以前のデモデータ（山田太郎など）が残っていて画面がおかしい場合、すべてのデータをクリアして最新の初期データを読み込み直します。
        </p>
        <button 
          className="btn btn-primary" 
          style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', color: 'white' }}
          onClick={() => {
            if (window.confirm('本当にデータを初期化してよろしいですか？（ブラウザに保存されている案件データはすべて消去されます）')) {
              localStorage.clear();
              window.location.reload();
            }
          }}
        >
          <Trash2 size={16} /> デモデータをリセットする
        </button>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="settings-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>通知・アラート設定</h2>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        アプリ内での通知の受け取り方や、外部サービスとの連携通知を設定します。
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', marginTop: 0 }}>アプリ内通知</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>トースト通知を表示する</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>画面の右下に一時的に表示されるアクション可能な通知です。</div>
          </div>
          <button 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => updateSettings({ showToasts: !notifSettings.showToasts })}
          >
            {notifSettings.showToasts ? <ToggleRight size={32} color="var(--success)" /> : <ToggleLeft size={32} color="var(--text-muted)" />}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>未読バッジを表示する</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>ヘッダーのベルアイコンに未読件数の赤丸を表示します。</div>
          </div>
          <button 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => updateSettings({ showBadge: !notifSettings.showBadge })}
          >
            {notifSettings.showBadge ? <ToggleRight size={32} color="var(--success)" /> : <ToggleLeft size={32} color="var(--text-muted)" />}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0' }}>
          <div>
            <div style={{ fontWeight: 600 }}>集中モード（危険アラートのみ表示）</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>右下に出るポップアップ（トースト）を、危険アラートなど重要なものだけに限定します。</div>
          </div>
          <button 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => updateSettings({ focusMode: !notifSettings.focusMode })}
          >
            {notifSettings.focusMode ? <ToggleRight size={32} color="var(--success)" /> : <ToggleLeft size={32} color="var(--text-muted)" />}
          </button>
        </div>
      </div>


      <div className="card">
        <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', marginTop: 0 }}>危険アラート設定</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>アラート発火タイミング（設置日の〇日前）</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>何日前から必須項目の未入力チェックを行うか設定します。</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="number" 
              className="input-field" 
              style={{ width: '80px', textAlign: 'right' }} 
              value={notifSettings.dangerAlertDaysBeforeInstall || 3}
              onChange={(e) => updateSettings({ dangerAlertDaysBeforeInstall: Number(e.target.value) })}
            />
            <span>日前</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>カラー未定をチェック</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>本体カラーが未定の場合に警告を出します。</div>
          </div>
          <button 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => updateSettings({ dangerAlertCheckColor: !notifSettings.dangerAlertCheckColor })}
          >
            {notifSettings.dangerAlertCheckColor ? <ToggleRight size={32} color="var(--danger)" /> : <ToggleLeft size={32} color="var(--text-muted)" />}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0' }}>
          <div>
            <div style={{ fontWeight: 600 }}>キャッシュレス未定をチェック</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>キャッシュレス審査が完了していない場合に警告を出します。</div>
          </div>
          <button 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => updateSettings({ dangerAlertCheckCashless: !notifSettings.dangerAlertCheckCashless })}
          >
            {notifSettings.dangerAlertCheckCashless ? <ToggleRight size={32} color="var(--danger)" /> : <ToggleLeft size={32} color="var(--text-muted)" />}
          </button>
        </div>
      </div>

    </div>
  );

  const renderIntegrationsTab = () => (
    <div className="settings-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>AI設定</h2>
        <button className="btn btn-primary" onClick={handleSaveAISettings}>
          <Save size={18} /> 保存する
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        AI要約機能や自動化に関する設定を行います。
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Key size={18} color="var(--primary)" /> AIモデル・APIキー設定
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          活動履歴の「3行要約」機能を有効にするには、APIキーを設定してください。キーはブラウザに保存され、安全に扱われます。
        </p>
        
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>使用するAIモデル</div>
          <select 
            className="input-field" 
            value={aiSettings.provider}
            onChange={(e) => setAiSettings({ ...aiSettings, provider: e.target.value as 'openai' | 'gemini' })}
            style={{ width: '100%', maxWidth: '200px', cursor: 'pointer' }}
          >
            <option value="openai">OpenAI (ChatGPT)</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {aiSettings.provider === 'gemini' ? 'Gemini APIキー' : 'OpenAI APIキー'}
          </div>
          <input 
            type="password" 
            className="input-field" 
            placeholder={aiSettings.provider === 'gemini' ? 'AIza...' : 'sk-...'} 
            value={aiSettings.provider === 'gemini' ? aiSettings.geminiApiKey : aiSettings.openaiApiKey}
            onChange={(e) => {
              if (aiSettings.provider === 'gemini') {
                setAiSettings({ ...aiSettings, geminiApiKey: e.target.value });
              } else {
                setAiSettings({ ...aiSettings, openaiApiKey: e.target.value });
              }
            }}
            style={{ width: '100%', maxWidth: '500px' }}
          />
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={18} color="var(--primary)" /> 要約AIプロンプト設定
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          AIが案件の要約を作成する際の「指示文」をカスタマイズできます。
        </p>
        <textarea 
          className="input-field" 
          rows={6}
          value={aiSettings.prompt}
          onChange={(e) => setAiSettings({ ...aiSettings, prompt: e.target.value })}
          style={{ width: '100%', resize: 'vertical', lineHeight: 1.5 }}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          ※ この指示のあとに、実際の「活動履歴」のテキストが連結されてAIに送信されます。
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        <SettingsIcon size={24} color="var(--primary)" />
        <h2 style={{ margin: 0 }}>システム設定</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* 上部：設定ナビゲーション（タブ化） */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <button 
            className={`btn ${activeTab === 'rules' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('rules')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Zap size={18} /> 自動化ルール
          </button>
          <button 
            className={`btn ${activeTab === 'master' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('master')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Database size={18} /> マスタデータ管理
          </button>
          <button 
            className={`btn ${activeTab === 'notifications' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('notifications')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Bell size={18} /> 通知・アラート
          </button>
          <button 
            className={`btn ${activeTab === 'integrations' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('integrations')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Bot size={18} /> AI設定
          </button>
        </div>

        {/* 下部：コンテンツエリア（横幅をフルに使う） */}
        <div style={{ width: '100%' }}>
          {activeTab === 'rules' && renderRulesTab()}
          {activeTab === 'master' && renderMasterTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {activeTab === 'integrations' && renderIntegrationsTab()}
        </div>
      </div>
    </div>
  );
}
