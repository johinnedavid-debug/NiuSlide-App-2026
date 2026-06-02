import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  avatar: z.string().url().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const tokenUser = await authorize(req, 'SUPER_ADMIN', 'SCHOOL_ADMIN');
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const role = searchParams.get('role');
    const schoolId = searchParams.get('schoolId');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;
    const where: any = {};
    if (role) where.role = role;
    if (schoolId) where.schoolId = schoolId;
    if (search) {
      const sanitized = search.trim().slice(0, 100);
      where.OR = [
        { email: { contains: sanitized, mode: 'insensitive' } },
        { firstName: { contains: sanitized, mode: 'insensitive' } },
        { lastName: { contains: sanitized, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, avatar: true, province: true, isActive: true, createdAt: true,
          school: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error: any) {
    const status = error.message === 'Authentication required' ? 401 : error.message === 'Insufficient permissions' ? 403 : 500;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
}
