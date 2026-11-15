import React, { useState, useEffect } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkflow } from '../context/WorkflowContext';
import type { Project, NextAction, ActionPriority } from '../types';
import { CheckCircle2, AlertTriangle, UserPlus, CheckSquare, ArrowRight, Mic, Mail, Upload, X, RefreshCw } from 'lucide-react';
import VoiceActionModal from '../components/VoiceActionModal';
import { parsePastedRosterText, convertParsedLeadsToProjects, inferDepartment } from '../utils/roster42Data';
import {
  readInquiryEmlFiles,
  parseInquiryEml,
  inferDeviceTypeFromProducts,
  findMatchingProjectsForEml,
  formatEmlMemo,
  buildProjectUpdatesFromEml,
  createProjectAndActionFromEml,
  SAMPLE_EML_3543_TEXT
} from '../utils/emlParser';
import type { ParsedInquiryEml } from '../utils/emlParser';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const EMPTY_EXTRA = {
  email: '',
  address: '',
  postalCode: '',
  contactTitle: '',
  furigana: '',
  rececon: '',
  inquiryNo: '',
  receivedAt: '',
  products: '',
  inquiryTypes: '',
  reason: '',
  content: ''
};

export default function ProjectRegistration() {
  const { addProject, addProjectsBulk, updateProject, projects } = useProjects();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { kanbanColumns } = useWorkflow();

  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [pasteRawText, setPasteRawText] = useState('');
  const parsedPasteList = React.useMemo(() => {
    if (!pasteRawText.trim()) return [];
    return parsePastedRosterText(pasteRawText);
  }, [pasteRawText]);

  const handleBulkPasteRegister = () => {
    if (parsedPasteList.length === 0) return;
    const { projects: newProjs, actions: newActs } = convertParsedLeadsToProjects(parsedPasteList);
    addProjectsBulk(newProjs, newActs);
    alert(`コピペから ${newProjs.length} 件の新規案件を一括登録しました！`);
    navigate('/');
  };

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
    todoMemo: '',
    ...EMPTY_EXTRA
  });

  // 📧 EML読み込み状態
  const [emlInfo, setEmlInfo] = useState<ParsedInquiryEml | null>(null);
  const [emlQueue, setEmlQueue] = useState<ParsedInquiryEml[]>([]);
  const [emlError, setEmlError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [emlPasteText, setEmlPasteText] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const applyParsedEml = (parsed: ParsedInquiryEml) => {
    if (!parsed.clinicName && !parsed.phone && !parsed.email) {
      setEmlError('お問い合わせ項目（【貴院名】【電話番号】など）が見つかりませんでした。フォームからのお問い合わせメールか確認してください。');
      setEmlInfo(null);
      return false;
    }
    setEmlError('');
    setEmlInfo(parsed);
    setFormData(prev => ({
      ...prev,
      clinicName: parsed.clinicName || prev.clinicName,
      contactPerson: parsed.contactPerson || prev.contactPerson,
      contactTitle: parsed.contactTitle || prev.contactTitle,
      furigana: parsed.furigana || prev.furigana,
      phone: parsed.phone || prev.phone,
      email: parsed.email || prev.email,
      address: parsed.address || prev.address,
      postalCode: parsed.postalCode || prev.postalCode,
      rececon: parsed.rececon || prev.rececon,
      inquiryNo: parsed.inquiryNo || prev.inquiryNo,
      receivedAt: parsed.receivedAt || prev.receivedAt,
      products: parsed.products || prev.products,
      inquiryTypes: parsed.inquiryTypes || prev.inquiryTypes,
      reason: parsed.reason || prev.reason,
      content: parsed.content || prev.content,
      memo: formatEmlMemo(parsed),
      todoTitle: parsed.inquiryTypes.includes('資料請求') ? '資料到着確認の初回架電（ファーストコール）' : '初回電話ヒアリング',
      todoPriority: '高',
      todoMemo: parsed.content ? `ご要望: ${parsed.content.slice(0, 80)}` : prev.todoMemo
    }));
    return true;
  };

  const handleEmlFiles = async (files: FileList | File[] | undefined | null) => {
    if (!files || files.length === 0) return;
    try {
      const results = await readInquiryEmlFiles(files);
      const valid = results.filter(r => r.clinicName || r.phone || r.email);
      if (valid.length === 0) {
        setEmlQueue([]);
        setEmlError('お問い合わせ項目（【貴院名】【電話番号】など）が見つかりませんでした。フォームからのお問い合わせメールか確認してください。');
        setEmlInfo(null);
        return;
      }
      setEmlQueue(valid);
      applyParsedEml(valid[0]);
    } catch (e) {
      console.error('EML parse error:', e);
      setEmlError('EMLファイルの読み込みに失敗しました。');
    }
  };

  const handleEmlPasteApply = () => {
    if (!emlPasteText.trim()) return;
    const parsed = parseInquiryEml(emlPasteText);
    if (applyParsedEml(parsed)) setEmlQueue([parsed]);
  };

  const handleLoadSampleEml = () => {
    const parsed = parseInquiryEml(SAMPLE_EML_3543_TEXT);
    if (applyParsedEml(parsed)) setEmlQueue([parsed]);
  };

  const handleApplyEmlToExisting = (target: Project, parsed?: ParsedInquiryEml | null) => {
    const source = parsed || emlInfo;
    if (!source) return;
    updateProject(target.id, buildProjectUpdatesFromEml(target, source));
    localStorage.removeItem('project_draft_v2');
    alert(`既存案件「${target.clinicName}」の基本情報（メール・レセコン・担当者・希望商材など）にEMLの内容を反映しました！`);
    navigate('/');
  };

  const handleBulkEmlRegister = () => {
    if (emlQueue.length === 0) return;
    const initialStatus = kanbanColumns.length > 0 ? kanbanColumns[0].id : '新規';
    const salesRep = formData.salesRep || defaultRep;
    const created = emlQueue.map(item => createProjectAndActionFromEml(item, { salesRep, initialStatus }));
    addProjectsBulk(
      created.map(c => c.project),
      created.map(c => c.action)
    );
    localStorage.removeItem('project_draft_v2');
    alert(`${created.length} 件のEMLを新規案件として一括登録しました！`);
    navigate('/');
  };

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

  // 重複チェック（名称の部分一致・電話番号・反響番号）
  const duplicateProjects = React.useMemo(
    () =>
      findMatchingProjectsForEml(projects, {
        clinicName: formData.clinicName,
        phone: formData.phone,
        inquiryNo: formData.inquiryNo
      }),
    [projects, formData.clinicName, formData.phone, formData.inquiryNo]
  );
  const existingCount = duplicateProjects.length;

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
    if (
      existingCount > 0 &&
      !window.confirm(`同じクリニック・電話番号・反響番号の案件が既に ${existingCount} 件登録されています。\n（${duplicateProjects.map(p => p.clinicName).join(' / ')}）\n\nそれでも新規登録しますか？`)
    ) {
      return;
    }

    const projectId = `prod-${uuidv4()}`;
    const today = new Date();
    const todayYmd = format(today, 'yyyy-MM-dd');
    const receivedAt = formData.receivedAt || todayYmd;
    const initialStatus = kanbanColumns.length > 0 ? kanbanColumns[0].id : '新規';
    const clinicName = formData.clinicName.trim();
    const department = inferDepartment(clinicName);
    const isFromEml = !!emlInfo;
    const contactTitle = formData.contactTitle.trim();
    const contactPerson = formData.contactPerson.trim();
    const isDirector = contactTitle.includes('院長') || contactTitle.includes('理事長');

    const activities = [
      {
        id: `act-rec-${projectId}`,
        projectId,
        date: receivedAt,
        type: '反響受付',
        content: isFromEml
          ? `資料請求・お問い合わせフォーム（受付番号: ${formData.inquiryNo || '-'}）をEMLから取込。種別: ${formData.inquiryTypes || '-'} / 商材: ${formData.products || '-'}`
          : '新規案件として登録'
      }
    ];

    // 1. プロジェクト作成
    const newProject: Project = {
      id: projectId,
      clinicName,
      clinicType: department === '医療機関' ? 'クリニック' : department,
      address: formData.address.trim(),
      postalCode: formData.postalCode.trim() || undefined,
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      contactPerson,
      contactTitle: contactTitle || '担当者',
      furigana: formData.furigana.trim() || undefined,
      inquiryType: formData.inquiryTypes || undefined,
      inquiryReason: formData.reason || undefined,
      inquiryContent: formData.content.trim() || undefined,
      memo: formData.memo.trim(),
      source: isFromEml ? 'HP資料請求・お問い合わせフォーム' : '直接受付',
      sourceDetail: formData.inquiryNo ? `反響番号: ${formData.inquiryNo}` : undefined,
      receivedAt,
      salesRep: formData.salesRep || defaultRep,
      product: formData.products ? `テマサック（${formData.products}）` : 'テマサック自動精算機',
      quantity: 1,
      status: initialStatus,
      priority: formData.todoPriority,
      lastActivityAt: todayYmd,
      ballHolder: formData.salesRep || defaultRep,
      isImplementationProject: false,
      reservationSystem: formData.rececon.trim() || undefined,
      activities,
      pipelineMap: {
        department: department === '医療機関' ? undefined : department,
        receiptComputer: formData.rececon.trim() || undefined,
        director: isDirector ? contactPerson : undefined,
        furigana: formData.furigana.trim() || undefined,
        deviceType: inferDeviceTypeFromProducts(formData.products) || undefined,
        inquiryType: formData.inquiryTypes || undefined,
        inquiryReason: formData.reason || undefined,
        inquiryContent: formData.content.trim() || undefined,
        purpose: formData.content
          ? formData.reason
            ? `${formData.reason}（${formData.content}）`
            : formData.content
          : formData.reason || undefined
      },
      aiSummary: isFromEml
        ? `【${formData.address || '住所未設定'}】反響日:${receivedAt}（HPフォーム #${formData.inquiryNo || '-'}）。理由: ${formData.reason || '-'}。${formData.content ? `要望: ${formData.content}` : ''}`
        : undefined,
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
      todoMemo: '',
      ...EMPTY_EXTRA
    });
    setEmlInfo(null);
    setEmlQueue([]);
    setEmlError('');
    setEmlPasteText('');
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

      {/* 📧 EML読み込みで自動入力（資料請求・お問い合わせフォームのメール） */}
      <section
        className="card"
        onDragOver={e => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          handleEmlFiles(e.dataTransfer.files);
        }}
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: '0.85rem',
          marginBottom: '1.5rem',
          backgroundColor: isDragOver ? '#dbeafe' : '#eff6ff',
          border: `2px ${isDragOver ? 'solid' : 'dashed'} #3b82f6`,
          transition: 'background-color 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Mail size={18} /> 📧 お問い合わせメール（EML）から自動入力
          </h3>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                minHeight: '40px',
                padding: '0.45rem 0.95rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Upload size={16} /> EMLファイルを選択（複数可）
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".eml,.txt,message/rfc822,text/plain"
            style={{ display: 'none' }}
            onChange={e => {
              handleEmlFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.8rem', color: '#1d4ed8' }}>
          「資料請求・お問い合わせフォームよりお問い合わせがありました」のメール（.eml）をここへドラッグ＆ドロップ（複数まとめてもOK）。
          貴院名・担当者・役職・電話・メール・住所・レセコン・商材・お問い合わせ内容を自動で入力します（ファイルは端末内だけで処理）。
        </p>

        <details style={{ fontSize: '0.8rem', color: '#1e40af' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>📋 メール本文をコピペして読み込む（スマホ向け）</summary>
          <textarea
            rows={4}
            value={emlPasteText}
            onChange={e => setEmlPasteText(e.target.value)}
            placeholder={'【貴院名】\n　〇〇クリニック\n【電話番号】\n　011-xxx-xxxx ...'}
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #93c5fd', fontSize: '0.85rem', fontFamily: 'monospace' }}
          />
          <button
            type="button"
            onClick={handleEmlPasteApply}
            disabled={!emlPasteText.trim()}
            style={{
              marginTop: '0.4rem',
              padding: '0.45rem 0.9rem',
              borderRadius: '0.45rem',
              border: '1px solid #2563eb',
              backgroundColor: emlPasteText.trim() ? '#ffffff' : '#f1f5f9',
              color: '#1d4ed8',
              fontWeight: 700,
              cursor: emlPasteText.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            本文から自動入力
          </button>
        </details>

        {emlError && (
          <div style={{ marginTop: '0.6rem', padding: '0.55rem 0.8rem', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '0.45rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={15} /> {emlError}
          </div>
        )}

        {emlInfo && (
          <div style={{ marginTop: '0.75rem', backgroundColor: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '0.6rem', padding: '0.75rem 0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <strong style={{ color: '#065f46', fontSize: '0.88rem' }}>
                ✅ 読み込み完了{emlInfo.inquiryNo ? `（受付番号 ${emlInfo.inquiryNo}）` : ''} — 下のフォームに反映しました
              </strong>
              <button
                type="button"
                onClick={() => {
                  setEmlInfo(null);
                  setEmlQueue([]);
                }}
                title="プレビューを閉じる"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.3rem 0.9rem', fontSize: '0.8rem', color: '#334155' }}>
              <div>🏥 {emlInfo.clinicName || '-'}</div>
              <div>👤 {emlInfo.contactTitle} {emlInfo.contactPerson}</div>
              <div>📞 {emlInfo.phone || '-'}</div>
              <div>✉️ {emlInfo.email || '-'}</div>
              <div style={{ gridColumn: '1 / -1' }}>📍 {emlInfo.postalCode && `〒${emlInfo.postalCode} `}{emlInfo.address || '-'}</div>
              <div>🧾 レセコン: {emlInfo.rececon || '-'}</div>
              <div>📅 反響日: {emlInfo.receivedAt}</div>
              <div style={{ gridColumn: '1 / -1' }}>🖥️ 商材: {emlInfo.products || '-'}</div>
              <div style={{ gridColumn: '1 / -1' }}>📝 種別: {emlInfo.inquiryTypes || '-'} / 理由: {emlInfo.reason || '-'}</div>
            </div>

            {duplicateProjects.length > 0 && (
              <div style={{ marginTop: '0.65rem', padding: '0.6rem 0.75rem', backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <AlertTriangle size={15} /> すでに「{duplicateProjects[0].clinicName}」が登録されています（新規ではなく既存案件への反映も可能です）
                </span>
                <button
                  type="button"
                  onClick={() => handleApplyEmlToExisting(duplicateProjects[0], emlInfo)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '0.45rem',
                    border: 'none',
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <RefreshCw size={14} /> 既存案件「{duplicateProjects[0].clinicName}」の基本情報にこのEML内容を反映する
                </button>
              </div>
            )}

            {emlQueue.length > 1 && (
              <div style={{ marginTop: '0.65rem', paddingTop: '0.6rem', borderTop: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e3a8a' }}>
                  📦 複数EML読み込み済み（{emlQueue.length}件）— クリックで個別プレビュー切替
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '110px', overflowY: 'auto' }}>
                  {emlQueue.map((item, idx) => (
                    <button
                      key={`${item.inquiryNo}-${idx}`}
                      type="button"
                      onClick={() => applyParsedEml(item)}
                      style={{
                        textAlign: 'left',
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.35rem',
                        border: emlInfo === item ? '1px solid #2563eb' : '1px solid #e2e8f0',
                        backgroundColor: emlInfo === item ? '#eff6ff' : '#f8fafc',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <span>#{item.inquiryNo || '-'}</span>
                      <strong>🏥 {item.clinicName || '-'}</strong>
                      <span style={{ color: '#64748b' }}>📞 {item.phone || '-'}</span>
                      <span style={{ color: '#0369a1', marginLeft: 'auto' }}>🧾 {item.rececon || '-'}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleBulkEmlRegister}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    backgroundColor: '#1d4ed8',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  ✅ 読み込んだ {emlQueue.length} 件のEMLを一括登録する
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 📋 コピペ一括入力セクション（反響日 / 顧客名 / 都道府県・市区町村 / 担当(松浦)） */}
      <section className="card" style={{
        padding: '1.25rem 1.5rem',
        borderRadius: '0.85rem',
        marginBottom: '1.5rem',
        backgroundColor: '#f0fdf4',
        border: '2px solid #10b981'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#065f46' }}>
            📋 コピペで一瞬登録（「反響日 / 顧客名 / 都道府県・市区町村 / 担当(松浦)」を貼るだけ）
          </h3>
        </div>

        <p style={{ margin: '0 0 0.65rem 0', fontSize: '0.8rem', color: '#047857' }}>
          Excel・スプレッドシートの行や、スラッシュ区切りのテキストを複数行まとめて貼り付けできます。
        </p>

        <textarea
          rows={3}
          value={pasteRawText}
          onChange={e => setPasteRawText(e.target.value)}
          placeholder={`例1: 2026-11-07 / おおぞら内科クリニック / 北海道札幌市北区 / 松浦\n例2: 2026-11-07\tみなみ歯科医院\t福島県\t郡山市\t松浦`}
          style={{
            width: '100%',
            padding: '0.65rem',
            borderRadius: '0.5rem',
            border: '1px solid #34d399',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
            backgroundColor: '#ffffff',
            marginBottom: '0.65rem'
          }}
        />

        {parsedPasteList.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065f46' }}>
              🔍 認識プレビュー ({parsedPasteList.length}件):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '120px', overflowY: 'auto' }}>
              {parsedPasteList.map(item => (
                <div key={item.id} style={{ backgroundColor: '#ffffff', padding: '0.35rem 0.65rem', borderRadius: '0.35rem', border: '1px solid #a7f3d0', fontSize: '0.8rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span>📅 {item.receivedDate}</span>
                  <strong>🏥 {item.clinicName}</strong>
                  <span style={{ color: '#1d4ed8' }}>📍 {item.address}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#047857' }}>👤 {item.salesRep}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleBulkPasteRegister}
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: '#059669',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: 'pointer'
              }}
            >
              ✅ この {parsedPasteList.length} 件をワンクリックで登録する
            </button>
          </div>
        )}
      </section>

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
                  <AlertTriangle size={16} /> 既存の可能性がある案件: {duplicateProjects.slice(0, 3).map(p => p.clinicName).join(' / ')}（{existingCount}件）
                </div>
              )}
            </div>

            {/* 役職・反響日（2列） */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  ご担当役職
                </label>
                <input
                  type="text"
                  name="contactTitle"
                  value={formData.contactTitle}
                  onChange={handleChange}
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px' }}
                  placeholder="例：院長 / 事務長"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  反響日
                </label>
                <input
                  type="date"
                  name="receivedAt"
                  value={formData.receivedAt}
                  onChange={handleChange}
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px' }}
                />
              </div>
            </div>

            {/* 担当者・フリガナ・電話番号（3列） */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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
                  フリガナ
                </label>
                <input 
                  type="text" 
                  name="furigana" 
                  value={formData.furigana} 
                  onChange={handleChange} 
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px' }} 
                  placeholder="例：ヤマダ タロウ" 
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

            {/* メール・レセコン（2列） */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  メールアドレス
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px' }}
                  placeholder="例：info@clinic.jp"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  電子カルテ / レセコン
                </label>
                <input
                  type="text"
                  name="rececon"
                  value={formData.rececon}
                  onChange={handleChange}
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px' }}
                  placeholder="例：ORCA / アニコムレセプター"
                />
              </div>
            </div>

            {/* 住所 */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                住所{formData.postalCode && <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>〒{formData.postalCode}</span>}
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="input-field"
                style={{ width: '100%', minHeight: '44px' }}
                placeholder="例：北海道札幌市中央区宮の森四条5-3-25"
              />
            </div>

            {/* お問い合わせ商材・反響番号（2列） */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  お問い合わせ商材
                </label>
                <input
                  type="text"
                  name="products"
                  value={formData.products}
                  onChange={handleChange}
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px' }}
                  placeholder="例：テマサックPro スタンドタイプ"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  反響番号（受付番号）
                </label>
                <input
                  type="text"
                  name="inquiryNo"
                  value={formData.inquiryNo}
                  onChange={handleChange}
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px' }}
                  placeholder="例：3543"
                />
              </div>
            </div>

            {/* お問い合わせ種別・お問い合わせ理由（2列） */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  お問い合わせ種別
                </label>
                <input
                  type="text"
                  name="inquiryTypes"
                  value={formData.inquiryTypes}
                  onChange={handleChange}
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px' }}
                  placeholder="例：資料請求,その他ご相談/質問"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  お問い合わせ理由
                </label>
                <input
                  type="text"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px' }}
                  placeholder="例：業務の効率化"
                />
              </div>

              {/* お問い合わせ内容 */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  お問い合わせ内容
                </label>
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  rows={3}
                  className="input-field"
                  style={{ width: '100%', padding: '0.6rem' }}
                  placeholder="例：人員不足の為セミセルフレジを検討しています。導入について、実際の使用感を知りたいです。"
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
                rows={formData.memo.split('\n').length > 2 ? 5 : 2} 
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
