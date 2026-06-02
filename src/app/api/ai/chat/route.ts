import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/auth';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  subject: z.string().optional(),
  gradeLevel: z.string().optional(),
  sessionId: z.string().optional(),
});

async function checkRateLimit(userId: string, tier: string): Promise<boolean> {
  const limits: Record<string, number> = { FREE: 10, BASIC: 50, PREMIUM: 200, ENTERPRISE: 1000 };
  const dailyLimit = limits[tier] || 10;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const usage = await prisma.chatSession.count({ where: { userId, updatedAt: { gte: today } } });
  return usage < dailyLimit;
}

export async function POST(req: NextRequest) {
  try {
    const tokenUser = await authenticate(req);
    const body = await req.json();
    const data = chatSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: tokenUser.userId }, select: { subscriptionTier: true } });
    const withinLimit = await checkRateLimit(tokenUser.userId, user?.subscriptionTier || 'FREE');
    if (!withinLimit) {
      return NextResponse.json({ success: false, message: 'Daily AI limit reached. Upgrade your subscription.' }, { status: 429 });
    }

    let session;
    if (data.sessionId) {
      session = await prisma.chatSession.findUnique({ where: { id: data.sessionId, userId: tokenUser.userId } });
    }
    if (!session) {
      session = await prisma.chatSession.create({
        data: {
          userId: tokenUser.userId,
          title: data.message.slice(0, 50) + '...',
          subject: data.subject,
          gradeLevel: data.gradeLevel,
          messages: [],
        },
      });
    }

    const messages = (session.messages as any[]) || [];
    messages.push({ role: 'user', content: data.message, timestamp: new Date().toISOString() });

    const systemPrompt = `You are NIUSLID AI Tutor for Papua New Guinea students and teachers.
${data.subject ? `Subject: ${data.subject}` : ''}
${data.gradeLevel ? `Grade Level: ${data.gradeLevel}` : ''}
Be encouraging and use PNG-relevant examples.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.';
    messages.push({ role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() });

    await prisma.chatSession.update({ where: { id: session.id }, data: { messages, updatedAt: new Date() } });

    return NextResponse.json({
      success: true,
      data: { response: aiResponse, sessionId: session.id, messagesUsed: messages.length },
    });
  } catch (error: any) {
    const status = error.message === 'Authentication required' ? 401 : 500;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
}
