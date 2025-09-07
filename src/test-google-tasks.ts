import { googleTasksIntegration } from '@/services/google-tasks';
import { googleTasksSyncService } from '@/services/google-tasks-sync';
import { googleTasksService } from '@/lib/firestore';

/**
 * Basic smoke test for Google Tasks integration
 * Run this manually to verify the integration is working
 */
export async function testGoogleTasksIntegration() {
  console.log('🚀 Testing Google Tasks Integration...');

  try {
    // Test 1: Check if OAuth URL generation works
    console.log('1. Testing OAuth URL generation...');
    const authUrl = googleTasksIntegration.getAuthUrl();
    console.log('✅ OAuth URL generated:', authUrl.substring(0, 50) + '...');

    // Test 2: Test basic service imports
    console.log('2. Testing service imports...');
    console.log('✅ googleTasksIntegration imported');
    console.log('✅ googleTasksSyncService imported');
    console.log('✅ googleTasksService imported');

    // Test 3: Test task conversion
    console.log('3. Testing task conversion...');
    const mockGoogleTask = {
      id: 'test-123',
      title: 'Test Task',
      notes: 'Test description',
      status: 'needsAction',
      due: new Date().toISOString(),
      selfLink: 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/test-123'
    };

    const convertedTask = googleTasksIntegration.convertGoogleTaskToAppTask(mockGoogleTask, 'test@example.com');
    console.log('✅ Task conversion works:', convertedTask.title);

    console.log('🎉 All basic tests passed!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Set up Google Cloud OAuth credentials');
    console.log('2. Add environment variables');
    console.log('3. Implement authentication helper');
    console.log('4. Test OAuth flow in browser');

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run test if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  testGoogleTasksIntegration();
}
