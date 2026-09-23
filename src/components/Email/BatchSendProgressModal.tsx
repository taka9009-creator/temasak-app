import React, { useState } from 'react';
import { 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  ShieldCheck, 
  Clock, 
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { ExtractedRecipient } from '../../types/email';
import { useEmail } from '../../context/EmailContext';
import { useAuth } from '../../context/AuthContext';

interface BatchSendProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  recipients: ExtractedRecipient[];
  subject: string;
  body: string;
  templateName?: string;
}

export default function BatchSendProgressModal({
  isOpen,
  onClose,
  onComplete,
  recipients,
  subject,
  body,
  templateName
}: BatchSendProgressModalProps) {
  const { user } = useAuth();
  const { sendTestEmail, startBatchCampaign } = useEmail();

  // フェーズ: 'test_send' -> 'final_confirm' -> 'sending' -> 'result'
  const [phase, setPhase] = useState<'test_send' | 'final_confirm' | 'sending' | 'result'>('test_send');

  // テスト送信用アドレス（デフォルトはログインユーザーのメール、または松浦さんのアドレス）
  const [testEmail, setTestEmail] = useState(user?.email || 'matsuura@example.com');
  const [isTestSending, setIsTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 送信設定
  const [batchSize, setBatchSize] = useState(20);
  const [intervalSeconds, setIntervalSeconds] = useState(2);
  const [recordToProjects, setRecordToProjects] = useState(true);

  // 進捗ステート
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [sendResult, setSendResult] = useState<{
    successCount: number;
    failCount: number;
    errors: Array<{ email: string; error: string }>;
  } | null>(null);

  if (!isOpen) return null;

  const selectedRecipients = recipients.filter(r => r.isSelected);

  // 1. テスト送信実行
  const handleExecuteTestSend = async () => {
    setIsTestSending(true);
    setTestResult(null);

    // テスト用のサンプルプレビュー差し込み
    const sampleRecipient = selectedRecipients[0] || {
      id: 'test',
      companyName: 'テスト株式会社',
      recipientName: 'テスト担当者',
      email: testEmail,
      phone: '000-0000-0000',
      region: '札幌市',
      salesRep: user?.name || '松浦',
      status: 'テスト中',
      isValidEmail: true,
      isDuplicate: false,
      isOptedOut: false,
      isSelected: true
    };

    const res = await sendTestEmail(testEmail, subject, body);
    setIsTestSending(false);
    setTestResult(res);
  };

  // 2. 本番送信開始
  const handleStartRealSend = async () => {
    setPhase('sending');
    setProgress({ sent: 0, failed: 0, total: selectedRecipients.length });

    const result = await startBatchCampaign({
      title: `${templateName || '一斉メール配信'} (${selectedRecipients.length}件)`,
      templateName,
      subject,
      body,
      recipients: selectedRecipients,
      batchSize,
      intervalSeconds,
      recordToProjectActivities: recordToProjects,
      onProgress: (sent, failed, total) => {
        setProgress({ sent, failed, total });
      }
    });

    setSendResult(result);
    setPhase('result');
  };

  const progressPercent = progress.total > 0 
    ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) 
    : 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '1rem',
        width: '100%',
        maxWidth: '580px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* --- STEP 7: テスト送信画面 --- */}
        {phase === 'test_send' && (
          <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.6rem', borderRadius: '50%' }}>
                <ShieldCheck size={28} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  STEP 7: 安全のためのテスト送信
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  本番送信の前に、ご自身のアドレスへ1通テスト送信して文面を確認します
                </p>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                テスト送信先メールアドレス
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.4rem 0 0 0' }}>
                ※ 差し込み変数にはサンプルの医院名・氏名が入った状態で届きます。
              </p>
            </div>

            {testResult && (
              <div style={{
                backgroundColor: testResult.success ? '#ecfdf5' : '#fef2f2',
                border: testResult.success ? '1px solid #a7f3d0' : '1px solid #fecaca',
                padding: '1rem',
                borderRadius: '0.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: testResult.success ? '#065f46' : '#991b1b',
                fontSize: '0.85rem'
              }}>
                {testResult.success ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span>{testResult.message}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '0.6rem 1rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', background: '#fff', color: '#475569', cursor: 'pointer' }}
              >
                戻る
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleExecuteTestSend}
                  disabled={isTestSending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 1.25rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #2563eb',
                    color: '#2563eb',
                    borderRadius: '0.375rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isTestSending ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                  <span>{isTestSending ? '送信中...' : 'テスト送信を実行'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPhase('final_confirm')}
                  disabled={!testResult?.success}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 1.25rem',
                    backgroundColor: testResult?.success ? '#2563eb' : '#94a3b8',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 600,
                    cursor: testResult?.success ? 'pointer' : 'not-allowed'
                  }}
                >
                  <span>本番送信確認へ</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- STEP 8: 最終確認画面 --- */}
        {phase === 'final_confirm' && (
          <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ backgroundColor: '#fffbeb', color: '#d97706', padding: '0.6rem', borderRadius: '50%' }}>
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  STEP 8: 一斉送信の最終確認
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  以下の設定で本番の一斉送信を開始します
                </p>
              </div>
            </div>

            {/* 確認サマリー */}
            <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>送信対象件数:</span>
                <strong style={{ color: '#2563eb', fontSize: '1.1rem' }}>{selectedRecipients.length} 件</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>件名:</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{subject}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>送信方式:</span>
                <span style={{ color: '#059669', fontWeight: 600 }}>個別送信（1顧客 ＝ 1通 / BCC不使用）</span>
              </div>
            </div>

            {/* 分割送信・レートリミット設定 */}
            <div style={{ backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700, color: '#334155', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Layers size={16} />
                <span>メールサービス送信上限対策（自動分割送信）</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#64748b' }}>バッチサイズ（1回の送信数）</label>
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                  >
                    <option value={10}>10 件ずつ</option>
                    <option value={20}>20 件ずつ（推奨）</option>
                    <option value={50}>50 件ずつ</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#64748b' }}>送信インターバル（間隔）</label>
                  <select
                    value={intervalSeconds}
                    onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                  >
                    <option value={1}>1 秒</option>
                    <option value={2}>2 秒（推奨）</option>
                    <option value={5}>5 秒</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 案件管理連携オプション */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                id="record-activity"
                checked={recordToProjects}
                onChange={(e) => setRecordToProjects(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <label htmlFor="record-activity" style={{ color: '#334155', cursor: 'pointer' }}>
                <strong>KOHAL案件活動履歴に「一斉メール送信」を自動記録する</strong>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setPhase('test_send')}
                style={{ padding: '0.6rem 1rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', background: '#fff', color: '#475569', cursor: 'pointer' }}
              >
                テスト送信に戻る
              </button>

              <button
                type="button"
                onClick={handleStartRealSend}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.75rem',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.25)'
                }}
              >
                <Send size={18} />
                <span>{selectedRecipients.length} 件へ一斉送信を開始</span>
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 9: 送信中プログレス画面 --- */}
        {phase === 'sending' && (
          <div style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem'
            }}>
              <RefreshCw className="animate-spin" size={32} />
            </div>

            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              メール一斉送信中...
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.5rem 0 1.5rem 0' }}>
              サーバー側で1通ずつ個別宛先として安全に送信処理を行っています。画面を閉じずにお待ちください。
            </p>

            <div style={{ backgroundColor: '#e2e8f0', borderRadius: '9999px', height: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{
                backgroundColor: '#2563eb',
                height: '100%',
                width: `${progressPercent}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
              <span>進捗: {progressPercent}%</span>
              <span>{progress.sent + progress.failed} / {progress.total} 件</span>
            </div>
          </div>
        )}

        {/* --- STEP 10: 送信結果レポート画面 --- */}
        {phase === 'result' && sendResult && (
          <div style={{ padding: '2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>
                一斉送信が完了しました！
              </h3>
              <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                全件の送信処理が完了し、配信履歴へ記録されました。
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 600 }}>送信成功</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#047857' }}>{sendResult.successCount} <span style={{ fontSize: '0.85rem' }}>件</span></div>
              </div>

              <div style={{ backgroundColor: sendResult.failCount > 0 ? '#fef2f2' : '#f8fafc', border: sendResult.failCount > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: sendResult.failCount > 0 ? '#991b1b' : '#64748b', fontWeight: 600 }}>送信失敗</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: sendResult.failCount > 0 ? '#dc2626' : '#64748b' }}>{sendResult.failCount} <span style={{ fontSize: '0.85rem' }}>件</span></div>
              </div>
            </div>

            {sendResult.errors.length > 0 && (
              <div style={{ marginBottom: '1.5rem', maxHeight: '120px', overflowY: 'auto', border: '1px solid #fecaca', borderRadius: '0.375rem', padding: '0.75rem', backgroundColor: '#fef2f2', fontSize: '0.75rem' }}>
                <strong style={{ color: '#991b1b', display: 'block', marginBottom: '0.25rem' }}>エラー発生アドレス:</strong>
                {sendResult.errors.map((e, idx) => (
                  <div key={idx} style={{ color: '#b91c1c' }}>
                    {e.email}: {e.error}
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onComplete}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              配信履歴で確認する
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
