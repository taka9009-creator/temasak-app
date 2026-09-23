import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Ban, 
  Clock, 
  Eye, 
  X,
  FileSpreadsheet
} from 'lucide-react';
import { useEmail } from '../../context/EmailContext';
import { EmailLog } from '../../types/email';

export default function EmailHistory() {
  const { logs, campaigns } = useEmail();

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 詳細モーダル用
  const [activeLog, setActiveLog] = useState<EmailLog | null>(null);

  // フィルタリング処理
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (selectedCampaignId !== 'all' && log.campaignId !== selectedCampaignId) return false;
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;

      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const match = 
          log.companyName.toLowerCase().includes(q) ||
          log.recipientName.toLowerCase().includes(q) ||
          log.email.toLowerCase().includes(q) ||
          log.subject.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [logs, selectedCampaignId, statusFilter, searchKeyword]);

  // CSVエクスポート
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      alert('出力するデータがありません。');
      return;
    }

    const headers = ['送信日時', '宛先メールアドレス', '会社名', '氏名', '件名', 'テンプレート', 'ステータス', 'エラー内容'];
    const rows = filteredLogs.map(l => [
      `"${l.sentAt || l.createdAt}"`,
      `"${l.email}"`,
      `"${l.companyName}"`,
      `"${l.recipientName}"`,
      `"${l.subject.replace(/"/g, '""')}"`,
      `"${l.templateName || '直接作成'}"`,
      `"${l.status === 'sent' ? '送信済み' : l.status === 'failed' ? '送信失敗' : l.status === 'opted_out' ? '配信停止除外' : l.status}"`,
      `"${(l.errorMessage || '').replace(/"/g, '""')}"`
    ]);

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const csvContent = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kohal_email_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* 画面ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
            メール送信履歴・監査ログ
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
            過去に送信されたすべての個別メール送信記録、結果、エラー内容を確認できます
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.25rem',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.85rem',
            color: '#334155',
            cursor: 'pointer'
          }}
        >
          <Download size={16} />
          <span>履歴をCSVダウンロード</span>
        </button>
      </div>

      {/* 検索・絞り込みフィルターバー */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        padding: '1rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.75rem'
      }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="会社名・氏名・メール・件名..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.25rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
          />
        </div>

        <select
          value={selectedCampaignId}
          onChange={(e) => setSelectedCampaignId(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
        >
          <option value="all">すべてのキャンペーン</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
        >
          <option value="all">すべてのステータス</option>
          <option value="sent">送信済み（成功）</option>
          <option value="failed">送信失敗（エラー）</option>
          <option value="opted_out">配信停止（除外）</option>
        </select>
      </div>

      {/* 履歴テーブル */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '0.75rem' }}>ステータス</th>
                <th style={{ padding: '0.75rem' }}>送信日時</th>
                <th style={{ padding: '0.75rem' }}>宛先会社名</th>
                <th style={{ padding: '0.75rem' }}>氏名</th>
                <th style={{ padding: '0.75rem' }}>宛先アドレス</th>
                <th style={{ padding: '0.75rem' }}>件名</th>
                <th style={{ padding: '0.75rem' }}>テンプレート</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>詳細</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                    該当する送信ログがありません。
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem' }}>
                      {log.status === 'sent' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#059669', fontWeight: 600, fontSize: '0.75rem' }}>
                          <CheckCircle2 size={15} /> 送信済み
                        </span>
                      ) : log.status === 'failed' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#dc2626', fontWeight: 600, fontSize: '0.75rem' }}>
                          <XCircle size={15} /> 失敗
                        </span>
                      ) : log.status === 'opted_out' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#7c3aed', fontWeight: 600, fontSize: '0.75rem' }}>
                          <Ban size={15} /> 配信停止
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#d97706', fontWeight: 600, fontSize: '0.75rem' }}>
                          <Clock size={15} /> 送信中
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {log.sentAt ? new Date(log.sentAt).toLocaleString('ja-JP') : new Date(log.createdAt).toLocaleString('ja-JP')}
                    </td>

                    <td style={{ padding: '0.75rem', fontWeight: 600, color: '#0f172a' }}>
                      {log.companyName || '-'}
                    </td>

                    <td style={{ padding: '0.75rem', color: '#334155' }}>
                      {log.recipientName || '-'}
                    </td>

                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#2563eb' }}>
                      {log.email}
                    </td>

                    <td style={{ padding: '0.75rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1e293b' }}>
                      {log.subject}
                    </td>

                    <td style={{ padding: '0.75rem', color: '#64748b' }}>
                      {log.templateName || '直接作成'}
                    </td>

                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setActiveLog(log)}
                        style={{
                          backgroundColor: '#f1f5f9',
                          border: 'none',
                          borderRadius: '0.375rem',
                          padding: '0.35rem 0.6rem',
                          color: '#475569',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.75rem'
                        }}
                      >
                        <Eye size={13} />
                        <span>確認</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 送信本文・エラー詳細モーダル */}
      {activeLog && (
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
            maxWidth: '640px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                送信ログ詳細
              </h3>
              <button onClick={() => setActiveLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeLog.errorMessage && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '0.75rem 1rem', borderRadius: '0.5rem', color: '#991b1b', fontSize: '0.85rem' }}>
                  <strong>エラー内容:</strong> {activeLog.errorMessage}
                </div>
              )}

              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                <div style={{ marginBottom: '0.35rem' }}><strong>宛先:</strong> {activeLog.recipientName} 様 ({activeLog.companyName}) &lt;{activeLog.email}&gt;</div>
                <div style={{ marginBottom: '0.35rem' }}><strong>件名:</strong> {activeLog.subject}</div>
                <div style={{ marginBottom: '0.35rem' }}><strong>送信日時:</strong> {activeLog.sentAt ? new Date(activeLog.sentAt).toLocaleString('ja-JP') : '-'}</div>
                <div><strong>テンプレート:</strong> {activeLog.templateName || '直接作成'}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>
                  送信された本文（差し込み後）
                </label>
                <div style={{
                  padding: '1rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  backgroundColor: '#ffffff',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                  color: '#1e293b'
                }}>
                  {activeLog.body}
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setActiveLog(null)}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer', color: '#475569' }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
