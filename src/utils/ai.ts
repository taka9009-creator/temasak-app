export interface AISettings {
  provider: 'openai' | 'gemini';
  openaiApiKey: string;
  geminiApiKey: string;
  prompt: string;
}

export const defaultAIPrompt = `あなたは優秀な営業マネージャーです。以下の「案件情報」と「これまでの活動履歴」を分析し、以下の構成で簡潔に要約してください。

【現在の状況】（今の商談フェーズや顧客の温度感を1〜2文で）
【ネクストアクション】（次に「誰が」「何を」すべきかを具体的に）
【注意点・リスク】（期限切れや長期間放置などの懸念があれば。無ければ省略可）

※ 現場の営業担当者がパッと見てすぐに行動に移せるよう、箇条書きを活用して極めて具体的に記述してください。冗長な挨拶や前置きは一切不要です。`;

export const getAISettings = (): AISettings => {
  const saved = localStorage.getItem('temasak-ai-settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      
      // 旧バージョンの apiKey をプロバイダに合わせて移行
      if (parsed.apiKey !== undefined) {
        if (parsed.provider === 'gemini') {
          parsed.geminiApiKey = parsed.apiKey;
        } else {
          parsed.openaiApiKey = parsed.apiKey;
        }
        delete parsed.apiKey;
      }

      // 以前の古いデフォルトプロンプトのままなら、新しいプロンプトに強制アップグレード
      const oldPrompt = `以下の活動履歴を基に、この案件の「現在の状況」と「次にとるべきアクション」を3行で要約してください。\n※ 現場の担当者がパッと見て状況がわかるように、簡潔かつ具体的に記述してください。`;
      if (parsed.prompt === oldPrompt || !parsed.prompt) {
        parsed.prompt = defaultAIPrompt;
      }
      return {
        ...parsed,
        openaiApiKey: parsed.openaiApiKey || '',
        geminiApiKey: parsed.geminiApiKey || '',
        provider: parsed.provider || 'openai'
      };
    } catch (e) {
      // ignore
    }
  }
  return {
    provider: 'openai',
    openaiApiKey: '',
    geminiApiKey: '',
    prompt: defaultAIPrompt,
  };
};

export const saveAISettings = (settings: AISettings) => {
  localStorage.setItem('temasak-ai-settings', JSON.stringify(settings));
};

export const generateSummary = async (activitiesText: string): Promise<string> => {
  const settings = getAISettings();
  
  const systemMessage = settings.prompt || defaultAIPrompt;

  if (settings.provider === 'gemini') {
    if (!settings.geminiApiKey) {
      throw new Error('GeminiのAPIキーが設定されていません。設定画面からAPIキーを登録してください。');
    }
    const apiKey = settings.geminiApiKey;
    // Gemini API: 最新の利用可能なモデルを動的に取得する
    let modelName = ''; 
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const listRes = await fetch(listUrl);
      if (listRes.ok) {
        const listData = await listRes.json();
        const models = listData.models || [];
        
        // generateContentをサポートしているモデル
        const validModels = models.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'));
        
        // 最新の安定版Flashモデルを探す (例: gemini-3.0-flash, gemini-4.5-flash)
        const flashModels = validModels.filter((m: any) => m.name.match(/models\/gemini-[0-9.]+-flash$/));
        const proModels = validModels.filter((m: any) => m.name.match(/models\/gemini-[0-9.]+-pro$/));

        // バージョン番号で降順ソート（最新モデルを先頭にする）
        const sortByVersion = (a: any, b: any) => {
          const vA = parseFloat(a.name.match(/gemini-([0-9.]+)-(flash|pro)$/)?.[1] || "0");
          const vB = parseFloat(b.name.match(/gemini-([0-9.]+)-(flash|pro)$/)?.[1] || "0");
          return vB - vA;
        };

        if (flashModels.length > 0) {
          flashModels.sort(sortByVersion);
          modelName = flashModels[0].name;
        } else if (proModels.length > 0) {
          proModels.sort(sortByVersion);
          modelName = proModels[0].name;
        } else if (validModels.length > 0) {
          // どうしても見つからなければ、非推奨っぽいものを避けて一番上のgeminiを選ぶ
          const fallback = validModels.find((m: any) => m.name.includes('gemini') && !m.name.includes('preview') && !m.name.includes('experimental'));
          if (fallback) modelName = fallback.name;
        }
      }
    } catch (e) {
      // APIキーエラーやネットワークエラーの場合は一旦無視
    }

    if (!modelName) {
      throw new Error('Gemini APIで利用可能な有効なモデルが見つかりませんでした。APIキーや権限をご確認ください。');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemMessage}\n\n===活動履歴===\n${activitiesText}` }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Gemini APIの呼び出しに失敗しました。APIキーが正しいか確認してください。');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '要約の生成に失敗しました。';
  } else {
    // OpenAI API calling logic
    if (!settings.openaiApiKey) {
      throw new Error('OpenAIのAPIキーが設定されていません。設定画面からAPIキーを登録してください。');
    }
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: `【案件情報・活動履歴】\n${activitiesText}` }
        ],
        temperature: 0.7,
        max_tokens: 800,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'OpenAI APIの呼び出しに失敗しました。APIキーが正しいか確認してください。');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
};
