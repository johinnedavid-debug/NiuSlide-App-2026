import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  schoolId?: string;
}

export async function authenticate(req: NextRequest): Promise<TokenPayload> {
  const token = req.cookies.get('accessToken')?.value || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Authentication required');

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');

  const decoded = jwt.verify(token, secret) as TokenPayload;
  return decoded;
}

export async function authorize(req: NextRequest, ...roles: string[]): Promise<TokenPayload> {
  const user = await authenticate(req);
  if (roles.length && !roles.includes(user.role)) {
    throw new Error('Insufficient permissions');
  }
  return user;
}

export function generateTokens(userId: string, email: string, role: string, schoolId?: string | null) {
  const secret = process.env.JWT_SECRET!;
  const accessToken = jwt.sign({ userId, email, role, schoolId }, secret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, secret, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}
