import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, Database, Check, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { parseCustomerFile, ParsedSheetData } from '../../utils/fileParser';
import { ColumnMapping } from '../../types/email';
import { useProjects } from '../../context/ProjectContext';

interface ListUploaderProps {
  onDataLoaded: (data: {
    fileName: string;
    rawRows: Record<string, string>[];
    mapping: ColumnMapping;
  }) => void;
}

export default function ListUploader({ onDataLoaded }: ListUploaderProps) {
  const { projects } = useProjects();
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // マッピング確認ステップ用
  const [parsedSheet, setParsedSheet] = useState<ParsedSheetData | null>(null);
  const [currentMapping, setCurrentMapping] = useState<ColumnMapping>({
    companyName: '',
    recipientName: '',
    email: '',
    phone: '',
    region: '',
    salesRep: '',
    status: ''
  });

  const handleFileChange = async (file?: File) => {
    if (!file) return;
    setErrorMsg(null);
    setIsParsing(true);

    try {
      const result = await parseCustomerFile(file);
      setParsedSheet(result);
      setCurrentMapping(result.inferredMapping);
    } catch (err: any) {
      setErrorMsg(err.message || 'ファイルの読み込みに失敗しました。');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // 既存のKOHAL案件データからインポート
  const handleLoadFromProjects = () => {
    if (projects.length === 0) {
      setErrorMsg('既存の案件データがありません。');
      return;
    }

    const rows: Record<string, string>[] = projects.map(p => ({
      '会社名': p.clinicName || '',
      '氏名': p.contactPerson || '',
      '電話番号': p.phone || '',
      'メールアドレス': p.email || '',
      '地域': p.address || '',
      '担当者': p.salesRep || '',
      'ステータス': p.status || '',
      '_projectId': p.id
    }));

    const mapping: ColumnMapping = {
      companyName: '会社名',
      recipientName: '氏名',
      phone: '電話番号',
      email: 'メールアドレス',
      region: '地域',
      salesRep: '担当者',
      status: 'ステータス'
    };

    onDataLoaded({
      fileName: `KOHAL案件リスト (${projects.length}件)`,
      rawRows: rows,
      mapping
    });
  };

  // サンプルCSVのダウンロード
  const handleDownloadSample = () => {
    const csvContent = "\uFEFF" + 
      "会社名,氏名,電話番号,メールアドレス,地域,担当者,ステータス\n" +
      "さくらクリニック,山田太郎,011-123-4567,yamada@example.com,札幌市,松浦,未対応\n" +
      "ひまわり医院,佐藤花子,011-234-5678,info@himawari-clinic.jp,札幌市,松浦,資料送付\n" +
      "石狩中央病院,高橋健二,0133-77-8899,contact@ishikari-hp.org,石狩市,松浦,アポ獲得\n" +
      "みどり整形外科,田中美咲,011-555-1234,tanaka@midori-seikei.com,小樽市,松浦,未対応\n" +
      "空欄サンプル院,鈴木一郎,011-999-0000,,札幌市,松浦,未対応\n" +
      "重複サンプル院,山田太郎,011-123-4567,YAMADA@example.com,札幌市,松浦,未対応\n" +
      "配信停止サンプル医院,中村次郎,011-888-7777,optout-test@example.com,江別市,松浦,資料送付\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'kohal_email_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // マッピング確認完了
  const handleConfirmMapping = () => {
    if (!parsedSheet) return;
    if (!currentMapping.email) {
      setErrorMsg('メールアドレスの列を選択してください。');
      return;
    }

    onDataLoaded({
      fileName: parsedSheet.fileName,
      rawRows: parsedSheet.rows,
      mapping: currentMapping
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* エラーアラート */}
      {errorMsg && (
        <div style={{
          backgroundColor: '#fef2f2',
          borderLeft: '4px solid #ef4444',
          padding: '1rem',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#991b1b'
        }}>
          <AlertCircle size={20} />
          <div style={{ flex: 1, fontSize: '0.9rem' }}>{errorMsg}</div>
          <button 
            onClick={() => setErrorMsg(null)} 
            style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 'bold' }}>
            ✕
          </button>
        </div>
      )}

      {!parsedSheet ? (
        <>
          {/* ドロップゾーン */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              border: isDragging ? '2px dashed #3b82f6' : '2px dashed #cbd5e1',
              backgroundColor: isDragging ? '#eff6ff' : '#f8fafc',
              borderRadius: '1rem',
              padding: '3rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => {
              const fileInput = document.getElementById('customer-file-input');
              fileInput?.click();
            }}
          >
            <input
              id="customer-file-input"
              type="file"
              accept=".csv, .xlsx, .xls"
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />

            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#e0e7ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem'
            }}>
              {isParsing ? <RefreshCw className="animate-spin" size={32} /> : <UploadCloud size={32} />}
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
              顧客リスト（CSV / Excel）をアップロード
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              ファイルをここにドラッグ＆ドロップ、またはクリックして選択
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '0.35rem 0.75rem', borderRadius: '9999px', fontWeight: 600 }}>
                CSV (.csv)
              </span>
              <span style={{ fontSize: '0.8rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '0.35rem 0.75rem', borderRadius: '9999px', fontWeight: 600 }}>
                Excel (.xlsx / .xls)
              </span>
              <span style={{ fontSize: '0.8rem', backgroundColor: '#e0e7ff', color: '#4338ca', padding: '0.35rem 0.75rem', borderRadius: '9999px', fontWeight: 600 }}>
                Shift-JIS / UTF-8 自動判別
              </span>
            </div>
          </div>

          {/* クイックアクションバー */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <button
              type="button"
              onClick={handleLoadFromProjects}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '0.75rem',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Database size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>KOHAL既存案件から読込</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>登録済みの顧客リスト（{projects.length}件）を使用</div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleDownloadSample}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '0.75rem',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#64748b')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileSpreadsheet size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>サンプルCSVをダウンロード</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>テスト用のひな形データを入手</div>
              </div>
            </button>
          </div>
        </>
      ) : (
        /* カラムマッピング確認・調整画面 */
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                列名（カラム）の自動判定結果の確認
              </h3>
              <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                ファイル：<strong>{parsedSheet.fileName}</strong>（全 {parsedSheet.rows.length} 件）
              </p>
            </div>
            <button
              onClick={() => setParsedSheet(null)}
              style={{
                fontSize: '0.85rem',
                color: '#64748b',
                background: 'none',
                border: '1px solid #cbd5e1',
                padding: '0.4rem 0.8rem',
                borderRadius: '0.5rem',
                cursor: 'pointer'
              }}
            >
              別のファイルを選び直す
            </button>
          </div>

          <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.25rem' }}>
            取り込んだファイルの列名を、KOHALの各項目へ自動マッピングしました。誤りがある場合はプルダウンで変更してください。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { key: 'email', label: 'メールアドレス', required: true },
              { key: 'companyName', label: '会社名・クリニック名', required: false },
              { key: 'recipientName', label: '氏名・お名前', required: false },
              { key: 'phone', label: '電話番号', required: false },
              { key: 'region', label: '地域・住所', required: false },
              { key: 'salesRep', label: '担当者', required: false },
              { key: 'status', label: 'ステータス', required: false }
            ].map(({ key, label, required }) => (
              <div key={key} style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  {label} {required && <span style={{ color: '#ef4444' }}>*必須</span>}
                </label>
                <select
                  value={currentMapping[key as keyof ColumnMapping]}
                  onChange={(e) => setCurrentMapping({ ...currentMapping, [key]: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="">（割り当てなし）</option>
                  {parsedSheet.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* プレビュー表示 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
              先頭3件のプレビュー
            </h4>
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                  <tr>
                    <th style={{ padding: '0.6rem' }}>会社名</th>
                    <th style={{ padding: '0.6rem' }}>氏名</th>
                    <th style={{ padding: '0.6rem' }}>メールアドレス</th>
                    <th style={{ padding: '0.6rem' }}>地域</th>
                    <th style={{ padding: '0.6rem' }}>担当者</th>
                    <th style={{ padding: '0.6rem' }}>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedSheet.rows.slice(0, 3).map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.6rem' }}>{r[currentMapping.companyName] || '-'}</td>
                      <td style={{ padding: '0.6rem' }}>{r[currentMapping.recipientName] || '-'}</td>
                      <td style={{ padding: '0.6rem', color: '#2563eb', fontWeight: 600 }}>{r[currentMapping.email] || '-'}</td>
                      <td style={{ padding: '0.6rem' }}>{r[currentMapping.region] || '-'}</td>
                      <td style={{ padding: '0.6rem' }}>{r[currentMapping.salesRep] || '-'}</td>
                      <td style={{ padding: '0.6rem' }}>{r[currentMapping.status] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleConfirmMapping}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
              }}
            >
              <span>メールアドレス抽出へ進む</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
