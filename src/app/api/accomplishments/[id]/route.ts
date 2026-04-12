import { NextRequest, NextResponse } from 'next/server';
import { accomplishmentPrismaService } from '@/services/server/accomplishment-prisma-service';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const getRouteUserEmail = (request: NextRequest): string | null => {
  const { searchParams } = new URL(request.url);
  return searchParams.get('userEmail');
};

const getRouteId = async (context: RouteContext): Promise<string> => {
  const { id } = await context.params;
  return id;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userEmail = getRouteUserEmail(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accomplishmentId = await getRouteId(context);
    const accomplishment = await accomplishmentPrismaService.getAccomplishmentById(
      userEmail,
      accomplishmentId
    );

    if (!accomplishment) {
      return NextResponse.json({ error: 'Accomplishment not found' }, { status: 404 });
    }

    return NextResponse.json({ accomplishment });
  } catch (error) {
    console.error('Error fetching accomplishment:', error);
    return NextResponse.json({ error: 'Failed to fetch accomplishment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userEmail = getRouteUserEmail(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accomplishmentId = await getRouteId(context);
    const deleted = await accomplishmentPrismaService.deleteAccomplishment(userEmail, accomplishmentId);

    if (!deleted) {
      return NextResponse.json({ error: 'Accomplishment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting accomplishment:', error);
    return NextResponse.json({ error: 'Failed to delete accomplishment' }, { status: 500 });
  }
}