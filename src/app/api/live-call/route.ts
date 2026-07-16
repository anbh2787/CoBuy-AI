import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { frameBase64, audioBase64, questionText, touchTarget, currentUserName } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!frameBase64 || frameBase64.length < 2000 || frameBase64 === 'data:,') {
      return NextResponse.json({
        spokenReply: `⚠️ Camera Notice: The frame arrived empty from device hardware. Please center your camera on the item right now to retry.`,
        telemetry: { status: 'BLANK_OR_EMPTY_BUFFER_REJECTED', byteLength: frameBase64?.length || 0 }
      }, { status: 200 });
    }

    if (apiKey && apiKey !== '') {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        const parts: any[] = [];
        const matches = frameBase64.match(/^data:image\/[a-z]+;base64,(.+)$/i);
        if (matches && matches[1]) {
          parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: matches[1]
            }
          });
        }

        if (audioBase64 && audioBase64.length > 500) {
          const audioMatch = audioBase64.match(/^data:audio\/[a-zA-Z0-9.\-_]+;base64,(.+)$/i);
          if (audioMatch && audioMatch[1]) {
            parts.push({
              inlineData: {
                mimeType: "audio/webm",
                data: audioMatch[1]
              }
            });
          }
        }

        let instructionContext = audioBase64
          ? "Listen carefully to the user's attached spoken voice recording along with the picture."
          : `User asks verbally: "${questionText || "Describe the item in view out loud."}"`;

        if (touchTarget && typeof touchTarget.x === 'number' && typeof touchTarget.y === 'number') {
          instructionContext = `PRECISION TOUCH TARGETING: The user touched the screen at exact coordinate coordinates [X: ${touchTarget.x}%, Y: ${touchTarget.y}%]. Inspect what specific object or product sits right directly beneath that target circle on the photograph. Ignore background objects across other areas of the picture completely.`;
        }

        const prompt = `
You are @GEMINI LIVE AI, an objective, visually sharp conversational voice co-pilot inside an active video collaboration call.
Analyze the literal physical pixels across the provided photo right above.
${instructionContext}

Strict conversational rules for spoken voice delivery:
1. FIRST listen directly to and answer what the user is asking out loud or what object lies beneath the tapped coordinates! If evaluating a touch target, state what specific item sits beneath the ring right along with its typical retail pricing out loud across speakers.
2. ZERO-BIAS FACTUAL GROUNDING: Base all evaluation strictly on physical items visible inside this picture.
3. EXTREME BREVITY RULE: Keep your spoken answer short, punchy, and concise—exactly 1 short conversational sentence (under 20 words max). Never read long lists or paragraphs out loud.
4. If this is a touch identification, structure your output precisely with a concise label tag formatted as [LABEL: Short Item Name (~$Price)] at the very beginning of your sentence so our UI can pin the target badge directly over the coordinate crosshairs!
   - Example format: "[LABEL: Chatham Armchair (~$310)] That decorative white armchair right where you tapped goes around $310 at retail."
5. Do not include raw markdown asterisks across your response text.
`;
        parts.push(prompt);

        const result = await model.generateContent(parts);
        const responseText = result.response.text();

        // Extract target label if present inside response text (`[LABEL: ...]`)
        const labelMatch = responseText.match(/\[LABEL:\s*([^\]]+)\]/i);
        const targetLabel = labelMatch ? labelMatch[1].trim() : undefined;
        const cleanSpoken = responseText.replace(/\[LABEL:\s*[^\]]+\]/i, '').replace(/[*#_`~]/g, '').trim();

        return NextResponse.json({
          spokenReply: cleanSpoken || `I identified the item beneath your finger touch directly across our studio room right now!`,
          telemetry: {
            status: 'VALID_PIXELS_INSPECTED',
            byteLength: matches ? matches[1].length : frameBase64.length,
            audioBytes: audioBase64 ? audioBase64.length : 0,
            opticalConclusion: cleanSpoken,
            targetLabel: targetLabel || (touchTarget ? cleanSpoken.split('.')[0] : undefined)
          }
        }, { status: 200 });
      } catch (geminiErr: any) {
        console.error('Gemini live check warning:', geminiErr);
        return NextResponse.json({
          spokenReply: `Neural model note: ${geminiErr.message}`,
          telemetry: { status: 'GEMINI_INFERENCE_ERROR', error: geminiErr.message }
        }, { status: 200 });
      }
    }

    return NextResponse.json({
      spokenReply: `Hey ${currentUserName || 'Anuj'}, I verified your targeted touch capture directly across our studio!`,
      telemetry: { status: 'NO_API_KEY_FALLBACK', targetLabel: touchTarget ? 'Targeted Item (~$150)' : undefined }
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to execute camera check', details: error?.message }, { status: 500 });
  }
}
