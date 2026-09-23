import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  Eye, 
  Send, 
  CheckCircle2, 
  FileSpreadsheet, 
  Mail, 
  Filter, 
  FileText, 
  ShieldCheck,
  AlertCircle 
} from 'lucide-react';
import ListUploader from '../../components/Email/ListUploader';
import RecipientFilterTable from '../../components/Email/RecipientFilterTable';
import TemplateSelector from '../../components/Email/TemplateSelector';
import EmailEditor from '../../components/Email/EmailEditor';
import EmailPreviewModal from '../../components/Email/EmailPreviewModal';
import BatchSendProgressModal from '../../components/Email/BatchSendProgressModal';
import { processRecipients } from '../../utils/emailValidator';
import { ExtractedRecipient, ExtractionSummary, EmailTemplate, ColumnMapping } from '../../types/email';
import { useEmail } from '../../context/EmailContext';

export default function EmailComposeWizard() {
  const navigate = useNavigate();
  const { optOuts } = useEmail();

  // 現在のステップ: 1 (取込) -> 2,3 (抽出・選択) -> 4 (テンプレート) -> 5 (作成)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // データステート
  const [fileName, setFileName] = useState<string>('');
  const [recipients, setRecipients] = useState<ExtractedRecipient[]>([]);
  const [summary, setSummary] = useState<ExtractionSummary>({
    totalRows: 0,
    validCount: 0,
    noEmailCount: 0,
    duplicateCount: 0,
    invalidEmailCount: 0,
    optedOutCount: 0,
    selectedCount: 0
  });

  // メール内容ステート
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [includeOptOut, setIncludeOptOut] = useState<boolean>(true);

  // モーダルステート
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  // エラー警告メッセージ
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  // STEP 1完了: ファイルアップロード & カラムマッピングから抽出処理
  const handleDataLoaded = ({
    fileName,
    rawRows,
    mapping
  }: {
    fileName: string;
    rawRows: Record<string, string>[];
    mapping: ColumnMapping;
  }) => {
    setFileName(fileName);

    const formattedList = rawRows.map(row => ({
      companyName: row[mapping.companyName] || '',
      recipientName: row[mapping.recipientName] || '',
      phone: row[mapping.phone] || '',
      email: row[mapping.email] || '',
      region: row[mapping.region] || '',
      salesRep: row[mapping.salesRep] || '',
      status: row[mapping.status] || '',
      projectId: row['_projectId'],
      rawRowData: row
    }));

    const result = processRecipients(formattedList, optOuts);
    setRecipients(result.recipients);
    setSummary(result.summary);

    // STEP 2 & 3（抽出・送信対象選択）へ進む
    setCurrentStep(2);
  };

  // 選択変更ハンドラ
  const handleSelectionChange = (updated: ExtractedRecipient[]) => {
    setRecipients(updated);
    const selectedCount = updated.filter(r => r.isSelected).length;
    setSummary(prev => ({ ...prev, selectedCount }));
  };

  // STEP 4: テンプレート選択ハンドラ
  const handleSelectTemplate = (template: EmailTemplate | null) => {
    if (template) {
      setSelectedTemplateId(template.id);
      setSelectedTemplateName(template.name);
      setSubject(template.subject);
      setBody(template.body);
      setIncludeOptOut(template.includeOptOut);
    } else {
      setSelectedTemplateId(null);
      setSelectedTemplateName('自由入力');
      setSubject('');
      setBody('');
    }
  };

  // 次のステップへの遷移バリデーション
  const handleNextStep = () => {
    setValidationWarning(null);

    if (currentStep === 2) {
      const selected = recipients.filter(r => r.isSelected);
      if (selected.length === 0) {
        setValidationWarning('送信対象が0件です。チェックボックスで1件以上選択してください。');
        return;
      }
      setCurrentStep(3); // テンプレート選択
    } else if (currentStep === 3) {
      setCurrentStep(4); // 件名・本文編集
    } else if (currentStep === 4) {
      if (!subject.trim()) {
        setValidationWarning('件名が入力されていません。');
        return;
      }
      if (!body.trim()) {
        setValidationWarning('本文が入力されていません。');
        return;
      }
      // STEP 6: プレビューを開く
      setIsPreviewOpen(true);
    }
  };

  // プレビュー確認後に送信モーダルを起動
  const handleOpenSendModal = () => {
    setIsPreviewOpen(false);
    setIsSendModalOpen(true);
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* 画面上部ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button
            onClick={() => navigate('/email')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '0.85rem',
              cursor: 'pointer',
              marginBottom: '0.25rem'
            }}
          >
            <ArrowLeft size={16} />
            <span>メール配信ダッシュボードへ戻る</span>
          </button>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            新規メール作成・一斉送信ウィザード
          </h1>
        </div>

        {recipients.length > 0 && (
          <div style={{
            fontSize: '0.85rem',
            backgroundColor: '#eff6ff',
            color: '#1d4ed8',
            padding: '0.4rem 0.8rem',
            borderRadius: '0.5rem',
            fontWeight: 600
          }}>
            送信対象: {recipients.filter(r => r.isSelected).length} 件
          </div>
        )}
      </div>

      {/* ステップ進行インジケーター */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        padding: '0.75rem 1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflowX: 'auto'
      }}>
        {[
          { step: 1, label: 'STEP 1: リスト取込' },
          { step: 2, label: 'STEP 2-3: 抽出・対象選択' },
          { step: 3, label: 'STEP 4: テンプレート選択' },
          { step: 4, label: 'STEP 5-6: メール作成・プレビュー' },
          { step: 5, label: 'STEP 7-10: 送信実行' }
        ].map(({ step, label }) => {
          const isActive = currentStep === step;
          const isDone = currentStep > step;

          return (
            <div
              key={step}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: isActive ? '#2563eb' : isDone ? '#059669' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.85rem',
                whiteSpace: 'nowrap'
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: isActive ? '#2563eb' : isDone ? '#ecfdf5' : '#f1f5f9',
                color: isActive ? '#ffffff' : isDone ? '#059669' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                {isDone ? '✓' : step}
              </div>
              <span>{label}</span>
            </div>
          );
        })}
      </div>

      {/* バリデーション警告 */}
      {validationWarning && (
        <div style={{
          backgroundColor: '#fef2f2',
          borderLeft: '4px solid #ef4444',
          padding: '1rem',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#991b1b',
          fontSize: '0.9rem'
        }}>
          <AlertCircle size={20} />
          <div style={{ flex: 1 }}>{validationWarning}</div>
          <button
            onClick={() => setValidationWarning(null)}
            style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ステップごとのコンテンツ */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '1rem',
        padding: '2rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
      }}>
        {currentStep === 1 && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                リストの取込（CSV / Excel / KOHAL既存案件）
              </h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                お持ちの顧客・クリニックリストファイルを読み込んでください。列名は自動で判定されます。
              </p>
            </div>
            <ListUploader onDataLoaded={handleDataLoaded} />
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                  メールアドレス抽出結果と送信対象の選択
                </h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                  重複アドレスや不正形式、配信停止リストは自動判定されています。送信したい顧客にチェックを入れてください。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                style={{ fontSize: '0.85rem', color: '#64748b', background: 'none', border: '1px solid #cbd5e1', padding: '0.35rem 0.75rem', borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                リストを再読込
              </button>
            </div>

            <RecipientFilterTable
              recipients={recipients}
              summary={summary}
              onSelectionChange={handleSelectionChange}
            />
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                メールテンプレートの選択
              </h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                営業シーンに合わせた定型文を選択するか、白紙から自由に作成してください。
              </p>
            </div>

            <TemplateSelector
              selectedTemplateId={selectedTemplateId}
              onSelect={handleSelectTemplate}
            />
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                  件名・本文の作成
                </h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                  差し込み変数（{`{{会社名}}`}, {`{{氏名}}`} 等）を活用して、1通ずつパーソナライズされた文面を作成します。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                style={{ fontSize: '0.85rem', color: '#64748b', background: 'none', border: '1px solid #cbd5e1', padding: '0.35rem 0.75rem', borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                別のテンプレートを選ぶ
              </button>
            </div>

            <EmailEditor
              subject={subject}
              body={body}
              includeOptOut={includeOptOut}
              onSubjectChange={setSubject}
              onBodyChange={setBody}
              onIncludeOptOutChange={setIncludeOptOut}
            />
          </div>
        )}
      </div>

      {/* フッター操作ナビゲーション */}
      {currentStep > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '1rem 1.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <button
            type="button"
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={18} />
            <span>前へ戻る</span>
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {currentStep === 4 ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.25rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #2563eb',
                    color: '#2563eb',
                    borderRadius: '0.5rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Eye size={18} />
                  <span>差し込みプレビュー確認</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSendModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.5rem',
                    backgroundColor: '#2563eb',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '0.5rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                  }}
                >
                  <Send size={18} />
                  <span>テスト送信・本番送信へ進む</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleNextStep}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.5rem',
                  backgroundColor: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                }}
              >
                <span>次へ進む</span>
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* プレビューモーダル */}
      <EmailPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        recipients={recipients}
        subject={subject}
        body={body}
        includeOptOut={includeOptOut}
      />

      {/* 送信（テスト・バッチ）モーダル */}
      <BatchSendProgressModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        onComplete={() => {
          setIsSendModalOpen(false);
          navigate('/email/history');
        }}
        recipients={recipients}
        subject={subject}
        body={body}
        templateName={selectedTemplateName}
      />
    </div>
  );
}
