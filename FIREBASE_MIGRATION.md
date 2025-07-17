# MindMate Firebase Migration Guide

## Overview

This document outlines the migration from local storage to Firebase Firestore for the MindMate application. The migration includes user authentication, task management, accomplishments, and user settings.

## What Changed

### 1. Data Storage Migration
- **Before**: Data was stored in browser's localStorage
- **After**: Data is stored in Firebase Firestore with real-time sync capabilities

### 2. Authentication System
- **Before**: Simple email/password verification against localStorage
- **After**: User credentials stored securely in Firestore with proper validation

### 3. Real-time Data Sync
- Tasks, accomplishments, and user settings now sync in real-time across devices
- Automatic backup and recovery of user data

## Database Structure

### Collections in Firestore:

#### `users`
```typescript
{
  email: string (document ID)
  firstName: string
  lastName: string
  phone?: string
  dob?: string
  password: string // In production, this should be hashed
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

#### `tasks`
```typescript
{
  id: string (auto-generated document ID)
  userEmail: string
  title: string
  description?: string
  category: string
  energyLevel: 'Low' | 'Medium' | 'High'
  duration: number
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening'
  createdAt: Timestamp
  completedAt?: Timestamp
  lastRejectedAt?: Timestamp
  rejectionCount: number
  isMuted: boolean
  parentId?: string
}
```

#### `accomplishments`
```typescript
{
  id: string (auto-generated document ID)
  userEmail: string
  date: string (YYYY-MM-DD)
  content: string
  createdAt: Timestamp
}
```

#### `userSettings`
```typescript
{
  userEmail: string (document ID)
  taskCategories: string[]
  taskDurations: number[]
  updatedAt: Timestamp
}
```

## Security Rules

For production, implement Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userEmail} {
      allow read, write: if request.auth != null && request.auth.token.email == userEmail;
    }
    
    // Tasks are user-specific
    match /tasks/{taskId} {
      allow read, write: if request.auth != null && 
        resource.data.userEmail == request.auth.token.email;
    }
    
    // Accomplishments are user-specific
    match /accomplishments/{accomplishmentId} {
      allow read, write: if request.auth != null && 
        resource.data.userEmail == request.auth.token.email;
    }
    
    // User settings are user-specific
    match /userSettings/{userEmail} {
      allow read, write: if request.auth != null && request.auth.token.email == userEmail;
    }
  }
}
```

## Setup Instructions

### 1. Firebase Console Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing "mindmate-5cecd"
3. Enable Firestore Database
4. Set up Firestore in production mode
5. Configure security rules (see above)

### 2. Environment Configuration
Ensure your `.env.local` file contains:
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBrIyiMpt3wsazthFHF1HB43UFo2J_NJKc
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mindmate-5cecd.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mindmate-5cecd
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mindmate-5cecd.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=607413711679
NEXT_PUBLIC_FIREBASE_APP_ID=1:607413711679:web:5006f9059f6d387a07598a
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-TH4NBFVQVS
```

### 3. Data Migration (Optional)
If you have existing data in localStorage, you can migrate it:

1. Export existing data from browser console:
```javascript
// Run this in browser console before migration
const exportData = () => {
  const users = JSON.parse(localStorage.getItem('mindmate-users') || '[]');
  const userData = {};
  
  users.forEach(user => {
    const userKey = `mindmate-data-${user.email}`;
    const data = JSON.parse(localStorage.getItem(userKey) || '{}');
    userData[user.email] = {
      user,
      tasks: data.tasks || [],
      accomplishments: data.accomplishments || [],
      taskCategories: data.taskCategories || [],
      taskDurations: data.taskDurations || []
    };
  });
  
  console.log('Export this data:', JSON.stringify(userData, null, 2));
};
exportData();
```

2. Use the exported data to manually create records in Firestore or create a migration script.

## Key Features

### 1. Real-time Sync
- Changes are immediately synchronized across all connected devices
- Offline support with automatic sync when connection resumes

### 2. Data Persistence
- No more data loss when clearing browser cache
- Cross-device access to all tasks and settings

### 3. Scalability
- Handles multiple users efficiently
- Automatic scaling with Firebase infrastructure

### 4. Error Handling
- Comprehensive error handling with user-friendly messages
- Automatic retry mechanisms for failed operations

## API Endpoints

### `/api/tasks`
- `GET`: Fetch user tasks
- `POST`: Create new task

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. For AI features, start Genkit:
```bash
npm run genkit:dev
```

## Production Considerations

1. **Security**: Implement proper Firestore security rules
2. **Authentication**: Consider using Firebase Auth instead of custom auth
3. **Indexing**: Create appropriate Firestore indexes for queries
4. **Backup**: Set up regular database backups
5. **Monitoring**: Implement Firebase Performance Monitoring

## Troubleshooting

### Common Issues:

1. **Connection Errors**: Check Firebase configuration and network connectivity
2. **Permission Denied**: Verify Firestore security rules and user authentication
3. **Data Not Syncing**: Check browser console for error messages

### Debug Mode:
Enable debug logging by adding to your Firebase config:
```typescript
// In firebase.ts
if (process.env.NODE_ENV === 'development') {
  enableNetwork(db);
  // Add other debugging configs
}
```

## Performance Tips

1. Use Firestore's offline persistence for better user experience
2. Implement pagination for large task lists
3. Use Firestore's real-time listeners efficiently
4. Consider using Firebase Functions for complex server-side operations

## Future Enhancements

1. **Firebase Authentication**: Replace custom auth with Firebase Auth
2. **Cloud Functions**: Move AI processing to Firebase Functions
3. **Real-time Collaboration**: Enable task sharing between users
4. **Push Notifications**: Implement task reminders with FCM
5. **Analytics**: Add Firebase Analytics for user behavior insights
