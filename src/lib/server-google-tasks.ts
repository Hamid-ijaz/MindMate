// Server-side only wrapper for Google Tasks services
// This file should never be imported on the client side

let googleTasksSyncService: any = null;

export const getGoogleTasksSyncService = async () => {
  // Only import on server side
  if (typeof window !== 'undefined') {
    throw new Error('Google Tasks sync service can only be used on the server side');
  }
  
  if (!googleTasksSyncService) {
    const module = await import('@/services/google-tasks-sync');
    googleTasksSyncService = module.googleTasksSyncService;
  }
  
  return googleTasksSyncService;
};

// Re-export for API routes
export { googleTasksIntegration } from '@/services/google-tasks';
