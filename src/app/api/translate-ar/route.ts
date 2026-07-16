import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { frameBase64, targetLanguage = 'English' } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!frameBase64 || frameBase64.length < 2000 || frameBase64 === 'data:,') {
      return NextResponse.json({
        translations: [],
        summary: "Empty camera buffer returned right from hardware."
      }, { status: 200 });
    }

    if (apiKey && apiKey !== '') {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        const matches = frameBase64.match(/^data:image\/[a-z]+;base64,(.+)$/i);
        if (!matches || !matches[1]) {
          return NextResponse.json({ translations: [] }, { status: 200 });
        }

        const parts: any[] = [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: matches[1]
            }
          },
          `
You are an ultra-fast optical character recognition (OCR) and AR real-time translation engine embedded across a live smartphone video camera stream.
Examine the exact physical pixels across the provided picture above right now.

Your exact tasks:
1. Scan for any foreign or non-English text right across store price labels, menus, packaging labels, or sign boards (e.g. Japanese Kanji/Kana, French, German, Chinese, Spanish, or foreign currency figures such as ¥, €, £).
2. Translate all identified non-English text directly into ${targetLanguage}. If foreign currency values are detected (like 3,200 JPY or 45 EUR), append the converted approximate USD total next right right right right right right right right to the English translation string (e.g., "$21.50 USD").
3. Estimate approximate normalized visual screen coordinates (` + `x, y as percentages between 10 and 80` + `) where each label or sign resides across the picture so our frontend can position floating AR translation chips directly over the item.
4. Return a STRICT JSON format block enclosed right inside \`\`\`json blocks containing the translation entries right below. If no foreign text or currency is found right inside this specific frame, return an empty array.

Expected JSON structure inside response:
\`\`\`json
{
  "translations": [
    {
      "original": "¥3,200 (純米大吟醸)",
      "translation": "Junmai Daiginjo Premium Sake ($21.44 USD)",
      "x": 40,
      "y": 55
    },
    {
      "original": "渋谷本店限定",
      "translation": "Shibuya Flagship Store Exclusive",
      "x": 35,
      "y": 25
    }
  ]
}
\`\`\`
`
        ];

        const result = await model.generateContent(parts);
        const responseText = result.response.text();

        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        let translations: Array<{ original: string; translation: string; x?: number; y?: number }> = [];

        if (jsonMatch && jsonMatch[1]) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed && Array.isArray(parsed.translations)) {
              translations = parsed.translations;
            }
          } catch (e) {
            console.warn("AR JSON parsing warning:", e);
          }
        }

        return NextResponse.json({
          translations,
          status: 'AR_TRANSLATION_COMPLETE'
        }, { status: 200 });
      } catch (geminiErr: any) {
        console.error('AR Translation model error:', geminiErr);
        return NextResponse.json({ translations: [], error: geminiErr.message }, { status: 200 });
      }
    }

    return NextResponse.json({
      translations: [
        {
          original: "Foreign Product Tag (Offline Demo)",
          translation: "Verified English AR Translation Demo ($25.00 USD)",
          x: 45,
          y: 40
        }
      ],
      status: 'DEMO_MODE'
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to run AR translation loop', details: error?.message }, { status: 500 });
  }
}
