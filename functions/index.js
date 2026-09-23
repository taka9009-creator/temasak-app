const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const cheerio = require("cheerio");

admin.initializeApp();

exports.extractClinicInfo = onRequest({ cors: true, region: "asia-northeast1", invoker: "public" }, async (request, response) => {
  // Allow OPTIONS request for CORS
  if (request.method === "OPTIONS") {
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Methods", "GET, POST");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    response.status(204).send("");
    return;
  }
  
  response.set("Access-Control-Allow-Origin", "*");

  let url;
  if (request.method === "POST") {
    url = request.body.url;
  } else {
    url = request.query.url;
  }
  
  if (!url) {
    response.status(400).json({ error: "URL is required." });
    return;
  }
  // Use the API key provided by the user in the config or environment
  const geminiApiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6JZNJ71XXT7JOB6C_t67K7lt5ppO2mtHqYIm7NVPU0pHA"; 
  
  if (!geminiApiKey) {
    response.status(500).json({ error: "GEMINI_API_KEY is not set." });
    return;
  }

  try {
    // 1. Fetch the website HTML
    logger.info(`Fetching URL: ${url}`);
    const webResponse = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
    });
    
    if (!webResponse.ok) {
      throw new Error(`Failed to fetch URL: ${webResponse.status} ${webResponse.statusText}`);
    }
    
    const html = await webResponse.text();
    
    // 2. Extract text using Cheerio
    const $ = cheerio.load(html);
    
    // Remove scripts, styles, and other non-content tags
    $('script, style, noscript, iframe, img, svg').remove();
    
    // Get text and clean it up (limit to ~15,000 chars to avoid hitting token limits for large pages, though Gemini has 1M context)
    const textContent = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 30000);
    
    logger.info(`Extracted ${textContent.length} characters of text.`);

    // 3. Call Gemini API
    const prompt = `
あなたはクリニックの情報を抽出するアシスタントです。
以下のWebサイトのテキストから、クリニックの基本情報を抽出し、指定されたJSONフォーマットで返してください。
情報が見つからない場合は null または空文字を設定してください。

【抽出してほしい項目】
- address: 住所（都道府県から最後まで）
- phone: 電話番号
- clinicHours: 診療時間（例: 9:00〜13:00 / 15:00〜18:00）
- closedDays: 休診日（例: 木曜・日曜・祝日）
- director: 院長先生の名前
- reservationSystem: 導入している予約システム（EPARK、ドクターキューブ、アポツールなど、サイト内に記載があれば）

【出力フォーマット（JSONのみを出力してください。マークダウンや余計なテキストは含めないでください）】
{
  "address": "",
  "phone": "",
  "clinicHours": "",
  "closedDays": "",
  "director": "",
  "reservationSystem": ""
}

【Webサイトのテキスト】
${textContent}
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`;
    
    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });
    
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logger.error("Gemini API Error:", errorText);
      throw new Error("Failed to extract data using AI.");
    }
    
    const aiData = await aiResponse.json();
    const resultText = aiData.candidates[0].content.parts[0].text;
    
    logger.info("AI Result:", resultText);
    
    // Parse the JSON result
    const resultJson = JSON.parse(resultText);
    
    response.status(200).json(resultJson);
    
  } catch (error) {
    logger.error("Extraction error:", error);
    response.status(500).json({ error: `Extraction failed: ${error.message}` });
  }
});

// メール配信機能エンドポイント
const emailFunctions = require("./email");
exports.sendTestEmail = emailFunctions.sendTestEmail;
exports.processEmailBatch = emailFunctions.processEmailBatch;
