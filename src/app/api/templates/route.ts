import { NextRequest, NextResponse } from 'next/server';
import { templateService } from '@/lib/firestore';
import type { TaskTemplate } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const isPublic = searchParams.get('isPublic');
    
    const templates = await templateService.getTaskTemplates(
      workspaceId || undefined,
      isPublic === 'true' ? true : isPublic === 'false' ? false : undefined
    );
    
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template } = body;
    
    if (!template || !template.name || !template.createdBy) {
      return NextResponse.json({ error: 'Template data with name and createdBy is required' }, { status: 400 });
    }
    
    const templateId = await templateService.createTaskTemplate(template);
    return NextResponse.json({ templateId });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

// Apply template to create tasks
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, workspaceId, createdBy, customizations } = body;
    
    if (!templateId || !workspaceId || !createdBy) {
      return NextResponse.json({ error: 'Template ID, workspace ID, and createdBy are required' }, { status: 400 });
    }
    
    const taskIds = await templateService.applyTemplate(templateId, workspaceId, createdBy, customizations);
    return NextResponse.json({ taskIds });
  } catch (error) {
    console.error('Error applying template:', error);
    return NextResponse.json({ error: 'Failed to apply template' }, { status: 500 });
  }
}