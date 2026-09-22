import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, Sparkles, Check, AlertCircle, ArrowRight, Calendar, Building2, ListTodo } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { parseVoiceTextLocally, ParsedVoiceResult } from '../utils/voiceParser';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { useWorkflow } from '../context/WorkflowContext';
import type { Project, NextAction } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface VoiceActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onFillForm?: (result: ParsedVoiceResult) => void;
}

export default function VoiceActionModal({ isOpen, onClose, onSuccess, onFillForm }: VoiceActionModalProps) {
  const { addProject } = useProjects();
  const { user } = useAuth();
  const { kanbanColumns } = useWorkflow();

  const {
    isListening,
    transcript,
    error,
    hasSupport,
    startListening,
    stopListening,
    setTranscript,
    resetTranscript
  } = useSpeechRecognition();

  const [parsedData, setParsedData] = useState<ParsedVoiceResult | null>(null);
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);

  // 発話が終わったら自動パース
  useEffect(() => {
    if (!isListening && transcript.trim()) {
      const result = parseVoiceTextLocally(transcript);
      setParsedData(result);
    }
  }, [isListening, transcript]);

  if (!isOpen) return null;

  // プリセット発話サンプル
  const samplePhrases = [
    'さくら内科クリニック、明日14時にデモ訪問決定。見積書持参',
    'ひまわり眼科、来週火曜日にカタログと料金資料を送付',
    'あおぞら小児科、明後日午前10時に初回電話ヒアリング'
  ];

  const handleApplyPreset = (phrase: string) => {
    setTranscript(phrase);
    const result = parseVoiceTextLocally(phrase);
    setParsedData(result);
  };

  const handleSave = () => {
    if (!parsedData) return;

    const projectId = uuidv4();
    const defaultRep = user?.name || '松浦 貴文';
    const initialStatus = kanbanColumns.length > 0 ? kanbanColumns[0].id : '新規';

    const newProject: Project = {
      id: projectId,
      clinicName: parsedData.clinicName,
      clinicType: 'クリニック',
      address: '',
      phone: '',
      email: '',
      contactPerson: parsedData.contactPerson,
      contactTitle: '担当者',
      memo: parsedData.memo,
      source: '音声登録',
      receivedAt: new Date().toISOString().substring(0, 10),
      salesRep: defaultRep,
      product: 'テマサック自動精算機',
      quantity: 1,
      status: initialStatus,
      priority: parsedData.priority,
      lastActivityAt: new Date().toISOString().substring(0, 10),
      ballHolder: defaultRep,
      isImplementationProject: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const initialAction: NextAction = {
      id: uuidv4(),
      projectId: projectId,
      title: parsedData.todoTitle,
      assignee: defaultRep,
      deadline: parsedData.deadline,
      priority: parsedData.priority,
      status: '未完了',
      memo: parsedData.memo,
      createdAt: new Date().toISOString()
    };

    addProject(newProject, initialAction);
    setIsSuccessMessage(true);

    setTimeout(() => {
      setIsSuccessMessage(false);
      resetTranscript();
      setParsedData(null);
      if (onSuccess) onSuccess();
      onClose();
    }, 1200);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div 
        className="card" 
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '1.25rem',
          padding: '1.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          position: 'relative'
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ backgroundColor: '#eef2ff', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <Sparkles size={20} color="var(--primary)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>喋って一瞬でスケジュール作成</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                話しかけるだけで「クリニック名」「ToDo」「期日」を自動抽出します
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 録音セクション */}
        <div style={{
          backgroundColor: isListening ? '#fef2f2' : '#f8fafc',
          border: isListening ? '2px solid var(--danger)' : '1px dashed var(--border-color)',
          borderRadius: '1rem',
          padding: '1.5rem',
          textAlign: 'center',
          marginBottom: '1.25rem',
          transition: 'all 0.2s ease'
        }}>
          {/* マイクボタン */}
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: isListening ? 'var(--danger)' : 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isListening 
                ? '0 0 0 8px rgba(239, 68, 68, 0.2), 0 4px 12px rgba(239, 68, 68, 0.4)' 
                : '0 4px 14px rgba(79, 70, 229, 0.35)',
              marginBottom: '0.75rem',
              transition: 'all 0.2s ease'
            }}
          >
            {isListening ? <MicOff size={32} /> : <Mic size={32} />}
          </button>

          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isListening ? 'var(--danger)' : 'var(--text-main)', marginBottom: '0.25rem' }}>
            {isListening ? '🎙️ お話しください...（タップで終了）' : 'マイクをタップして喋る'}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            例：「さくら内科、明日14時にデモ訪問決定。見積書持参」
          </p>

          {/* リアルタイム発話テキスト */}
          {transcript && (
            <div style={{
              marginTop: '1rem',
              backgroundColor: '#ffffff',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-color)',
              fontSize: '0.9rem',
              fontWeight: 500,
              textAlign: 'left',
              color: 'var(--text-main)'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>聞き取った音声:</span>
              "{transcript}"
            </div>
          )}

          {error && (
            <div style={{ marginTop: '0.75rem', color: 'var(--danger)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        {/* サンプル発話（ワンタップで試せる） */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            💡 サンプル発話（タップしてテスト入力）:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {samplePhrases.map((phrase, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleApplyPreset(phrase)}
                style={{
                  textAlign: 'left',
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.8rem',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid transparent',
                  borderRadius: '0.375rem',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                🗣️ "{phrase}"
              </button>
            ))}
          </div>
        </div>

        {/* AI解析結果プレビュー */}
        {parsedData && (
          <div style={{
            backgroundColor: '#faf5ff',
            border: '1px solid #e9d5ff',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              <Sparkles size={16} /> 自動解析結果
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={16} color="var(--text-muted)" />
                <span style={{ color: 'var(--text-muted)', width: '80px' }}>クリニック:</span>
                <input 
                  type="text" 
                  value={parsedData.clinicName} 
                  onChange={(e) => setParsedData({ ...parsedData, clinicName: e.target.value })}
                  className="input-field"
                  style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.875rem', fontWeight: 600 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ListTodo size={16} color="var(--text-muted)" />
                <span style={{ color: 'var(--text-muted)', width: '80px' }}>次回ToDo:</span>
                <input 
                  type="text" 
                  value={parsedData.todoTitle} 
                  onChange={(e) => setParsedData({ ...parsedData, todoTitle: e.target.value })}
                  className="input-field"
                  style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} color="var(--text-muted)" />
                <span style={{ color: 'var(--text-muted)', width: '80px' }}>対応期日:</span>
                <input 
                  type="date" 
                  value={parsedData.deadline} 
                  onChange={(e) => setParsedData({ ...parsedData, deadline: e.target.value })}
                  className="input-field"
                  style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 成功メッセージ */}
        {isSuccessMessage && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#ecfdf5',
            color: '#065f46',
            borderRadius: '0.5rem',
            textAlign: 'center',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '1rem'
          }}>
            <Check size={20} /> 案件とToDoを作成しました！
          </div>
        )}

        {/* アクションボタン */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={onClose}
            style={{ flex: 1, minHeight: '44px', justifyContent: 'center' }}
          >
            キャンセル
          </button>
          
          {onFillForm && (
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => {
                if (parsedData) {
                  onFillForm(parsedData);
                  onClose();
                }
              }}
              disabled={!parsedData}
              style={{
                flex: 1.5,
                minHeight: '44px',
                justifyContent: 'center',
                fontWeight: 600,
                borderColor: 'var(--primary)',
                color: 'var(--primary)',
                backgroundColor: '#ffffff'
              }}
            >
              フォームに反映
            </button>
          )}

          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={!parsedData || isSuccessMessage}
            style={{
              flex: 2,
              minHeight: '44px',
              justifyContent: 'center',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}
          >
            <span>一瞬で登録する</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
