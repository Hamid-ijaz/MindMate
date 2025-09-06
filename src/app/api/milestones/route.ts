import { NextRequest, NextResponse } from 'next/server';
import { MilestoneService } from '@/services/milestone-service';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userEmail = url.searchParams.get('userEmail');
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'userEmail parameter is required' },
        { status: 400 }
      );
    }

    const milestones = await MilestoneService.getUserMilestones(userEmail);
    
    return NextResponse.json({
      success: true,
      milestones,
      count: milestones.length,
    });
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return NextResponse.json(
      { error: 'Failed to fetch milestones' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, ...milestoneData } = body;
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'userEmail is required' },
        { status: 400 }
      );
    }

    const milestoneId = await MilestoneService.createMilestone(userEmail, milestoneData);
    
    return NextResponse.json({
      success: true,
      milestoneId,
      message: 'Milestone created successfully',
    });
  } catch (error) {
    console.error('Error creating milestone:', error);
    return NextResponse.json(
      { error: 'Failed to create milestone' },
      { status: 500 }
    );
  }
}
