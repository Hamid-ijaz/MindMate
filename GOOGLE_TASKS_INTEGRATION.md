# Google Tasks Integration

This implementation provides full two-way synchronization between your app and Google Tasks, replacing the previous Google Calendar collaboration features.

## Features Implemented

### ✅ OAuth Connect/Disconnect
- **File**: `src/app/api/google/oauth/route.ts`, `src/app/api/google/callback/route.ts`
- **Description**: Secure OAuth 2.0 flow to connect user's Google account
- **Scope**: `https://www.googleapis.com/auth/tasks`
- **Storage**: Encrypted refresh tokens in Firestore

### ✅ Two-way Sync (App ↔ Google Tasks)
- **File**: `src/services/google-tasks-sync.ts`
- **Description**: Bidirectional synchronization with conflict detection
- **Modes**: 
  - `app-to-google`: Push app tasks to Google Tasks
  - `google-to-app`: Pull Google Tasks to app
  - `bidirectional`: Full two-way sync (default)

### ✅ Real-time Push Changes
- **Hook**: `src/hooks/use-google-tasks-sync.ts`
- **Description**: Automatically sync task changes as they happen
- **Triggers**: Task create, update, delete, completion status changes

### ✅ Conflict Resolution
- **Logic**: Timestamp-based with manual resolution options
- **Types**: `both_modified`, `deleted_in_app`, `deleted_in_google`
- **Resolution**: Keep app version, keep Google version, or merge

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google Tasks API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Tasks API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Authorized redirect URIs:
     - `http://localhost:3000/api/google/callback` (development)
     - `https://yourdomain.com/api/google/callback` (production)

5. Copy the Client ID and Client Secret

### 2. Environment Variables

Add to your `.env.local`:

```bash
# Google Tasks Integration
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_OAUTH_REDIRECT=http://localhost:3000/api/google/callback
NEXTAUTH_URL=http://localhost:3000

# Optional: For background sync worker
CRON_SECRET=your_random_secret_for_cron_jobs
```

### 3. Install Dependencies

```bash
npm install googleapis
```

### 4. Update Authentication Helper

Edit `src/lib/auth-utils.ts` and implement `getAuthenticatedUserEmail()` based on your auth system:

```typescript
// Example for NextAuth:
import { getServerSession } from 'next-auth';
export async function getAuthenticatedUserEmail(request: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}
```

## Usage

### 1. Add to Settings Page

Replace the calendar connections component:

```tsx
// Remove old import
// import { CalendarConnections } from '@/components/calendar-connections';

// Add new import
import { GoogleTasksConnections } from '@/components/google-tasks-connections';

// In your settings component:
<GoogleTasksConnections 
  onConnectionChange={(provider, connected) => {
    console.log(`${provider} ${connected ? 'connected' : 'disconnected'}`);
  }}
/>
```

### 2. Use Sync Hooks in Task Components

```tsx
import { useGoogleTasksSync } from '@/hooks/use-google-tasks-sync';

function TaskComponent() {
  const { syncTaskChange, syncTaskDeletion } = useGoogleTasksSync({
    onSyncError: (error) => console.error('Sync error:', error),
    onSyncComplete: (result) => console.log('Sync complete:', result)
  });

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    // Update task in your app
    await updateTask(taskId, updates);
    
    // Sync to Google Tasks
    await syncTaskChange(taskId);
  };

  const handleTaskDelete = async (taskId: string, googleTaskId?: string) => {
    // Delete task from your app
    await deleteTask(taskId);
    
    // Sync deletion to Google Tasks
    await syncTaskDeletion(taskId, googleTaskId);
  };
}
```

### 3. Manual Sync

```tsx
const { triggerSync } = useGoogleTasksSync();

const handleManualSync = async () => {
  const result = await triggerSync();
  if (result.success) {
    console.log(`Synced ${result.synced} tasks`);
  } else {
    console.error('Sync failed:', result.errors);
  }
};
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/google/oauth` | Start OAuth flow |
| `GET` | `/api/google/callback` | OAuth callback handler |
| `GET` | `/api/google/sync` | Get connection status |
| `POST` | `/api/google/sync` | Trigger manual sync |
| `DELETE` | `/api/google/sync` | Disconnect Google Tasks |
| `POST` | `/api/google/sync/background` | Background sync worker |

## Data Flow

### Task Creation (App → Google)
1. User creates task in app
2. Task saved to Firestore
3. If `syncToGoogleTasks=true`, push to Google Tasks API
4. Store `googleTaskId` mapping
5. Update sync status

### Task Update (Bidirectional)
1. Change detected (app or Google)
2. Compare timestamps (`updatedAt` vs `updated`)
3. Sync newer version to other platform
4. Handle conflicts if both modified since last sync

### Background Sync
- Can be triggered by cron jobs
- Processes users with `autoSync=true`
- Batch processing to avoid rate limits
- Error handling and retry logic

## Conflict Resolution

When both app and Google Tasks have been modified since last sync:

1. **Automatic**: Use timestamp to determine newer version
2. **Manual**: Present conflict resolution UI (TODO)
3. **Merge**: Combine changes using predefined rules

## Security Considerations

- ✅ Refresh tokens stored encrypted in Firestore
- ✅ OAuth 2.0 with proper scopes (`tasks` only)
- ✅ Background sync worker protected with secret
- ✅ User isolation (can only sync own tasks)
- ✅ Rate limiting handled by googleapis client

## Removed Google Calendar Features

The following Google Calendar features have been removed:

- ❌ Calendar event sync
- ❌ Calendar connections UI
- ❌ Google Calendar settings in types
- ❌ Calendar-related firestore operations
- ❌ Time blocking with calendar events

## Migration Notes

1. Existing users with Google Calendar connected will need to reconnect with Google Tasks
2. Update settings UI to use `GoogleTasksConnections` component
3. Remove references to `googleCalendarSettings` in user documents
4. Update task creation/update flows to use Google Tasks sync hooks

## Testing

### 1. Test OAuth Flow
```bash
# Start dev server
npm run dev

# Navigate to settings page
# Click "Connect" for Google Tasks
# Complete OAuth flow
# Verify connection status
```

### 2. Test Sync
```bash
# Manual sync via API
curl -X POST http://localhost:3000/api/google/sync

# Check sync status
curl http://localhost:3000/api/google/sync
```

### 3. Test Task Operations
1. Create task in app → verify appears in Google Tasks
2. Create task in Google Tasks → trigger sync → verify appears in app
3. Update task in either place → verify changes sync
4. Delete task → verify deletion syncs

## Troubleshooting

### Common Issues

1. **OAuth Error**: Check redirect URI matches exactly
2. **API Not Enabled**: Ensure Google Tasks API is enabled
3. **Token Expired**: Implement automatic refresh token handling
4. **Rate Limits**: Implement exponential backoff
5. **Sync Conflicts**: Check conflict resolution logic

### Debug Mode

Add logging to track sync operations:

```typescript
// In google-tasks-sync.ts
console.log('Syncing task:', taskId, 'direction:', direction);
```

## Next Steps

1. **UI Enhancements**: Add conflict resolution dialog
2. **Background Worker**: Implement scheduled sync
3. **Analytics**: Track sync success rates
4. **Performance**: Optimize for large task lists
5. **Testing**: Add comprehensive test suite
