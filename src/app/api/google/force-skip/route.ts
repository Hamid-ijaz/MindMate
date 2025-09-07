import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { googleTasksService } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user email
    const userEmail = await getAuthenticatedUserEmail(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔧 Force updating onDeletedTasksAction to 'skip' for user: ${userEmail}`);

    // Force update the setting to 'skip'
    await googleTasksService.updateGoogleTasksSettings(userEmail, {
      onDeletedTasksAction: 'skip'
    });

    console.log(`✅ Successfully updated onDeletedTasksAction to 'skip'`);

    // Get the updated settings to confirm
    const updatedSettings = await googleTasksService.getGoogleTasksSettings(userEmail);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Successfully updated onDeletedTasksAction to skip',
      onDeletedTasksAction: updatedSettings?.onDeletedTasksAction
    });
  } catch (error) {
    console.error('Error forcing skip setting:', error);
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}
