import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Group, ShoppyItem } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { messageText, imageBase64, group, currentUserId } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!group) {
      return NextResponse.json({ error: 'Group dataset required for discovery' }, { status: 400 });
    }

    const sender = (group.members || []).find((m: any) => m.id === currentUserId) || group.members?.[0] || { name: 'Participant', id: 'user' };
    const recentMessages = (group.messages || []).slice(-6).map((m: any) => `${m.senderName}: ${m.content}`).join('\n');

    if (apiKey && apiKey !== '') {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        const parts: any[] = [];
        let imageNotice = "";

        if (imageBase64 && imageBase64.length > 2000) {
          const matches = imageBase64.match(/^data:image\/[a-z]+;base64,(.+)$/i);
          if (matches && matches[1]) {
            parts.push({
              inlineData: {
                mimeType: "image/jpeg",
                data: matches[1]
              }
            });
            imageNotice = "An actual photograph captured from the live video consultation is attached right above. Analyze its exact physical visual style, color, dimensions, and manufacturer cues.";
          }
        }

        const prompt = `
You are @SHOPPY AI, an expert, visually astute collaborative shopping and product recommendations engine inside our group workspace called "${group.title}".
Current group members: ${group.members ? group.members.map((m:any) => m.name).join(', ') : 'Group Members'}.
Requester: ${sender.name} (${sender.id}).
Recent conversation history right below:
---
${recentMessages}
---
Instruction or context from ${sender.name}: "${messageText}"
${imageNotice}

Your exact tasks as @SHOPPY AI:
1. If an image is attached or if the user is asking about an object discovered on camera (such as a bed, desk, armchair, or microphone), evaluate the literal visual characteristics shown in the picture. Find identical or near-identical real-world equivalents from verified manufacturers (e.g. West Elm, IKEA, Sony, Amazon, Target, Apple) that match the exact aesthetic right above right without random unaligned suggestions.
2. If the user asked about general flights, hotels, or items, curate precisely matching items within their specified parameters and budget limits.
3. Return a strictly formatted JSON block enclosed inside \`\`\`json blocks containing an array of 3 to 4 high-fidelity options, followed directly by a clear, human conversational summary explaining why these exact matches were curated for the group right below.

Expected JSON structure inside response:
\`\`\`json
{
  "products": [
    {
      "id": "opt-1",
      "title": "West Elm Mid-Century Solid Wood Platform Bed",
      "price": "$1,199",
      "numericPrice": 1199,
      "imageUrl": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=80",
      "rating": "⭐ 4.9 (420 reviews)",
      "vendor": "West Elm / Wayfair",
      "externalUrl": "https://www.google.com/search?q=West+Elm+Mid+Century+Solid+Wood+Platform+Bed",
      "votes": []
    },
    {
      "id": "opt-2",
      "title": "IKEA Nordli Light Ash Storage Platform Bed",
      "price": "$549",
      "numericPrice": 549,
      "imageUrl": "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=600&q=80",
      "rating": "⭐ 4.8 (1,120 reviews)",
      "vendor": "IKEA / Amazon",
      "externalUrl": "https://www.google.com/search?q=IKEA+Nordli+Storage+Platform+Bed",
      "votes": []
    }
  ]
}
\`\`\`
`;
        parts.push(prompt);

        const result = await model.generateContent(parts);
        const responseText = result.response.text();

        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        let products: ShoppyItem[] = [];

        if (jsonMatch && jsonMatch[1]) {
          try {
            const data = JSON.parse(jsonMatch[1]);
            if (data && Array.isArray(data.products)) {
              products = data.products.map((p: any, idx: number) => ({
                id: p.id || 'shoppy-' + Math.random().toString(36).substring(2, 7),
                title: p.title || 'Curated Product Match',
                price: p.price || `$${p.numericPrice || 299}`,
                numericPrice: Number(p.numericPrice || 299),
                imageUrl: p.imageUrl || `https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=80`,
                rating: p.rating || '⭐ 4.8 (Verified Reviews)',
                vendor: p.vendor || 'Retail Platform',
                externalUrl: p.externalUrl || `https://www.google.com/search?q=${encodeURIComponent(p.title || 'recommended item')}`,
                votes: []
              }));
            }
          } catch (err) {
            console.error('JSON parsing failure across shoppy discovery:', err);
          }
        }

        const cleanReply = responseText.replace(/```json\n[\s\S]*?\n```/, '').replace(/\*\*/g, '').trim();
        const firstLine = cleanReply.split('\n')[0];
        return NextResponse.json({
          replyText: firstLine && firstLine.length < 80 ? firstLine : `🛍️ Curated Recommendations:`,
          structuredProducts: products
        }, { status: 200 });
      } catch (geminiErr: any) {
        console.error('Error in @SHOPPY neural processing:', geminiErr);
      }
    }

    const fallbackProducts: ShoppyItem[] = [
      {
        id: 'opt-fallback-1',
        title: 'West Elm Mid-Century Solid Wood Platform Bed',
        price: '$1,199',
        numericPrice: 1199,
        imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=80',
        rating: '4.9 (420 reviews)',
        vendor: 'West Elm',
        externalUrl: 'https://www.google.com/search?q=West+Elm+Mid+Century+Solid+Wood+Platform+Bed',
        votes: []
      },
      {
        id: 'opt-fallback-2',
        title: 'IKEA Nordli Light Ash Storage Platform Bed',
        price: '$549',
        numericPrice: 549,
        imageUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=600&q=80',
        rating: '4.8 (1,120 reviews)',
        vendor: 'IKEA',
        externalUrl: 'https://www.google.com/search?q=IKEA+Nordli+Storage+Platform+Bed',
        votes: []
      }
    ];

    return NextResponse.json({
      replyText: `🛍️ Curated Recommendations:`,
      structuredProducts: fallbackProducts
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Discovery failure', details: error?.message }, { status: 500 });
  }
}
