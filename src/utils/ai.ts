export type AIPromptPresetId = 'easy_os_standard' | 'quick_3lines' | 'clinic_closing' | 'btob_partner';

export interface AIPromptPreset {
  id: AIPromptPresetId;
  label: string;
  badge: string;
  description: string;
  prompt: string;
}

export interface AISettings {
  provider: 'openai' | 'gemini';
  openaiApiKey: string;
  geminiApiKey: string;
  prompt: string;
  presetId?: AIPromptPresetId | 'custom';
  enableAutoFallback?: boolean;
  includeNextActionPoint?: boolean;
  includeTalkScript?: boolean;
}

export interface ExtractedClinicWebsiteInfo {
  websiteUrl: string;
  address?: string;
  phone?: string;
  email?: string;
  clinicHours?: string;
  closedDays?: string;
  director?: string;
  department?: string;
  reservationSystem?: string;
  corpId?: string;
  sourceMethod?: string;
}

export const defaultAIPrompt = `あなたは医療機器・クリニック向け営業支援システム「超かんたん司令室」の専属AI営業参謀です。
以下の「案件情報（7段階フロー・累計獲得ポイント・実施済マイルストーン）」と「これまでの活動履歴」を分析し、現場の営業担当者が3秒で状況を掴み、次にどのアクションボタンを押すべきか即判断できるよう簡潔に要約してください。

【現在の状況・温度感】
・現在のステージ（問合せ／初動／デモ／見積／検討／後追い／受注）と、これまでの活動履歴・累計ポイントから見える先方の温度感を1〜2文で具体的に記述

【次に打つべき推奨アクション（超かんたん司令室連動）】
・次に実行すべき具体的なアクション（例：📞会話(+3p)、✉️初動メール(+5p)、💻オンラインデモ(+5p)、📄見積書送付(+5p)、📮後追いメール(+2p)、🚶訪問(+3p) など）と、実施タイミング（今日／明日／+3日後／+1週間後）

【次回アプローチのトーク要点・注意点】
・次回の架電やメールで切り出すべき具体的な一言、または放置日数・競合・決裁者確認などの注意点

※ 冗長な挨拶や前置きは一切省き、箇条書きで端的に出力してください。`;

export const AI_PROMPT_PRESETS: AIPromptPreset[] = [
  {
    id: 'easy_os_standard',
    label: '🎯 超かんたん司令室・標準参謀（推奨）',
    badge: '標準・7段階フロー＆ポイント連動',
    description: '現在の温度感・次に押すべきアクションボタン(+Xp)・実施日目安・トーク要点をバランスよく出力します。',
    prompt: defaultAIPrompt
  },
  {
    id: 'quick_3lines',
    label: '⚡ 架電前・3行スピード要約',
    badge: '超短文・10秒確認用',
    description: '連続架電中にパッと見てすぐ受話器を取れるよう、「これまでの経緯」「今の課題」「今日話す一言」の3行だけで出力します。',
    prompt: `あなたはクリニック営業のスピード参謀です。架電直前の営業担当者が3秒で読めるよう、以下の活動履歴を必ず【3行のみ】で超簡潔に要約してください。

1. 【これまでの経緯】（直近いつ・何を実施し、どんな反応だったか1文で）
2. 【現在の温度感とボトルネック】（なぜ止まっているか／何が決め手になるか1文で）
3. 【今日切り出す一言】（今回の架電またはメールで最初に伝える具体的な一言）

※ 前置き・挨拶・余計な装飾は一切禁止。3行以内で簡潔に出力してください。`
  },
  {
    id: 'clinic_closing',
    label: '🏥 クリニック院長・決裁クロージング特化',
    badge: 'デモ誘導・見積後追い向け',
    description: '院長先生の決裁ハードル（費用対効果・スタッフ負担・予約システム連携）を突破するための提案切り口を重点出力します。',
    prompt: `あなたはクリニック向け医療機器・ITシステムのトップセールスマネージャーです。
以下のクリニック情報と活動履歴を分析し、院長先生から「デモ実施」または「受注決裁」を勝ち取るための戦略要約を作成してください。

【クリニックの現状と決裁ハードル】
・診療科目・予約システム・これまでの接触履歴から推測される院長の関心事や懸念点

【推奨クロージング手順（超かんたん司令室アクション）】
・次に実行すべきアクション（オンラインデモ(+5p)／訪問デモ(+5p)／見積書送付(+5p)／後追いメール(+2p)等）と狙い目の曜日・時間帯

【院長先生へ刺さるキラーフレーズ】
・受付業務の削減や患者満足度アップなど、次回の会話・メールにそのまま使える具体的な提案フレーズ`
  },
  {
    id: 'btob_partner',
    label: '🏢 BtoB ディーラー・パートナー協業特化',
    badge: 'ディーラー別枠向け',
    description: '医療機器ディーラー・代理店担当者との関係構築、紹介案件の掘り起こし、同行デモ設定に特化した要約を出力します。',
    prompt: `あなたは医療機器ディーラー・パートナー企業（BtoBアライアンス）統括マネージャーです。
以下のディーラー・パートナー企業との活動履歴を分析し、紹介案件の創出と協業推進に向けた要約を作成してください。

【パートナー協業の現状】
・先方の営業担当者との関係値、現在動いている紹介案件・共同提案の状況

【次に打つべきBtoBアクション】
・次に実施すべきアクション（会話(+3p)での案件ヒアリング／訪問(+3p)での勉強会／同行デモ打診／卸条件・見積書送付(+5p)など）

【担当者へ聞くべきヒアリング項目】
・「最近、新患対応や受付精算でお困りの先生はいらっしゃいませんか？」など、担当営業マンから紹介を引き出す具体的な一言`
  }
];

