import { NextResponse } from 'next/server';

export interface VoiceLogEntry {
  id: string;
  timestamp: string;
  eventType?: string;
  userName: string;
  userSaid: string;
  aiAnswer: string;
  audioByteLength: number;
  frameByteLength: number;
  targetLabel?: string;
  audioUrl?: string;
  details?: string;
}

// In-memory store for serverless execution lifecycle
const globalVoiceLogs: VoiceLogEntry[] = [];

export async function GET() {
  return NextResponse.json({
    count: globalVoiceLogs.length,
    logs: globalVoiceLogs.slice(-50).reverse()
  }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const entry: VoiceLogEntry = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      eventType: body.eventType || 'VOICE_QUESTION',
      userName: body.userName || 'Anonymous Explorer',
      userSaid: body.userSaid || 'Visual Scan',
      aiAnswer: body.aiAnswer || 'No answer generated',
      audioByteLength: Number(body.audioByteLength || 0),
      frameByteLength: Number(body.frameByteLength || 0),
      targetLabel: body.targetLabel || undefined,
      audioUrl: body.audioUrl || undefined,
      details: body.details || undefined
    };

    globalVoiceLogs.push(entry);
    console.log(`[RCA-EVENT-LOGGED] Type: ${entry.eventType} | Time: ${entry.timestamp} | User: "${entry.userName}" | Said: "${entry.userSaid}" | AI: "${entry.aiAnswer}" | AudioBytes: ${entry.audioByteLength}`);

    return NextResponse.json({ success: true, entry }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to record log entry', details: err?.message }, { status: 500 });
  }
}
