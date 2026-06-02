import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  provider: z.string().min(1),
  type: z.enum(['LOCAL', 'INTERNATIONAL', 'GOVERNMENT', 'PRIVATE', 'NGO']),
  description: z.string().min(1),
  eligibilityCriteria: z.array(z.string()),
  requiredGpa: z.number().min(0).max(4).optional(),
  applicationDeadline: z.string().datetime(),
  awardAmount: z.string().min(1),
  duration: z.string().min(1),
  studyLevel: z.array(z.enum(['PRIMARY', 'SECONDARY', 'TVET', 'UNIVERSITY', 'POSTGRADUATE'])),
  fieldsOfStudy: z.array(z.string()),
  provinceRestriction: z.array(z.string()).optional(),
  applicationUrl: z.string().url().optional(),
  applicationInstructions: z.string().optional(),
  documentsRequired: z.array(z.string()),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');
    const featured = searchParams.get('featured');

    const skip = (page - 1) * limit;
    const where: any = {};
    if (type) where.type = type;
    if (isActive !== null) where.isActive = isActive === 'true';
    if (featured !== null) where.featured = featured === 'true';

    const [scholarships, total] = await Promise.all([
      prisma.scholarship.findMany({ where, skip, take: limit, orderBy: [{ featured: 'desc' }, { applicationDeadline: 'asc' }] }),
      prisma.scholarship.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { scholarships, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await authorize(req, 'SUPER_ADMIN', 'GOVERNMENT_OFFICIAL');
    const body = await req.json();
    const data = createSchema.parse(body);

    const scholarship = await prisma.scholarship.create({
      data: { ...data, applicationDeadline: new Date(data.applicationDeadline) },
    });

    return NextResponse.json({ success: true, data: { scholarship } }, { status: 201 });
  } catch (error: any) {
    const status = error.message === 'Authentication required' ? 401 : error.message === 'Insufficient permissions' ? 403 : 400;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
}
