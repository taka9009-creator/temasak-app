import React, { useState } from 'react';
import { FileText, Check, Plus, Sparkles, Tag } from 'lucide-react';
import { EmailTemplate } from '../../types/email';
import { useEmail } from '../../context/EmailContext';

interface TemplateSelectorProps {
  selectedTemplateId: string | null;
  onSelect: (template: EmailTemplate | null) => void;
}

export default function TemplateSelector({ selectedTemplateId, onSelect }: TemplateSelectorProps) {
  const { templates } = useEmail();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'すべて' },
    { id: 'initial', label: '初回案内' },
    { id: 'document', label: '資料送付' },
    { id: 'followup', label: 'フォローアップ' },
    { id: 'subsidy', label: '補助金' },
    { id: 'campaign', label: 'キャンペーン' },
    { id: 'case_study', label: '導入事例' },
    { id: 'exhibition', label: '展示会' }
  ];

  const filteredTemplates = templates.filter(t => {
    if (activeCategory === 'all') return true;
    return t.category === activeCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* カテゴリタブ */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: activeCategory === cat.id ? '1px solid #2563eb' : '1px solid #e2e8f0',
              backgroundColor: activeCategory === cat.id ? '#eff6ff' : '#ffffff',
              color: activeCategory === cat.id ? '#1d4ed8' : '#64748b',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* テンプレートカードグリッド */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {/* 白紙から作成カード */}
        <div
          onClick={() => onSelect(null)}
          style={{
            border: selectedTemplateId === null ? '2px solid #2563eb' : '1px dashed #cbd5e1',
            backgroundColor: selectedTemplateId === null ? '#eff6ff' : '#f8fafc',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '140px',
            textAlign: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: selectedTemplateId === null ? '#dbeafe' : '#e2e8f0',
            color: selectedTemplateId === null ? '#2563eb' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <Plus size={20} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>白紙から自由に作成</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>テンプレートを使わずに手入力</div>
        </div>

        {/* テンプレート一覧 */}
        {filteredTemplates.map(tmpl => {
          const isSelected = selectedTemplateId === tmpl.id;

          return (
            <div
              key={tmpl.id}
              onClick={() => onSelect(tmpl)}
              style={{
                border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                backgroundColor: isSelected ? '#f0f7ff' : '#ffffff',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: isSelected ? '0 4px 6px -1px rgba(37, 99, 235, 0.1)' : '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease'
              }}
            >
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Check size={14} />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.25rem'
                }}>
                  {categories.find(c => c.id === tmpl.category)?.label || '定型文'}
                </span>
              </div>

              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', paddingRight: '1.5rem', lineHeight: '1.3' }}>
                {tmpl.name}
              </h4>

              <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                件名: {tmpl.subject}
              </div>

              <p style={{
                margin: 0,
                fontSize: '0.75rem',
                color: '#64748b',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: '1.4'
              }}>
                {tmpl.body}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
