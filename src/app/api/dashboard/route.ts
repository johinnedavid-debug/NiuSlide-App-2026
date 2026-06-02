import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const tokenUser = await authenticate(req);
    const userId = tokenUser.userId;
    const role = tokenUser.role;
    let data: any = {};

    if (role === 'STUDENT') {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId },
        include: { school: { select: { name: true } } },
      });
      const recentAttempts = await prisma.quizAttempt.findMany({
        where: { userId }, orderBy: { submittedAt: 'desc' }, take: 5,
        include: { quiz: { select: { title: true, subject: true } } },
      });
      const performanceRecords = await prisma.performanceRecord.findMany({
        where: { studentId: profile?.id }, orderBy: { recordedAt: 'desc' }, take: 10,
      });
      const scholarships = await prisma.scholarshipApplication.findMany({
        where: { userId },
        include: { scholarship: { select: { title: true, provider: true } } },
        orderBy: { createdAt: 'desc' }, take: 5,
      });
      data = { profile, recentQuizzes: recentAttempts, performance: performanceRecords, scholarships };
    } else if (role === 'TEACHER') {
      const profile = await prisma.teacherProfile.findUnique({ where: { userId } });
      const lessonPlans = await prisma.lessonPlan.findMany({
        where: { teacherId: profile?.id }, orderBy: { createdAt: 'desc' }, take: 5,
      });
      const presentations = await prisma.presentation.findMany({
        where: { createdBy: userId }, orderBy: { createdAt: 'desc' }, take: 5,
      });
      const quizzes = await prisma.quiz.findMany({
        where: { createdBy: userId }, orderBy: { createdAt: 'desc' }, take: 5,
      });
      data = { profile, lessonPlans, presentations, quizzes };
    } else if (['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(role)) {
      const school = tokenUser.schoolId ? await prisma.school.findUnique({
        where: { id: tokenUser.schoolId },
        include: { _count: { select: { users: true, lessonPlans: true, quizzes: true } } },
      }) : null;
      const recentUsers = await prisma.user.findMany({
        where: { schoolId: tokenUser.schoolId }, orderBy: { createdAt: 'desc' }, take: 5,
        select: { id: true, firstName: true, lastName: true, role: true, createdAt: true },
      });
      data = { school, recentUsers };
    }

    const notifications = await prisma.notification.findMany({
      where: { userId, isRead: false }, orderBy: { createdAt: 'desc' }, take: 10,
    });
    const chatSessions = await prisma.chatSession.findMany({
      where: { userId }, orderBy: { updatedAt: 'desc' }, take: 5,
      select: { id: true, title: true, subject: true, updatedAt: true },
    });

    return NextResponse.json({
      success: true,
      data: { ...data, notifications, chatSessions, user: { id: userId, email: tokenUser.email, role, subscriptionTier: role } },
    });
  } catch (error: any) {
    const status = error.message === 'Authentication required' ? 401 : 500;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
}
