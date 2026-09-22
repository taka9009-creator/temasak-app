/**
 * 音声発話テキストから案件・ToDo情報を抽出するスマートパーサー（Ver.2.0 - 医療・テマサック営業特化版）
 * 音声認識の揺れ・同音異義語オートコレクト辞書を搭載
 */

export interface ParsedVoiceResult {
  clinicName: string;
  contactPerson: string;
  todoTitle: string;
  deadline: string; // YYYY-MM-DD
  time?: string; // HH:MM
  priority: '高' | '中' | '低';
  ballHolder: '自社営業' | 'クリニック（先方）' | 'メーカー・パートナー';
  tags: string[];
  memo: string;
  normalizedText: string;
  rawText: string;
}

// 相対日付の計算 (今日 + offsetDays)
export function getRelativeDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 営業現場特化の音声認識オートコレクト辞書
 * Web Speech API が誤変換しやすい音声・同音異義語を業界標準用語へ自動補正
 */
const SPEECH_CORRECTIONS: [RegExp, string][] = [
  // 製品名
  [/テーマ作|テマ作|てまさっく|手間策|手前作/g, 'テマサック'],
  [/エイチピーエス|えいちぴーえす/gi, 'HPS'],
  [/ビーエムポス|びーえむぽす/gi, 'BMPOS'],
  
  // 機器・機能
  [/清算機|せいさんき|セルフレジ/g, '自動精算機'],
  [/釣り銭機|つりせんき|ツリセンキ/g, '自動釣銭機'],
  [/せせこん|レセ魂|れせこん|せれこん/g, 'レセコン'],
  [/オンシ|音信|おんし|オン資/g, 'オンライン資格確認'],
  [/電マネ|電マ(?![ぁ-ん])/g, '電子マネー'],
  [/クレカ|クレジット/g, 'クレジットカード'],
  
  // 業務・アクション
  [/現状(?=確認|行く|伺う|下見|調査)|限調|現長|けんちょう|げんちょう/g, '現調'],
  [/デモ(?![ぁ-ん])/g, 'デモ実演'],
  [/あぽ|アポ(?![ぁ-ん])/g, 'アポイント'],
  [/みつもり|三森|見つ森/g, '見積書'],
  [/ひありんぐ/g, 'ヒアリング'],
  
  // 医療機関・役職
  [/くりにっく|クリ二ック/g, 'クリニック'],
  [/いいん/g, '医院'],
  [/いんちょう/g, '院長'],
  [/じむちょう/g, '事務長'],
  [/りじちょう/g, '理事長']
];

/**
 * 発話テキストを辞書ベースで正規化
 */