const LEGACY_PROMPTS = [
  `以下の活動履歴を基に、この案件の「現在の状況」と「次にとるべきアクション」を3行で要約してください。\n※ 現場の担当者がパッと見て状況がわかるように、簡潔かつ具体的に記述してください。`,
  `あなたは優秀な営業マネージャーです。以下の「案件情報」と「これまでの活動履歴」を分析し、以下の構成で簡潔に要約してください。

【現在の状況】（今の商談フェーズや顧客の温度感を1〜2文で）
【ネクストアクション】（次に「誰が」「何を」すべきかを具体的に）
【注意点・リスク】（期限切れや長期間放置などの懸念があれば。無ければ省略可）

※ 現場の営業担当者がパッと見てすぐに行動に移せるよう、箇条書きを活用して極めて具体的に記述してください。冗長な挨拶や前置きは一切不要です。`
];

export const getAISettings = (): AISettings => {
  const saved = localStorage.getItem('temasak-ai-settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey !== undefined) {
        if (parsed.provider === 'gemini') {
          parsed.geminiApiKey = parsed.apiKey;
        } else {
          parsed.openaiApiKey = parsed.apiKey;
        }
        delete parsed.apiKey;
      }

      if (!parsed.prompt || LEGACY_PROMPTS.includes(parsed.prompt.trim())) {
        parsed.prompt = defaultAIPrompt;
        parsed.presetId = 'easy_os_standard';
      }

      return {
        provider: parsed.provider || 'gemini',
        openaiApiKey: parsed.openaiApiKey || '',
        geminiApiKey: parsed.geminiApiKey || '',
        prompt: parsed.prompt || defaultAIPrompt,
        presetId: parsed.presetId || 'easy_os_standard',
        enableAutoFallback: parsed.enableAutoFallback !== false,
        includeNextActionPoint: parsed.includeNextActionPoint !== false,
        includeTalkScript: parsed.includeTalkScript !== false
      };
    } catch (e) {
      // ignore
    }
  }
  return {
    provider: 'gemini',
    openaiApiKey: '',
    geminiApiKey: '',
    prompt: defaultAIPrompt,
    presetId: 'easy_os_standard',
    enableAutoFallback: true,
    includeNextActionPoint: true,
    includeTalkScript: true
  };
};

export const saveAISettings = (settings: AISettings) => {
  localStorage.setItem('temasak-ai-settings', JSON.stringify(settings));
};

/**
 * 案件情報テキストと活動履歴から、設定されたプロンプト構成に沿ってスマート要約を生成する内蔵エンジン
 * （API混雑エラー 503 High Demand 時やAPIキー未設定時でも、設定プロンプトの指示に従って確実に要約を返します）
 */
