import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { frameBase64, audioBase64, questionText, currentUserName, telemetryData } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!frameBase64 || frameBase64.length < 2000 || frameBase64 === 'data:,') {
      return NextResponse.json({
        spokenReply: `⚠️ Camera Notice: The frame arrived empty from device hardware. Please center your camera on the item to retry!`,
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

        const prompt = `
You are @GEMINI LIVE AI, an objective, visually sharp conversational voice co-pilot inside an active video collaboration call.
Analyze the literal physical pixels across the provided photo above.
${audioBase64 ? "Listen carefully to the user's attached spoken voice recording along with the picture." : `User asks verbally: "${questionText || "Describe what physical object across this picture looks like out loud."}"`}

Strict conversational rules for spoken voice delivery:
1. FIRST listen right to and directly answer what the user is asking across their voice command! If the user asks whether a piece of furniture or bed is good quality, or what it costs, immediately provide your direct conversational evaluation out loud rather than merely listing static room items.
2. ZERO-BIAS FACTUAL GROUNDING: Base all product identification directly on literal items observable across this exact photo. Never invent external train tickets or fictitious items not shown on screen.
3. Keep your spoken audio reply natural, friendly, and concise (around 2 clear conversational sentences) completely suitable right for out-loud delivery across speakers.
4. Do not include raw markdown symbols or repetitive filler words across your response text.
`;
        parts.push(prompt);

        const result = await model.generateContent(parts);
        const responseText = result.response.text();
        const cleanSpoken = responseText.replace(/[*#_`~]/g, '').trim();

        return NextResponse.json({
          spokenReply: cleanSpoken || `I clearly checked your visual frame across our meeting right now! Ask about any observable real item whenever ready.`,
          telemetry: {
            status: 'VALID_PIXELS_INSPECTED',
            byteLength: matches ? matches[1].length : frameBase64.length,
            audioBytes: audioBase64 ? audioBase64.length : 0,
            opticalConclusion: cleanSpoken
          }
        }, { status: 200 });
      } catch (geminiErr: any) {
        console.error('Gemini live check warning:', geminiErr);
        return NextResponse.json({
          spokenReply: `Neural model processing note: ${geminiErr.message}`,
          telemetry: { status: 'GEMINI_INFERENCE_ERROR', error: geminiErr.message }
        }, { status: 200 });
      }
    }

    return NextResponse.json({
      spokenReply: `Hey ${currentUserName || 'Anuj'}, I received your high-resolution photo capture (` + Math.round(frameBase64.length / 1024) + `KB)! Ask about any item in view whenever ready.`,
      telemetry: { status: 'NO_API_KEY_FALLBACK', byteLength: frameBase64.length }
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to execute camera check', details: error?.message }, { status: 500 });
  }
}
