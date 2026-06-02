import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const tokenUser = await authenticate(req);
    const pending = await prisma.offlineSyncQueue.findMany({
      where: { userId: tokenUser.userId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });

    const results = [];
    for (const item of pending) {
      try {
        await prisma.offlineSyncQueue.update({
          where: { id: item.id },
          data: { status: 'COMPLETED', processedAt: new Date() },
        });
        results.push({ id: item.id, status: 'COMPLETED' });
      } catch (error: any) {
        await prisma.offlineSyncQueue.update({
          where: { id: item.id },
          data: { status: 'FAILED', errorMessage: error.message, retryCount: { increment: 1 } },
        });
        results.push({ id: item.id, status: 'FAILED', error: error.message });
      }
    }

    return NextResponse.json({ success: true, data: { results, processed: pending.length } });
  } catch (error: any) {
    const status = error.message === 'Authentication required' ? 401 : 500;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
}
