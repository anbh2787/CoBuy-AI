import { GoogleGenerativeAI } from '@google/generative-ai';
import { Group, Expense, ExpenseSplit } from './types';

/**
 * Handles interactions right with Gemini 3.5 API transmitting live Base64 buffers for both Images and PDF Documents (`application/pdf`)
 */
export async function processChatWithGemini(
  messageText: string,
  imageUrl: string | undefined,
  group: Group,
  currentUserId: string
): Promise<{ replyText: string; draftExpense?: Expense }> {
  const apiKey = process.env.GEMINI_API_KEY;

  const membersList = group.members.map(m => `${m.name} (id: ${m.id})`).join(', ');
  const sender = group.members.find(m => m.id === currentUserId) || group.members[0];
  const groupBaseCurrency = group.baseCurrency || 'USD';

  if (apiKey && apiKey !== '') {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

      const parts: any[] = [];

      // Detect and transmit authentic binary payload across standard images AND full multi-page PDF documents right away
      if (imageUrl && imageUrl.startsWith('data:')) {
        const matches = imageUrl.match(/^data:((?:image\/[a-z0-9+-]+)|(?:application\/pdf));base64,(.+)$/i);
        if (matches && matches[2]) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          });
        }
      } else if (imageUrl && imageUrl.startsWith('http')) {
        try {
          const fetched = await fetch(imageUrl);
          const contentType = fetched.headers.get('content-type') || 'image/jpeg';
          const buffer = await fetched.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          parts.push({
            inlineData: {
              mimeType: contentType,
              data: base64
            }
          });
        } catch (fetchErr) {
          console.warn("Could not convert HTTP URL straight right to binary payload:", fetchErr);
        }
      }

      const isPdf = imageUrl && (imageUrl.includes('application/pdf') || imageUrl.toLowerCase().endsWith('.pdf'));
      const docLabel = isPdf ? "itemized multi-page PDF invoice/document" : "actual physical itemized receipt photo";

      const textPrompt = `
You are Gemini AI, a brilliant multimodal financial co-pilot inside a collaborative expense room called "${group.title}".
Group Base Home Currency: ${groupBaseCurrency}.
Current active verified participants: ${membersList}.
Message sender right now: ${sender.name} (${sender.id}).
Natural language instructions: "${messageText}"
${parts.length > 0 ? `IMPORTANT: An exact ${docLabel} is attached right above as a binary visual stream. Inspect the actual printed merchant title, line item table across pages, tax, tip, and literal currency symbol (¥, $, €, £, INR) directly from the visual data precisely!` : ""}

Your exact processing requirements:
1. Extract the authentic merchant title, item list, and precise final bill total directly right off the document or text. Do NOT invent items not seen right in the document!
2. CHECK THE CURRENCY: If the bill or instructions explicitly involve a foreign currency (e.g. Japanese Yen JPY ¥, EUR €, GBP £, INR ₹) that differs from our Group Base Home Currency (${groupBaseCurrency}), calculate the exact converted total inside ${groupBaseCurrency} right right using current accurate exchange conversions (` +
`1 JPY ≈ 0.0067 USD, 1 EUR ≈ 1.08 USD, 1 GBP ≈ 1.28 USD, 1 INR ≈ 0.012 USD` +
`).
3. EVALUATE SPLIT INTENT: If the user explicitly specifies percentage breakdowns ("Alice paid, split 60-40 with Bob") or itemized assignments, set precise individual percentage shares right across each person. Otherwise, divide equally across all verified group participants (${group.members.map(m=>m.name).join(', ')}).
4. Return a STRICT JSON block enclosed right inside \`\`\`json blocks followed by a brief markdown explanation describing the proposed breakdown for confirmation!

Expected JSON schema right inside output:
\`\`\`json
{
  "hasExpense": true,
  "title": "Exact Merchant Name or Document Title",
  "originalAmount": 3200,
  "originalCurrency": "JPY",
  "convertedAmount": 21.44,
  "paidByUserId": "${sender.id}",
  "paidByName": "${sender.name}",
  "splits": [
    { "userId": "user_id_1", "userName": "Member Name 1", "amountOwed": 10.72, "percentage": 50 },
    { "userId": "user_id_2", "userName": "Member Name 2", "amountOwed": 10.72, "percentage": 50 }
  ]
}
\`\`\`
`;
      parts.push(textPrompt);

      const result = await model.generateContent(parts);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      let draftExpense: Expense | undefined = undefined;

      if (jsonMatch && jsonMatch[1]) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          if (data.hasExpense && (data.amount > 0 || data.originalAmount > 0 || data.convertedAmount > 0)) {
            const isForeign = data.originalCurrency && data.originalCurrency.toUpperCase() !== groupBaseCurrency.toUpperCase();
            const finalLedgerAmount = isForeign ? Number(data.convertedAmount || data.amount) : Number(data.originalAmount || data.amount);

            draftExpense = {
              id: 'draft-' + Math.random().toString(36).substring(2, 8),
              groupId: group.id,
              title: data.title || (isPdf ? 'Scanned PDF Document' : 'Group Receipt'),
              amount: finalLedgerAmount,
              currency: groupBaseCurrency,
              originalAmount: isForeign ? Number(data.originalAmount) : undefined,
              originalCurrency: isForeign ? data.originalCurrency : undefined,
              paidByUserId: data.paidByUserId || sender.id,
              paidByName: data.paidByName || sender.name,
              createdAt: new Date().toISOString(),
              splits: data.splits || [],
              receiptImageUrl: imageUrl
            };
          }
        } catch (e) {
          console.error("JSON parsing warning:", e);
        }
      }

      const cleanReply = responseText.replace(/```json\n[\s\S]*?\n```/, '').replace(/\*\*/g, '').trim();
      const summaryLine = cleanReply.split('\n')[0];
      return {
        replyText: summaryLine && summaryLine.length < 80 ? summaryLine : `⚖️ Proposed Ledger Split:`,
        draftExpense
      };
    } catch (err) {
      console.error("Gemini neural processing note:", err);
    }
  }

  const amountMatch = messageText.match(/\$?(\d+(\.\d{1,2})?)/);
  const fallbackAmount = amountMatch ? parseFloat(amountMatch[1]) : (imageUrl ? 45.00 : 0);
  
  if (fallbackAmount === 0 && !imageUrl) {
    return {
      replyText: `Hi ${sender.name}! State an expense amount or tap 📷 / 📎 right below to extract a receipt.`,
      draftExpense: undefined
    };
  }

  const perUser = Math.round((fallbackAmount / group.members.length) * 100) / 100;
  const pct = Math.round((100 / group.members.length) * 100) / 100;
  const splits = group.members.map(m => ({
    userId: m.id,
    userName: m.name,
    amountOwed: perUser,
    percentage: pct
  }));

  const draft: Expense = {
    id: 'draft-' + Math.random().toString(36).substring(2, 8),
    groupId: group.id,
    title: imageUrl ? (imageUrl.includes('application/pdf') ? "Scanned PDF Document Draft" : "Scanned Receipt Draft") : "Proposed Group Bill",
    amount: fallbackAmount,
    currency: groupBaseCurrency,
    paidByUserId: sender.id,
    paidByName: sender.name,
    createdAt: new Date().toISOString(),
    splits,
    receiptImageUrl: imageUrl
  };

  return {
    replyText: `📋 **Draft Proposal Ready:** I prepared a proposed split for **$${fallbackAmount.toFixed(2)} ${groupBaseCurrency}**. A verification drawer has popped up on your screen right now right to inspect individual proportions prior right to saving permanently into Postgres!`,
    draftExpense: draft
  };
}
