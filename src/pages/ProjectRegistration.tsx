import React, { useState, useEffect } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkflow } from '../context/WorkflowContext';
import type { Project, NextAction, ActionPriority } from '../types';
import { CheckCircle2, AlertTriangle, UserPlus, Calendar, CheckSquare, Sparkles, ArrowRight, Mic } from 'lucide-react';
import VoiceActionModal from '../components/VoiceActionModal';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export default function ProjectRegistration() {
  const { addProject, projects } = useProjects();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { kanbanColumns } = useWorkflow();

  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const defaultRep = user?.name || '松浦 貴文';
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // フォーム状態（案件情報＋初回ToDoの併用）
  const [formData, setFormData] = useState({
    // 案件情報
    clinicName: '',
    contactPerson: '',
    phone: '',
    salesRep: defaultRep,
    memo: '',
    // 初回ToDo
    todoTitle: '初回電話ヒアリング',
    todoDeadline: todayStr,
    todoPriority: '高' as ActionPriority,
    todoMemo: ''
  });

  const [isRegistered, setIsRegistered] = useState(false);
  const [registeredSummary, setRegisteredSummary] = useState<{
    clinicName: string;
    todoTitle: string;
    todoDeadline: string;
    salesRep: string;
  } | null>(null);

  // 下書きの自動復元
  useEffect(() => {
    const draft = localStorage.getItem('project_draft_v2');
    if (draft) {
      try {
        setFormData(prev => ({ ...prev, ...JSON.parse(draft) }));
      } catch (e) {}
    }
  }, []);

  // 下書きの自動保存
  useEffect(() => {
    localStorage.setItem('project_draft_v2', JSON.stringify(formData));
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // クイック選択タグ
  const quickActions = [
    '初回電話ヒアリング',
    '資料・見積書送付',
    'オンラインデモ調整',
    '訪問デモ・現調'
  ];

  // 重複チェック
  const existingCount = projects.filter(p => p.clinicName && p.clinicName === formData.clinicName.trim()).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clinicName.trim()) {
      alert('クリニック名を入力してください。');
      return;
    }
    if (!formData.todoTitle.trim()) {
      alert('最初のアクション（ToDo）を入力してください。');
      return;
    }

    const projectId = uuidv4();
    const today = new Date();
    const initialStatus = kanbanColumns.length > 0 ? kanbanColumns[0].id : '新規';

    // 1. プロジェクト作成
    const newProject: Project = {
      id: projectId,
      clinicName: formData.clinicName.trim(),
      clinicType: 'クリニック',
      address: '',
      phone: formData.phone.trim(),
      email: '',
      contactPerson: formData.contactPerson.trim(),
      contactTitle: '担当者',
      memo: formData.memo.trim(),
      source: '直接受付',
      receivedAt: format(today, 'yyyy-MM-dd'),
      salesRep: formData.salesRep || defaultRep,
      product: 'テマサック自動精算機',
      quantity: 1,
      status: initialStatus,
      priority: formData.todoPriority,
      lastActivityAt: format(today, 'yyyy-MM-dd'),
      ballHolder: formData.salesRep || defaultRep,
      isImplementationProject: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 2. 初回ToDo（アクション）作成
    const initialAction: NextAction = {
      id: uuidv4(),
      projectId: projectId,
      title: formData.todoTitle.trim(),
      assignee: formData.salesRep || defaultRep,
      deadline: formData.todoDeadline || todayStr,
      priority: formData.todoPriority,
      status: '未完了',
      memo: formData.todoMemo.trim(),
      createdAt: new Date().toISOString()
    };

    // 3. 登録実行
    addProject(newProject, initialAction);

    setRegisteredSummary({
      clinicName: newProject.clinicName,
      todoTitle: initialAction.title,
      todoDeadline: initialAction.deadline,
      salesRep: initialAction.assignee
    });

    setIsRegistered(true);
    localStorage.removeItem('project_draft_v2');
  };

  const handleReset = () => {
    setIsRegistered(false);
    setRegisteredSummary(null);
    setFormData({
      clinicName: '',
      contactPerson: '',
      phone: '',
      salesRep: defaultRep,
      memo: '',
      todoTitle: '初回電話ヒアリング',
      todoDeadline: todayStr,
      todoPriority: '高',
      todoMemo: ''
    });
  };

  // 登録完了ビュー
  if (isRegistered && registeredSummary) {
    return (
      <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '0 1rem', textAlign: 'center' }}>
        <div className="card" style={{ padding: '2.5rem 1.5rem', borderRadius: '1rem', boxShadow: 'var(--shadow-md)' }}>
          <CheckCircle2 size={56} color="var(--success)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>案件とToDoを登録しました</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
            ダッシュボードの「今日やること」および案件管理に反映されました。
          </p>

          <div style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'left', marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>登録案件</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>
              🏥 {registeredSummary.clinicName}
            </div>

            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#92400e', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <CheckSquare size={16} /> 最初のアクション（ToDo）
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                {registeredSummary.todoTitle}
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>
                <div>期限: <strong>{registeredSummary.todoDeadline}</strong></div>
                <div>担当: <strong>{registeredSummary.salesRep}</strong></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => navigate('/')} 
              style={{ minHeight: '48px', justifyContent: 'center', fontSize: '1rem', fontWeight: 600 }}
            >
              ダッシュボードで確認する
            </button>
            <button 
              className="btn btn-outline" 
              onClick={() => navigate('/projects')} 
              style={{ minHeight: '44px', justifyContent: 'center', fontSize: '0.95rem' }}
            >
              案件管理一覧を開く
            </button>
            <button 
              onClick={handleReset} 
              style={{ minHeight: '40px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
            >
              続けて次の案件を登録する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* ページタイトル ＆ 音声一括入力トリガー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', padding: '0.6rem', borderRadius: '0.75rem', display: 'flex' }}>
            <UserPlus size={24} color="var(--primary)" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>新規案件・ToDo登録</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              顧客情報と初回アクションをセットで素早く登録します
            </p>
          </div>
        </div>

        {/* 🎙️ 喋って一括入力ボタン */}
        <button
          type="button"
          onClick={() => setIsVoiceModalOpen(true)}
          style={{
            minHeight: '44px',
            padding: '0.5rem 1rem',
            borderRadius: '2rem',
            backgroundColor: '#eef2ff',
            color: 'var(--primary)',
            border: '1px solid rgba(79, 70, 229, 0.25)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            boxShadow: '0 2px 6px rgba(79, 70, 229, 0.15)'
          }}
        >
          <Mic size={18} color="var(--primary)" />
          <span>🎙️ 喋って一括入力</span>
        </button>
      </div>

      {/* 音声入力モーダル */}
      <VoiceActionModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onFillForm={(parsed) => {
          setFormData(prev => ({
            ...prev,
            clinicName: parsed.clinicName !== '新規お問い合わせ案件' ? parsed.clinicName : prev.clinicName,
            contactPerson: parsed.contactPerson || prev.contactPerson,
            todoTitle: parsed.todoTitle || prev.todoTitle,
            todoDeadline: parsed.deadline || prev.todoDeadline,
            todoPriority: parsed.priority || prev.todoPriority,
            memo: parsed.memo || prev.memo
          }));
        }}
      />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* 案件・顧客情報 */}
        <section className="card" style={{ padding: '1.5rem', borderRadius: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🏥</span>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>案件・顧客情報</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* クリニック名 */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                医療機関・クリニック名 <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input 
                type="text" 
                name="clinicName" 
                value={formData.clinicName} 
                onChange={handleChange} 
                required 
                className="input-field"
                style={{ width: '100%', minHeight: '44px', fontSize: '1rem' }} 
                placeholder="例：さくら内科クリニック" 
              />
              {existingCount > 0 && formData.clinicName.length > 2 && (
                <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.85rem', backgroundColor: '#fffbeb', color: '#92400e', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <AlertTriangle size={16} /> 既存顧客が見つかりました（登録済み: {existingCount}件）
                </div>
              )}
            </div>

            {/* 担当者・電話番号（2列） */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  ご担当者名（院長・事務長など）
                </label>
                <input 
                  type="text" 
                  name="contactPerson" 
                  value={formData.contactPerson} 
                  onChange={handleChange} 
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px' }} 
                  placeholder="例：山田 太郎 院長" 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  電話番号
                </label>
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px' }} 
                  placeholder="例：03-1234-5678" 
                />
              </div>
            </div>

            {/* 担当営業 */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                担当営業
              </label>
              <input 
                type="text" 
                name="salesRep" 
                value={formData.salesRep} 
                onChange={handleChange} 
                className="input-field"
                style={{ width: '100%', minHeight: '44px' }} 
                placeholder="担当営業名" 
              />
            </div>

            {/* メモ */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                案件メモ・要望概要
              </label>
              <textarea 
                name="memo" 
                value={formData.memo} 
                onChange={handleChange} 
                rows={2} 
                className="input-field"
                style={{ width: '100%', padding: '0.6rem' }} 
                placeholder="問い合わせ背景、希望製品、特記事項など"
              />
            </div>
          </div>
        </section>

        {/* 最初のアクション（ToDo）設定 */}
        <section className="card" style={{ padding: '1.5rem', borderRadius: '0.75rem', borderLeft: '5px solid var(--primary)', backgroundColor: '#faf5ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(79, 70, 229, 0.15)', paddingBottom: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckSquare size={20} color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                最初のアクション（ToDo）
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', backgroundColor: '#ede9fe', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
              必須
            </span>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            案件登録と同時に最初のアクションを設定し、タスクの放置をゼロにします。
          </p>

          {/* クイック選択タグ */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              よく使うアクションから選ぶ:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {quickActions.map(actionTitle => (
                <button
                  type="button"
                  key={actionTitle}
                  onClick={() => setFormData(prev => ({ ...prev, todoTitle: actionTitle }))}
                  style={{
                    minHeight: '36px',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '20px',
                    border: formData.todoTitle === actionTitle ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: formData.todoTitle === actionTitle ? 'var(--primary)' : '#ffffff',
                    color: formData.todoTitle === actionTitle ? '#ffffff' : 'var(--text-main)',
                    fontSize: '0.825rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {actionTitle}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* アクション内容 */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                アクション内容 <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input 
                type="text" 
                name="todoTitle" 
                value={formData.todoTitle} 
                onChange={handleChange} 
                required 
                className="input-field"
                style={{ width: '100%', minHeight: '44px', fontSize: '0.95rem', fontWeight: 600 }} 
                placeholder="例：初回電話ヒアリング" 
              />
            </div>

            {/* 期限と優先度（2列） */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  対応期限 <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input 
                  type="date" 
                  name="todoDeadline" 
                  value={formData.todoDeadline} 
                  onChange={handleChange} 
                  required 
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px', fontSize: '0.95rem' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  優先度
                </label>
                <select 
                  name="todoPriority" 
                  value={formData.todoPriority} 
                  onChange={handleChange} 
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px', fontSize: '0.95rem' }}
                >
                  <option value="高">🔴 高（即日・最優先）</option>
                  <option value="中">🟡 中（通常）</option>
                  <option value="低">🟢 低（状況伺い等）</option>
                </select>
              </div>
            </div>

            {/* アクションメモ */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                ToDoメモ（電話のポイント・持ち物など）
              </label>
              <input 
                type="text" 
                name="todoMemo" 
                value={formData.todoMemo} 
                onChange={handleChange} 
                className="input-field"
                style={{ width: '100%', minHeight: '44px' }} 
                placeholder="例：院長先生あてに午前中にTEL、デモ機空き日程を確認" 
              />
            </div>
          </div>
        </section>

        {/* 登録実行ボタン */}
        <div style={{ marginTop: '0.5rem' }}>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ 
              width: '100%', 
              minHeight: '52px', 
              justifyContent: 'center', 
              fontSize: '1.1rem', 
              fontWeight: 700, 
              borderRadius: '0.65rem',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>案件とToDoを一緒に登録する</span>
            <ArrowRight size={18} />
          </button>
        </div>

      </form>
    </div>
  );
}
