import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123!', 12);
  const teacherPassword = await bcrypt.hash('teacher123!', 12);
  const studentPassword = await bcrypt.hash('student123!', 12);

  const school = await prisma.school.create({
    data: {
      name: 'Port Moresby National High School',
      code: 'PMNHS001',
      type: 'SECONDARY',
      province: 'National Capital District',
      district: 'Port Moresby',
      address: 'Waigani Drive, Port Moresby',
      phone: '+675 123 4567',
      email: 'info@pmnhs.edu.pg',
      principalName: 'John Doe',
      isVerified: true,
      settings: {
        create: {
          curriculumType: 'STANDARD_BASED',
          allowOfflineAccess: true,
          featuresEnabled: ['ai_tutor', 'lesson_planner', 'presentation_generator'],
        },
      },
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@niuslid.edu.pg',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'SUPER_ADMIN',
      province: 'National Capital District',
      emailVerified: true,
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      email: 'teacher@pmnhs.edu.pg',
      passwordHash: teacherPassword,
      firstName: 'Sarah',
      lastName: 'Kila',
      role: 'TEACHER',
      province: 'National Capital District',
      schoolId: school.id,
      emailVerified: true,
      teacherProfile: {
        create: {
          schoolId: school.id,
          employeeId: 'TCH001',
          department: 'Science',
          subjects: ['Physics', 'Chemistry'],
          qualifications: ['BSc Education', 'MSc Physics'],
          specialization: 'Physics',
          joinDate: new Date('2020-01-15'),
          isFullTime: true,
        },
      },
    },
    include: { teacherProfile: true },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: 'student@pmnhs.edu.pg',
      passwordHash: studentPassword,
      firstName: 'Michael',
      lastName: 'Taki',
      role: 'STUDENT',
      province: 'National Capital District',
      schoolId: school.id,
      emailVerified: true,
      studentProfile: {
        create: {
          schoolId: school.id,
          gradeLevel: 'Grade 11',
          studentIdNumber: 'STU2024001',
          enrollmentDate: new Date('2024-01-20'),
          subjects: ['Physics', 'Chemistry', 'Mathematics', 'English'],
          careerInterests: ['Engineering', 'Medicine'],
          guardianName: 'Peter Taki',
          guardianPhone: '+675 987 6543',
        },
      },
    },
    include: { studentProfile: true },
  });

  await prisma.scholarship.create({
    data: {
      title: 'PNG Excellence Scholarship 2026',
      provider: 'PNG Government',
      type: 'GOVERNMENT',
      description: 'Full scholarship for outstanding PNG students pursuing STEM degrees at local universities.',
      eligibilityCriteria: ['PNG Citizen', 'Minimum GPA 3.5', 'Grade 12 graduate'],
      requiredGpa: 3.5,
      applicationDeadline: new Date('2026-08-31'),
      awardAmount: 'K 50,000 per year',
      duration: '4 years',
      studyLevel: ['UNIVERSITY'],
      fieldsOfStudy: ['Engineering', 'Medicine', 'Computer Science'],
      documentsRequired: ['Academic Transcript', 'Recommendation Letter', 'Personal Statement'],
      isActive: true,
      featured: true,
    },
  });

  if (teacherUser.teacherProfile) {
    await prisma.lessonPlan.create({
      data: {
        title: "Introduction to Newton's Laws of Motion",
        subject: 'Physics',
        gradeLevel: 'Grade 11',
        curriculumType: 'STANDARD_BASED',
        duration: 90,
        objectives: ["Understand Newton's three laws", 'Apply laws to real-world scenarios'],
        materials: ['Textbook', 'Whiteboard', 'Ball and ramp'],
        introduction: 'Begin with a discussion about everyday motion and why objects move or stay still.',
        mainActivity: "Demonstrate Newton's laws using a ball and ramp experiment.",
        conclusion: 'Summarize key points and assign practice problems.',
        assessment: "Quiz on applying Newton's laws to various scenarios.",
        teacherId: teacherUser.teacherProfile.id,
        schoolId: school.id,
        tags: ['physics', 'mechanics', 'newton'],
      },
    });
  }

  console.log('Seed data created successfully');
  console.log('');
  console.log('Default accounts:');
  console.log('  Admin: admin@niuslid.edu.pg / admin123!');
  console.log('  Teacher: teacher@pmnhs.edu.pg / teacher123!');
  console.log('  Student: student@pmnhs.edu.pg / student123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
