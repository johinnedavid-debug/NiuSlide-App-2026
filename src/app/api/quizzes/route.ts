import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authenticate, authorize } from '@/lib/auth';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  curriculumType: z.enum(['STANDARD_BASED', 'OUTCOME_BASED', 'STEM', 'FODE']),
  description: z.string().optional(),
  timeLimit: z.number().int().min(5).max(180).optional(),
  passingScore: z.number().min(0).max(100).default(50),
  maxAttempts: z.number().int().min(1).max(10).default(1),
  questions: z.any(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const subject = searchParams.get('subject');
    const gradeLevel = searchParams.get('gradeLevel');

    const skip = (page - 1) * limit;
    const where: any = { isPublic: true };
    if (subject) where.subject = subject;
    if (gradeLevel) where.gradeLevel = gradeLevel;

    const [quizzes, total] = await Promise.all([
      prisma.quiz.findMany({
        where, skip, take: limit,
        select: {
          id: true, title: true, subject: true, gradeLevel: true,
          timeLimit: true, passingScore: true, maxAttempts: true, createdAt: true,
          school: { select: { name: true } },
          _count: { select: { attempts: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quiz.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { quizzes, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
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

    const quiz = await prisma.quiz.create({
      data: {
        ...data,
        createdBy: tokenUser.userId,
        schoolId: tokenUser.schoolId!,
      },
    });

    return NextResponse.json({ success: true, data: { quiz } }, { status: 201 });
  } catch (error: any) {
    const status = error.message === 'Authentication required' ? 401 : error.message === 'Insufficient permissions' ? 403 : 400;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
}
