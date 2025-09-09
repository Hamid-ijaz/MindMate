# Parent-Child Relationship Fix for Google Tasks

## Issue
Tasks were not being created with proper parent-child relationships in Google Tasks. Child tasks were being created as independent tasks instead of being nested under their parent tasks.

## Root Cause
The Google Tasks API requires specific handling for parent-child relationships:

1. **For task creation**: The `parent` parameter must be passed as a separate parameter in the API call, NOT as part of the task body (`requestBody`)
2. **For task updates**: Parent relationships should be handled using the `move` API after the task update

## Fix Applied

### 1. Fixed `createTask` method in `src/services/google-tasks.ts`

**Before:**
```typescript
const googleTask: tasks_v1.Schema$Task = {
  title: task.title,
  // ... other fields
  parent: parentGoogleTaskId || undefined  // ❌ WRONG: Don't include in requestBody
};

const response = await tasksApi.tasks.insert({
  tasklist: listId,
  requestBody: googleTask,
  parent: parentGoogleTaskId || undefined  // ❌ Redundant and conflicting
});
```

**After:**
```typescript
const googleTask: tasks_v1.Schema$Task = {
  title: task.title,
  // ... other fields
  // ✅ Do NOT include 'parent' in the requestBody
};

const requestParams: any = {
  tasklist: listId,
  requestBody: googleTask
};

// ✅ Add parent parameter separately if provided
if (parentGoogleTaskId) {
  requestParams.parent = parentGoogleTaskId;
}

const response = await tasksApi.tasks.insert(requestParams);
```

### 2. Fixed `updateTask` method in `src/services/google-tasks.ts`

**Before:**
```typescript
const googleTask: tasks_v1.Schema$Task = {
  // ... other fields
  parent: parentGoogleTaskId || undefined  // ❌ Not the correct way for updates
};

await tasksApi.tasks.update({
  tasklist: listId,
  task: googleTaskId,
  requestBody: googleTask
});
```

**After:**
```typescript
const googleTask: tasks_v1.Schema$Task = {
  // ... other fields
  // ✅ Don't include parent in requestBody for updates
};

await tasksApi.tasks.update({
  tasklist: listId,
  task: googleTaskId,
  requestBody: googleTask
});

// ✅ Use the move API to handle parent relationships
if (parentGoogleTaskId) {
  await tasksApi.tasks.move({
    tasklist: listId,
    task: googleTaskId,
    parent: parentGoogleTaskId
  });
}
```

## How Parent-Child Relationships Work Now

### Task Creation Flow:
1. **Local task created** with `parentId` pointing to local parent task
2. **Sync service** determines the parent's `googleTaskId`
3. **Google Tasks API** creates child task with proper parent parameter
4. **Result**: Child task appears nested under parent in Google Tasks

### Task Update Flow:
1. **Local task updated** (including potential parent changes)
2. **Sync service** updates task content first
3. **Move API** repositions task under correct parent if needed
4. **Result**: Task relationships maintained in Google Tasks

### Sync Flow Enhancement:
The existing sync service improvements ensure:
- ✅ Parent tasks are synced before child tasks
- ✅ Parent `googleTaskId` is resolved before child task creation
- ✅ Parent-child maps are built for efficient relationship tracking
- ✅ Completed tasks are excluded from sync (they don't need parent relationships)

## Testing
To verify the fix:

1. **Create a parent task** in the app
2. **Create a child task** with the parent selected
3. **Check Google Tasks** - child should appear indented under parent
4. **Update child task** and verify hierarchy is maintained
5. **Complete parent task** - both parent and child are removed from Google Tasks
6. **Uncomplete parent task** - parent is recreated, children follow if uncompleted

## API Reference
- [Google Tasks API - Insert Task](https://developers.google.com/tasks/reference/rest/v1/tasks/insert)
- [Google Tasks API - Move Task](https://developers.google.com/tasks/reference/rest/v1/tasks/move)

The key insight: Google Tasks API treats parent relationships as positional (using `move`) rather than relational (using `parent` field in task body).
