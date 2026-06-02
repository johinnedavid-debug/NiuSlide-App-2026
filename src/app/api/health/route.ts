import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.1',
    environment: process.env.NODE_ENV || 'development',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    healthcheck.message = 'OK';
    return NextResponse.json({ success: true, data: healthcheck });
  } catch (error: any) {
    healthcheck.message = 'Database connection failed';
    return NextResponse.json({ success: false, data: healthcheck, error: error.message }, { status: 503 });
  }
}
