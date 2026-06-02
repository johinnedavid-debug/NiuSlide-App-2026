import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const tokenUser = await authenticate(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const content: any = {};

    const baseWhere = {
      OR: [
        { schoolId: tokenUser.schoolId },
        { isPublic: true },
      ],
    };

    if (type === 'lesson_plans' || !type) {
      content.lessonPlans = await prisma.lessonPlan.findMany({
        where: baseWhere,
        select: { id: true, title: true, subject: true, gradeLevel: true, objectives: true, materials: true, introduction: true, mainActivity: true, conclusion: true, assessment: true },
      });
    }
    if (type === 'presentations' || !type) {
      content.presentations = await prisma.presentation.findMany({
        where: baseWhere,
        select: { id: true, title: true, subject: true, gradeLevel: true, slides: true },
      });
    }
    if (type === 'quizzes' || !type) {
      content.quizzes = await prisma.quiz.findMany({
        where: baseWhere,
        select: { id: true, title: true, subject: true, gradeLevel: true, questions: true, timeLimit: true, passingScore: true },
      });
    }

    return NextResponse.json({ success: true, data: { content } });
  } catch (error: any) {
    const status = error.message === 'Authentication required' ? 401 : 500;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
}
