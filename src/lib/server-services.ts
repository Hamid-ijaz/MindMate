// Server-side only imports and services
// This file should only be imported in API routes or server components

import { sharingService, taskService, noteService, userService, googleTasksService } from '@/lib/firestore';

// Re-export services for server-side use only
export {
  sharingService,
  taskService,
  noteService,
  userService,
  googleTasksService
};

// Additional server-side utilities
export const isServerSide = () => typeof window === 'undefined';

// Check if we're on server side before using services
export const getServerServices = () => {
  if (!isServerSide()) {
    throw new Error('Server services can only be used on the server side. Use API routes instead.');
  }
  
  return {
    sharingService,
    taskService,
    noteService,
    userService,
    googleTasksService
  };
};
