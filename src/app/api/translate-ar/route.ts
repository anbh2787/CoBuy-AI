import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { frameBase64, targetLanguage = 'English' } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!frameBase64 || frameBase64.length < 2000 || frameBase64 === 'data:,') {
      return NextResponse.json({ translations: [] }, { status: 200 });
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
You are a precision optical overlay engine right inside a live smartphone camera stream (like Google Lens AR).
Examine the physical picture right now.

Your exact instructions for clean optical overlay:
1. Scan the central physical item, bottle, container, or sign for any non-English character text right across its face (` + `e.g. Japanese Kanji on a product bottle, foreign dining menus, or currency values` + `).
2. INSTEAD OF FRAGMENTING TEXT INTO MULTIPLE OVERLAPPING TILES, consolidate the primary identity and instructions of the object right right into EXACTLY ONE single, unified English product summary string (or at most two widely separated distinct items if two entirely separate physical boxes sit next to each other on a table).
   - For example, if aiming at a Japanese bottle showing brand and features, output: "Hakugen Earth: Extra Mint Cooling Spray for Clothing".
   - If foreign currency is detected (e.g. ¥3,200), include the estimated USD price equivalent right beside the item name.
3. Determine the approximate center-point visual coordinates (x, y percentages between 20 and 75) directly over where the physical label lettering appears on the product container so our frontend renders a singular flush decal over the physical label without cluttering the screen.
4. Return a STRICT JSON block enclosed inside \`\`\`json blocks right right below.

Expected JSON schema inside response:
\`\`\`json
{
  "translations": [
    {
      "original": "白元アース株式会社 衣類用冷感スプレー",
      "translation": "Hakugen Earth: Extra Mint Cooling Spray for Clothing",
      "x": 42,
      "y": 45
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
              translations = parsed.translations.slice(0, 2);
            }
          } catch (e) {
            console.warn("AR JSON parsing warning:", e);
          }
        }

        return NextResponse.json({
          translations,
          status: 'AR_OVERLAY_COMPLETE'
        }, { status: 200 });
      } catch (geminiErr: any) {
        console.error('AR model note:', geminiErr);
        return NextResponse.json({ translations: [], error: geminiErr.message }, { status: 200 });
      }
    }

    return NextResponse.json({
      translations: [
        {
          original: "Foreign Label",
          translation: "Verified English AR Decal Demo ($25.00 USD)",
          x: 45,
          y: 45
        }
      ],
      status: 'DEMO_MODE'
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'AR loop failure', details: error?.message }, { status: 500 });
  }
}
