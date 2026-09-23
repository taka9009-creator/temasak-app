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
  Tag
} from 'lucide-react';
import { useEmail } from '../../context/EmailContext';
import { EmailTemplate } from '../../types/email';

export default function EmailTemplates() {
  const { templates, saveTemplate, deleteTemplate } = useEmail();

  // モーダル編集ステート
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenNew = () => {
    setEditingTemplate({
      name: '',
      category: 'custom',
      subject: '',
      body: '',
      includeOptOut: true
    });
    setIsModalOpen(true);
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
            営業用途に応じた定型文を登録・カスタマイズできます。一斉送信時に自動セットされます。
          </p>
        </div>

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
          <span>新しいテンプレートを作成</span>
        </button>
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
              WebkitLineClamp: 4,
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    テンプレート名 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingTemplate.name || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    placeholder="例: 初回案内（クリニック向け）"
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
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      使用可能変数: {`{{会社名}}`}, {`{{氏名}}`}, {`{{担当者}}`}, {`{{地域}}`}
                    </span>
                  </div>
                  <textarea
                    required
                    rows={10}
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
