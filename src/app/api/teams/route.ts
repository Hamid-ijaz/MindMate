import { NextRequest, NextResponse } from 'next/server';
import { teamService } from '@/lib/firestore';
import type { Team } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    
    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }
    
    const teams = await teamService.getUserTeams(userEmail);
    return NextResponse.json({ teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamData } = body;
    
    if (!teamData || !teamData.name || !teamData.ownerId) {
      return NextResponse.json({ error: 'Team data with name and ownerId is required' }, { status: 400 });
    }
    
    const teamId = await teamService.createTeam(teamData);
    return NextResponse.json({ teamId });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, updates } = body;
    
    if (!teamId || !updates) {
      return NextResponse.json({ error: 'Team ID and updates are required' }, { status: 400 });
    }
    
    await teamService.updateTeam(teamId, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    
    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }
    
    await teamService.deleteTeam(teamId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}