import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateTokens, getClientIp } from '@/lib/auth';

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100)
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[a-z]/, 'Must contain lowercase')
  .regex(/[0-9]/, 'Must contain number')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character');

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['STUDENT', 'TEACHER', 'SCHOOL_ADMIN', 'PARENT']),
  province: z.string().optional(),
  district: z.string().optional(),
  schoolId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ success: false, message: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        province: data.province,
        district: data.district,
        schoolId: data.schoolId,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, schoolId: true, createdAt: true,
      },
    });

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
      success: true, message: 'Registration successful',
      data: { user, accessToken, refreshToken },
    }, { status: 201 });

    response.cookies.set('accessToken', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60 });
    response.cookies.set('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Registration failed' }, { status: 400 });
  }
}
