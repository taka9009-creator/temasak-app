import React, { useState, useEffect } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useNavigate } from 'react-router-dom';
import { useMasterData } from '../context/MasterDataContext';
import { useWorkflow } from '../context/WorkflowContext';
import type { Project, NextAction, ActionPriority } from '../types';
import { CheckCircle2, AlertTriangle, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export default function ProjectRegistration() {
  const { addProject, projects } = useProjects();
  const navigate = useNavigate();
  const { masterData } = useMasterData();
  const { kanbanColumns } = useWorkflow();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // フォーム状態
  const [formData, setFormData] = useState({
    clinicName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    clinicHours: '',
    closedDays: '',
    source: '',
    sourceDetail: '', // 紹介元など
    inquiryTypes: [] as string[],
    inquiryDetail: '',
    urgency: '',
    salesRep: '松浦貴文',
    // 詳細（マップ）情報
    receiptComputer: '',
    department: '',
    subsidyName: ''
  });

  const [isRegistered, setIsRegistered] = useState(false);
  const [newProjectId, setNewProjectId] = useState<string | null>(null);

  // 下書きの自動復元
  useEffect(() => {
    const draft = localStorage.getItem('project_draft');
    if (draft) {
      try {
        setFormData(JSON.parse(draft));
      } catch (e) {}
    }
  }, []);

  // 下書きの自動保存
  useEffect(() => {
    localStorage.setItem('project_draft', JSON.stringify(formData));
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      const types = checked 
        ? [...prev.inquiryTypes, value]
        : prev.inquiryTypes.filter(t => t !== value);
      return { ...prev, inquiryTypes: types };
    });
  };

  // 重複チェックモックロジック
  const existingCount = projects.filter(p => p.clinicName === formData.clinicName).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clinicName || !formData.source || !formData.salesRep) {
      alert('必須項目を入力してください。');
      return;
    }

    const projectId = uuidv4();
    const today = new Date();
    
    // 優先度の自動判定
    let priority: ActionPriority = '中';
    if (formData.urgency === 'すぐに導入したい') priority = '高';
    else if (formData.urgency === '情報収集' || formData.urgency === '時期未定') priority = '低';

    // First column is the default starting status
    const initialStatus = kanbanColumns.length > 0 ? kanbanColumns[0].id : '新規';

    const newProject: Project = {
      id: projectId,
      clinicName: formData.clinicName,
      clinicType: '未設定', // 今回は省く
      address: formData.address,
      phone: formData.phone,
      email: formData.email,
      clinicHours: formData.clinicHours,
      closedDays: formData.closedDays,
      contactPerson: formData.contactPerson,
      contactTitle: '担当者',
      memo: formData.inquiryTypes.join('、') + (formData.inquiryDetail ? `\n詳細: ${formData.inquiryDetail}` : ''),
      source: formData.source,
      sourceDetail: formData.sourceDetail,
      receivedAt: format(today, 'yyyy-MM-dd'),
      salesRep: formData.salesRep,
      product: 'テマサック自動精算機',
      quantity: 1,
      status: initialStatus,
      priority,
      lastActivityAt: format(today, 'yyyy-MM-dd'),
      ballHolder: '自社営業',
      isImplementationProject: false,
      pipelineMap: {
        receiptComputer: formData.receiptComputer,
        department: formData.department,
        subsidyName: formData.subsidyName
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addProject(newProject);
    setNewProjectId(projectId);
    setIsRegistered(true);
    localStorage.removeItem('project_draft'); // 登録完了したら下書き削除
  };

  if (isRegistered) {
    return (
      <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '3rem 2rem' }}>
          <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>案件を登録しました</h2>
          <h3 style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{formData.clinicName}</h3>

          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'left', marginBottom: '2rem' }}>
            <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🔥 次にやること
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>初回連絡</div>
            <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}><strong>期限：</strong> 本日</div>
            <div style={{ fontSize: '0.875rem' }}><strong>担当：</strong> {formData.salesRep}</div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/projects')}>案件一覧を見る</button>
            <button className="btn btn-outline" onClick={() => { setIsRegistered(false); setFormData({ clinicName: '', contactPerson: '', phone: '', email: '', address: '', clinicHours: '', closedDays: '', source: '', sourceDetail: '', inquiryTypes: [], inquiryDetail: '', urgency: '', salesRep: '松浦貴文', receiptComputer: '', department: '', subsidyName: '' }); }}>続けて登録する</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        <UserPlus size={24} color="var(--primary)" />
        <h2 style={{ margin: 0 }}>新規案件登録</h2>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* STEP 1 */}
        <section>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>STEP 1：誰から？（流入経路）</h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>流入経路 <span style={{ color: 'var(--danger)' }}>*</span></label>
            <select name="source" value={formData.source} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)' }} required>
              <option value="">選択してください</option>
              <option value="LP反響">LP反響</option>
              <option value="BtoB紹介">BtoB紹介</option>
              <option value="BtoC紹介">BtoC紹介</option>
              <option value="展示会">展示会</option>
              <option value="その他">その他</option>
            </select>
          </div>
          
          {(formData.source === 'BtoB紹介' || formData.source === 'BtoC紹介') && (
            <div style={{ marginBottom: '1rem', animation: 'slideInRight 0.2s' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>紹介元</label>
              <input type="text" name="sourceDetail" value={formData.sourceDetail} onChange={handleChange} placeholder="例：〇〇先生" style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)' }} />
            </div>
          )}
        </section>

        {/* STEP 2 */}
        <section>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>STEP 2：誰？（顧客情報）</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>医療機関名 <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="text" name="clinicName" value={formData.clinicName} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)' }} placeholder="例：〇〇クリニック" />
            
            {existingCount > 0 && formData.clinicName.length > 2 && (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#fffbeb', color: '#92400e', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <AlertTriangle size={16} /> 既存顧客が見つかりました（過去案件: {existingCount}件）
              </div>
            )}
          </div>
        </section>

        {/* STEP 3 */}
        <section>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>STEP 3：何の相談？（案件情報）</h3>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>問い合わせ内容</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {['感染予防対策', '非接触', '現金管理の自動化（違算対策）', '会計待ち時間対策', '業務の効率化', 'キャッシュレス対策', '人件費削減', '詳細'].map(item => (
                <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" name="inquiryTypes" value={item} checked={formData.inquiryTypes.includes(item)} onChange={handleCheckboxChange} />
                  <span style={{ fontSize: '0.875rem' }}>{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>詳細</label>
            <textarea name="inquiryDetail" value={formData.inquiryDetail} onChange={handleChange} rows={3} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)' }} placeholder="現在使用している精算機が古くなったため検討、など"></textarea>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>導入希望時期（緊急度）</label>
            <select name="urgency" value={formData.urgency} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)' }}>
              <option value="">選択してください</option>
              <option value="すぐに導入したい">🔴 すぐに導入したい</option>
              <option value="1〜3か月以内">🟡 1〜3か月以内</option>
              <option value="半年以内">🟡 半年以内</option>
              <option value="時期未定">🟢 時期未定</option>
              <option value="情報収集">⚪ 情報収集</option>
            </select>
          </div>
          

        </section>

        <div style={{ marginTop: '1rem' }}>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1.125rem' }}>案件を登録してタスクを生成する</button>
        </div>

      </form>
    </div>
  );
}
