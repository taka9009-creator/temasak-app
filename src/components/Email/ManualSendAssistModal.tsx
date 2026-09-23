import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ExternalLink, 
  Copy, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  SkipForward, 
  X, 
  Mail, 
  Building, 
  User, 
  Sparkles 
} from 'lucide-react';
import { ExtractedRecipient } from '../../types/email';
import { interpolateVariables, OPTOUT_FOOTER_TEXT } from '../../utils/emailValidator';
import { useEmail } from '../../context/EmailContext';

interface ManualSendAssistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  recipients: ExtractedRecipient[];
  subject: string;
  body: string;
  includeOptOut: boolean;
  templateName?: string;
}

export default function ManualSendAssistModal({
  isOpen,
  onClose,
  onComplete,
  recipients,
  subject,
  body,
  includeOptOut,
  templateName
}: ManualSendAssistModalProps) {
  const { addManualSendLog } = useEmail();
  const selectedRecipients = recipients.filter(r => r.isSelected);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen || selectedRecipients.length === 0) return null;

  const currentRecipient = selectedRecipients[currentIndex] || selectedRecipients[0];
  const isFinished = completedIds.size >= selectedRecipients.length;

  // 差し込み後の件名と本文
  const currentSubject = interpolateVariables(subject, currentRecipient);
  let currentBody = interpolateVariables(body, currentRecipient);
  if (includeOptOut) {
    currentBody += OPTOUT_FOOTER_TEXT;
  }

  // クリップボードコピー
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Gmail新規作成画面をワンクリックで起動
  const handleOpenGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(currentRecipient.email)}&su=${encodeURIComponent(currentSubject)}&body=${encodeURIComponent(currentBody)}`;
    window.open(gmailUrl, '_blank');
  };

  // 通常メーラー / Active! mail 用の mailto リンク
  const handleOpenMailto = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(currentRecipient.email)}?subject=${encodeURIComponent(currentSubject)}&body=${encodeURIComponent(currentBody)}`;
    window.location.href = mailtoUrl;
  };

  // 送信完了として次へ進む
  const handleMarkAsSentAndNext = async () => {
    setCompletedIds(prev => new Set(prev).add(currentRecipient.id));

    // ログ保存
    await addManualSendLog({
      email: currentRecipient.email,
      companyName: currentRecipient.companyName,
      recipientName: currentRecipient.recipientName,
      subject: currentSubject,
      body: currentBody,
      templateName: templateName || '手動送信アシスト'
    });

    if (currentIndex < selectedRecipients.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // スキップして次へ
  const handleSkip = () => {
    if (currentIndex < selectedRecipients.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const progressPercent = Math.round((completedIds.size / selectedRecipients.length) * 100);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
        maxWidth: '760px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden'
      }}>
        {/* モーダルヘッダー */}
        <div style={{
          padding: '1.25rem 1.5rem',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ backgroundColor: '#10b981', color: '#ffffff', padding: '0.4rem', borderRadius: '0.5rem', display: 'flex' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                社内セキュア送信アシスト（社内監査ログゼロ・完全安全）
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                会社のGoogle WorkspaceやActive! mail画面から直接送信するため、外部ツールの接続痕跡が一切残りません
              </p>
            </div>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
            <X size={22} />
          </button>
        </div>

        {/* 進捗プログレスバー */}
        <div style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#334155', fontWeight: 600, marginBottom: '0.4rem' }}>
            <span>送信進捗: {completedIds.size} / {selectedRecipients.length} 件 完了 ({progressPercent}%)</span>
            <span>現在: {currentIndex + 1} 件目を表示中</span>
          </div>
          <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* メイン操作エリア */}
        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 現在の顧客カード */}
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '0.75rem',
            padding: '1rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#1e40af', fontWeight: 700, fontSize: '1rem' }}>
                <Building size={16} />
                <span>{currentRecipient.companyName || '（会社名なし）'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#334155', fontSize: '0.9rem' }}>
                <User size={15} />
                <span>{currentRecipient.recipientName || '（氏名なし）'} 様</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#2563eb', fontWeight: 600, fontSize: '0.9rem', fontFamily: 'monospace' }}>
                <Mail size={15} />
                <span>{currentRecipient.email}</span>
              </div>
            </div>

            {completedIds.has(currentRecipient.id) && (
              <span style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>
                ✓ 送信済
              </span>
            )}
          </div>

          {/* ★ ワンクリック起動ボタン群 ★ */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '2px solid #2563eb',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.1)'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={16} color="#2563eb" />
              <span>ワンクリックでメール作成画面を開く（宛先・件名・本文が自動入力されます）</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleOpenGmail}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.8rem 1rem',
                  backgroundColor: '#ea4335',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(234, 67, 53, 0.25)'
                }}
              >
                <ExternalLink size={18} />
                <span>Gmailで作成画面を開く</span>
              </button>

              <button
                type="button"
                onClick={handleOpenMailto}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.8rem 1rem',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
                }}
              >
                <ExternalLink size={18} />
                <span>Active! mail / メーラーで開く</span>
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem', textAlign: 'center' }}>
              ※ クリックするとブラウザの別タブでメール作成画面が立ち上がり、相手の名前が入った状態でセットされます。
            </div>
          </div>

          {/* ★ コピペ用ボックス ★ */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                手動コピペ用（ボタンを押すだけでクリップボードにコピーされます）
              </span>

              <button
                type="button"
                onClick={() => handleCopy(`【宛先】${currentRecipient.email}\n【件名】${currentSubject}\n\n${currentBody}`, 'all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#2563eb',
                  cursor: 'pointer'
                }}
              >
                {copiedType === 'all' ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                <span>{copiedType === 'all' ? '一括コピー完了！' : '宛先・件名・本文を一括コピー'}</span>
              </button>
            </div>

            {/* 宛先 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '60px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>宛先:</span>
              <input
                type="text"
                readOnly
                value={currentRecipient.email}
                style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
              />
              <button
                type="button"
                onClick={() => handleCopy(currentRecipient.email, 'email')}
                style={{ padding: '0.4rem 0.75rem', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                {copiedType === 'email' ? 'コピー済' : 'コピー'}
              </button>
            </div>

            {/* 件名 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '60px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>件名:</span>
              <input
                type="text"
                readOnly
                value={currentSubject}
                style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff', fontWeight: 600 }}
              />
              <button
                type="button"
                onClick={() => handleCopy(currentSubject, 'subject')}
                style={{ padding: '0.4rem 0.75rem', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                {copiedType === 'subject' ? 'コピー済' : 'コピー'}
              </button>
            </div>

            {/* 本文 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>差し込み本文:</span>
                <button
                  type="button"
                  onClick={() => handleCopy(currentBody, 'body')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  {copiedType === 'body' ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                  <span>{copiedType === 'body' ? '本文コピー完了' : '本文のみコピー'}</span>
                </button>
              </div>
              <textarea
                readOnly
                rows={7}
                value={currentBody}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  lineHeight: '1.6',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>

        {/* モーダルフッター（ステータス更新＆次へ） */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.5rem 0.8rem',
                backgroundColor: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                color: '#475569',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <ArrowLeft size={14} />
              <span>前の顧客</span>
            </button>

            <button
              type="button"
              onClick={handleSkip}
              disabled={currentIndex >= selectedRecipients.length - 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.5rem 0.8rem',
                backgroundColor: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                color: '#475569',
                cursor: currentIndex >= selectedRecipients.length - 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <SkipForward size={14} />
              <span>スキップ</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {isFinished ? (
              <button
                type="button"
                onClick={onComplete}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.5rem',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <CheckCircle2 size={18} />
                <span>全件送信完了（履歴で確認）</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleMarkAsSentAndNext}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.5rem',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)'
                }}
              >
                <Check size={18} />
                <span>送信完了 ＆ 次の顧客へ進む</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