export function generateSmartLocalSummary(activitiesText: string, customPrompt?: string): string {
  const settings = getAISettings();
  const promptToFollow = customPrompt || settings.prompt || defaultAIPrompt;

  // テキストから主要フィールドを抽出
  const getLineVal = (label: string): string => {
    const regex = new RegExp(`・${label}[:：]\\s*(.+)`);
    const m = activitiesText.match(regex);
    return m ? m[1].trim() : '';
  };

  const clinicName = getLineVal('案件名') || '対象案件';
  const status = getLineVal('ステータス') || getLineVal('進捗ステージ') || '初動';
  const probability = getLineVal('確度') || '未設定';
  const pointsStr = getLineVal('累計獲得ポイント') || '0p';
  const pointsNum = parseInt(pointsStr.replace(/[^0-9]/g, ''), 10) || 0;
  const segment = getLineVal('区分') || (clinicName.includes('株式会社') || clinicName.includes('メディカル') ? 'BtoBディーラー' : 'クリニック');
  const nextTask = getLineVal('次回予定タスク') || '';
  const closedDays = getLineVal('休診日') || '';
  const reservationSystem = getLineVal('予約システム') || '';

  // 活動履歴行の抽出
  const actSplit = activitiesText.split(/【活動履歴】|===活動履歴===/);
  const rawActsBlock = actSplit.length > 1 ? actSplit[1].trim() : '';
  const actLines = rawActsBlock
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('[') || l.startsWith('・'));

  const totalActs = actLines.length;
  const latestAct = actLines[0] || 'まだ活動履歴が記録されていません';
  const secondAct = actLines[1] || '';

  const hasInitialMail = rawActsBlock.includes('初動メール');
  const hasDemo = rawActsBlock.includes('デモ');
  const hasEstimate = rawActsBlock.includes('見積');
  const hasVisit = rawActsBlock.includes('訪問');
  const hasPosting = rawActsBlock.includes('ポスティング');
  const hasFollowupMail = rawActsBlock.includes('後追いメール');
  const absenceCount = (rawActsBlock.match(/不在/g) || []).length;
  const talkCount = (rawActsBlock.match(/会話/g) || []).length;

  // 現在の状況分析
  let situationLines: string[] = [];
  if (totalActs === 0) {
    situationLines.push(
      `・【${clinicName}】は現在「${status}」ステージ（累計 ${pointsNum}p）で、まだ具体的なアプローチ履歴が記録されていません。`
    );
  } else {
    situationLines.push(
      `・【${clinicName}】は現在「${status}」ステージ（累計獲得 ${pointsNum}p / 活動計 ${totalActs}回 / 確度: ${probability}）。直近は ${latestAct} を実施済みです。`
    );
    if (secondAct) {
      situationLines.push(`・その前は ${secondAct} を記録しており、${pointsNum >= 15 ? '複数回の接触により熱量が高まっている重点案件です。' : pointsNum >= 8 ? '初動接触から具体的な提案フェーズへ移行しつつあります。' : 'まずは接点を増やして院長・担当者との対話機会を作る段階です。'}`);
    }
  }

  // 推奨ネクストアクション判定（超かんたん司令室連動）
  let recommendedAction = '';
  let recommendedTiming = '今日〜明日';
  let talkPoint = '';

  if (segment.includes('BtoB') || segment.includes('ディーラー')) {
    if (!hasEstimate && !hasDemo) {
      recommendedAction = '📞 架電: 会話 (+3p) または 🚶 現地訪問 (+3p) で担当営業マンへ紹介案件ヒアリング';
      recommendedTiming = '明日 または +3日後';
      talkPoint = '「現在クリニック様から引き合いの多い自動精算・予約連携の最新事例資料をお持ちしました。先生方から受付業務でご相談を受けている案件はございませんか？」と切り出すのが効果的です。';
    } else {
      recommendedAction = '📄 見積書送付 (+5p) または 💻 同行デモ打診 (+5p)';
      recommendedTiming = '今日〜+3日後';
      talkPoint = 'ディーラー担当者様と導入スケジュール・卸条件をすり合わせ、クリニック院長先生への同行デモ日程を確定させてください。';
    }
  } else if (status === '受注') {
    recommendedAction = '🎉 導入キックオフ確認・設置準備フォロー';
    recommendedTiming = '+3日後';
    talkPoint = '受注確定のお礼とともに、機器設置日・キャッシュレス審査・スタッフ様向け操作説明会の日程確定を進めてください。';
  } else if (status === '問合せ' || (!hasInitialMail && totalActs <= 1)) {
    recommendedAction = '✉️ 初動メール (+5p) 送付 ＋ 📞 架電: 会話 (+3p)';
    recommendedTiming = '今日中（即時）';
    talkPoint = '問い合わせ・名簿登録の熱量が冷めないうちに、「3分でわかる導入事例資料」を初動メールで送付し、お電話でオンラインデモの候補日を2〜3枠ご提案してください。';
  } else if (absenceCount >= 2 && talkCount === 0) {
    recommendedAction = hasPosting
      ? '✉️ 相談メール (+3p) で時間帯変更アプローチ'
      : '📮 ポスティング (+2p) または ✉️ 初動メール (+5p)';
    recommendedTiming = '明日（昼休み前 または 午後診療前）';
    talkPoint = `架電で不在が${absenceCount}回続いています。${closedDays ? `休診日（${closedDays}）を避け、` : ''}外来が落ち着く12:15頃または13:45頃に時間を変えてコールするか、チラシ投函・メールで視覚的にフックを作ってください。`;
  } else if (!hasDemo && (status === '初動' || hasInitialMail || talkCount > 0)) {
    recommendedAction = '💻 オンラインデモ (+5p) または 🚗 訪問デモ (+5p) の日程打診';
    recommendedTiming = '+3日後以内';
    talkPoint = `${reservationSystem ? `現在ご利用中の「${reservationSystem}」との連携イメージや、` : ''}実際の画面を15分だけお見せするオンラインデモをご案内し、「デモ」ステージへ引き上げましょう。`;
  } else if (hasDemo && !hasEstimate) {
    recommendedAction = '📄 見積書送付 (+5p) ＋ 導入プラン比較の提示';
    recommendedTiming = '今日〜明日';
    talkPoint = 'デモの記憶が新しいうちに概算見積書（初期費用・月額・補助金活用プラン）を送付し、院長先生の予算感を確認してください。';
  } else if (hasEstimate && !hasFollowupMail) {
    recommendedAction = '📮 後追いメール (+2p) ＋ 📞 決裁確認コール (+3p)';
    recommendedTiming = '+3日後';
    talkPoint = '「先日お送りしたお見積書につきまして、ご不明点やご予算面での調整ご要望はございませんでしょうか？」と後追いメール＆架電で決裁時期を握ってください。';
  } else {
    recommendedAction = '📞 架電: 会話 (+3p) または ✉️ 相談メール (+3p) で最終クロージング';
    recommendedTiming = '明日 または +3日後';
    talkPoint = '導入時期の目安と最終的な懸念点（設置スペース・スタッフ教育など）をヒアリングし、今月中の受注確定を目指しましょう。';
  }

  // プロンプトが「3行」を求めている場合は3行フォーマットで出力
  if (promptToFollow.includes('3行') || settings.presetId === 'quick_3lines') {
    return [
      `1. 【これまでの経緯】${situationLines[0].replace(/^・/, '')}`,
      `2. 【推奨アクション】次は「${recommendedAction}」（実施目安: ${recommendedTiming}）を実行${nextTask ? `（現在登録タスク: ${nextTask}）` : ''}。`,
      `3. 【今日切り出す一言】${talkPoint}`
    ].join('\n');
  }

  // BtoBパートナープロンプトの場合
  if (promptToFollow.includes('BtoB') || promptToFollow.includes('パートナー') || settings.presetId === 'btob_partner') {
    return [
      `【パートナー協業の現状】`,
      ...situationLines,
      ``,
      `【次に打つべきBtoBアクション】`,
      `・推奨ボタン: ${recommendedAction}`,
      `・実施日選択の目安: 【${recommendedTiming}】`,
      ...(nextTask ? [`・現在登録中の次回タスク: ${nextTask}`] : []),
      ``,
      `【担当者へ聞くべきヒアリング項目】`,
      `・${talkPoint}`
    ].join('\n');
  }

  // クリニック院長クロージング特化の場合
  if (promptToFollow.includes('キラーフレーズ') || promptToFollow.includes('決裁ハードル') || settings.presetId === 'clinic_closing') {
    return [
      `【クリニックの現状と決裁ハードル】`,
      ...situationLines,
      ...(reservationSystem || closedDays ? [`・医院体制: ${reservationSystem ? `予約システム「${reservationSystem}」` : ''} ${closedDays ? `/ 休診日「${closedDays}」` : ''}`] : []),
      ``,
      `【推奨クロージング手順（超かんたん司令室アクション）】`,
      `・次に押すアクション: ${recommendedAction}`,
      `・推奨実施日: 【${recommendedTiming}】`,
      ``,
      `【院長先生へ刺さるキラーフレーズ】`,
      `・${talkPoint}`
    ].join('\n');
  }

  // 標準フォーマット（またはカスタムプロンプトの見出し構造を自動検出して合わせる）
  const customHeaders = Array.from(promptToFollow.matchAll(/【([^】]+)】/g))
    .map(m => m[1])
    .filter(h => !['案件情報', '活動履歴', '案件情報・活動履歴'].includes(h));

  if (customHeaders.length >= 2) {
    const sections: string[] = [];
    customHeaders.slice(0, 4).forEach((header, idx) => {
      sections.push(`【${header}】`);
      if (idx === 0) {
        sections.push(...situationLines);
      } else if (idx === 1) {
        sections.push(`・推奨アクション: ${recommendedAction}`);
        sections.push(`・実施日目安: 【${recommendedTiming}】${nextTask ? `（現在のタスク: ${nextTask}）` : ''}`);
      } else {
        sections.push(`・${talkPoint}`);
      }
      sections.push('');
    });
    return sections.join('\n').trim();
  }

  return [
    `【現在の状況・温度感】`,
    ...situationLines,
    ``,
    `【次に打つべき推奨アクション（超かんたん司令室連動）】`,
    `・推奨アクション: ${recommendedAction}`,
    `・実施日選択の目安: 【${recommendedTiming}】${nextTask ? `\n・現在セットされている次回タスク: 「${nextTask}」` : ''}`,
    ``,
    `【次回アプローチのトーク要点・注意点】`,
    `・${talkPoint}`
  ].join('\n');
}

