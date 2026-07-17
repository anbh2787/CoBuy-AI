import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text, language = 'en' } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text input required for synthesis' }, { status: 400 });
    }

    const cleanText = text.replace(/\[LABEL:\s*[^\]]+\]/i, '').replace(/[*#_`~]/g, '').trim();
    const encodedText = encodeURIComponent(cleanText.substring(0, 200));
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${language}&client=tw-ob`;

    const audioResponse = await fetch(googleTtsUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'audio/mpeg, audio/*'
      }
    });

    if (!audioResponse.ok) {
      throw new Error(`Cloud speech stream returned HTTP ${audioResponse.status}`);
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    const audioDataUrl = `data:audio/mp3;base64,${base64Audio}`;

    return NextResponse.json({
      audioUrl: audioDataUrl,
      status: 'HIGH_DEF_HUMAN_AUDIO_SUCCESS'
    }, { status: 200 });
  } catch (error: any) {
    console.error('High-Def cloud speech synthesis exception:', error);
    return NextResponse.json({ error: 'Fallback to local device synthesis requested', details: error?.message }, { status: 500 });
  }
}
