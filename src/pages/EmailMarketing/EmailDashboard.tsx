import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Ban, 
  FileText, 
  Users, 
  TrendingUp, 
  Plus, 
  History, 
  ArrowRight,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { useEmail } from '../../context/EmailContext';
import { useProjects } from '../../context/ProjectContext';

export default function EmailDashboard() {
  const navigate = useNavigate();
  const { campaigns, logs, templates, optOuts } = useEmail();
  const { projects } = useProjects();

  // 今日の送信数、今月の送信数、成功・失敗の集計
  const todayStr = new Date().toISOString().split('T')[0];
  const thisMonthStr = todayStr.substring(0, 7);

  const todayLogs = logs.filter(l => (l.sentAt || l.createdAt).startsWith(todayStr));
  const monthLogs = logs.filter(l => (l.sentAt || l.createdAt).startsWith(thisMonthStr));

  const totalSuccess = logs.filter(l => l.status === 'sent').length;
  const totalFailed = logs.filter(l => l.status === 'failed').length;
  const successRate = (totalSuccess + totalFailed) > 0 
    ? Math.round((totalSuccess / (totalSuccess + totalFailed)) * 100) 
    : 100;

  // 登録済みメールアドレス数（既存プロジェクト）
  const projectsWithEmail = projects.filter(p => p.email && p.email.includes('@')).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      {/* 画面トップヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
            メール配信ダッシュボード
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            顧客リストからのメール抽出、個別差し込み、一斉送信および送信履歴を一括管理します
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/email/compose')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderRadius: '0.5rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)'
          }}
        >
          <Plus size={20} />
          <span>新規メール作成・配信</span>
        </button>
      </div>

      {/* 1. 集計KPIカードグリッド */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <span>今月の送信件数</span>
            <Send size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
            {monthLogs.length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>通</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.25rem' }}>本日: {todayLogs.length} 通</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <span>送信成功（累計）</span>
            <CheckCircle2 size={18} color="#059669" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#047857' }}>
            {totalSuccess} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>通</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>到達成功率: {successRate}%</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <span>送信失敗 / エラー</span>
            <XCircle size={18} color="#dc2626" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: totalFailed > 0 ? '#dc2626' : '#0f172a' }}>
            {totalFailed} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>件</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>要確認</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <span>配信停止（オプトアウト）</span>
            <Ban size={18} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#6d28d9' }}>
            {optOuts.length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>件</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>自動送信除外中</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <span>登録テンプレート数</span>
            <FileText size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
            {templates.length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>種</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>プリセット＆カスタム</div>
        </div>
      </div>

      {/* 将来の高度分析（開封率・クリック率などの枠組みUI） */}
      <div style={{
        backgroundColor: '#f8fafc',
        border: '1px dashed #cbd5e1',
        borderRadius: '0.75rem',
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <TrendingUp size={20} color="#64748b" />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
              エンゲージメント指標（拡張予定）
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              開封率 (Open Rate)・クリック率 (CTR)・返信追跡のリアルタイムトラッキングに対応可能なアーキテクチャ
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#475569' }}>
          <div>推定開封率: <strong>-- %</strong></div>
          <div>リンククリック率: <strong>-- %</strong></div>
          <div>返信率: <strong>-- %</strong></div>
        </div>
      </div>

      {/* 2. クイックアクションパネル */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div
          onClick={() => navigate('/email/compose')}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.6rem', borderRadius: '0.5rem' }}>
              <Send size={24} />
            </div>
            <ArrowRight size={18} color="#94a3b8" />
          </div>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
            新規メール作成・一斉送信
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            CSV/Excelから抽出してテスト送信〜本番送信までを一括実行
          </p>
        </div>

        <div
          onClick={() => navigate('/email/history')}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '0.6rem', borderRadius: '0.5rem' }}>
              <History size={24} />
            </div>
            <ArrowRight size={18} color="#94a3b8" />
          </div>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
            配信履歴・ログ確認
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            過去の配信結果、宛先別エラー詳細、CSVダウンロード
          </p>
        </div>

        <div
          onClick={() => navigate('/email/templates')}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ backgroundColor: '#fffbeb', color: '#d97706', padding: '0.6rem', borderRadius: '0.5rem' }}>
              <FileText size={24} />
            </div>
            <ArrowRight size={18} color="#94a3b8" />
          </div>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
            テンプレート管理
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            初回案内・資料送付・補助金など用途別テンプレートの作成・編集
          </p>
        </div>

        <div
          onClick={() => navigate('/email/optouts')}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ backgroundColor: '#f5f3ff', color: '#7c3aed', padding: '0.6rem', borderRadius: '0.5rem' }}>
              <Ban size={24} />
            </div>
            <ArrowRight size={18} color="#94a3b8" />
          </div>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
            配信停止リスト管理
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            オプトアウト顧客の管理・手動追加・CSVインポート
          </p>
        </div>
      </div>

      {/* 3. 直近の配信キャンペーン一覧 */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
            最近の配信キャンペーン
          </h2>
          <button
            onClick={() => navigate('/email/history')}
            style={{ fontSize: '0.85rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            すべての履歴を見る →
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
            <Mail size={40} style={{ margin: '0 auto 0.75rem auto', color: '#cbd5e1' }} />
            <p style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', fontWeight: 600 }}>配信履歴がまだありません</p>
            <p style={{ fontSize: '0.8rem', margin: 0 }}>「新規メール作成・配信」から一斉送信を開始してください</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '0.75rem' }}>キャンペーン名</th>
                  <th style={{ padding: '0.75rem' }}>件名</th>
                  <th style={{ padding: '0.75rem' }}>送信日時</th>
                  <th style={{ padding: '0.75rem' }}>送信件数</th>
                  <th style={{ padding: '0.75rem' }}>成功 / 失敗</th>
                  <th style={{ padding: '0.75rem' }}>ステータス</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.slice(0, 5).map(cmp => (
                  <tr key={cmp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: '#0f172a' }}>{cmp.title}</td>
                    <td style={{ padding: '0.75rem', color: '#334155', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cmp.subject}
                    </td>
                    <td style={{ padding: '0.75rem', color: '#64748b' }}>
                      {new Date(cmp.createdAt).toLocaleDateString('ja-JP')} {new Date(cmp.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{cmp.totalCount} 件</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ color: '#059669', fontWeight: 600 }}>{cmp.sentCount}</span> / <span style={{ color: cmp.failedCount > 0 ? '#dc2626' : '#64748b' }}>{cmp.failedCount}</span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: cmp.status === 'completed' ? '#ecfdf5' : cmp.status === 'sending' ? '#eff6ff' : '#fef2f2',
                        color: cmp.status === 'completed' ? '#047857' : cmp.status === 'sending' ? '#1d4ed8' : '#b91c1c'
                      }}>
                        {cmp.status === 'completed' ? '完了' : cmp.status === 'sending' ? '送信中' : '失敗'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