export const generateSummary = async (
  activitiesText: string,
  overridePrompt?: string
): Promise<string> => {
  const settings = getAISettings();
  let systemMessage = (overridePrompt || settings.prompt || defaultAIPrompt).trim();

  // オプション指定の補足指示を付与
  const extraRules: string[] = [];
  if (settings.includeNextActionPoint !== false) {
    extraRules.push('・超かんたん司令室のアクションボタン名（会話(+3p)、初動メール(+5p)、オンラインデモ(+5p)、見積書送付(+5p)、訪問(+3p)、ポスティング(+2p)、相談メール(+3p)、後追いメール(+2p)など）と実施日目安（今日／明日／+3日後／+1週間後）を必ず明記してください。');
  }
  if (settings.includeTalkScript !== false) {
    extraRules.push('・次回の電話やメールでそのまま使える具体的な「切り出しトークの一言」を必ず含めてください。');
  }
  if (extraRules.length > 0) {
    systemMessage = `${systemMessage}\n\n【追加出力ルール】\n${extraRules.join('\n')}`;
  }

  if (settings.provider === 'gemini') {
    if (!settings.geminiApiKey) {
      if (settings.enableAutoFallback !== false) {
        return generateSmartLocalSummary(activitiesText, systemMessage);
      }
      throw new Error('GeminiのAPIキーが設定されていません。「システム設定 ＞ AI設定」からAPIキーを登録するか、スマート要約フォールバックを有効にしてください。');
    }

    const apiKey = settings.geminiApiKey.trim();

    // 混雑エラー (503 High demand / 429 Quota) を回避するため、複数モデルのフォールバック順序を構築
    const candidateModels: string[] = [
      'models/gemini-2.0-flash',
      'models/gemini-2.0-flash-lite',
      'models/gemini-1.5-flash',
      'models/gemini-1.5-flash-8b',
      'models/gemini-1.5-pro'
    ];

    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const listRes = await fetch(listUrl);
      if (listRes.ok) {
        const listData = await listRes.json();
        const models = listData.models || [];
        const validModels = models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name as string);

        // 2.0-flash / 1.5-flash などの安定モデルを優先し、preview/expで混雑しやすいモデルを後ろに回す
        const stableFlash = validModels.filter(
          (n: string) => n.includes('flash') && !n.includes('preview') && !n.includes('exp')
        );
        const otherValid = validModels.filter((n: string) => !stableFlash.includes(n));
        const merged = [...stableFlash, ...candidateModels, ...otherValid];
        candidateModels.length = 0;
        merged.forEach(m => {
          if (!candidateModels.includes(m)) candidateModels.push(m);
        });
      }
    } catch (e) {
      // モデル一覧取得失敗時は既定の candidateModels を順番に試行
    }

    let lastErrorMsg = '';
    for (const modelName of candidateModels.slice(0, 5)) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemMessage}\n\n===案件・活動履歴データ===\n${activitiesText}` }]
              }
            ],
            generationConfig: { temperature: 0.5, maxOutputTokens: 900 }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText && generatedText.trim()) {
            return generatedText.trim();
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          lastErrorMsg = errorData.error?.message || `HTTP ${response.status}`;
          // APIキー自体が無効な場合(400 API_KEY_INVALID / 403)は別モデルを試しても同じなのでループを抜ける
          if (response.status === 400 && lastErrorMsg.toLowerCase().includes('api key')) {
            break;
          }
          // 503 (high demand) や 429 (quota) や 404 の場合は次のモデルへ自動フォールバック！
          continue;
        }
      } catch (err: any) {
        lastErrorMsg = err?.message || '通信エラー';
        continue;
      }
    }

    // 全モデルが混雑 (High demand) またはレート制限だった場合、スマート要約エンジンへ自動フォールバック
    if (settings.enableAutoFallback !== false) {
      return generateSmartLocalSummary(activitiesText, systemMessage);
    }

    throw new Error(
      lastErrorMsg.includes('high demand')
        ? '現在AIサーバーのアクセスが集中しています。AI設定で「混雑時のスマート要約フォールバック」をONにすると待ち時間ゼロで要約を生成できます。'
        : lastErrorMsg || 'Gemini APIの呼び出しに失敗しました。'
    );
  } else {
    if (!settings.openaiApiKey) {
      if (settings.enableAutoFallback !== false) {
        return generateSmartLocalSummary(activitiesText, systemMessage);
      }
      throw new Error('OpenAIのAPIキーが設定されていません。「システム設定 ＞ AI設定」からAPIキーを登録するか、スマート要約フォールバックを有効にしてください。');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.openaiApiKey.trim()}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: `【案件情報・活動履歴】\n${activitiesText}` }
          ],
          temperature: 0.5,
          max_tokens: 900
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (settings.enableAutoFallback !== false) {
          return generateSmartLocalSummary(activitiesText, systemMessage);
        }
        throw new Error(errorData.error?.message || 'OpenAI APIの呼び出しに失敗しました。');
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || generateSmartLocalSummary(activitiesText, systemMessage);
    } catch (err: any) {
      if (settings.enableAutoFallback !== false) {
        return generateSmartLocalSummary(activitiesText, systemMessage);
      }
      throw err;
    }
  }
};

/**
 * クリニックHPのテキスト・HTMLから正規表現＆ルールベースで高精度抽出するパーサー
 */
function parseClinicTextHeuristic(rawText: string, existingAddress?: string): Partial<ExtractedClinicWebsiteInfo> {
  const text = rawText
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r/g, '\n');

  const result: Partial<ExtractedClinicWebsiteInfo> = {};

  // 1. 電話番号 (0X-XXXX-XXXX / 0XX-XXX-XXXX / 0120-XX-XXXX)
  const phoneMatch =
    text.match(/(?:TEL|Tel|tel|電話|代表|ご予約|お問い合わせ)[\s:：・]*([0０][0-9０-９]{1,4}[-\-ー‐()（）][0-9０-９]{1,4}[-\-ー‐()（）][0-9０-９]{3,4})/) ||
    text.match(/\b(0\d{1,4}-\d{1,4}-\d{3,4})\b/);
  if (phoneMatch) {
    result.phone = phoneMatch[1]
      .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[ー‐]/g, '-');
  }

  // 2. 住所 (〒XXX-XXXX + 都道府県〜 または 都道府県から始まる住所)
  const prefRegex = /(?:〒\s*\d{3}-\d{4}\s*)?((?:北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)[^\n\t<>「」【】]{4,45})/;
  const addrMatch = text.match(prefRegex);
  if (addrMatch) {
    result.address = addrMatch[1].trim().replace(/\s+/g, ' ');
  } else if (existingAddress) {
    result.address = existingAddress;
  }

  // 3. 診療時間
  const hoursMatch =
    text.match(/(?:診療時間|受付時間|営業時間)[\s:：・\n]*([^\n]{5,60}(?:\d{1,2}[:：]\d{2}[^\n]{0,50}))/) ||
    text.match(/(\d{1,2}:\d{2}\s*[〜～\-~]\s*\d{1,2}:\d{2}(?:\s*[\/／・,、]\s*(?:午後\s*)?\d{1,2}:\d{2}\s*[〜～\-~]\s*\d{1,2}:\d{2})?)/);
  if (hoursMatch) {
    result.clinicHours = hoursMatch[1].trim().replace(/\s+/g, ' ');
  }

  // 4. 休診日
  const closedMatch = text.match(/(?:休診日|定休日|休診)[\s:：・\n]*([^\n。]{2,35}(?:曜|日|祝|祭|午後)[^\n。]{0,20})/);
  if (closedMatch) {
    result.closedDays = closedMatch[1].trim().replace(/\s+/g, ' ');
  }

  // 5. 院長・理事長
  const directorMatch = text.match(/(?:院長|理事長|院長名)[\s:：・\n]*([一-龠々ヶヵぁ-んァ-ヶ]{2,6}[\s　]+[一-龠々ヶヵぁ-んァ-ヶ]{2,6})/);
  if (directorMatch) {
    result.director = directorMatch[1].trim().replace(/\s+/g, ' ');
  }

  // 6. 診療科目
  const deptKeywords = [
    '内科', '消化器内科', '循環器内科', '呼吸器内科', '糖尿病内科', '脳神経内科', '心療内科',
    '小児科', '皮膚科', '整形外科', '眼科', '耳鼻咽喉科', '泌尿器科', '産婦人科', '婦人科',
    '歯科', '小児歯科', '矯正歯科', '歯科口腔外科', '外科', '脳神経外科', '形成外科', '精神科', 'アレルギー科', 'リハビリテーション科'
  ];
  const foundDepts = deptKeywords.filter(d => text.includes(d));
  if (foundDepts.length > 0) {
    result.department = foundDepts.slice(0, 4).join('・');
  }

  // 7. 予約システム判別
  const lower = rawText.toLowerCase();
  if (lower.includes('digikar-smart') || text.includes('デジスマ')) {
    result.reservationSystem = 'デジスマ診療';
  } else if (lower.includes('doctorqube') || text.includes('ドクターキューブ')) {
    result.reservationSystem = 'ドクターキューブ';
  } else if (lower.includes('epark') || text.includes('EPARK')) {
    result.reservationSystem = 'EPARK';
  } else if (lower.includes('clinics') || text.includes('クリニクス')) {
    result.reservationSystem = 'CLINICS (クリニクス)';
  } else if (lower.includes('apokul') || text.includes('アポクル')) {
    result.reservationSystem = 'アポクル';
  } else if (lower.includes('medical-kakumei') || text.includes('メディカル革命')) {
    result.reservationSystem = 'メディカル革命';
  } else if (lower.includes('apodent') || text.includes('アポデント')) {
    result.reservationSystem = 'アポデント';
  } else if (text.includes('LINE予約') || text.includes('LINEで予約')) {
    result.reservationSystem = 'LINE予約システム';
  } else if (text.includes('Web予約') || text.includes('WEB予約') || text.includes('ネット予約')) {
    result.reservationSystem = 'Web予約あり';
  }

  // 8. メールアドレス
  const mailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (mailMatch && !mailMatch[1].endsWith('.png') && !mailMatch[1].endsWith('.jpg')) {
    result.email = mailMatch[1];
  }

  // 9. 法人番号 (13桁)
  const corpMatch = text.match(/法人番号[\s:：]*(\d{13})/);
  if (corpMatch) {
    result.corpId = corpMatch[1];
  }

  return result;
}

/**
 * 実際のURLからサイトコンテンツを取得し、AI（またはヒューリスティック解析）でクリニック情報を抽出する
 */
export async function extractClinicInfoFromUrl(
  rawUrl: string,
  clinicName?: string,
  existingAddress?: string
): Promise<ExtractedClinicWebsiteInfo> {
  const normalizedUrl = rawUrl.trim().startsWith('http') ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  let siteContent = '';
  let cloudRunData: any = null;

  // 1. Jina Reader (CORS対応のWebページテキスト抽出サービス) で実サイト本文を取得
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${normalizedUrl}`, {
      headers: { Accept: 'text/plain' }
    });
    if (jinaRes.ok) {
      siteContent = await jinaRes.text();
    }
  } catch (e) {
    // ignore and try next
  }

  // 2. もしJinaで取得できなかった場合は AllOrigins CORS Proxy でHTMLを取得
  if (!siteContent || siteContent.length < 100) {
    try {
      const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(normalizedUrl)}`);
      if (proxyRes.ok) {
        const proxyJson = await proxyRes.json();
        if (proxyJson?.contents) {
          siteContent = proxyJson.contents;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 3. 既存のCloud Runエンドポイントも補助として試行
  try {
    const crRes = await fetch('https://extractclinicinfo-f4rmwiyjwq-an.a.run.app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl })
    });
    if (crRes.ok) {
      cloudRunData = await crRes.json();
    }
  } catch (e) {
    // ignore
  }

  // 4. ヒューリスティック解析を実行
  const heuristic = siteContent ? parseClinicTextHeuristic(siteContent, existingAddress) : {};

  // 5. OpenAI または Gemini APIキーが設定されていれば、実サイトテキストをAIで構造化解析
  const settings = getAISettings();
  let aiParsed: Partial<ExtractedClinicWebsiteInfo> = {};

  if (siteContent && (settings.openaiApiKey || settings.geminiApiKey)) {
    const promptText = `以下の医療機関Webサイトのテキストから、基本情報をJSON形式で抽出してください。不明な項目は空文字""にしてください。
対象クリニック名: ${clinicName || ''}
対象URL: ${normalizedUrl}

抽出するJSONキー:
{
  "address": "住所（都道府県から）",
  "phone": "電話番号",
  "email": "メールアドレス",
  "clinicHours": "診療時間（例: 9:00〜12:30 / 14:30〜18:00）",
  "closedDays": "休診日（例: 水曜・日曜・祝日）",
  "director": "院長名",
  "department": "診療科目（例: 内科・消化器内科）",
  "reservationSystem": "予約システム名（デジスマ、ドクターキューブ、EPARK、Web予約あり 等）"
}

=== サイトテキスト ===
${siteContent.slice(0, 7000)}`;

    try {
      if (settings.provider === 'openai' && settings.openaiApiKey) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.openaiApiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'あなたは医療機関のWebサイトから正確に基本情報を抽出するAIアシスタントです。JSONのみを出力してください。' },
              { role: 'user', content: promptText }
            ],
            temperature: 0.1
          })
        });
        if (res.ok) {
          const d = await res.json();
          aiParsed = JSON.parse(d.choices[0].message.content || '{}');
        }
      } else if (settings.geminiApiKey) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: promptText }] }],
              generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
            })
          }
        );
        if (res.ok) {
          const d = await res.json();
          const rawJson = d.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          aiParsed = JSON.parse(rawJson);
        }
      }
    } catch (e) {
      console.warn('AI JSON parse fallback to heuristic:', e);
    }
  }

  return {
    websiteUrl: normalizedUrl,
    address: aiParsed.address || heuristic.address || cloudRunData?.address || existingAddress || '',
    phone: aiParsed.phone || heuristic.phone || cloudRunData?.phone || '',
    email: aiParsed.email || heuristic.email || '',
    clinicHours: aiParsed.clinicHours || heuristic.clinicHours || cloudRunData?.clinicHours || '',
    closedDays: aiParsed.closedDays || heuristic.closedDays || cloudRunData?.closedDays || '',
    director: aiParsed.director || heuristic.director || cloudRunData?.director || '',
    department: aiParsed.department || heuristic.department || '',
    reservationSystem: aiParsed.reservationSystem || heuristic.reservationSystem || cloudRunData?.reservationSystem || '',
    corpId: heuristic.corpId || '',
    sourceMethod: siteContent ? '実サイトAI解析' : 'CloudRun解析'
  };
}