export function normalizeSpeechText(text: string): string {
  let normalized = text.trim();
  for (const [pattern, replacement] of SPEECH_CORRECTIONS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

export function parseVoiceTextLocally(rawText: string): ParsedVoiceResult {
  const cleanText = normalizeSpeechText(rawText);
  const todayStr = getRelativeDateString(0);

  // 1. 日付の抽出
  let deadline = todayStr;
  let timeStr = '';

  if (cleanText.includes('明々後日') || cleanText.includes('しあさって')) {
    deadline = getRelativeDateString(3);
  } else if (cleanText.includes('明後日') || cleanText.includes('あさって')) {
    deadline = getRelativeDateString(2);
  } else if (cleanText.includes('明日') || cleanText.includes('あした') || cleanText.includes('あす')) {
    deadline = getRelativeDateString(1);
  } else {
    // ○月○日 のマッチ
    const monthDayMatch = cleanText.match(/(\d{1,2})月(\d{1,2})日/);
    if (monthDayMatch) {
      const yyyy = new Date().getFullYear();
      const mm = String(parseInt(monthDayMatch[1], 10)).padStart(2, '0');
      const dd = String(parseInt(monthDayMatch[2], 10)).padStart(2, '0');
      deadline = `${yyyy}-${mm}-${dd}`;
    } else {
      // 曜日マッチ（例: 来週火曜、今週金曜日など）
      const weekdayMatch = cleanText.match(/(来週|今週)?(?:の)?(月|火|水|木|金|土|日)曜?/);
      if (weekdayMatch) {
        const dayMap: Record<string, number> = { '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6 };
        const targetDay = dayMap[weekdayMatch[2]];
        const now = new Date();
        const currentDay = now.getDay();
        let diff = targetDay - currentDay;
        if (weekdayMatch[1] === '来週' || diff <= 0) {
          diff += 7;
        }
        deadline = getRelativeDateString(diff);
      }
    }
  }

  // 2. 時刻の抽出（例: 14時、14:30、午前10時、午後3時半など）
  const timeMatch = cleanText.match(/(?:(午前|午後))?(\d{1,2})時(?:(\d{1,2})分|半)?/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[2], 10);
    const isPM = timeMatch[1] === '午後' || (hour < 8 && !timeMatch[1]);
    if (isPM && hour < 12) hour += 12;
    
    let minute = '00';
    if (timeMatch[0].includes('半')) {
      minute = '30';
    } else if (timeMatch[3]) {
      minute = String(parseInt(timeMatch[3], 10)).padStart(2, '0');
    }
    timeStr = `${String(hour).padStart(2, '0')}:${minute}`;
  }

  // 3. クリニック名・医療機関名の高精度抽出
  let clinicName = '';
  const clinicMatch = cleanText.match(/([^\s、,。]+(?:クリニック|医院|病院|内科|眼科|小児科|耳鼻科|皮膚科|整形外科|歯科|デンタル|メディカル))/);
  if (clinicMatch) {
    clinicName = clinicMatch[1].replace(/^(で|に|の|へ|と|は)/, '').trim();
  } else {
    // 「〜様」「〜先生」「〜さん」
    const personMatch = cleanText.match(/([^\s、,。]+)(?:先生|様|さん)/);
    if (personMatch) {
      clinicName = `${personMatch[1]}様 案件`;
    }
  }

  // 4. 担当者・院長名の抽出
  let contactPerson = '';
  const doctorMatch = cleanText.match(/([^\s、,。]+(?:院長|先生|理事長|事務長|部長|担当))/);
  if (doctorMatch) {
    contactPerson = doctorMatch[1];
  }

  // 5. 特徴タグの抽出
  const tags: string[] = [];
  if (cleanText.includes('レセコン')) tags.push('レセコン連携');
  if (cleanText.includes('現調')) tags.push('現地調査');
  if (cleanText.includes('自動釣銭機') || cleanText.includes('釣銭機')) tags.push('釣銭機対応');
  if (cleanText.includes('電子マネー') || cleanText.includes('クレジットカード') || cleanText.includes('キャッシュレス')) tags.push('キャッシュレス');
  if (cleanText.includes('HPS')) tags.push('HPS連携');
  if (cleanText.includes('デモ')) tags.push('デモ実施');
  if (cleanText.includes('オンライン資格確認')) tags.push('オン資連動');

  // 6. アクション内容（ToDoタイトル）の抽出と分類
  let todoTitle = '初回電話ヒアリング';
  if (cleanText.includes('現調') || cleanText.includes('下見') || cleanText.includes('設置環境')) {
    todoTitle = '現地調査（寸法・LAN・電源の確認）';
  } else if (cleanText.includes('訪問') || cleanText.includes('対面')) {
    todoTitle = cleanText.includes('デモ') ? '訪問デモ・実機実演' : '訪問商談・ヒアリング';
  } else if (cleanText.includes('オンライン') || cleanText.includes('Zoom') || cleanText.includes('ズーム')) {
    todoTitle = 'オンラインデモ・相談会';
  } else if (cleanText.includes('見積書') || cleanText.includes('資料') || cleanText.includes('パンフ') || cleanText.includes('送付')) {
    todoTitle = '資料・見積書の作成送付';
  } else if (cleanText.includes('電話') || cleanText.includes('コール') || cleanText.includes('状況確認')) {
    todoTitle = '電話状況伺い・ヒアリング';
  } else if (cleanText.includes('契約') || cleanText.includes('受注') || cleanText.includes('内諾') || cleanText.includes('クロージング')) {
    todoTitle = '契約締結・注文書受領';
  } else if (cleanText.includes('納品') || cleanText.includes('設置')) {
    todoTitle = '機器納品・設置立ち会い';
  }

  // 時刻があれば先頭に付与（例: 14:00 訪問デモ）
  if (timeStr) {
    todoTitle = `${timeStr} ${todoTitle}`;
  }

  // 7. ボール判定（誰のアクションか）
  let ballHolder: '自社営業' | 'クリニック（先方）' | 'メーカー・パートナー' = '自社営業';
  if (cleanText.includes('返事待ち') || cleanText.includes('連絡待ち') || cleanText.includes('院長確認待ち') || cleanText.includes('検討中')) {
    ballHolder = 'クリニック（先方）';
  } else if (cleanText.includes('メーカー確認') || cleanText.includes('工事手配待ち')) {
    ballHolder = 'メーカー・パートナー';
  }

  // 8. 優先度判定
  let priority: '高' | '中' | '低' = '中';
  if (cleanText.includes('至急') || cleanText.includes('急ぎ') || cleanText.includes('最優先') || cleanText.includes('緊急') || deadline === todayStr) {
    priority = '高';
  } else if (cleanText.includes('情報収集') || cleanText.includes('時期未定') || cleanText.includes('ゆっくり') || cleanText.includes('半年後')) {
    priority = '低';
  }

  return {
    clinicName: clinicName || '新規お問い合わせ案件',
    contactPerson,
    todoTitle,
    deadline,
    time: timeStr,
    priority,
    ballHolder,
    tags,
    memo: cleanText,
    normalizedText: cleanText,
    rawText
  };
}
