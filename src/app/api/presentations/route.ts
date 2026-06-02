import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/auth';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  slides: z.any(),
  theme: z.string().default('png_standard'),
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  isPublic: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const subject = searchParams.get('subject');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;
    const where: any = { isPublic: true };
    if (subject) where.subject = subject;
    if (search) where.title = { contains: search, mode: 'insensitive' };

    const [presentations, total] = await Promise.all([
      prisma.presentation.findMany({
        where, skip, take: limit,
        select: {
          id: true, title: true, description: true, subject: true, gradeLevel: true,
          theme: true, isTemplate: true, viewCount: true, downloadCount: true, createdAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.presentation.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { presentations, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tokenUser = await authenticate(req);
    const body = await req.json();
    const data = createSchema.parse(body);

    const presentation = await prisma.presentation.create({
      data: {
        ...data,
        createdBy: tokenUser.userId,
        schoolId: tokenUser.schoolId,
      },
    });

    return NextResponse.json({ success: true, data: { presentation } }, { status: 201 });
  } catch (error: any) {
    const status = error.message === 'Authentication required' ? 401 : 400;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
}
