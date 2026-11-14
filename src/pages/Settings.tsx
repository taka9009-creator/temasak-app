import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Zap,
  Database,
  Bell,
  Plus,
  ArrowRight,
  Save,
  ToggleRight,
  ToggleLeft,
  Key,
  Bot,
  X,
  Trash2,
  Edit2,
  Sparkles,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import {
  getAISettings,
  saveAISettings,
  defaultAIPrompt,
  AI_PROMPT_PRESETS,
  generateSummary,
  type AISettings,
  type AIPromptPresetId
} from '../utils/ai';
import { useMasterData, type MasterData } from '../context/MasterDataContext';
import {
  useRules,
  RULE_IDEA_CATALOG,
  type GlobalRule,
  type RuleCategory,
  type RuleTriggerType,
  type RuleTargetSegment
} from '../context/RuleContext';
import { useProjects } from '../context/ProjectContext';
import { scanMatchingProjectsForRule } from '../utils/actionRules';
import { SALES_PROGRESS_FLOW } from '../types';

const RULE_CATEGORIES: RuleCategory[] = [
  '初動・架電加速',
  'デモ・見積・後追い',
  'ポイント到達連動',
  'BtoBディーラー別枠',
  '失注復活・受注導入'
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'rules' | 'master' | 'notifications' | 'integrations'>(() => {
    if (window.location.hash === '#notifications') return 'notifications';
    return 'rules';
  });

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#notifications') {
        setActiveTab('notifications');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const { settings: notifSettings, updateSettings } = useNotifications();
  const [aiSettings, setAiSettings] = useState<AISettings>(getAISettings);
  const { rules, toggleRule, deleteRule, addRule, updateRule, resetToEasyOSDefaultRules } = useRules();
  const { projects, applyRuleToMatchingProjects, syncLocalToCloud, isCloudSyncing, resetToRoster42 } = useProjects();
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [selectedRuleCategory, setSelectedRuleCategory] = useState<string>('all');
  const [showIdeaCatalog, setShowIdeaCatalog] = useState<boolean>(true);
  const [ruleToastMsg, setRuleToastMsg] = useState<string | null>(null);

  const showRuleToast = (msg: string) => {
    setRuleToastMsg(msg);
    setTimeout(() => setRuleToastMsg(null), 3500);
  };

  const defaultNewRule: Partial<GlobalRule> = {
    name: '',
    category: '初動・架電加速',
    description: '',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'action_recorded',
    triggerValue: '初動メール',
    actionType: 'create_task',
    actionTitle: '',
    actionDaysToDeadline: 2,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: '',
    nextStage: undefined,
    autoProbability: undefined,
    aiDraftHint: undefined,
    conditionField: undefined,
    conditionOperator: 'equals',
    conditionValue: ''
  };
  const [newRule, setNewRule] = useState<Partial<GlobalRule>>(defaultNewRule);

  const startEditRule = (rule: GlobalRule) => {
    setEditingRuleId(rule.id);
    setIsAddingRule(true);
    setNewRule(rule);
  };

  const handleAddRuleSubmit = () => {
    if (!newRule.name || !newRule.triggerValue || !newRule.actionTitle) {
      alert('必須項目（ルール名・発動トリガー・生成タスク名）を入力してください');
      return;
    }

    if (editingRuleId) {
      updateRule(editingRuleId, newRule as Partial<GlobalRule>);
      setEditingRuleId(null);
      showRuleToast(`✅ ルール「${newRule.name}」を更新しました`);
    } else {
      addRule(newRule as Omit<GlobalRule, 'id'>);
      showRuleToast(`✨ 新しいルール「${newRule.name}」を追加しました`);
    }

    setIsAddingRule(false);
    setNewRule(defaultNewRule);
  };

  const cancelAddRule = () => {
    setIsAddingRule(false);
    setEditingRuleId(null);
    setNewRule(defaultNewRule);
  };

  const [aiSavedMsg, setAiSavedMsg] = useState<string | null>(null);
  const [aiPreviewLoading, setAiPreviewLoading] = useState<boolean>(false);
  const [aiPreviewText, setAiPreviewText] = useState<string>('');

  const handleSaveAISettings = () => {
    saveAISettings(aiSettings);
    setAiSavedMsg('✅ AI設定および要約プロンプトを保存しました！');
    setTimeout(() => setAiSavedMsg(null), 3500);
  };

  const handleTestPromptPreview = async () => {
    saveAISettings(aiSettings);
    setAiPreviewLoading(true);
    try {
      const sampleProject = projects.find(p => (p.activities || []).length > 0) || projects[0];
      const contextText = sampleProject
        ? `
【案件情報】
・案件名: ${sampleProject.clinicName}
・ステータス: ${sampleProject.status}
・確度: ${sampleProject.probability || 'B (50%)'}
・累計獲得ポイント: ${sampleProject.clinicPoints ?? 8}p
・区分: ${sampleProject.clinicType === 'パートナー' ? 'BtoBディーラー' : 'クリニック直販'}
・営業担当: ${sampleProject.salesRep}
・現在のボール: ${sampleProject.ballHolder}
・休診日: ${sampleProject.closedDays || '水曜・日曜・祝日'}
・予約システム: ${sampleProject.reservationSystem || 'Web予約あり'}

【活動履歴】
${(sampleProject.activities || []).map(a => `[${a.date}] ${a.type} - ${a.content}`).join('\n') || '[2026-11-05] 初動メール (+5p) - 資料送付\n[2026-11-06] 架電: 会話 (+3p) - 事務長と会話、院長へ共有依頼'}
        `.trim()
        : `
【案件情報】
・案件名: さくら内科クリニック
・ステータス: 初動
・確度: B (50%)
・累計獲得ポイント: 8p
・区分: クリニック直販
・営業担当: 松浦 貴文
・現在のボール: 松浦 貴文
・休診日: 水曜・日曜・祝日
・予約システム: デジスマ診療

【活動履歴】
[2026-11-06] 架電: 会話 (+3p) - 受付チーフと会話。水曜以外の昼休み前なら院長が在院とのこと。
[2026-11-04] 初動メール (+5p) - 導入事例集と3分概要資料を送付。
        `.trim();

      const res = await generateSummary(contextText, aiSettings.prompt);
      setAiPreviewText(res);
    } catch (e: any) {
      setAiPreviewText(`⚠️ プレビュー生成エラー: ${e.message || '不明なエラー'}`);
    } finally {
      setAiPreviewLoading(false);
    }
  };

  const { masterData, addItem, removeItem } = useMasterData();

  const triggerLabelMap: Record<RuleTriggerType, string> = {
    action_recorded: '⚡ 超かんたん司令室のアクション実行時',
    status_changed: '🔄 7段階 進捗フロー変更時',
    points_reached: '🏆 クリニック/BtoB累計ポイント到達時',
    stagnant_days: '⏰ 最終活動から停滞日数経過時',
    lost_archived: '🗄️ アーカイブ（失注理由）移動時',
    task_completed: '✅ タスク完了時'
  };

  const segmentLabelMap: Record<RuleTargetSegment, { label: string; bg: string; color: string }> = {
    clinic_only: { label: '🏥 クリニック直販枠のみ', bg: '#dbeafe', color: '#1e40af' },
    btob_only: { label: '🏢 BtoBディーラー別枠のみ', bg: '#e0e7ff', color: '#3730a3' },
    all: { label: '🌐 全案件（クリニック＋BtoB）', bg: '#f1f5f9', color: '#334155' }
  };

  const renderRuleForm = () => (
    <div className="card" style={{ padding: '0', marginBottom: '1.5rem', border: '2px solid #2563eb', borderRadius: '0.85rem', overflow: 'hidden' }}>
      <div style={{ backgroundColor: '#eff6ff', padding: '0.9rem 1.35rem', borderBottom: '1px solid #93c5fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e3a8a' }}>
          {editingRuleId ? '✏️ 自動化ルールの編集（超かんたん司令室連動）' : '➕ 新しい自動化ルールの作成（超かんたん司令室連動）'}
        </h3>
      </div>

      <div style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        {/* ルール名・カテゴリ・対象枠 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '0.85rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>ルール名</label>
            <input
              type="text"
              className="input-field"
              style={{ width: '100%' }}
              value={newRule.name || ''}
              onChange={e => setNewRule({ ...newRule, name: e.target.value })}
              placeholder="例: 初動メール(+5p) ➔ 2日後フォロー架電"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>カテゴリ</label>
            <select
              className="input-field"
              style={{ width: '100%', backgroundColor: '#ffffff' }}
              value={newRule.category || '初動・架電加速'}
              onChange={e => setNewRule({ ...newRule, category: e.target.value as RuleCategory })}
            >
              {RULE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>適用対象リスト枠</label>
            <select
              className="input-field"
              style={{ width: '100%', backgroundColor: '#ffffff', fontWeight: 700 }}
              value={newRule.targetSegment || 'clinic_only'}
              onChange={e => setNewRule({ ...newRule, targetSegment: e.target.value as RuleTargetSegment })}
            >
              <option value="clinic_only">🏥 クリニック直販枠のみ</option>
              <option value="btob_only">🏢 BtoB ディーラー・パートナー別枠のみ</option>
              <option value="all">🌐 全案件（クリニック＋BtoB両方）</option>
            </select>
          </div>
        </div>

        {/* ブロック1: WHEN（超かんたん司令室トリガー） */}
        <div style={{ display: 'flex', gap: '0.85rem' }}>
          <div style={{ flexShrink: 0, width: '64px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#1e40af', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, padding: '0.25rem 0', borderRadius: '4px' }}>WHEN</div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '0.95rem 1.1rem', borderRadius: '0.6rem', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <select
              className="input-field"
              style={{ width: 'auto', backgroundColor: '#ffffff', fontWeight: 700 }}
              value={newRule.triggerType || 'action_recorded'}
              onChange={e => {
                const nextType = e.target.value as RuleTriggerType;
                let defaultVal = '';
                if (nextType === 'action_recorded') defaultVal = '初動メール';
                else if (nextType === 'status_changed') defaultVal = 'デモ';
                else if (nextType === 'points_reached') defaultVal = '10';
                else if (nextType === 'stagnant_days') defaultVal = '5';
                else if (nextType === 'lost_archived') defaultVal = '金銭面';
                setNewRule({ ...newRule, triggerType: nextType, triggerValue: defaultVal });
              }}
            >
              <option value="action_recorded">⚡ アクションボタン実行時（超かんたん司令室）</option>
              <option value="status_changed">🔄 8段階 進捗フロー変更時（カンバン連動）</option>
              <option value="points_reached">🏆 クリニック/BtoB 累計ポイント到達時</option>
              <option value="stagnant_days">⏰ 最終活動から停滞・放置日数経過時</option>
              <option value="lost_archived">🗄️ アーカイブ（失注理由）移動時</option>
              <option value="task_completed">✅ 次にやること（タスク）完了時</option>
            </select>

            {newRule.triggerType === 'action_recorded' && (
              <select
                className="input-field"
                style={{ width: 'auto', backgroundColor: '#ffffff', fontWeight: 800, color: '#1e40af' }}
                value={newRule.triggerValue || '初動メール'}
                onChange={e => setNewRule({ ...newRule, triggerValue: e.target.value })}
              >
                <option value="会話">📞 架電: 会話 (+3p)</option>
                <option value="不在">📞 架電: 不在 (+1p)</option>
                <option value="折返待ち">🔥 架電: 折返待ち (+1p)</option>
                <option value="初動メール">✉️ 初動メール (+5p)</option>
                <option value="見積書送付">📄 見積書送付 (+5p)</option>
                <option value="オンラインデモ">💻 オンラインデモ (+5p)</option>
                <option value="訪問デモ">🚗 訪問デモ (+5p)</option>
                <option value="来社デモ">🏢 来社デモ (+5p)</option>
                <option value="訪問">🚶 現地訪問 (+3p)</option>
                <option value="ポスティング">📮 ポスティング (+2p)</option>
                <option value="相談メール">📨 相談メール (+3p)</option>
                <option value="後追いメール">📮 後追いメール (+2p)</option>
                <option value="kz送客">💰 kz送客・補助金コンサル送客 (+5p)</option>
                <option value="受注">🎉 受注 (+10p)</option>
              </select>
            )}

            {newRule.triggerType === 'status_changed' && (
              <select
                className="input-field"
                style={{ width: 'auto', backgroundColor: '#ffffff', fontWeight: 800 }}
                value={newRule.triggerValue || 'デモ'}
                onChange={e => setNewRule({ ...newRule, triggerValue: e.target.value })}
              >
                {SALES_PROGRESS_FLOW.map(st => (
                  <option key={st} value={st}>進捗ステージ: 【{st}】</option>
                ))}
              </select>
            )}

            {newRule.triggerType === 'points_reached' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>累計ポイントが</span>
                <select
                  className="input-field"
                  style={{ width: 'auto', backgroundColor: '#ffffff', fontWeight: 800, color: '#047857' }}
                  value={newRule.triggerValue || '10'}
                  onChange={e => setNewRule({ ...newRule, triggerValue: e.target.value })}
                >
                  <option value="5">5p 以上（初動突破）</option>
                  <option value="8">8p 以上（有望案件）</option>
                  <option value="10">10p 以上（ホットリード覚醒）</option>
                  <option value="15">15p 以上（最終決裁圏内）</option>
                  <option value="20">20p 以上（超重点案件）</option>
                </select>
                <span>に到達したとき</span>
              </div>
            )}

            {newRule.triggerType === 'stagnant_days' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>最終活動日から</span>
                <select
                  className="input-field"
                  style={{ width: 'auto', backgroundColor: '#ffffff', fontWeight: 800, color: '#b91c1c' }}
                  value={newRule.triggerValue || '5'}
                  onChange={e => setNewRule({ ...newRule, triggerValue: e.target.value })}
                >
                  <option value="3">3日以上 放置・未接触</option>
                  <option value="5">5日以上 放置・未接触</option>
                  <option value="7">7日以上（1週間）放置</option>
                  <option value="14">14日以上（2週間）放置</option>
                </select>
              </div>
            )}

            {newRule.triggerType === 'lost_archived' && (
              <select
                className="input-field"
                style={{ width: 'auto', backgroundColor: '#ffffff', fontWeight: 800, color: '#991b1b' }}
                value={newRule.triggerValue || '金銭面'}
                onChange={e => setNewRule({ ...newRule, triggerValue: e.target.value })}
              >
                <option value="金銭面">💰 失注理由：金銭面</option>
                <option value="他社導入">🏢 失注理由：他社導入</option>
                <option value="その他">📝 失注理由：その他</option>
              </select>
            )}

            {newRule.triggerType === 'task_completed' && (
              <input
                type="text"
                className="input-field"
                style={{ width: '220px', backgroundColor: '#ffffff' }}
                value={newRule.triggerValue || ''}
                onChange={e => setNewRule({ ...newRule, triggerValue: e.target.value })}
                placeholder="完了したタスク名"
              />
            )}
          </div>
        </div>

        {/* ブロック2: IF（追加条件フィルタ） */}
        <div style={{ display: 'flex', gap: '0.85rem' }}>
          <div style={{ flexShrink: 0, width: '64px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#fef3c7', color: '#b45309', fontSize: '0.75rem', fontWeight: 800, padding: '0.25rem 0', borderRadius: '4px', border: '1px solid #fde68a' }}>IF</div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#fffbeb', padding: '0.85rem 1.1rem', borderRadius: '0.6rem', border: '1px solid #fde68a' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, cursor: 'pointer', color: '#92400e', fontSize: '0.84rem' }}>
              <input
                type="checkbox"
                checked={!!newRule.conditionField}
                onChange={e => {
                  if (e.target.checked) {
                    setNewRule({ ...newRule, conditionField: 'status', conditionOperator: 'equals', conditionValue: '検討' });
                  } else {
                    setNewRule({ ...newRule, conditionField: undefined, conditionOperator: undefined, conditionValue: undefined });
                  }
                }}
              />
              さらに細かい絞り込み条件（進捗ステージ・科目・新規開業・補助金・地域など）を指定する
            </label>

            {newRule.conditionField !== undefined && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                <select
                  className="input-field"
                  style={{ width: 'auto', backgroundColor: '#ffffff' }}
                  value={newRule.conditionField || 'status'}
                  onChange={e => setNewRule({ ...newRule, conditionField: e.target.value })}
                >
                  <option value="status">進捗フローステージ</option>
                  <option value="clinicName">クリニック名（新規開業など）</option>
                  <option value="clinicType">診療科目・企業属性</option>
                  <option value="address">都道府県・エリア</option>
                  <option value="probability">契約確度 (A/B/C)</option>
                  <option value="subsidyName">利用予定の補助金</option>
                  <option value="clinicPoints">累計獲得ポイント</option>
                </select>
                <span>が「</span>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '150px', backgroundColor: '#ffffff' }}
                  value={newRule.conditionValue || ''}
                  onChange={e => setNewRule({ ...newRule, conditionValue: e.target.value })}
                  placeholder="例: 検討 / 歯科 / 新規開業"
                />
                <span>」</span>
                <select
                  className="input-field"
                  style={{ width: 'auto', backgroundColor: '#ffffff' }}
                  value={newRule.conditionOperator || 'equals'}
                  onChange={e => setNewRule({ ...newRule, conditionOperator: e.target.value as any })}
                >
                  <option value="equals">と一致する</option>
                  <option value="contains">を含む</option>
                  <option value="gte">以上である (数値)</option>
                  <option value="not_equals">と一致しない</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ブロック3: THEN（自動アクション＆進捗フロー連動） */}
        <div style={{ display: 'flex', gap: '0.85rem' }}>
          <div style={{ flexShrink: 0, width: '64px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#4338ca', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, padding: '0.25rem 0', borderRadius: '4px' }}>THEN</div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#eef2ff', padding: '1rem 1.15rem', borderRadius: '0.6rem', border: '1px solid #c7d2fe', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>① 次回期限:</span>
              <input
                type="number"
                className="input-field"
                style={{ width: '75px', backgroundColor: '#ffffff', fontWeight: 800 }}
                value={newRule.actionDaysToDeadline ?? 1}
                onChange={e => setNewRule({ ...newRule, actionDaysToDeadline: Number(e.target.value) })}
                min={0}
              />
              <span style={{ fontSize: '0.84rem' }}>日後に、優先度:</span>
              <select
                className="input-field"
                style={{ width: 'auto', backgroundColor: '#ffffff', fontWeight: 800 }}
                value={newRule.actionPriority || '高'}
                onChange={e => setNewRule({ ...newRule, actionPriority: e.target.value as any })}
              >
                <option value="高">🔥 高（最優先）</option>
                <option value="中">⚡ 中（通常）</option>
                <option value="低">🌱 低（長期フォロー）</option>
              </select>
              <span style={{ fontSize: '0.84rem' }}>、進捗フロー自動シフト:</span>
              <select
                className="input-field"
                style={{ width: 'auto', backgroundColor: '#ffffff', fontWeight: 700 }}
                value={newRule.nextStage || ''}
                onChange={e => setNewRule({ ...newRule, nextStage: e.target.value || undefined })}
              >
                <option value="">（変更しない）</option>
                {SALES_PROGRESS_FLOW.map(st => (
                  <option key={st} value={st}>➔ 【{st}】へ進める</option>
                ))}
              </select>
              <span style={{ fontSize: '0.84rem' }}>、確度:</span>
              <select
                className="input-field"
                style={{ width: 'auto', backgroundColor: '#ffffff', fontWeight: 700 }}
                value={newRule.autoProbability || ''}
                onChange={e => setNewRule({ ...newRule, autoProbability: (e.target.value || undefined) as any })}
              >
                <option value="">（変更しない）</option>
                <option value="A">確度【A】へ昇格</option>
                <option value="B">確度【B】</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#1e1b4b', marginBottom: '0.25rem' }}>
                ②「🔥 次にやること」に自動セットするタスク名
              </label>
              <input
                type="text"
                className="input-field"
                style={{ width: '100%', backgroundColor: '#ffffff', fontWeight: 700 }}
                value={newRule.actionTitle || ''}
                onChange={e => setNewRule({ ...newRule, actionTitle: e.target.value })}
                placeholder="例: 📞 初動メール開封確認 ＆ 実機デモ日程の打診コール"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#3730a3', marginBottom: '0.25rem' }}>
                ③ 営業ガイド・補足メモ（超かんたん司令室のカード右側に表示されます）
              </label>
              <input
                type="text"
                className="input-field"
                style={{ width: '100%', backgroundColor: '#ffffff' }}
                value={newRule.actionMemo || ''}
                onChange={e => setNewRule({ ...newRule, actionMemo: e.target.value })}
                placeholder="例: 初動メール(+5p)送付から2日経過。デモ(+5p)または見積送付(+5p)を狙う。"
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
          <button className="btn btn-outline" onClick={cancelAddRule}>キャンセル</button>
          <button className="btn btn-primary" onClick={handleAddRuleSubmit}>
            <Save size={16} style={{ marginRight: '0.25rem' }} /> ルールを保存する
          </button>
        </div>
      </div>
    </div>
  );

  const filteredRules = rules.filter(r =>
    selectedRuleCategory === 'all' ? true : (r.category || '初動・架電加速') === selectedRuleCategory
  );

  const renderRulesTab = () => (
    <div className="settings-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {ruleToastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          backgroundColor: '#0f172a',
          color: '#ffffff',
          borderLeft: '5px solid #10b981',
          padding: '0.85rem 1.25rem',
          borderRadius: '0.65rem',
          fontWeight: 800,
          fontSize: '0.86rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.25)'
        }}>
          {ruleToastMsg}
        </div>
      )}

      {/* ヘッダーバナー */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #312e81 100%)',
        borderRadius: '0.9rem',
        padding: '1.2rem 1.5rem',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{
              backgroundColor: '#10b981',
              color: '#0f172a',
              fontSize: '0.72rem',
              fontWeight: 900,
              padding: '0.15rem 0.6rem',
              borderRadius: '999px'
            }}>
              超かんたん司令室 完全連動
            </span>
            <span style={{ fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 700 }}>
              アクションポイント制 ・ 7段階進捗フロー ・ 🏥クリニック直販 / 🏢BtoBディーラー別枠 対応
            </span>
          </div>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.35rem', fontWeight: 900, color: '#ffffff' }}>
            ⚡ 自動化ルール（ルールエンジン）— 稼働中 {rules.filter(r => r.isActive).length} / 全 {rules.length} ルール
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowIdeaCatalog(prev => !prev)}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '0.5rem',
              border: '1px solid #fcd34d',
              backgroundColor: showIdeaCatalog ? '#f59e0b' : 'rgba(245, 158, 11, 0.15)',
              color: showIdeaCatalog ? '#0f172a' : '#fef3c7',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Sparkles size={15} />
            <span>{showIdeaCatalog ? '💡 新ルールアイデア集を閉じる' : '💡 超かんたん司令室の新ルールアイデア集を見る'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('超かんたん司令室連動の標準10ルールにリセットしますか？')) {
                resetToEasyOSDefaultRules();
                showRuleToast('🔄 超かんたん司令室連動の標準10ルールを再読み込みしました');
              }
            }}
            style={{
              padding: '0.45rem 0.8rem',
              borderRadius: '0.5rem',
              border: '1px solid rgba(255,255,255,0.3)',
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            <RotateCcw size={14} /> 標準ルールに戻す
          </button>

          <button
            type="button"
            className="btn btn-primary"
            style={{ backgroundColor: '#10b981', border: 'none', color: '#0f172a', fontWeight: 900 }}
            onClick={() => (isAddingRule ? cancelAddRule() : setIsAddingRule(true))}
          >
            {isAddingRule ? 'キャンセル' : <><Plus size={16} /> オリジナルルールを作成</>}
          </button>
        </div>
      </div>

      {/* 💡 超かんたん司令室を参考にした「新たなるルールのアイデア集（ワンクリック導入カタログ）」 */}
      {showIdeaCatalog && (
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '2px solid #f59e0b',
          borderRadius: '0.95rem',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '1.02rem', fontWeight: 900, color: '#78350f', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Sparkles size={19} color="#d97706" />
                <span>💡「超かんたん司令室」を参考にした新たなる自動化ルールのアイデア集（全8選）</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#92400e', marginTop: '0.15rem', fontWeight: 600 }}>
                ポスティング×架電コンボ、現地訪問×同日相談メール(+6p)、新規開業特化、歯科特化、🏢BtoBディーラー別枠フォロー、累計15p決裁突破など、ワンクリックで追加できます
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '0.75rem' }}>
            {RULE_IDEA_CATALOG.map((idea, idx) => {
              const alreadyAdded = rules.some(r => r.name === idea.name);
              const seg = segmentLabelMap[idea.targetSegment || 'all'];
              const previewMatches = scanMatchingProjectsForRule(projects, { ...idea, id: `idea-${idx}` });
              return (
                <div
                  key={idea.name}
                  style={{
                    backgroundColor: '#ffffff',
                    border: alreadyAdded ? '2px solid #10b981' : '1px solid #fcd34d',
                    borderRadius: '0.75rem',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.6rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{
                        backgroundColor: seg.bg,
                        color: seg.color,
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '0.12rem 0.5rem',
                        borderRadius: '999px'
                      }}>
                        {seg.label}
                      </span>
                      <span style={{
                        backgroundColor: '#fef3c7',
                        color: '#b45309',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '0.12rem 0.5rem',
                        borderRadius: '999px'
                      }}>
                        {idea.category}
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#047857', marginLeft: 'auto' }}>
                        🔍 現名簿該当: {previewMatches.length}件
                      </span>
                    </div>

                    <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.35 }}>
                      {idea.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem', lineHeight: 1.45 }}>
                      {idea.description}
                    </div>
                    <div style={{
                      marginTop: '0.45rem',
                      padding: '0.35rem 0.55rem',
                      borderRadius: '0.4rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.73rem',
                      color: '#1e3a8a',
                      fontWeight: 700
                    }}>
                      ➔ 自動生成タスク: 「{idea.actionTitle}」
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' }}>
                    {alreadyAdded ? (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: '#059669',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.3rem 0.65rem',
                        backgroundColor: '#ecfdf5',
                        borderRadius: '0.4rem',
                        border: '1px solid #6ee7b7'
                      }}>
                        <CheckCircle2 size={14} /> 導入済み
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          addRule(idea);
                          showRuleToast(`✨ アイデア「${idea.name}」をルールエンジンに追加しました！`);
                        }}
                        style={{
                          padding: '0.35rem 0.8rem',
                          borderRadius: '0.45rem',
                          border: 'none',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: '#0f172a',
                          fontSize: '0.76rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <Plus size={14} /> このルールをワンクリック追加
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* カテゴリ絞り込みピルバー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setSelectedRuleCategory('all')}
          style={{
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            border: selectedRuleCategory === 'all' ? '2px solid #1e40af' : '1px solid #cbd5e1',
            backgroundColor: selectedRuleCategory === 'all' ? '#1e40af' : '#ffffff',
            color: selectedRuleCategory === 'all' ? '#ffffff' : '#334155',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          すべて ({rules.length})
        </button>
        {RULE_CATEGORIES.map(cat => {
          const cnt = rules.filter(r => (r.category || '初動・架電加速') === cat).length;
          const active = selectedRuleCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedRuleCategory(cat)}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '999px',
                border: active ? '2px solid #1e40af' : '1px solid #cbd5e1',
                backgroundColor: active ? '#1e40af' : '#ffffff',
                color: active ? '#ffffff' : '#334155',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {cat} ({cnt})
            </button>
          );
        })}
      </div>

      {isAddingRule && !editingRuleId && renderRuleForm()}

      {filteredRules.map(rule => {
        const seg = segmentLabelMap[rule.targetSegment || 'all'];
        const matchingProjects = scanMatchingProjectsForRule(projects, rule);

        return (
          <React.Fragment key={rule.id}>
            {editingRuleId === rule.id ? (
              renderRuleForm()
            ) : (
              <div
                className="rule-card"
                style={{
                  borderLeft: `6px solid ${
                    !rule.isActive
                      ? '#94a3b8'
                      : rule.targetSegment === 'btob_only'
                      ? '#4338ca'
                      : '#2563eb'
                  }`
                }}
              >
                <div className="rule-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => toggleRule(rule.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                      title={rule.isActive ? 'クリックで一時停止' : 'クリックで有効化'}
                    >
                      {rule.isActive ? <ToggleRight size={30} color="var(--success)" /> : <ToggleLeft size={30} color="var(--text-muted)" />}
                    </button>

                    <span style={{
                      backgroundColor: seg.bg,
                      color: seg.color,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '999px'
                    }}>
                      {seg.label}
                    </span>

                    {rule.category && (
                      <span style={{
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '999px'
                      }}>
                        {rule.category}
                      </span>
                    )}

                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: rule.isActive ? '#0f172a' : 'var(--text-muted)' }}>
                      {rule.name}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    {/* 現在の名簿への即時一括適用ボタン */}
                    <button
                      type="button"
                      onClick={() => {
                        if (matchingProjects.length === 0) {
                          alert('現在このルールの条件に合致する案件はありません。');
                          return;
                        }
                        const count = applyRuleToMatchingProjects(rule);
                        showRuleToast(`⚡ 該当する ${count} 件の案件に「${rule.actionTitle}」を一括セットしました！`);
                      }}
                      style={{
                        padding: '0.28rem 0.7rem',
                        borderRadius: '0.45rem',
                        border: matchingProjects.length > 0 ? '1px solid #059669' : '1px solid #cbd5e1',
                        backgroundColor: matchingProjects.length > 0 ? '#ecfdf5' : '#f8fafc',
                        color: matchingProjects.length > 0 ? '#065f46' : '#64748b',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Zap size={13} />
                      <span>該当 {matchingProjects.length}件に今すぐ適用</span>
                    </button>

                    <button onClick={() => startEditRule(rule)} className="btn" style={{ padding: '0.25rem 0.45rem', color: 'var(--primary-color)', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.35rem', fontSize: '0.75rem', fontWeight: 700 }}>
                      <Edit2 size={14} /> 編集
                    </button>
                    <button onClick={() => { if (confirm('このルールを削除しますか？')) deleteRule(rule.id); }} className="btn" style={{ padding: '0.25rem 0.45rem', color: 'var(--danger)', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.35rem', fontSize: '0.75rem', fontWeight: 700 }}>
                      <Trash2 size={14} /> 削除
                    </button>
                  </div>
                </div>

                {rule.description && (
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '0.6rem' }}>
                    {rule.description}
                  </div>
                )}

                <div className="rule-condition" style={{ opacity: rule.isActive ? 1 : 0.6 }}>
                  <span className="rule-badge">{triggerLabelMap[rule.triggerType] || '条件'}</span>
                  <span className="rule-badge" style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontWeight: 800 }}>
                    {rule.triggerType === 'points_reached'
                      ? `累計 ${rule.triggerValue}p 以上`
                      : rule.triggerType === 'stagnant_days'
                      ? `${rule.triggerValue}日間 未接触・停滞`
                      : rule.triggerValue}
                  </span>

                  {rule.conditionField && (
                    <span style={{ display: 'inline-block', marginLeft: '0.5rem' }}>
                      <span style={{ fontWeight: 800, color: '#b45309' }}>＋ AND条件:</span>
                      <span className="rule-badge" style={{ backgroundColor: '#fef3c7', color: '#92400e', marginLeft: '0.35rem' }}>
                        {rule.conditionField} が「{rule.conditionValue}」({rule.conditionOperator || 'equals'})
                      </span>
                    </span>
                  )}

                  <ArrowRight className="rule-arrow" size={16} />
                  <span className="rule-badge" style={{ backgroundColor: '#e0e7ff', color: '#4338ca', fontWeight: 800 }}>
                    {rule.actionDaysToDeadline === 0 ? '当日（即時）' : `+${rule.actionDaysToDeadline}日後`}
                  </span>
                  {rule.nextStage && (
                    <span className="rule-badge" style={{ backgroundColor: '#dcfce7', color: '#166534', fontWeight: 800 }}>
                      進捗 ➔ 【{rule.nextStage}】
                    </span>
                  )}
                  {rule.autoProbability && (
                    <span className="rule-badge" style={{ backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 800 }}>
                      確度 ➔ 【{rule.autoProbability}】
                    </span>
                  )}
                </div>

                <div className="rule-action" style={{ marginTop: '0.75rem', opacity: rule.isActive ? 1 : 0.6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Zap size={20} color={rule.isActive ? '#d97706' : 'var(--text-muted)'} />
                    <div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>自動セットされる次回タスク：「{rule.actionTitle}」</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        担当: {rule.actionAssignee} / 優先度: <strong>{rule.actionPriority}</strong> {rule.actionMemo && ` / ガイド: ${rule.actionMemo}`}
                      </div>
                    </div>
                  </div>

                  {matchingProjects.length > 0 && (
                    <div style={{ fontSize: '0.73rem', color: '#065f46', backgroundColor: '#ecfdf5', padding: '0.25rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #a7f3d0', fontWeight: 700 }}>
                      対象例: {matchingProjects.slice(0, 2).map(p => p.clinicName).join('、')}
                      {matchingProjects.length > 2 ? ` 他${matchingProjects.length - 2}件` : ''}
                    </div>
                  )}
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const [newItems, setNewItems] = useState<{ [key: string]: string }>({});

  const handleAddItem = (category: keyof MasterData) => {
    const item = newItems[category];
    if (item) {
      addItem(category, item);
      setNewItems({ ...newItems, [category]: '' });
    }
  };

  const renderMasterList = (title: string, category: keyof MasterData) => (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', margin: 0 }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          className="mock-input"
          value={newItems[category] || ''}
          onChange={e => setNewItems({ ...newItems, [category]: e.target.value })}
          placeholder="新しい項目..."
          onKeyDown={e => e.key === 'Enter' && handleAddItem(category)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleAddItem(category)}>
          <Plus size={14} /> 追加
        </button>
      </div>
      <table className="data-table">
        <tbody>
          {masterData[category].map(item => (
            <tr key={item}>
              <td>{item}</td>
              <td style={{ textAlign: 'right', width: '50px' }}>
                <button
                  onClick={() => removeItem(category, item)}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderMasterTab = () => (
    <div className="settings-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>マスタデータ管理</h2>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        各種ドロップダウンで選択できる項目をカスタマイズします。
      </p>

      <div className="two-col-grid">
        {renderMasterList('機器カラー', 'deviceColors')}
        {renderMasterList('釣銭機カラー', 'changeMachineColors')}
      </div>

      {/* 全端末データ統合（Firestore クラウド同期） */}
      <div className="card" style={{ marginTop: '2rem', border: '2px solid #2563eb', backgroundColor: '#eff6ff', borderRadius: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Sparkles size={20} color="#2563eb" />
          <h3 style={{ fontSize: '1rem', color: '#1e3a8a', margin: 0, fontWeight: 800 }}>
            ☁️ 全端末データ統合（Firestore クラウド一括同期・バックアップ）
          </h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '1rem', lineHeight: 1.6 }}>
          現在のブラウザにある全{projects.length}件の名簿データ・活動履歴・獲得ポイント・次回ToDoをクラウド（Firestore）にバックアップ・同期します。<br />
          同期が完了すると、<strong>別のパソコン・スマホ・タブレットからログインした際も、まったく同じ最新データがリアルタイムで統合・表示</strong>されます。
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            disabled={isCloudSyncing}
            onClick={async () => {
              if (window.confirm(`現在ローカルにある全${projects.length}件の案件とToDoをクラウドに一括同期しますか？\n（他のパソコンやスマホからも同じデータが見られるようになります）`)) {
                const res = await syncLocalToCloud();
                if (res.success) {
                  alert(`✅ 成功: ${res.count}件の案件データをクラウドに同期しました！他の端末からも確認できます。`);
                } else {
                  alert(`⚠️ エラー: ${res.error}`);
                }
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
          >
            {isCloudSyncing ? 'クラウド同期中...' : `☁️ 現在の${projects.length}件をクラウドに一括同期・統合する`}
          </button>

          <button
            className="btn btn-outline"
            onClick={() => {
              if (window.confirm('名簿初期の42件（北海道・東北クリニック＆ディーラー）の状態に初期化し、クラウドにも反映しますか？')) {
                resetToRoster42();
                alert('🔄 名簿初期の42件データを再読み込みし、クラウドへ反映しました。');
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, borderColor: '#2563eb', color: '#1d4ed8', backgroundColor: '#ffffff' }}
          >
            <RotateCcw size={15} /> 📋 名簿初期の42件から始める（初期状態へリセット）
          </button>
        </div>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="settings-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>通知・アラート設定</h2>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        アプリ内での通知の受け取り方や、外部サービスとの連携通知を設定します。
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', marginTop: 0 }}>アプリ内通知</h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>トースト通知を表示する</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>画面の右下に一時的に表示されるアクション可能な通知です。</div>
          </div>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => updateSettings({ showToasts: !notifSettings.showToasts })}
          >
            {notifSettings.showToasts ? <ToggleRight size={32} color="var(--success)" /> : <ToggleLeft size={32} color="var(--text-muted)" />}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>未読バッジを表示する</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>ヘッダーのベルアイコンに未読件数の赤丸を表示します。</div>
          </div>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => updateSettings({ showBadge: !notifSettings.showBadge })}
          >
            {notifSettings.showBadge ? <ToggleRight size={32} color="var(--success)" /> : <ToggleLeft size={32} color="var(--text-muted)" />}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0' }}>
          <div>
            <div style={{ fontWeight: 600 }}>集中モード（危険アラートのみ表示）</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>右下に出るポップアップ（トースト）を、危険アラートなど重要なものだけに限定します。</div>
          </div>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => updateSettings({ focusMode: !notifSettings.focusMode })}
          >
            {notifSettings.focusMode ? <ToggleRight size={32} color="var(--success)" /> : <ToggleLeft size={32} color="var(--text-muted)" />}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', marginTop: 0 }}>危険アラート設定</h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>アラート発火タイミング（設置日の〇日前）</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>何日前から必須項目の未入力チェックを行うか設定します。</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="number"
              className="input-field"
              style={{ width: '80px', textAlign: 'right' }}
              value={notifSettings.dangerAlertDaysBeforeInstall || 3}
              onChange={(e) => updateSettings({ dangerAlertDaysBeforeInstall: Number(e.target.value) })}
            />
            <span>日前</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>カラー未定をチェック</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>本体カラーが未定の場合に警告を出します。</div>
          </div>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => updateSettings({ dangerAlertCheckColor: !notifSettings.dangerAlertCheckColor })}
          >
            {notifSettings.dangerAlertCheckColor ? <ToggleRight size={32} color="var(--danger)" /> : <ToggleLeft size={32} color="var(--text-muted)" />}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0' }}>
          <div>
            <div style={{ fontWeight: 600 }}>キャッシュレス未定をチェック</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>キャッシュレス審査が完了していない場合に警告を出します。</div>
          </div>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => updateSettings({ dangerAlertCheckCashless: !notifSettings.dangerAlertCheckCashless })}
          >
            {notifSettings.dangerAlertCheckCashless ? <ToggleRight size={32} color="var(--danger)" /> : <ToggleLeft size={32} color="var(--text-muted)" />}
          </button>
        </div>
      </div>
    </div>
  );

  const renderIntegrationsTab = () => (
    <div className="settings-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>AI設定・要約AIプロンプト設定</h2>
          <p style={{ color: 'var(--text-muted)', margin: '0.35rem 0 0 0', fontSize: '0.88rem' }}>
            「超かんたん司令室」の7段階フロー・累計ポイント・13種アクション履歴と完全連動したAI要約プロンプトを設定します。
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSaveAISettings} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800 }}>
          <Save size={18} /> 設定を保存する
        </button>
      </div>

      {aiSavedMsg && (
        <div style={{
          padding: '0.7rem 1rem',
          marginBottom: '1.25rem',
          borderRadius: '0.55rem',
          backgroundColor: '#dcfce7',
          border: '1px solid #86efac',
          color: '#166534',
          fontWeight: 800,
          fontSize: '0.88rem'
        }}>
          {aiSavedMsg}
        </div>
      )}

      {/* 1. 要約AIプロンプト設定（メインカード） */}
      <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid #93c5fd', borderRadius: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e3a8a' }}>
            <Bot size={20} color="#2563eb" /> 要約AIプロンプト設定（超かんたん司令室連動）
          </h3>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            onClick={() => {
              const updated: AISettings = {
                ...aiSettings,
                prompt: defaultAIPrompt,
                presetId: 'easy_os_standard'
              };
              setAiSettings(updated);
              saveAISettings(updated);
              setAiSavedMsg('🔄 標準プロンプト（超かんたん司令室・標準参謀）にリセット＆保存しました');
              setTimeout(() => setAiSavedMsg(null), 3500);
            }}
          >
            <RotateCcw size={14} /> 標準プロンプトに戻す
          </button>
        </div>

        {/* プリセット選択ボタン群 */}
        <div style={{ marginBottom: '1.15rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: '0.5rem' }}>
            💡 用途別プロンプトテンプレート（ワンクリックで切り替え＆即時反映）
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.65rem' }}>
            {AI_PROMPT_PRESETS.map((preset) => {
              const isSelected = aiSettings.presetId === preset.id || aiSettings.prompt.trim() === preset.prompt.trim();
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const updated: AISettings = {
                      ...aiSettings,
                      prompt: preset.prompt,
                      presetId: preset.id as AIPromptPresetId
                    };
                    setAiSettings(updated);
                    saveAISettings(updated);
                    setAiSavedMsg(`✨ プロンプトを「${preset.label}」に切り替えました`);
                    setTimeout(() => setAiSavedMsg(null), 3000);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '0.65rem',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.84rem', color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                      {preset.label}
                    </span>
                    {isSelected && (
                      <span style={{ backgroundColor: '#2563eb', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '0.1rem 0.45rem', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                        適用中
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', marginBottom: '0.25rem' }}>
                    {preset.badge}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.4 }}>
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 出力強化オプションスイッチ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '0.65rem',
          padding: '0.85rem 1rem',
          backgroundColor: '#f8fafc',
          borderRadius: '0.65rem',
          border: '1px solid #e2e8f0',
          marginBottom: '1rem'
        }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', cursor: 'pointer', fontSize: '0.82rem' }}>
            <input
              type="checkbox"
              checked={aiSettings.includeNextActionPoint !== false}
              onChange={(e) => {
                const updated = { ...aiSettings, includeNextActionPoint: e.target.checked };
                setAiSettings(updated);
                saveAISettings(updated);
              }}
              style={{ marginTop: '0.2rem', accentColor: '#2563eb' }}
            />
            <div>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>🎯 推奨アクションボタン(+Xp)と実施日を明記</div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                会話(+3p)・初動メール(+5p)・デモ(+5p)等のどれをいつ押すべきか出力します
              </div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', cursor: 'pointer', fontSize: '0.82rem' }}>
            <input
              type="checkbox"
              checked={aiSettings.includeTalkScript !== false}
              onChange={(e) => {
                const updated = { ...aiSettings, includeTalkScript: e.target.checked };
                setAiSettings(updated);
                saveAISettings(updated);
              }}
              style={{ marginTop: '0.2rem', accentColor: '#2563eb' }}
            />
            <div>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>💬 次回架電・メールの切り出しトークを提案</div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                そのまま現場で使える具体的な一言フレーズを要約末尾に含めます
              </div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', cursor: 'pointer', fontSize: '0.82rem' }}>
            <input
              type="checkbox"
              checked={aiSettings.enableAutoFallback !== false}
              onChange={(e) => {
                const updated = { ...aiSettings, enableAutoFallback: e.target.checked };
                setAiSettings(updated);
                saveAISettings(updated);
              }}
              style={{ marginTop: '0.2rem', accentColor: '#16a34a' }}
            />
            <div>
              <div style={{ fontWeight: 800, color: '#166534' }}>🛡️ API混雑時(High Demand)の自動フォールバック</div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Gemini/OpenAIサーバー混雑時やAPIキー未設定時もエラーで止めず即座に要約を生成します
              </div>
            </div>
          </label>
        </div>

        {/* プロンプト自由編集テキストエリア */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e293b' }}>
              📝 プロンプト指示文（自由編集可能）
            </label>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              ※ 【見出し】を変えると要約の出力フォーマットも自動で連動します
            </span>
          </div>
          <textarea
            className="input-field"
            rows={10}
            value={aiSettings.prompt}
            onChange={(e) => setAiSettings({ ...aiSettings, prompt: e.target.value, presetId: 'custom' })}
            style={{ width: '100%', resize: 'vertical', lineHeight: 1.6, fontSize: '0.86rem', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0 }}>
              ※ この指示文のあとに、対象案件の「ステータス・累計ポイント・休診日・予約システム・活動履歴」が自動連結されて解析されます。
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleTestPromptPreview}
                disabled={aiPreviewLoading}
                style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', borderColor: '#2563eb', color: '#1d4ed8' }}
              >
                <Sparkles size={15} />
                {aiPreviewLoading ? 'テスト要約を生成中...' : '✨ 現在のプロンプトでテスト要約を試す'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAISettings}
                style={{ fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Save size={15} /> プロンプトを保存
              </button>
            </div>
          </div>
        </div>

        {/* テスト要約プレビュー結果 */}
        {aiPreviewText && (
          <div style={{
            marginTop: '1rem',
            padding: '0.95rem 1.1rem',
            backgroundColor: '#f0f9ff',
            border: '1px solid #7dd3fc',
            borderRadius: '0.65rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0369a1' }}>
                ⚡ テスト要約プレビュー結果（実案件データで検証）
              </span>
              <button
                type="button"
                onClick={() => setAiPreviewText('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.75rem' }}
              >
                ✕ 閉じる
              </button>
            </div>
            <div style={{
              backgroundColor: '#ffffff',
              padding: '0.85rem',
              borderRadius: '0.5rem',
              border: '1px solid #bae6fd',
              fontSize: '0.84rem',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              color: '#0f172a'
            }}>
              {aiPreviewText}
            </div>
          </div>
        )}
      </div>

      {/* 2. AIモデル・APIキー設定 */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Key size={18} color="var(--primary)" /> AIモデル・APIキー設定
        </h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Google Gemini または OpenAI のAPIキーを設定できます。Gemini利用時に特定モデルが混雑（High Demand）している場合は、自動的に別モデル（gemini-2.0-flash ➔ gemini-1.5-flash 等）および内蔵スマート要約エンジンへフォールバックします。
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1rem', alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.4rem' }}>優先するAIプロバイダー</div>
            <select
              className="input-field"
              value={aiSettings.provider}
              onChange={(e) => setAiSettings({ ...aiSettings, provider: e.target.value as 'openai' | 'gemini' })}
              style={{ width: '100%', cursor: 'pointer', fontWeight: 700 }}
            >
              <option value="gemini">Google Gemini（推奨・自動モデル切替対応）</option>
              <option value="openai">OpenAI (ChatGPT / gpt-4o-mini)</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              {aiSettings.provider === 'gemini' ? 'Gemini APIキー（任意）' : 'OpenAI APIキー（任意）'}
            </div>
            <input
              type="password"
              className="input-field"
              placeholder={aiSettings.provider === 'gemini' ? 'AIza...（未入力でもスマート要約が動作します）' : 'sk-...（未入力でもスマート要約が動作します）'}
              value={aiSettings.provider === 'gemini' ? aiSettings.geminiApiKey : aiSettings.openaiApiKey}
              onChange={(e) => {
                if (aiSettings.provider === 'gemini') {
                  setAiSettings({ ...aiSettings, geminiApiKey: e.target.value });
                } else {
                  setAiSettings({ ...aiSettings, openaiApiKey: e.target.value });
                }
              }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        <SettingsIcon size={24} color="var(--primary)" />
        <h2 style={{ margin: 0 }}>システム設定</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* 上部：設定ナビゲーション（タブ化） */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <button
            className={`btn ${activeTab === 'rules' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('rules')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Zap size={18} /> 自動化ルール
          </button>
          <button
            className={`btn ${activeTab === 'master' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('master')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Database size={18} /> マスタデータ管理
          </button>
          <button
            className={`btn ${activeTab === 'notifications' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('notifications')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Bell size={18} /> 通知・アラート
          </button>
          <button
            className={`btn ${activeTab === 'integrations' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('integrations')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Bot size={18} /> AI設定
          </button>
        </div>

        {/* 下部：コンテンツエリア（横幅をフルに使う） */}
        <div style={{ width: '100%' }}>
          {activeTab === 'rules' && renderRulesTab()}
          {activeTab === 'master' && renderMasterTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {activeTab === 'integrations' && renderIntegrationsTab()}
        </div>
      </div>
    </div>
  );
}
