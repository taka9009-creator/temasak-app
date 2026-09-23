import React, { useState, useMemo } from 'react';
import { 
  CheckSquare, 
  Square, 
  Filter, 
  Search, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Ban, 
  Copy,
  ChevronDown
} from 'lucide-react';
import { ExtractedRecipient, ExtractionSummary } from '../../types/email';

interface RecipientFilterTableProps {
  recipients: ExtractedRecipient[];
  summary: ExtractionSummary;
  onSelectionChange: (updated: ExtractedRecipient[]) => void;
}

export default function RecipientFilterTable({
  recipients,
  summary,
  onSelectionChange
}: RecipientFilterTableProps) {
  // 絞り込みフィルター条件
  const [filterRegion, setFilterRegion] = useState('');
  const [filterSalesRep, setFilterSalesRep] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterValidity, setFilterValidity] = useState<'all' | 'valid_only' | 'invalid_only' | 'selected_only'>('all');

  // 地域・担当者・ステータスの選択肢一覧を抽出
  const uniqueRegions = useMemo(() => {
    return Array.from(new Set(recipients.map(r => r.region).filter(Boolean))).sort();
  }, [recipients]);

  const uniqueSalesReps = useMemo(() => {
    return Array.from(new Set(recipients.map(r => r.salesRep).filter(Boolean))).sort();
  }, [recipients]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(recipients.map(r => r.status).filter(Boolean))).sort();
  }, [recipients]);

  // フィルター適用後のリスト
  const filteredRecipients = useMemo(() => {
    return recipients.filter(r => {
      if (filterRegion && r.region !== filterRegion) return false;
      if (filterSalesRep && r.salesRep !== filterSalesRep) return false;
      if (filterStatus && r.status !== filterStatus) return false;

      if (filterValidity === 'valid_only' && !r.isValidEmail) return false;
      if (filterValidity === 'invalid_only' && r.isValidEmail) return false;
      if (filterValidity === 'selected_only' && !r.isSelected) return false;

      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const match = 
          r.companyName.toLowerCase().includes(q) ||
          r.recipientName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.phone.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [recipients, filterRegion, filterSalesRep, filterStatus, filterValidity, searchKeyword]);

  // 個別チェック切り替え
  const handleToggleSelect = (id: string) => {
    const updated = recipients.map(r => {
      if (r.id === id) {
        return { ...r, isSelected: !r.isSelected };
      }
      return r;
    });
    onSelectionChange(updated);
  };

  // 条件に一致する人を全選択
  const handleSelectAllFiltered = () => {
    const filteredIds = new Set(filteredRecipients.filter(r => r.isValidEmail).map(r => r.id));
    const updated = recipients.map(r => {
      if (filteredIds.has(r.id)) {
        return { ...r, isSelected: true };
      }
      return r;
    });
    onSelectionChange(updated);
  };

  // 条件に一致する人の選択を全解除
  const handleDeselectAllFiltered = () => {
    const filteredIds = new Set(filteredRecipients.map(r => r.id));
    const updated = recipients.map(r => {
      if (filteredIds.has(r.id)) {
        return { ...r, isSelected: false };
      }
      return r;
    });
    onSelectionChange(updated);
  };

  // 全有効アドレスを一括選択
  const handleSelectAllValid = () => {
    const updated = recipients.map(r => ({
      ...r,
      isSelected: r.isValidEmail
    }));
    onSelectionChange(updated);
  };

  const selectedCount = recipients.filter(r => r.isSelected).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. 上部集計サマリーバー */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '0.75rem'
      }}>
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>総件数</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{summary.totalRows} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>件</span></div>
        </div>

        <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 600 }}>メールアドレスあり</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#047857' }}>{summary.validCount} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>件</span></div>
        </div>

        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>アドレスなし/空欄</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>{summary.noEmailCount} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>件</span></div>
        </div>

        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>重複件数</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#b45309' }}>{summary.duplicateCount} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>件</span></div>
        </div>

        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>不正メール形式</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>{summary.invalidEmailCount} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>件</span></div>
        </div>

        <div style={{ backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#5b21b6', fontWeight: 600 }}>配信停止対象</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#6d28d9' }}>{summary.optedOutCount} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>件</span></div>
        </div>

        <div style={{ backgroundColor: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 700 }}>今回の送信対象</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb' }}>{selectedCount} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>件</span></div>
        </div>
      </div>

      {/* 2. 絞り込みフィルターバー */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.875rem', fontWeight: 600 }}>
          <Filter size={18} />
          <span>送信対象の絞り込み条件</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
          {/* キーワード検索 */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="会社名・氏名・メール..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.5rem 0.5rem 2.25rem',
                borderRadius: '0.375rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem'
              }}
            />
          </div>

          {/* 地域 */}
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
          >
            <option value="">すべての地域</option>
            {uniqueRegions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* 担当者 */}
          <select
            value={filterSalesRep}
            onChange={(e) => setFilterSalesRep(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
          >
            <option value="">すべての担当者</option>
            {uniqueSalesReps.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* ステータス */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
          >
            <option value="">すべてのステータス</option>
            {uniqueStatuses.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          {/* 状態フィルター */}
          <select
            value={filterValidity}
            onChange={(e) => setFilterValidity(e.target.value as any)}
            style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
          >
            <option value="all">状態：すべて</option>
            <option value="valid_only">有効アドレスのみ</option>
            <option value="selected_only">選択中のみ ({selectedCount}件)</option>
            <option value="invalid_only">除外・エラーのみ</option>
          </select>
        </div>

        {/* 一括選択アクションバー */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #f1f5f9',
          paddingTop: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            現在の表示件数: <strong>{filteredRecipients.length}</strong> 件
            {filteredRecipients.length !== recipients.length && '（絞り込み中）'}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <CheckSquare size={15} />
              <span>条件に一致する人を全選択</span>
            </button>

            <button
              type="button"
              onClick={handleDeselectAllFiltered}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <Square size={15} />
              <span>表示中の選択を解除</span>
            </button>

            <button
              type="button"
              onClick={handleSelectAllValid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#ecfdf5',
                color: '#065f46',
                border: '1px solid #a7f3d0',
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span>有効な全件を選択</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. 顧客データテーブル */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '0.75rem', width: '48px', textAlign: 'center' }}>選択</th>
                <th style={{ padding: '0.75rem' }}>状態</th>
                <th style={{ padding: '0.75rem' }}>会社名・医院名</th>
                <th style={{ padding: '0.75rem' }}>氏名</th>
                <th style={{ padding: '0.75rem' }}>メールアドレス</th>
                <th style={{ padding: '0.75rem' }}>地域</th>
                <th style={{ padding: '0.75rem' }}>担当者</th>
                <th style={{ padding: '0.75rem' }}>ステータス</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecipients.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                    条件に一致する顧客データがありません。
                  </td>
                </tr>
              ) : (
                filteredRecipients.map((recipient) => {
                  const isBlocked = !recipient.isValidEmail;

                  return (
                    <tr
                      key={recipient.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: recipient.isSelected 
                          ? '#eff6ff' 
                          : isBlocked 
                            ? '#fef2f2' 
                            : '#ffffff',
                        transition: 'background-color 0.1s ease'
                      }}
                    >
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={recipient.isSelected}
                          disabled={isBlocked}
                          onChange={() => handleToggleSelect(recipient.id)}
                          style={{ width: '16px', height: '16px', cursor: isBlocked ? 'not-allowed' : 'pointer' }}
                        />
                      </td>

                      <td style={{ padding: '0.75rem' }}>
                        {recipient.isValidEmail ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#059669', fontSize: '0.75rem', fontWeight: 600 }}>
                            <CheckCircle2 size={14} />
                            正常
                          </span>
                        ) : recipient.isOptedOut ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#7c3aed', fontSize: '0.75rem', fontWeight: 600 }}>
                            <Ban size={14} />
                            配信停止
                          </span>
                        ) : recipient.isDuplicate ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#d97706', fontSize: '0.75rem', fontWeight: 600 }}>
                            <Copy size={14} />
                            重複除外
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}>
                            <XCircle size={14} />
                            {recipient.validationError || 'エラー'}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem', fontWeight: 600, color: '#1e293b' }}>
                        {recipient.companyName || '-'}
                      </td>

                      <td style={{ padding: '0.75rem', color: '#334155' }}>
                        {recipient.recipientName || '-'}
                      </td>

                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: recipient.isValidEmail ? '#2563eb' : '#94a3b8' }}>
                        {recipient.email || '（未入力）'}
                      </td>

                      <td style={{ padding: '0.75rem', color: '#475569' }}>
                        {recipient.region || '-'}
                      </td>

                      <td style={{ padding: '0.75rem', color: '#475569' }}>
                        {recipient.salesRep || '-'}
                      </td>

                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          backgroundColor: '#f1f5f9',
                          color: '#475569'
                        }}>
                          {recipient.status || '未対応'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
