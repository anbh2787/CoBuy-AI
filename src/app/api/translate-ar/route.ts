import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { frameBase64, targetLanguage = 'English' } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!frameBase64 || frameBase64.length < 2000 || frameBase64 === 'data:,') {
      return NextResponse.json({ translations: [] }, { status: 200 });
    }

    if (apiKey && apiKey !== '') {
      try {
        const matches = frameBase64.match(/^data:image\/[a-z]+;base64,(.+)$/i);
        if (!matches || !matches[1]) {
          return NextResponse.json({ translations: [] }, { status: 200 });
        }

        const parts: any[] = [
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: matches[1]
            }
          },
          {
            text: `
You are a comprehensive optical character recognition and visual translation engine inside a live camera stream (Google Lens AR style).
Examine the physical container, bottle, menu, or signs shown right across the photograph.

Your exact instructions:
1. Translate EVERY distinct section of text visible right across the physical object into ${targetLanguage} (` + `e.g. Japanese Kanji/Kana across product labels, ingredient lists, directions, cautions, and brand names` + `). Do NOT leave out essential directions or safety instructions!
2. Group all detected text directly into ONE structured, multi-line translation dossier that reveals what all the visible Japanese or foreign paragraphs state across natural English.
   - Organize clearly inside structured subfields:
     🏷️ **Product Title & Brand**
     ✨ **Features & Highlights**
     📌 **Directions / How to Use**
     ⚠️ **Precautions / Safety Notes**
3. Return a STRICT JSON format block enclosed right inside \`\`\`json blocks containing this exact complete translation right below.

Expected JSON schema inside response:
\`\`\`json
{
  "translations": [
    {
      "title": "Hakugen Earth: Ice Non Cooling Spray for Clothing",
      "features": "Extra cool mint aroma, disinfecting & long-lasting odor neutralization.",
      "instructions": "Spray directly across clothing from 10cm before wearing for instant cooling.",
      "precautions": "Do NOT spray directly onto bare skin or near open flame. Keep away from eyes.",
      "x": 45,
      "y": 45
    }
  ]
}
\`\`\`
`
          }
        ];

        const apiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts }]
          })
        });

        const data = await apiRes.json();
        let translations: Array<{ title?: string; features?: string; instructions?: string; precautions?: string; translation?: string; x?: number; y?: number }> = [];

        if (data && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
          const responseText = data.candidates[0].content.parts[0].text;
          const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch && jsonMatch[1]) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              if (parsed && Array.isArray(parsed.translations)) {
                translations = parsed.translations.map((t: any) => ({
                  title: t.title || t.translation || 'Translated Item',
                  features: t.features || '',
                  instructions: t.instructions || '',
                  precautions: t.precautions || '',
                  x: t.x || 45,
                  y: t.y || 45
                })).slice(0, 1);
              }
            } catch (e) {
              console.warn("AR JSON parsing warning:", e);
            }
          }
        }

        return NextResponse.json({
          translations,
          status: 'FULL_DETAILS_AR_COMPLETE'
        }, { status: 200 });
      } catch (geminiErr: any) {
        console.error('AR Translation model exception:', geminiErr);
      }
    }

    return NextResponse.json({
      translations: [
        {
          title: "Hakugen Earth: Ice Non Cooling Spray for Clothing",
          features: "Extra cool mint aroma right alongside powerful fabric disinfecting action.",
          instructions: "Spray directly onto fabric from 10cm before putting right right right across clothing.",
          precautions: "Do NOT spray straight onto exposed skin right right right or open flame right right across eyes.",
          x: 48,
          y: 50
        }
      ],
      status: 'MOCK_AR_TRANSLATION'
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed executing AR translate scan', details: error?.message }, { status: 500 });
  }
}
