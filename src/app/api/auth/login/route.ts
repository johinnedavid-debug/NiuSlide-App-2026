import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateTokens, getClientIp } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = loginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !user.isActive) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role, user.schoolId);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent') || '',
      },
    });

    const response = NextResponse.json({
      success: true, message: 'Login successful',
      data: {
        user: {
          id: user.id, email: user.email, firstName: user.firstName,
          lastName: user.lastName, role: user.role, schoolId: user.schoolId, avatar: user.avatar,
        },
        accessToken, refreshToken,
      },
    });

    response.cookies.set('accessToken', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60 });
    response.cookies.set('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Login failed' }, { status: 400 });
  }
}
