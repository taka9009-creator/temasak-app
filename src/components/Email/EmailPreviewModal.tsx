import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Mail, Building, User, MapPin } from 'lucide-react';
import { ExtractedRecipient } from '../../types/email';
import { interpolateVariables, OPTOUT_FOOTER_TEXT } from '../../utils/emailValidator';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: ExtractedRecipient[];
  subject: string;
  body: string;
  includeOptOut: boolean;
  senderName?: string;
  senderEmail?: string;
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  recipients,
  subject,
  body,
  includeOptOut,
  senderName = '松浦 貴文 (テマサック)',
  senderEmail = 'matsuura@example.com'
}: EmailPreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const selectedRecipients = recipients.filter(r => r.isSelected);

  if (!isOpen || selectedRecipients.length === 0) return null;

  const currentRecipient = selectedRecipients[currentIndex] || selectedRecipients[0];

  const interpolatedSubject = interpolateVariables(subject, currentRecipient);
  let interpolatedBody = interpolateVariables(body, currentRecipient);
  if (includeOptOut) {
    interpolatedBody += OPTOUT_FOOTER_TEXT;
  }

  const handlePrev = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : selectedRecipients.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev < selectedRecipients.length - 1 ? prev + 1 : 0));
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
        maxWidth: '720px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* ヘッダー */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              差し込み実データ プレビュー
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              各宛先に届く実際のメールレイアウトを確認できます
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  padding: '0.3rem',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontWeight: 600 }}>{currentIndex + 1}</span> / {selectedRecipients.length}
              <button
                type="button"
                onClick={handleNext}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  padding: '0.3rem',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* 顧客情報インフォバー */}
        <div style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#eff6ff',
          borderBottom: '1px solid #dbeafe',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          fontSize: '0.8rem',
          color: '#1e40af',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Building size={14} />
            <strong>{currentRecipient.companyName || '（会社名なし）'}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <User size={14} />
            <span>{currentRecipient.recipientName || '（氏名なし）'} 様</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Mail size={14} />
            <span>{currentRecipient.email}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MapPin size={14} />
            <span>{currentRecipient.region || '（地域なし）'}</span>
          </div>
        </div>

        {/* メールプレビュー領域（クライアント風） */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            {/* 宛先・差出人ヘッダー */}
            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', marginBottom: '0.4rem' }}>
                <span style={{ width: '70px', color: '#64748b' }}>差出人:</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{senderName} &lt;{senderEmail}&gt;</span>
              </div>
              <div style={{ display: 'flex', marginBottom: '0.4rem' }}>
                <span style={{ width: '70px', color: '#64748b' }}>宛先 (To):</span>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>
                  {currentRecipient.recipientName ? `${currentRecipient.recipientName} 様 ` : ''}&lt;{currentRecipient.email}&gt;
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#059669', backgroundColor: '#ecfdf5', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                  個別送信 (1顧客1通)
                </span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ width: '70px', color: '#64748b' }}>件名:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{interpolatedSubject}</span>
              </div>
            </div>

            {/* 本文エリア */}
            <div style={{ padding: '1.5rem', whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '0.92rem', color: '#1e293b' }}>
              {interpolatedBody}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            ※ BCCではなく個別送信のため、他の受信者アドレスが見えることはありません。
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: '0.375rem',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            プレビューを閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
