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
You are a comprehensive optical character recognition and visual translation engine inside a live camera stream (Google Lens AR style).
Examine the physical container, bottle, menu, or signs shown across the picture.

Your exact instructions:
1. Translate EVERY distinct section of text visible across the physical object directly right into ${targetLanguage} (` + `e.g. Japanese Kanji/Kana on product labels, ingredient lists, instructions, cautions, and manufacturer names` + `). Do NOT leave out essential instructions or precautions just to be short!
2. Group all detected text directly into ONE structured, multi-line translation dossier that completely reveals what all the visible Japanese or foreign paragraphs state in clean, natural English.
   - Organize clearly right right across distinct lines:
     🏷️ **Product Title & Brand**
     ✨ **Features & Highlights**
     📌 **Directions / How to Use**
     ⚠️ **Precautions / Safety Notes**
3. Estimate approximate normalized visual screen coordinates (` + `x, y percentages between 30 and 70` + `) over where the container is centered in the camera frame so our frontend renders a singular comprehensive translation decal over the physical item.
4. Return a STRICT JSON format block enclosed inside \`\`\`json blocks containing this complete structured translation right below.

Expected JSON schema inside response:
\`\`\`json
{
  "translations": [
    {
      "title": "Hakugen Earth: Ice Non Cooling Spray for Clothing",
      "features": "Extra cool mint aroma, disinfecting & long-lasting odor neutralization.",
      "instructions": "Spray directly across clothing from 10cm before wearing right right for instant cooling.",
      "precautions": "Do NOT spray directly onto bare skin right or near open flame. Keep away right from eyes.",
      "x": 45,
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
        let translations: Array<{ title?: string; features?: string; instructions?: string; precautions?: string; translation?: string; x?: number; y?: number }> = [];

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

        return NextResponse.json({
          translations,
          status: 'FULL_DETAILS_AR_COMPLETE'
        }, { status: 200 });
      } catch (geminiErr: any) {
        console.error('AR Translation model note:', geminiErr);
        return NextResponse.json({ translations: [], error: geminiErr.message }, { status: 200 });
      }
    }

    return NextResponse.json({
      translations: [
        {
          title: "Hakugen Earth: Ice Non Cooling Spray for Clothing",
          features: "Extra cool mint aroma, fabric disinfecting & odor-neutralizing properties.",
          instructions: "Spray directly onto fabric from 10cm before wearing right for instant cooling sensation.",
          precautions: "Do NOT spray directly onto bare skin right right right or near open flame.",
          x: 45,
          y: 45
        }
      ],
      status: 'DEMO_MODE'
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to run comprehensive AR translation loop', details: error?.message }, { status: 500 });
  }
}
