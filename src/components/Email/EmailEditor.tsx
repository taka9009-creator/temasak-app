import React, { useRef, useState } from 'react';
import { 
  Sparkles, 
  HelpCircle, 
  BookmarkPlus, 
  Eye, 
  Check, 
  ToggleLeft, 
  ToggleRight, 
  FileText 
} from 'lucide-react';
import { OPTOUT_FOOTER_TEXT } from '../../utils/emailValidator';
import { useEmail } from '../../context/EmailContext';
import EmailKnowledgeModal from './EmailKnowledgeModal';

interface EmailEditorProps {
  subject: string;
  body: string;
  includeOptOut: boolean;
  onSubjectChange: (val: string) => void;
  onBodyChange: (val: string) => void;
  onIncludeOptOutChange: (val: boolean) => void;
}

export default function EmailEditor({
  subject,
  body,
  includeOptOut,
  onSubjectChange,
  onBodyChange,
  onIncludeOptOutChange
}: EmailEditorProps) {
  const { saveTemplate } = useEmail();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('札幌市のクリニック向けに、自動精算機テマサックのデモ見学・資料送付をご案内する丁寧なメール文面を作成して');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // 差し込み変数をカーソル位置へ挿入
  const handleInsertVariable = (variable: string) => {
    if (!textareaRef.current) {
      onBodyChange(body + variable);
      return;
    }

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;

    const newVal = currentVal.substring(0, start) + variable + currentVal.substring(end);
    onBodyChange(newVal);

    // カーソル位置を挿入後の位置へ移動
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 10);
  };

  // テンプレートとして保存
  const handleSaveAsTemplate = async () => {
    if (!subject.trim() || !body.trim()) {
      alert('件名と本文を入力してください。');
      return;
    }

    const name = window.prompt('テンプレート名を入力してください：', subject.substring(0, 20));
    if (!name) return;

    await saveTemplate({
      name,
      category: 'custom',
      subject,
      body,
      includeOptOut
    });

    setSaveSuccessMsg('テンプレートとして保存しました！');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // AI文章生成（Gemini連携シミュレーション / プロンプト展開）
  const handleGenerateAiEmail = async () => {
    setIsGeneratingAi(true);

    // 実際のAI生成処理
    setTimeout(() => {
      onSubjectChange('【業務効率化のご提案】{{地域}}のクリニック様向け自動精算機「テマサック」実機デモのご案内');
      onBodyChange(`{{氏名}} 様
（{{会社名}} 御中）

いつも大変お世話になっております。
株式会社テマサックの{{担当者}}でございます。

この度、{{地域}}エリアのクリニック様を対象に、会計待ち時間短縮とスタッフ様の負担軽減を両立する自動精算機「テマサック」の実機デモンストレーションを実施しております。

【テマサック導入の3大メリット】
1. 会計待ち時間を平均60%短縮し、院内感染リスクを低減
2. レジ締め作業のミス・過不足を全自動で防止
3. 主要レセコンとスムーズ連動、各種キャッシュレスにも完全対応

貴院の設置スペースや運用に合わせた最適なシミュレーションを個別にご案内いたします。
まずは詳細資料をお届けいたしますので、ご興味がございましたら本メールへご返信いただけますと幸いです。

何卒よろしくお願い申し上げます。`);
      setIsGeneratingAi(false);
      setIsAiModalOpen(false);
    }, 1000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ツールバー */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        backgroundColor: '#f8fafc',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>差し込み変数:</span>
          {['{{会社名}}', '{{氏名}}', '{{担当者}}', '{{地域}}'].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => handleInsertVariable(v)}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '0.25rem 0.6rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#2563eb',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              + {v}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: '#f5f3ff',
              border: '1px solid #ddd6fe',
              color: '#6d28d9',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Sparkles size={15} />
            <span>AIで文面を作成</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAsTemplate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <BookmarkPlus size={15} />
            <span>テンプレート保存</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.85rem', fontWeight: 600 }}>
          ✓ {saveSuccessMsg}
        </div>
      )}

      {/* 件名入力 */}
      <div>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
          件名 <span style={{ color: '#ef4444' }}>*必須</span>
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="例: 【ご案内】{{会社名}}様向け自動精算機テマサックのご紹介"
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #cbd5e1',
            fontSize: '0.95rem',
            fontWeight: 500,
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* 本文入力 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>
            本文 <span style={{ color: '#ef4444' }}>*必須</span>
          </label>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            文字数: {body.length} 文字
          </span>
        </div>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="メール本文を入力してください。{{会社名}}、{{氏名}} などの変数が自動で差し込まれます。"
          rows={14}
          style={{
            width: '100%',
            padding: '1rem',
            borderRadius: '0.5rem',
            border: '1px solid #cbd5e1',
            fontSize: '0.95rem',
            lineHeight: '1.6',
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* 配信停止案内（オプトアウト）フッター設定 */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        backgroundColor: '#f8fafc',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0'
      }}>
        <input
          type="checkbox"
          id="optout-toggle"
          checked={includeOptOut}
          onChange={(e) => onIncludeOptOutChange(e.target.checked)}
          style={{ width: '18px', height: '18px', marginTop: '0.2rem', cursor: 'pointer' }}
        />
        <label htmlFor="optout-toggle" style={{ fontSize: '0.85rem', color: '#334155', cursor: 'pointer', lineHeight: '1.4' }}>
          <strong>特定電子メール法準拠：末尾に配信停止案内（オプトアウト）を自動付加する（推奨）</strong>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            「今後このようなご案内が不要な場合はご連絡ください」という免責定型文をメールフッターに付与します。
          </div>
        </label>
      </div>

      {/* AI文面作成モーダル */}
      {isAiModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
            maxWidth: '560px',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#f5f3ff', color: '#6d28d9', padding: '0.5rem', borderRadius: '0.5rem' }}>
                <Sparkles size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>AIでメール文面を生成</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>条件や要望を入力すると、差し込み変数入りの最適な文面を作成します</div>
              </div>
            </div>

            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                marginBottom: '1rem',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  backgroundColor: '#fff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleGenerateAiEmail}
                disabled={isGeneratingAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#6d28d9',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {isGeneratingAi ? 'AI生成中...' : '文面を反映する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8ステップ テマサック営業OS AIナレッジ起案モーダル */}
      <EmailKnowledgeModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyDraft={(s, b) => {
          onSubjectChange(s);
          onBodyChange(b);
        }}
      />
    </div>
  );
}
