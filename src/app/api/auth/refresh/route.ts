import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { generateTokens, getClientIp } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('refreshToken')?.value || (await req.json()).refreshToken;
    if (!refreshToken) {
      return NextResponse.json({ success: false, message: 'Refresh token required' }, { status: 401 });
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return NextResponse.json({ success: false, message: 'Invalid refresh token' }, { status: 401 });
    }

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      stored.user.id, stored.user.email, stored.user.role, stored.user.schoolId
    );

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: stored.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent') || '',
      },
    });

    const response = NextResponse.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
    response.cookies.set('accessToken', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60 });
    response.cookies.set('refreshToken', newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Token refresh failed' }, { status: 401 });
  }
}
