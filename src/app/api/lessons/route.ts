import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  curriculumType: z.enum(['STANDARD_BASED', 'OUTCOME_BASED', 'STEM', 'FODE']),
  duration: z.number().int().min(15).max(180),
  objectives: z.array(z.string()),
  materials: z.array(z.string()),
  introduction: z.string(),
  mainActivity: z.string(),
  conclusion: z.string(),
  assessment: z.string(),
  differentiation: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const subject = searchParams.get('subject');
    const gradeLevel = searchParams.get('gradeLevel');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;
    const where: any = { isApproved: true };
    if (subject) where.subject = subject;
    if (gradeLevel) where.gradeLevel = gradeLevel;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    const [lessonPlans, total] = await Promise.all([
      prisma.lessonPlan.findMany({
        where, skip, take: limit,
        include: {
          teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
          school: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lessonPlan.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { lessonPlans, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tokenUser = await authorize(req, 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const data = createSchema.parse(body);

    const teacherProfile = await prisma.teacherProfile.findUnique({ where: { userId: tokenUser.userId } });
    if (!teacherProfile) {
      return NextResponse.json({ success: false, message: 'Teacher profile not found' }, { status: 400 });
    }

    const lessonPlan = await prisma.lessonPlan.create({
      data: {
        ...data,
        teacherId: teacherProfile.id,
        schoolId: tokenUser.schoolId || teacherProfile.schoolId,
      },
    });

    return NextResponse.json({ success: true, data: { lessonPlan } }, { status: 201 });
  } catch (error: any) {
    const status = error.message === 'Authentication required' ? 401 : error.message === 'Insufficient permissions' ? 403 : 400;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
}
