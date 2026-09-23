import React, { useState, useMemo } from 'react';
import { 
  Ban, 
  Plus, 
  Trash2, 
  Search, 
  Upload, 
  CheckCircle2, 
  AlertTriangle,
  X 
} from 'lucide-react';
import { useEmail } from '../../context/EmailContext';
import { normalizeEmail } from '../../utils/emailValidator';

export default function EmailOptOuts() {
  const { optOuts, addOptOut, removeOptOut, importOptOutsFromCsv } = useEmail();

  const [searchKeyword, setSearchKeyword] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [newReason, setNewReason] = useState('顧客要望（配信停止依頼）');

  // CSVインポート用ステート
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);

  const filteredOptOuts = useMemo(() => {
    if (!searchKeyword.trim()) return optOuts;
    const q = searchKeyword.toLowerCase();
    return optOuts.filter(o => 
      o.email.toLowerCase().includes(q) ||
      (o.companyName && o.companyName.toLowerCase().includes(q)) ||
      (o.recipientName && o.recipientName.toLowerCase().includes(q)) ||
      (o.reason && o.reason.toLowerCase().includes(q))
    );
  }, [optOuts, searchKeyword]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      alert('メールアドレスを入力してください。');
      return;
    }

    await addOptOut(newEmail, newCompany, newRecipient, newReason);
    setNewEmail('');
    setNewCompany('');
    setNewRecipient('');
    setIsAddModalOpen(false);
  };

  const handleRemove = async (id: string, email: string) => {
    if (window.confirm(`「${email}」の配信停止指定を解除し、再度配信可能にしますか？`)) {
      await removeOptOut(id);
    }
  };

  // CSVから配信停止リストを一括取込
  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
      const emails: string[] = [];

      lines.forEach(line => {
        const parts = line.split(',');
        parts.forEach(p => {
          const clean = p.replace(/"/g, '').trim();
          if (clean.includes('@')) {
            emails.push(clean);
          }
        });
      });

      if (emails.length === 0) {
        alert('有効なメールアドレスが見つかりませんでした。');
        return;
      }

      const count = await importOptOutsFromCsv(emails);
      setCsvFeedback(`${count} 件のアドレスを配信停止リストに追加しました。`);
      setTimeout(() => setCsvFeedback(null), 4000);
    } catch (err: any) {
      alert('CSV読み込みエラー: ' + err.message);
    }
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
            配信停止（オプトアウト）リスト管理
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
            ここに登録されたメールアドレスには、一斉送信時に自動で送信除外（強制スキップ）されます
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1rem',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '0.5rem',
            color: '#334155',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}>
            <Upload size={16} />
            <span>CSVから一括登録</span>
            <input type="file" accept=".csv" onChange={handleCsvImport} style={{ display: 'none' }} />
          </label>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1.25rem',
              backgroundColor: '#7c3aed',
              color: '#ffffff',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(124, 58, 237, 0.2)'
            }}
          >
            <Plus size={16} />
            <span>停止アドレスを手動登録</span>
          </button>
        </div>
      </div>

      {csvFeedback && (
        <div style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #a7f3d0', fontSize: '0.85rem', fontWeight: 600 }}>
          ✓ {csvFeedback}
        </div>
      )}

      {/* 検索バー */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="メールアドレス・会社名・氏名で検索..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.25rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
          登録件数: <strong>{filteredOptOuts.length}</strong> 件
        </div>
      </div>

      {/* テーブル */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '0.75rem' }}>停止メールアドレス</th>
              <th style={{ padding: '0.75rem' }}>会社名・医院名</th>
              <th style={{ padding: '0.75rem' }}>氏名</th>
              <th style={{ padding: '0.75rem' }}>停止理由</th>
              <th style={{ padding: '0.75rem' }}>登録日時</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>解除操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredOptOuts.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                  配信停止リストに登録されたアドレスはありません。
                </td>
              </tr>
            ) : (
              filteredOptOuts.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#dc2626', fontWeight: 600 }}>
                    {item.email}
                  </td>
                  <td style={{ padding: '0.75rem', color: '#1e293b' }}>
                    {item.companyName || '-'}
                  </td>
                  <td style={{ padding: '0.75rem', color: '#334155' }}>
                    {item.recipientName || '-'}
                  </td>
                  <td style={{ padding: '0.75rem', color: '#64748b' }}>
                    {item.reason || '顧客要望'}
                  </td>
                  <td style={{ padding: '0.75rem', color: '#64748b' }}>
                    {new Date(item.registeredAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id, item.email)}
                      style={{
                        padding: '0.3rem 0.6rem',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      解除（配信許可）
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 手動登録モーダル */}
      {isAddModalOpen && (
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
            maxWidth: '480px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <form onSubmit={handleAddSubmit}>
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc'
              }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  配信停止アドレスの手動登録
                </h3>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    メールアドレス <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="example@clinic.com"
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    会社名・クリニック名（任意）
                  </label>
                  <input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="○○クリニック"
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    氏名（任意）
                  </label>
                  <input
                    type="text"
                    value={newRecipient}
                    onChange={(e) => setNewRecipient(e.target.value)}
                    placeholder="山田 太郎"
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    配信停止の理由
                  </label>
                  <select
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', backgroundColor: '#fff', boxSizing: 'border-box' }}
                  >
                    <option value="顧客要望（配信停止依頼）">顧客要望（配信停止依頼）</option>
                    <option value="不達・バウンスエラー">不達・バウンスエラー</option>
                    <option value="競合・対象外">競合・対象外</option>
                    <option value="担当者退職・休院">担当者退職・休院</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
              </div>

              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: '#f8fafc' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', backgroundColor: '#fff', color: '#475569', cursor: 'pointer' }}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.5rem 1.5rem', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  登録する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
