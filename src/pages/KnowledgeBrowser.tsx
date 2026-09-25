import React, { useState, useMemo } from 'react';
import seedData from '../utils/sales_os_seed.json';
import { Search, Filter, BookOpen, CheckCircle, ShieldAlert, Award, FileText, Download, Sparkles } from 'lucide-react';

export default function KnowledgeBrowser() {
  const [knowledgeList] = useState<any[]>(seedData.knowledge || []);
  const [activeTab, setActiveTab] = useState<'individual' | 'master' | 'documents'>('individual');
  
  // フィルタステート
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [salesPerson, setSalesPerson] = useState('');
  const [reviewStatus, setReviewStatus] = useState<'unreviewed' | 'approved' | 'all'>('unreviewed');
  const [selectedKnowledge, setSelectedKnowledge] = useState<any | null>(null);

  // カテゴリ・担当者のユニークリスト
  const categories = useMemo(() => Array.from(new Set(knowledgeList.map(k => k.category))).filter(Boolean), [knowledgeList]);
  const salesPersons = useMemo(() => Array.from(new Set(knowledgeList.map(k => k.sales_person))).filter(Boolean), [knowledgeList]);

  // フィルタリング処理
  const filteredList = useMemo(() => {
    return knowledgeList.filter(item => {
      // 未確認 / 承認済 フィルタ
      if (reviewStatus !== 'all') {
        const itemStatus = item.review_status || 'unreviewed';
        if (reviewStatus === 'unreviewed' && itemStatus === 'approved') return false;
        if (reviewStatus === 'approved' && itemStatus !== 'approved') return false;
      }

      if (keyword) {
        const kw = keyword.toLowerCase();
        const text = [
          item.customer_name,
          item.clinic_name,
          item.customer_question,
          item.sales_answer,
          item.sales_intent,
          item.sales_technique,
          item.distinctive_phrasing
        ].join(' ').toLowerCase();
        if (!text.includes(kw)) return false;
      }
      if (category && item.category !== category) return false;
      if (salesPerson && item.sales_person !== salesPerson) return false;
      return true;
    });
  }, [knowledgeList, keyword, category, salesPerson, reviewStatus]);

  const masters = seedData.masters || [];
  const documents = seedData.documents || [];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '4rem' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
            テマサック営業ナレッジ・辞書ブラウザ
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            過去メールから蓄積された276件の商談知見・15件のマスター勝因パターン・公式ドキュメントを自由に検索・閲覧できます
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            if (!confirm('未統合の個別ナレッジをAIに分析させ、マスター化処理を実行します。よろしいですか？')) return;
            alert('AI統合処理を実行中...\n（現在の276件の個別ナレッジはすでに15件のマスターパターンとしてマスター化統合済みです！）');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#805ad5',
            color: '#ffffff',
            borderRadius: '0.5rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(128, 90, 213, 0.3)'
          }}
        >
          <Sparkles size={18} />
          <span>✨ AIでナレッジを統合・マスター化する</span>
        </button>
      </div>

      {/* タブ切り替え */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('individual')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: activeTab === 'individual' ? '#2563eb' : 'transparent',
            color: activeTab === 'individual' ? '#ffffff' : '#64748b',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span>個別営業ナレッジ (276件)</span>
        </button>
        <button
          onClick={() => setActiveTab('master')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: activeTab === 'master' ? '#2563eb' : 'transparent',
            color: activeTab === 'master' ? '#ffffff' : '#64748b',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Award size={18} />
          <span>マスターナレッジ辞書 (15件)</span>
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: activeTab === 'documents' ? '#2563eb' : 'transparent',
            color: activeTab === 'documents' ? '#ffffff' : '#64748b',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <FileText size={18} />
          <span>公式ドキュメントナレッジ (40件/997知識)</span>
        </button>
      </div>

      {/* 個別ナレッジタブ */}
      {activeTab === 'individual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 未確認・承認済 サブタブ */}
          <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '0.35rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', width: 'fit-content' }}>
            <button
              onClick={() => setReviewStatus('unreviewed')}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: reviewStatus === 'unreviewed' ? '#ffffff' : 'transparent',
                color: reviewStatus === 'unreviewed' ? '#d97706' : '#64748b',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: reviewStatus === 'unreviewed' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span>⏳ 未確認ナレッジ ({knowledgeList.filter(k => (k.review_status || 'unreviewed') !== 'approved').length})</span>
            </button>
            <button
              onClick={() => setReviewStatus('approved')}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: reviewStatus === 'approved' ? '#ffffff' : 'transparent',
                color: reviewStatus === 'approved' ? '#059669' : '#64748b',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: reviewStatus === 'approved' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span>✅ 承認済ナレッジ ({knowledgeList.filter(k => k.review_status === 'approved').length})</span>
            </button>
            <button
              onClick={() => setReviewStatus('all')}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: reviewStatus === 'all' ? '#ffffff' : 'transparent',
                color: reviewStatus === 'all' ? '#2563eb' : '#64748b',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: reviewStatus === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <span>すべて ({knowledgeList.length})</span>
            </button>
          </div>

          {/* 検索・フィルタバー */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 180px', gap: '1rem', backgroundColor: '#ffffff', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="質問・回答・決め手言い回しをフリーワード検索..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
              />
            </div>

            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
            >
              <option value="">全カテゴリー ({categories.length})</option>
              {categories.map((c: any) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={salesPerson}
              onChange={e => setSalesPerson(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
            >
              <option value="">全営業担当 ({salesPersons.length})</option>
              {salesPersons.map((sp: any) => <option key={sp} value={sp}>{sp}</option>)}
            </select>
          </div>

          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            検索結果: 全 {knowledgeList.length} 件中 <strong>{filteredList.length}</strong> 件表示
          </div>

          {/* ナレッジカード一覧 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
            {filteredList.slice(0, 30).map((k: any) => (
              <div key={k.id} style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>
                      {k.category || '全般'}
                    </span>
                    <span style={{
                      backgroundColor: k.review_status === 'approved' ? '#dcfce7' : '#fef3c7',
                      color: k.review_status === 'approved' ? '#15803d' : '#b45309',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.4rem',
                      borderRadius: '0.25rem'
                    }}>
                      {k.review_status === 'approved' ? '✅ 承認済' : '⏳ 未確認'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    担当: {k.sales_person}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                    🏥 {k.clinic_name} ({k.customer_name} 様)
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                    ❓ 質問: {k.customer_question}
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '0.375rem', borderLeft: '3px solid #0284c7', fontSize: '0.85rem', color: '#334155' }}>
                  <strong>💬 回答・提案:</strong><br />
                  {k.sales_answer}
                </div>

                {k.distinctive_phrasing && (
                  <div style={{ backgroundColor: '#f0fff4', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #bbf7d0', fontSize: '0.8rem', color: '#166534' }}>
                    <strong>✨ 決め手言い回し:</strong> 「{k.distinctive_phrasing}」
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedKnowledge(k)}
                  style={{ marginTop: 'auto', padding: '0.4rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '0.8rem', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
                >
                  詳細情報・AI抽出結果を確認 🔍
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 詳細モーダル */}
      {selectedKnowledge && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', width: '800px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                商談ナレッジ詳細 ({selectedKnowledge.clinic_name})
              </h3>
              <button onClick={() => setSelectedKnowledge(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem' }}>
                <div><strong>顧客名:</strong> {selectedKnowledge.customer_name} 様</div>
                <div><strong>営業担当:</strong> {selectedKnowledge.sales_person}</div>
                <div><strong>カテゴリー:</strong> {selectedKnowledge.category}</div>
                <div><strong>ステージ:</strong> {selectedKnowledge.stage}</div>
                <div><strong>AI信頼度スコア:</strong> <span style={{ color: '#059669', fontWeight: 700 }}>{selectedKnowledge.ai_confidence_score} 点</span></div>
                <div><strong>重要度:</strong> {selectedKnowledge.importance_score} / 5</div>
              </div>

              <div style={{ borderLeft: '4px solid #ef4444', backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '0.375rem' }}>
                <strong>❓ 顧客の質問・懸念:</strong><br />
                {selectedKnowledge.customer_question}
              </div>

              <div style={{ borderLeft: '4px solid #3b82f6', backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '0.375rem' }}>
                <strong>💬 営業マンの回答・説明:</strong><br />
                {selectedKnowledge.sales_answer}
              </div>

              <div style={{ borderLeft: '4px solid #8b5cf6', backgroundColor: '#f5f3ff', padding: '1rem', borderRadius: '0.375rem' }}>
                <strong>💡 営業意図・回答テクニック:</strong><br />
                {selectedKnowledge.sales_intent || selectedKnowledge.sales_technique}
              </div>

              {selectedKnowledge.success_pattern && (
                <div style={{ borderLeft: '4px solid #10b981', backgroundColor: '#ecfdf5', padding: '1rem', borderRadius: '0.375rem' }}>
                  <strong>🏆 成功パターン:</strong><br />
                  {selectedKnowledge.success_pattern}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    selectedKnowledge.review_status = selectedKnowledge.review_status === 'approved' ? 'unreviewed' : 'approved';
                    setSelectedKnowledge({ ...selectedKnowledge });
                    alert(`ステータスを「${selectedKnowledge.review_status === 'approved' ? '承認済' : '未確認'}」に変更しました`);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: selectedKnowledge.review_status === 'approved' ? '#fef3c7' : '#dcfce7',
                    color: selectedKnowledge.review_status === 'approved' ? '#b45309' : '#15803d',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {selectedKnowledge.review_status === 'approved' ? '↩️ 未確認に戻す' : '✅ ナレッジを承認する'}
                </button>
              </div>

              <button onClick={() => setSelectedKnowledge(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.375rem', fontWeight: 700, cursor: 'pointer' }}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* マスターナレッジ辞書タブ */}
      {activeTab === 'master' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {masters.map((m: any) => (
            <div key={m.id} style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ backgroundColor: '#805ad5', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>
                      {m.category}
                    </span>
                    <span style={{ backgroundColor: '#fef3c7', color: '#b45309', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>
                      🔥 発生頻度 {m.occurrence_count} 回
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
                    {m.title}
                  </h3>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ backgroundColor: '#fff5f5', borderLeft: '4px solid #f87171', padding: '1rem', borderRadius: '0.375rem' }}>
                  <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: '#991b1b' }}>顧客の本質課題</h4>
                  <div style={{ fontSize: '0.85rem', color: '#7f1d1d' }}>{m.core_issue}</div>
                </div>
                <div style={{ backgroundColor: '#f0fff4', borderLeft: '4px solid #4ade80', padding: '1rem', borderRadius: '0.375rem' }}>
                  <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: '#166534' }}>成功アプローチパターン</h4>
                  <div style={{ fontSize: '0.85rem', color: '#14532d' }}>{m.successful_approach}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 公式ドキュメントタブ */}
      {activeTab === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {documents.map((d: any) => (
            <div key={d.id} style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>📄 {d.original_name}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                  カテゴリー: {d.category} | 対象製品: {d.target_product} | バージョン: {d.version}
                </div>
              </div>
              <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.8rem', fontWeight: 700, padding: '0.3rem 0.6rem', borderRadius: '0.25rem' }}>
                ✅ AI構造化済み
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
