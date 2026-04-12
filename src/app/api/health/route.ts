import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'ok',
      database: 'up',
      timestamp,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown health check error';

    return NextResponse.json(
      {
        status: 'degraded',
        database: 'down',
        timestamp,
        details,
      },
      { status: 503 }
    );
  }
}
