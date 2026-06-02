import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/auth';

const syncSchema = z.object({
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  payload: z.any(),
});

export async function GET(req: NextRequest) {
  try {
    const tokenUser = await authenticate(req);
    const items = await prisma.offlineSyncQueue.findMany({
      where: { userId: tokenUser.userId },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ success: true, data: { items } });
  } catch (error: any) {
    const status = error.message === 'Authentication required' ? 401 : 500;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tokenUser = await authenticate(req);
    const body = await req.json();
    const data = syncSchema.parse(body);

    const item = await prisma.offlineSyncQueue.create({
      data: { ...data, userId: tokenUser.userId, status: 'PENDING' },
    });
    return NextResponse.json({ success: true, data: { item } }, { status: 201 });
  } catch (error: any) {
    const status = error.message === 'Authentication required' ? 401 : 400;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
}
