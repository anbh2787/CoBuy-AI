import { NextResponse } from 'next/server';
import { processChatWithGemini } from '@/lib/gemini';
import { Group } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { messageText, imageUrl, group, currentUserId } = await req.json();

    if (!group) {
      return NextResponse.json({ error: 'Group data required' }, { status: 400 });
    }

    const result = await processChatWithGemini(
      messageText || '',
      imageUrl,
      group as Group,
      currentUserId || 'user'
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to process AI chat response', details: error?.message },
      { status: 500 }
    );
  }
}
