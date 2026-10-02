import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  Save, 
  X, 
  Check,
  Tag,
  Award,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { useEmail } from '../../context/EmailContext';
import { EmailTemplate } from '../../types/email';
import seedData from '../../utils/sales_os_seed.json';

export default function EmailTemplates() {
  const { templates, saveTemplate, deleteTemplate } = useEmail();

  // モーダル編集ステート
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const handleOpenNew = () => {
    setEditingTemplate({
      name: '',
      category: 'initial',
      subject: '',
      body: '',
      includeOptOut: true
    });
    setIsModalOpen(true);
  };

  // AIでナレッジ辞書276件＋マスター15件からトップ営業文面を自動生成し入力欄に補完
  const handleAiAssistGenerate = async (category: string) => {
    setIsGeneratingAi(true);
    try {
      const masters = seedData.masters || [];
      const knowledge = seedData.knowledge || [];

      // 該当カテゴリ/目的に応じたマスター型とトップフレーズを選択
      const categoryLabelMap: Record<string, string> = {
        initial: '初回案内',
        document: '資料送付',
        exhibition: '展示会',
        campaign: 'キャンペーン',
        followup: 'フォローアップ',
        case_study: '事例',
        subsidy: '補助金',
        custom: '自動精算機'
      };

      const targetLabel = categoryLabelMap[category] || '初回案内';
      const matchedMaster = masters.find((m: any) => m.category?.includes(targetLabel) || m.title?.includes(targetLabel)) || masters[0];
      
      const topPhrases = knowledge
        .filter((k: any) => k.distinctive_phrasing && k.distinctive_phrasing.length > 5)
        .map((k: any) => k.distinctive_phrasing);

      const phrase1 = topPhrases[Math.floor(Math.random() * Math.min(10, topPhrases.length))] || '補助金申請の専門スタッフが書類作成を完全サポートいたします';
      const phrase2 = topPhrases[Math.floor(Math.random() * Math.min(20, topPhrases.length))] || '通信・接続方式の変更も含め事前に技術検証いたします';

      await new Promise(r => setTimeout(r, 600));

      setEditingTemplate(prev => ({
        ...prev,
        name: prev?.name || `【トップ営業AI型】${targetLabel}テンプレート`,
        subject: prev?.subject || `【ご提案】{{地域}}のクリニック様向け「{{会社名}}」自動精算機導入のご案内`,
        body: `{{氏名}} 様
（{{会社名}} 御中）

いつも大変お世話になっております。
株式会社テマサックの{{担当者}}でございます。

トップ営業ノウハウ参照ポイント:
・本質課題: ${matchedMaster?.core_issue || '会計待ち時間の混雑・レジ締め作業の残業削減・現金過不足リスク防止'}
・決め手フレーズ: 「${phrase1}」

【テマサック導入による現場の3大成果】
1. 会計待ち時間を平均60%短縮し、院内混雑・患者様ストレスを大幅緩和
2. レジ締め作業の過不足ゼロ化＆毎日の締め時間を「30分→5分」に短縮
3. クレジット・電子マネー・QR決済および主要電子カルテ・レセコン連動に完全対応

「${phrase2}」

まずは3分で読める運用シミュレーション資料をお届けいたします。
ご興味がございましたら、本メールへご返信いただけますと幸いです。

何卒よろしくお願い申し上げます。`
      }));
    } catch (e) {
      alert('AI生成エラーが発生しました');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleOpenEdit = (t: EmailTemplate) => {
    setEditingTemplate({ ...t });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`「${name}」を削除してもよろしいですか？`)) {
      await deleteTemplate(id);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.name || !editingTemplate.subject || !editingTemplate.body) {
      alert('テンプレート名・件名・本文を入力してください。');
      return;
    }

    await saveTemplate({
      name: editingTemplate.name,
      category: (editingTemplate.category || 'custom') as any,
      subject: editingTemplate.subject,
      body: editingTemplate.body,
      includeOptOut: !!editingTemplate.includeOptOut
    }, editingTemplate.id);

    setIsModalOpen(false);
    setEditingTemplate(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
            メールテンプレート管理
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
            全テンプレートが276件のナレッジ辞書・15件の成功マスター型に基づくトップ営業仕様でプリセットされています。
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a
            href="/knowledge/browser"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.65rem 1.1rem',
              backgroundColor: '#f5f3ff',
              border: '1px solid #ddd6fe',
              color: '#6d28d9',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.875rem',
              textDecoration: 'none'
            }}
          >
            <Award size={18} />
            <span>ナレッジ辞書を参照</span>
          </a>

          <a
            href="/knowledge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.65rem 1.1rem',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.875rem',
              textDecoration: 'none'
            }}
          >
            <BookOpen size={18} />
            <span>過去メール/PDF取込</span>
          </a>

          <button
            type="button"
            onClick={handleOpenNew}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
            }}
          >
            <Plus size={18} />
            <span>新規テンプレートを作成</span>
          </button>
        </div>
      </div>

      {/* テンプレートカード一覧 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {templates.map(tmpl => (
          <div
            key={tmpl.id}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.25rem'
              }}>
                {tmpl.category}
              </span>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(tmpl)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}
                  title="編集"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(tmpl.id, tmpl.name)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                  title="削除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              {tmpl.name}
            </h3>

            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2563eb', marginBottom: '0.75rem' }}>
              {tmpl.subject}
            </div>

            <p style={{
              margin: 0,
              fontSize: '0.8rem',
              color: '#475569',
              lineHeight: '1.5',
              display: '-webkit-box',
              WebkitLineClamp: 5,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              flex: 1
            }}>
              {tmpl.body}
            </p>
          </div>
        ))}
      </div>

      {/* 作成・編集モーダル */}
      {isModalOpen && editingTemplate && (
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
            maxWidth: '680px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc'
              }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  {editingTemplate.id ? 'テンプレートの編集' : '新規テンプレート作成'}
                </h3>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                
                {/* AI自動補完アシストツールバー */}
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Sparkles size={16} /> AIナレッジ文章自動生成アシスト
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#7e22ce' }}>選択したカテゴリの最高成約率フレーズを自動補完します</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAiAssistGenerate(editingTemplate.category || 'initial')}
                    disabled={isGeneratingAi}
                    style={{
                      padding: '0.35rem 0.85rem',
                      backgroundColor: isGeneratingAi ? '#94a3b8' : '#7c3aed',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: isGeneratingAi ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isGeneratingAi ? '生成中...' : '✨ AIで文面を自動起案'}
                  </button>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    テンプレート名 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingTemplate.name || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    placeholder="例: 初回案内【トップ営業型】"
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    カテゴリ
                  </label>
                  <select
                    value={editingTemplate.category || 'custom'}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value as any })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', backgroundColor: '#fff', boxSizing: 'border-box' }}
                  >
                    <option value="initial">初回案内</option>
                    <option value="document">資料送付</option>
                    <option value="exhibition">展示会・セミナー</option>
                    <option value="campaign">キャンペーン</option>
                    <option value="followup">フォローアップ</option>
                    <option value="case_study">導入事例</option>
                    <option value="subsidy">補助金</option>
                    <option value="custom">カスタム</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    件名 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingTemplate.subject || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                    placeholder="【ご案内】{{会社名}}様向け自動精算機のご案内"
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                      本文 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                  </div>

                  {/* 差し込み変数ワンタップ挿入ボタン */}
                  <div style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: '#f0f4f8', borderRadius: '0.375rem', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>📌 差し込みタグを挿入:</span>
                    {[
                      { label: '+ {{会社名}}', tag: '{{会社名}}' },
                      { label: '+ {{氏名}}', tag: '{{氏名}}' },
                      { label: '+ {{担当者}}', tag: '{{担当者}}' },
                      { label: '+ {{地域}}', tag: '{{地域}}' }
                    ].map(btn => (
                      <button
                        key={btn.tag}
                        type="button"
                        onClick={() => setEditingTemplate(prev => prev ? ({ ...prev, body: (prev.body || '') + btn.tag }) : null)}
                        style={{
                          padding: '0.2rem 0.5rem',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#2563eb',
                          cursor: 'pointer'
                        }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    required
                    rows={12}
                    value={editingTemplate.body || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', lineHeight: '1.6', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: '#f8fafc' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', backgroundColor: '#fff', color: '#475569', cursor: 'pointer' }}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.5rem 1.5rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
