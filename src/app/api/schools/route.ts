import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

const createSchoolSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  type: z.enum(['PRIMARY', 'SECONDARY', 'TVET', 'UNIVERSITY', 'POSTGRADUATE']),
  province: z.string().min(1),
  district: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  website: z.string().url().optional(),
  principalName: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const province = searchParams.get('province');
    const isVerified = searchParams.get('isVerified');

    const skip = (page - 1) * limit;
    const where: any = {};
    if (province) where.province = province;
    if (isVerified !== null) where.isVerified = isVerified === 'true';

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where, skip, take: limit,
        select: {
          id: true, name: true, code: true, type: true,
          province: true, district: true, isVerified: true,
          logo: true, currentStudentCount: true, currentTeacherCount: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.school.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { schools, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await authorize(req, 'SUPER_ADMIN', 'GOVERNMENT_OFFICIAL');
    const body = await req.json();
    const data = createSchoolSchema.parse(body);

    const existing = await prisma.school.findUnique({ where: { code: data.code } });
    if (existing) {
      return NextResponse.json({ success: false, message: 'School code already exists' }, { status: 409 });
    }

    const school = await prisma.school.create({
      data: {
        ...data,
        settings: {
          create: {
            curriculumType: 'STANDARD_BASED',
            allowOfflineAccess: true,
            featuresEnabled: ['ai_tutor', 'lesson_planner', 'presentation_generator'],
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: { school } }, { status: 201 });
  } catch (error: any) {
    const status = error.message === 'Authentication required' ? 401 : error.message === 'Insufficient permissions' ? 403 : 400;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
}
