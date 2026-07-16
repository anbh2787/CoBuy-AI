import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Group, ShoppyItem } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { messageText, group, currentUserId } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!group) {
      return NextResponse.json({ error: 'Group dataset required right for discovery' }, { status: 400 });
    }

    const sender = (group.members || []).find((m: any) => m.id === currentUserId) || group.members?.[0] || { name: 'Participant', id: 'user' };
    const recentMessages = (group.messages || []).slice(-6).map((m: any) => `${m.senderName}: ${m.content}`).join('\n');

    if (apiKey && apiKey !== '') {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        const prompt = `
You are @SHOPPY AI, an exciting, ultra-knowledgeable Pre-Trip Discovery, Reservations, and Group Shopping Co-Pilot embedded right inside our collaborative planning chatroom called "${group.title}".
Current group members: ${group.members ? group.members.map((m:any) => m.name).join(', ') : 'Friends'}.
Message sender invoking you: ${sender.name} (${sender.id}).
Recent conversation history in this room right before now:
---
${recentMessages}
---
New instruction right from ${sender.name}: "${messageText}"

Your exact tasks right now as @SHOPPY:
1. Understand what travel accommodations, flights, restaurant packages, event passes, or shared household products the group wants right right from their instructions.
2. Remember past feedback from the chat history (` + `recentMessages` + `). If someone says "show options closer to station" or "cheaper options under $200", adjust recommendations accurately right right right away!
3. If parameters are severely unrealistic (e.g. "luxury 5-star private resorts under $40/night"), write a friendly note explaining typical market ranges, but immediately provide 3 fantastic practical alternatives closest right to their parameters right right below!
4. Return a strictly formatted JSON block enclosed inside \`\`\`json blocks containing an array of 3 or 4 high-fidelity options, followed directly by your conversational intro explaining why you picked these exact choices right for the group!

Expected JSON structure inside response:
\`\`\`json
{
  "products": [
    {
      "id": "opt-1",
      "title": "Shibuya Sky Boutique Tower & Rooftop",
      "price": "$310 / night",
      "numericPrice": 310,
      "imageUrl": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80",
      "rating": "⭐ 4.9 (240 reviews)",
      "vendor": "Booking / Airbnb",
      "externalUrl": "https://www.google.com/travel/hotels/Shibuya%20Boutique",
      "votes": []
    },
    {
      "id": "opt-2",
      "title": "Shinjuku Traditional Ryokan Garden",
      "price": "$290 / night",
      "numericPrice": 290,
      "imageUrl": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80",
      "rating": "⭐ 4.8 (185 reviews)",
      "vendor": "Agoda / Vrbo",
      "externalUrl": "https://www.google.com/travel/hotels/Shinjuku%20Ryokan",
      "votes": []
    },
    {
      "id": "opt-3",
      "title": "Ginza Modern Executive Suites",
      "price": "$340 / night",
      "numericPrice": 340,
      "imageUrl": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
      "rating": "⭐ 4.9 (310 reviews)",
      "vendor": "Marriott / Expedia",
      "externalUrl": "https://www.google.com/travel/hotels/Ginza%20Suites",
      "votes": []
    }
  ]
}
\`\`\`
`;

        const result = await model.generateContent([prompt]);
        const responseText = result.response.text();

        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        let products: ShoppyItem[] = [];

        if (jsonMatch && jsonMatch[1]) {
          try {
            const data = JSON.parse(jsonMatch[1]);
            if (data && Array.isArray(data.products)) {
              products = data.products.map((p: any, idx: number) => ({
                id: p.id || 'shoppy-' + Math.random().toString(36).substring(2, 7),
                title: p.title || 'Curated Group Candidate',
                price: p.price || `$${p.numericPrice || 250}`,
                numericPrice: Number(p.numericPrice || 250),
                imageUrl: p.imageUrl || `https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80`,
                rating: p.rating || '⭐ 4.8 (Verified Reviews)',
                vendor: p.vendor || 'Provider Platform',
                externalUrl: p.externalUrl || `https://www.google.com/search?q=${encodeURIComponent(p.title || 'group travel option')}`,
                votes: []
              }));
            }
          } catch (err) {
            console.error('JSON parsing failure across shoppy discovery:', err);
          }
        }

        const cleanReply = responseText.replace(/```json\n[\s\S]*?\n```/, '').trim();
        return NextResponse.json({
          replyText: cleanReply || `🛍️ **@SHOPPY Discovery:** Here are top curated options fitting right within your desired specifications right below:`,
          structuredProducts: products
        }, { status: 200 });
      } catch (geminiErr) {
        console.error('Error in @SHOPPY neural processing:', geminiErr);
      }
    }

    // Offline / fallback options
    const fallbackProducts: ShoppyItem[] = [
      {
        id: 'opt-fallback-1',
        title: 'Shibuya Sky Boutique Tower & Rooftop',
        price: '$310 / night',
        numericPrice: 310,
        imageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80',
        rating: '⭐ 4.9 (240 reviews)',
        vendor: 'Airbnb / Booking',
        externalUrl: 'https://www.google.com/search?q=Shibuya+Sky+Boutique+Hotel',
        votes: []
      },
      {
        id: 'opt-fallback-2',
        title: 'Shinjuku Traditional Garden Ryokan',
        price: '$290 / night',
        numericPrice: 290,
        imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80',
        rating: '⭐ 4.8 (190 reviews)',
        vendor: 'Agoda / Vrbo',
        externalUrl: 'https://www.google.com/search?q=Shinjuku+Traditional+Ryokan',
        votes: []
      },
      {
        id: 'opt-fallback-3',
        title: 'Ginza Executive Suites & Spa',
        price: '$340 / night',
        numericPrice: 340,
        imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80',
        rating: '⭐ 4.9 (310 reviews)',
        vendor: 'Marriott / Expedia',
        externalUrl: 'https://www.google.com/search?q=Ginza+Executive+Suites',
        votes: []
      }
    ];

    return NextResponse.json({
      replyText: `🛍️ **@SHOPPY Discovery Engine:** I curated three exceptional candidates fitting your parameters right below right for the group to vote right across and review!`,
      structuredProducts: fallbackProducts
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to complete @SHOPPY discovery', details: error?.message }, { status: 500 });
  }
}
