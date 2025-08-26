# MindMate Team Collaboration Roadmap

This document outlines a detailed, step-by-step implementation plan for adding team collaboration features to MindMate. The roadmap is organized into small, manageable phases to ensure steady progress and early value delivery.

## Design & Implementation Guidelines

**Core Principles:**
- **Design Consistency**: All features must adhere to MindMate's existing design language, maintaining visual harmony with the current app.
- **Responsive Design**: Every component must be fully responsive, working perfectly on both desktop and mobile devices.
- **Theme Support**: All new features must support both light and dark themes, using the app's existing theming system.
- **Animation & Interaction**: Implement smooth, subtle animations for transitions and user interactions consistent with the app's current feel.
- **Accessibility**: Ensure all features follow accessibility best practices, including keyboard navigation, screen reader support, and proper contrast.
- **Performance**: Optimize all implementations for performance, using proper React patterns and efficient Firebase operations.

**Development Approach:**
- Each feature should feel like a natural extension of the existing app, not a bolted-on addition.
- Components should reuse existing UI elements from the app wherever possible (buttons, cards, forms, etc.).
- Code structure should follow the established patterns in the codebase for consistency.
- Pay special attention to edge cases, error states, and loading indicators for a polished user experience.

**Implementation Excellence:**
- Write clean, bug-free, production-quality code that's easy to maintain and extend.
- Handle all dependencies, edge cases, and component relationships proactively.
- Think deeply about UX, scalability, and visual excellence.
- Implement any suggestive improvements that might enhance the feature beyond what's specified.

## Phase 1: Team Workspace Foundation

This phase establishes the core infrastructure for team collaboration while maintaining perfect consistency with MindMate's existing design language. All UI components will follow the app's established patterns for responsiveness, theme support, and interaction design.

### 1.1 Data Model Setup

**Tasks:**
- [ ] Extend existing Task interface in `src/lib/types.ts` (rather than modify core structure):
  ```typescript
  // Add these fields to your existing Task interface
  export interface Task {
    // ... existing fields remain unchanged ...
    
    // New team collaboration fields
    workspaceId?: string; // Optional reference to workspace
    assignees?: string[]; // Array of user emails assigned to this task
    assignedBy?: string; // Email of user who assigned the task
    assignedAt?: number; // Timestamp when assignment was made
    assignmentStatus?: 'pending' | 'accepted' | 'declined' | 'in_progress';
    assignmentNotes?: string; // Notes from assignee about the task
  }
  ```

- [ ] Create new Workspace types in `src/lib/types.ts`:
  ```typescript
  export interface Workspace {
    id: string;
    name: string;
    description?: string;
    createdBy: string; // user email
    createdAt: number;
    updatedAt: number;
    icon?: string;
    color?: string;
    isArchived?: boolean;
    settings: {
      defaultCategories: string[];
      allowedPriorities: Priority[];
      defaultTimeOfDay: TimeOfDay;
      enableGoogleCalendarSync: boolean;
      enableNotifications: boolean;
      workingHours: {
        start: string; // "09:00"
        end: string; // "17:00"  
        days: number[]; // [1,2,3,4,5] for Mon-Fri
      };
    };
  }

  export interface WorkspaceMember {
    workspaceId: string;
    email: string;
    name?: string;
    role: 'admin' | 'manager' | 'member' | 'guest';
    joinedAt: number;
    invitedBy: string;
    status: 'active' | 'invited' | 'suspended';
    permissions?: WorkspacePermission[];
    lastActivityAt?: number;
  }

  export interface WorkspacePermission {
    action: 'view' | 'create' | 'edit' | 'delete' | 'assign' | 'manage_members' | 'manage_settings';
    resource: 'task' | 'note' | 'workspace' | 'calendar' | 'analytics';
    granted: boolean;
  }
  ```

- [ ] Update COLLECTIONS constant in `src/lib/firestore.ts`:
  ```typescript
  export const COLLECTIONS = {
    // ... existing collections ...
    WORKSPACES: 'workspaces',
    WORKSPACE_MEMBERS: 'workspace_members',
    WORKSPACE_INVITATIONS: 'workspace_invitations',
    TASK_ASSIGNMENTS: 'task_assignments',
    TASK_COMMENTS: 'task_comments',
    APPROVAL_WORKFLOWS: 'approval_workflows',
  } as const;
  ```

- [ ] Create Firebase indexes for efficient queries:
  ```javascript
  // Add to firestore.indexes.json or Firebase console
  {
    "indexes": [
      {
        "collectionGroup": "tasks",
        "queryScope": "COLLECTION",
        "fields": [
          {"fieldPath": "workspaceId", "order": "ASCENDING"},
          {"fieldPath": "createdAt", "order": "DESCENDING"}
        ]
      },
      {
        "collectionGroup": "tasks", 
        "queryScope": "COLLECTION",
        "fields": [
          {"fieldPath": "assignees", "arrayConfig": "CONTAINS"},
          {"fieldPath": "completedAt", "order": "ASCENDING"}
        ]
      }
    ]
  }
  ```

### 1.2 Core Workspace Services

**Tasks:**
- [ ] Add Workspace service to existing `src/lib/firestore.ts` following your established patterns:
  ```typescript
  // Workspace operations (add to existing firestore.ts)
  export const workspaceService = {
    // Create a new workspace
    async createWorkspace(workspaceData: Partial<Workspace>): Promise<Workspace> {
      const workspaceId = doc(collection(db, COLLECTIONS.WORKSPACES)).id;
      const workspace: Workspace = {
        id: workspaceId,
        name: workspaceData.name || 'New Workspace',
        description: workspaceData.description,
        createdBy: workspaceData.createdBy!,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isArchived: false,
        settings: {
          defaultCategories: ['Work', 'Personal'],
          allowedPriorities: ['Low', 'Medium', 'High', 'Critical'],
          defaultTimeOfDay: 'Morning',
          enableGoogleCalendarSync: true,
          enableNotifications: true,
          workingHours: {
            start: '09:00',
            end: '17:00',
            days: [1, 2, 3, 4, 5]
          }
        },
        ...workspaceData
      };
      
      const workspaceRef = doc(db, COLLECTIONS.WORKSPACES, workspaceId);
      await setDoc(workspaceRef, {
        ...workspace,
        createdAt: Timestamp.fromMillis(workspace.createdAt),
        updatedAt: Timestamp.fromMillis(workspace.updatedAt)
      });
      
      // Add creator as admin
      await this.addMember(workspaceId, {
        email: workspace.createdBy,
        role: 'admin',
        status: 'active',
        joinedAt: Date.now(),
        invitedBy: workspace.createdBy
      });
      
      return workspace;
    },
    
    // Get workspace by ID
    async getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
      const workspaceRef = doc(db, COLLECTIONS.WORKSPACES, workspaceId);
      const workspaceSnap = await getDoc(workspaceRef);
      
      if (workspaceSnap.exists()) {
        const data = workspaceSnap.data();
        return {
          ...data,
          createdAt: data.createdAt?.toMillis() || 0,
          updatedAt: data.updatedAt?.toMillis() || 0,
        } as Workspace;
      }
      return null;
    },
    
    // Get workspaces for a user
    async getWorkspacesForUser(userEmail: string): Promise<Workspace[]> {
      // Get user's workspace memberships
      const membershipsQuery = query(
        collection(db, COLLECTIONS.WORKSPACE_MEMBERS),
        where('email', '==', userEmail),
        where('status', '==', 'active')
      );
      
      const membershipsSnap = await getDocs(membershipsQuery);
      const workspaceIds = membershipsSnap.docs.map(doc => doc.data().workspaceId);
      
      if (workspaceIds.length === 0) return [];
      
      // Get workspace details
      const workspaces: Workspace[] = [];
      for (const workspaceId of workspaceIds) {
        const workspace = await this.getWorkspaceById(workspaceId);
        if (workspace && !workspace.isArchived) {
          workspaces.push(workspace);
        }
      }
      
      return workspaces.sort((a, b) => b.createdAt - a.createdAt);
    },
    
    // Update workspace
    async updateWorkspace(workspaceId: string, data: Partial<Workspace>): Promise<void> {
      const workspaceRef = doc(db, COLLECTIONS.WORKSPACES, workspaceId);
      const updates: any = {
        ...data,
        updatedAt: Timestamp.fromMillis(Date.now())
      };
      
      // Remove undefined values to avoid Firestore errors
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined) {
          delete updates[key];
        }
      });
      
      await updateDoc(workspaceRef, updates);
    },
    
    // Archive workspace
    async archiveWorkspace(workspaceId: string): Promise<void> {
      await this.updateWorkspace(workspaceId, { 
        isArchived: true, 
        updatedAt: Date.now() 
      });
    },
  };
  ```
    async archiveWorkspace(workspaceId: string): Promise<void> {
      // Implementation
    },
  };
  ```
- [ ] Implement Workspace Members service following your existing patterns:
  ```typescript
  // Workspace member operations (add to existing firestore.ts)
  export const workspaceMemberService = {
    // Add member to workspace
    async addMember(workspaceId: string, memberData: Partial<WorkspaceMember>): Promise<void> {
      const memberId = `${workspaceId}_${memberData.email}`;
      const member: WorkspaceMember = {
        workspaceId,
        email: memberData.email!,
        name: memberData.name,
        role: memberData.role || 'member',
        joinedAt: Date.now(),
        invitedBy: memberData.invitedBy!,
        status: memberData.status || 'active',
        permissions: memberData.permissions,
        lastActivityAt: Date.now()
      };
      
      const memberRef = doc(db, COLLECTIONS.WORKSPACE_MEMBERS, memberId);
      await setDoc(memberRef, {
        ...member,
        joinedAt: Timestamp.fromMillis(member.joinedAt),
        lastActivityAt: Timestamp.fromMillis(member.lastActivityAt!)
      });
    },
    
    // Get members of a workspace
    async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
      const membersQuery = query(
        collection(db, COLLECTIONS.WORKSPACE_MEMBERS),
        where('workspaceId', '==', workspaceId),
        orderBy('joinedAt', 'asc')
      );
      
      const membersSnap = await getDocs(membersQuery);
      return membersSnap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          joinedAt: data.joinedAt?.toMillis() || 0,
          lastActivityAt: data.lastActivityAt?.toMillis() || 0,
        } as WorkspaceMember;
      });
    },
    
    // Update member role
    async updateMemberRole(workspaceId: string, email: string, role: string): Promise<void> {
      const memberId = `${workspaceId}_${email}`;
      const memberRef = doc(db, COLLECTIONS.WORKSPACE_MEMBERS, memberId);
      await updateDoc(memberRef, { 
        role,
        lastActivityAt: Timestamp.fromMillis(Date.now())
      });
    },
    
    // Remove member
    async removeMember(workspaceId: string, email: string): Promise<void> {
      const memberId = `${workspaceId}_${email}`;
      
      // Remove member document
      const memberRef = doc(db, COLLECTIONS.WORKSPACE_MEMBERS, memberId);
      await deleteDoc(memberRef);
      
      // Unassign from all workspace tasks
      const tasksQuery = query(
        collection(db, COLLECTIONS.TASKS),
        where('workspaceId', '==', workspaceId),
        where('assignees', 'array-contains', email)
      );
      
      const tasksSnap = await getDocs(tasksQuery);
      const batch = writeBatch(db);
      
      tasksSnap.docs.forEach(doc => {
        const task = doc.data() as Task;
        const updatedAssignees = task.assignees?.filter(a => a !== email) || [];
        batch.update(doc.ref, { assignees: updatedAssignees });
      });
      
      await batch.commit();
    },
    
    // Check member permissions
    async hasPermission(userEmail: string, workspaceId: string, action: string, resource: string): Promise<boolean> {
      const memberId = `${workspaceId}_${userEmail}`;
      const memberRef = doc(db, COLLECTIONS.WORKSPACE_MEMBERS, memberId);
      const memberSnap = await getDoc(memberRef);
      
      if (!memberSnap.exists()) return false;
      
      const member = memberSnap.data() as WorkspaceMember;
      
      // Admins have all permissions
      if (member.role === 'admin') return true;
      
      // Check specific permissions
      if (member.permissions) {
        return member.permissions.some(p => 
          p.action === action && p.resource === resource && p.granted
        );
      }
      
      // Default permissions by role
      const defaultPermissions = {
        manager: ['view', 'create', 'edit', 'assign'],
        member: ['view', 'create', 'edit'],
        guest: ['view']
      };
      
      return defaultPermissions[member.role]?.includes(action) || false;
    },
  };
  ```

- [ ] Extend existing Task service to handle workspace assignments:
  ```typescript
  // Add these methods to your existing taskService in firestore.ts
  
  // Get tasks by workspace
  async getTasksByWorkspace(workspaceId: string, userEmail?: string): Promise<Task[]> {
    let tasksQuery = query(
      collection(db, COLLECTIONS.TASKS),
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    );
    
    const tasksSnap = await getDocs(tasksQuery);
    return tasksSnap.docs.map(doc => deserializeTaskFromFirestore(doc.data()));
  },
  
  // Get tasks assigned to user
  async getAssignedTasks(userEmail: string, workspaceId?: string): Promise<Task[]> {
    let tasksQuery = query(
      collection(db, COLLECTIONS.TASKS),
      where('assignees', 'array-contains', userEmail),
      orderBy('createdAt', 'desc')
    );
    
    if (workspaceId) {
      tasksQuery = query(
        collection(db, COLLECTIONS.TASKS),
        where('assignees', 'array-contains', userEmail),
        where('workspaceId', '==', workspaceId),
        orderBy('createdAt', 'desc')
      );
    }
    
    const tasksSnap = await getDocs(tasksQuery);
    return tasksSnap.docs.map(doc => deserializeTaskFromFirestore(doc.data()));
  },
  
  // Create task in workspace
  async createWorkspaceTask(workspaceId: string, taskData: Partial<Task>): Promise<Task> {
    const taskWithWorkspace = {
      ...taskData,
      workspaceId,
      assignees: taskData.assignees || [],
      assignedBy: taskData.assignedBy,
      assignedAt: taskData.assignees?.length ? Date.now() : undefined,
      assignmentStatus: taskData.assignees?.length ? 'pending' : undefined
    };
    
    // Use existing createTask method but with workspace data
    return await this.createTask(taskWithWorkspace);
  },
  
  // Assign task to users
  async assignTask(taskId: string, assignees: string[], assignedBy: string): Promise<void> {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    const updates = {
      assignees,
      assignedBy,
      assignedAt: Timestamp.fromMillis(Date.now()),
      assignmentStatus: 'pending',
      updatedAt: Timestamp.fromMillis(Date.now())
    };
    
    await updateDoc(taskRef, updates);
    
    // Send notifications to assignees using existing notification system
    for (const assigneeEmail of assignees) {
      await this.sendAssignmentNotification(taskId, assigneeEmail, assignedBy);
    }
  },
  
  // Update assignment status
  async updateAssignmentStatus(taskId: string, userEmail: string, status: string, notes?: string): Promise<void> {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    const updates: any = {
      assignmentStatus: status,
      updatedAt: Timestamp.fromMillis(Date.now())
    };
    
    if (notes) {
      updates.assignmentNotes = notes;
    }
    
    await updateDoc(taskRef, updates);
  },
  
  // Integration with existing notification system
  async sendAssignmentNotification(taskId: string, assigneeEmail: string, assignedBy: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) return;
    
    // Use your existing notification system
    const notificationData: NotificationData = {
      title: 'New Task Assignment',
      body: `You've been assigned: ${task.title}`,
      type: 'task_assignment',
      data: {
        taskId,
        assignedBy,
        workspaceId: task.workspaceId
      },
      userEmail: assigneeEmail,
      createdAt: Date.now(),
      scheduledFor: Date.now()
    };
    
    // Use existing sendNotification method
    await notificationService.sendNotification(notificationData);
  }
  ```

### 1.3 Workspace Context & UI

**Tasks:**
- [ ] Create Workspace Context in `src/contexts/workspace-context.tsx` following your existing auth-context pattern:
  ```typescript
  "use client";
  
  import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
  import type { Workspace, WorkspaceMember } from '@/lib/types';
  import { workspaceService, workspaceMemberService } from '@/lib/firestore';
  import { useAuth } from './auth-context';
  import { useToast } from '@/hooks/use-toast';
  import { useNotifications } from './notification-context';
  import Cookies from 'js-cookie';
  
  const WORKSPACE_COOKIE_KEY = 'mindmate-current-workspace';
  
  interface WorkspaceContextType {
    currentWorkspace: Workspace | null;
    setCurrentWorkspace: (workspace: Workspace | null) => void;
    workspaces: Workspace[];
    workspaceMembers: WorkspaceMember[];
    isLoading: boolean;
    error: any;
    refreshWorkspaces: () => Promise<void>;
    hasPermission: (action: string, resource: string) => boolean;
  }
  
  export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);
  
  export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<any>(null);
    
    const { toast } = useToast();
    const { sendNotification } = useNotifications();
    const isInitialLoad = useRef(true);
    
    // Load workspaces when user is authenticated
    useEffect(() => {
      if (isAuthenticated && user?.email) {
        loadWorkspaces();
      }
    }, [isAuthenticated, user?.email]);
    
    // Load saved workspace from cookie
    useEffect(() => {
      if (workspaces.length > 0) {
        const savedWorkspaceId = Cookies.get(WORKSPACE_COOKIE_KEY);
        if (savedWorkspaceId) {
          const savedWorkspace = workspaces.find(w => w.id === savedWorkspaceId);
          if (savedWorkspace) {
            setCurrentWorkspaceState(savedWorkspace);
            loadWorkspaceMembers(savedWorkspaceId);
          } else if (!isInitialLoad.current) {
            // Only show this toast if not the initial load
            toast({
              title: "Workspace not found",
              description: "The previously selected workspace is no longer available.",
              variant: "destructive",
            });
            Cookies.remove(WORKSPACE_COOKIE_KEY);
          }
        }
        isInitialLoad.current = false;
      }
    }, [workspaces, toast]);
    
    const loadWorkspaces = async () => {
      if (!user?.email) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const userWorkspaces = await workspaceService.getWorkspacesForUser(user.email);
        setWorkspaces(userWorkspaces);
      } catch (err) {
        setError(err);
        console.error('Error loading workspaces:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    const loadWorkspaceMembers = async (workspaceId: string) => {
      try {
        const members = await workspaceMemberService.getWorkspaceMembers(workspaceId);
        setWorkspaceMembers(members);
      } catch (err) {
        console.error('Error loading workspace members:', err);
      }
    };
    
    const setCurrentWorkspace = (workspace: Workspace | null) => {
      setCurrentWorkspaceState(workspace);
      
      if (workspace) {
        Cookies.set(WORKSPACE_COOKIE_KEY, workspace.id, { expires: 30 });
        loadWorkspaceMembers(workspace.id);
      } else {
        Cookies.remove(WORKSPACE_COOKIE_KEY);
        setWorkspaceMembers([]);
      }
    };
    
    const hasPermission = (action: string, resource: string): boolean => {
      if (!currentWorkspace || !user?.email) return false;
      
      const member = workspaceMembers.find(m => m.email === user.email);
      if (!member) return false;
      
      // Admin has all permissions
      if (member.role === 'admin') return true;
      
      // Check specific permissions or default role permissions
      const defaultPermissions = {
        manager: ['view', 'create', 'edit', 'assign'],
        member: ['view', 'create', 'edit'],
        guest: ['view']
      };
      
      return defaultPermissions[member.role]?.includes(action) || false;
    };
    
    const refreshWorkspaces = async () => {
      await loadWorkspaces();
    };
    
    return (
      <WorkspaceContext.Provider value={{
        currentWorkspace,
        setCurrentWorkspace,
        workspaces,
        workspaceMembers,
        isLoading,
        error,
        refreshWorkspaces,
        hasPermission
      }}>
        {children}
      </WorkspaceContext.Provider>
    );
  }
  
  export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
      throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
  }
  ```

- [ ] Create Workspace Selector component in `src/components/workspace-selector.tsx` using your existing UI components:
  ```typescript
  "use client";
  
  import React from 'react';
  import { useWorkspace } from '@/contexts/workspace-context';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Building2, Plus, User } from 'lucide-react';
  import { cn } from '@/lib/utils';
  
  interface WorkspaceSelectorProps {
    className?: string;
    showCreateOption?: boolean;
    onCreateWorkspace?: () => void;
  }
  
  export function WorkspaceSelector({ 
    className, 
    showCreateOption = true,
    onCreateWorkspace 
  }: WorkspaceSelectorProps) {
    const { currentWorkspace, setCurrentWorkspace, workspaces, isLoading } = useWorkspace();
    
    const handleWorkspaceChange = (value: string) => {
      if (value === 'personal') {
        setCurrentWorkspace(null);
      } else if (value === 'create-new') {
        onCreateWorkspace?.();
      } else {
        const workspace = workspaces.find(w => w.id === value);
        if (workspace) {
          setCurrentWorkspace(workspace);
        }
      }
    };
    
    const currentValue = currentWorkspace?.id || 'personal';
    
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Select value={currentValue} onValueChange={handleWorkspaceChange} disabled={isLoading}>
          <SelectTrigger className="w-[200px]">
            <div className="flex items-center gap-2">
              {currentWorkspace ? (
                <Building2 className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
              <SelectValue placeholder="Select workspace" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="personal">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Personal Tasks
              </div>
            </SelectItem>
            {workspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {workspace.name}
                </div>
              </SelectItem>
            ))}
            {showCreateOption && (
              <SelectItem value="create-new">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Workspace
                </div>
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        
        {currentWorkspace && (
          <Badge variant="secondary" className="text-xs">
            Team
          </Badge>
        )}
      </div>
    );
  }
  ```

- [ ] Add workspace provider to your existing layout in `src/app/layout.tsx`:
  ```typescript
  // Add WorkspaceProvider inside AuthProvider
  <AuthProvider>
    <WorkspaceProvider>
      {/* existing layout content */}
    </WorkspaceProvider>
  </AuthProvider>
  ```

### 1.4 Workspace Creation & Settings

**Tasks:**
- [ ] Create Workspace Creation Dialog in `src/components/create-workspace-dialog.tsx`:
  - Form for workspace name, description, color/icon
  - Initial member invitation options
- [ ] Implement Workspace Settings page in `src/app/workspace/settings/page.tsx`:
  - Workspace details editing
  - Delete/archive functionality
  - Export workspace data
- [ ] Add workspace switching features to sidebar:
  - Quick workspace switcher
  - Visual indication of current workspace

### 1.5 Task Integration with Workspaces

**Tasks:**
- [ ] Update existing Task Form component in `src/components/task-form.tsx` to include workspace context:
  ```typescript
  // Add workspace integration to your existing formSchema
  const formSchema = z.object({
    // ... existing fields ...
    workspaceId: z.string().optional(),
    assignees: z.array(z.string()).optional(), // Array of user emails
  });
  
  // In your TaskForm component:
  export function TaskForm({ task, onFinished, parentId }: TaskFormProps) {
    const { currentWorkspace, workspaceMembers } = useWorkspace();
    const { user } = useAuth();
    
    // Update defaultValues to include workspace context
    const defaultValues = task ? {
      // ... existing task values ...
      workspaceId: task.workspaceId || currentWorkspace?.id,
      assignees: task.assignees || [],
    } : {
      // ... existing default values ...
      workspaceId: currentWorkspace?.id,
      assignees: [],
    };
    
    // Add assignee selection field to your form
    // (Only show when in workspace context)
    {currentWorkspace && (
      <FormField
        control={form.control}
        name="assignees"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Assign To</FormLabel>
            <FormControl>
              <MultiSelect
                options={workspaceMembers.map(member => ({
                  value: member.email,
                  label: member.name || member.email
                }))}
                value={field.value || []}
                onValueChange={field.onChange}
                placeholder="Select team members..."
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    )}
    
    // Update onSubmit to handle workspace tasks
    const onSubmit = async (values: TaskFormValues) => {
      try {
        const taskData = {
          ...values,
          userEmail: user?.email!,
          // Add workspace context
          workspaceId: currentWorkspace?.id,
          assignees: values.assignees?.length ? values.assignees : undefined,
          assignedBy: values.assignees?.length ? user?.email : undefined,
          assignedAt: values.assignees?.length ? Date.now() : undefined,
        };
        
        if (task) {
          await taskService.updateTask(task.id, taskData);
        } else if (currentWorkspace) {
          await taskService.createWorkspaceTask(currentWorkspace.id, taskData);
        } else {
          await taskService.createTask(taskData); // Personal task
        }
        
        onFinished?.();
      } catch (error) {
        // Handle error
      }
    };
  }
  ```

- [ ] Update Task List components to filter by workspace context:
  ```typescript
  // In your existing task listing components (home-main.tsx, pending page, etc.)
  const { currentWorkspace } = useWorkspace();
  const { tasks, loading } = useTasks();
  
  // Filter tasks based on workspace context
  const filteredTasks = useMemo(() => {
    if (currentWorkspace) {
      return tasks.filter(task => task.workspaceId === currentWorkspace.id);
    } else {
      return tasks.filter(task => !task.workspaceId); // Personal tasks only
    }
  }, [tasks, currentWorkspace]);
  
  // Use filteredTasks instead of tasks in your components
  ```

- [ ] Update Task Item component in `src/components/task-item.tsx` to show assignment info:
  ```typescript
  // Add workspace/assignment indicators to task cards
  export function TaskItem({ task, onEdit, onDelete }: TaskItemProps) {
    const { workspaceMembers } = useWorkspace();
    
    const assigneeNames = task.assignees?.map(email => {
      const member = workspaceMembers.find(m => m.email === email);
      return member?.name || email;
    });
    
    return (
      <Card>
        {/* Existing task content */}
        
        {/* Add assignment info */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1">
              {assigneeNames?.map(name => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Workspace indicator */}
        {task.workspaceId && (
          <Badge variant="outline" className="text-xs">
            <Building2 className="h-3 w-3 mr-1" />
            Team Task
          </Badge>
        )}
      </Card>
    );
  }
  ```

- [ ] Create MultiSelect component for assignee selection:
  ```typescript
  // Create src/components/ui/multi-select.tsx
  "use client";
  
  import * as React from "react";
  import { Badge } from "@/components/ui/badge";
  import { Button } from "@/components/ui/button";
  import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
  } from "@/components/ui/command";
  import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from "@/components/ui/popover";
  import { Check, ChevronsUpDown, X } from "lucide-react";
  import { cn } from "@/lib/utils";
  
  interface Option {
    value: string;
    label: string;
  }
  
  interface MultiSelectProps {
    options: Option[];
    value: string[];
    onValueChange: (value: string[]) => void;
    placeholder?: string;
    className?: string;
  }
  
  export function MultiSelect({
    options,
    value,
    onValueChange,
    placeholder = "Select options...",
    className
  }: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);
    
    const handleSelect = (optionValue: string) => {
      const newValue = value.includes(optionValue)
        ? value.filter(v => v !== optionValue)
        : [...value, optionValue];
      onValueChange(newValue);
    };
    
    const removeOption = (optionValue: string) => {
      onValueChange(value.filter(v => v !== optionValue));
    };
    
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("justify-between", className)}
          >
            <div className="flex gap-1 flex-wrap">
              {value.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                value.map(val => {
                  const option = options.find(opt => opt.value === val);
                  return option ? (
                    <Badge key={val} variant="secondary" className="mr-1">
                      {option.label}
                      <X
                        className="ml-1 h-3 w-3 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeOption(val);
                        }}
                      />
                    </Badge>
                  ) : null;
                })
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
  ```

### 1.6 Backward Compatibility & Migration Strategy

**Critical Implementation Notes:**
- [ ] Ensure all existing personal tasks continue to work without modification:
  ```typescript
  // Personal tasks (workspaceId = null/undefined) should:
  // - Display normally in personal view
  // - Continue to work with existing features (AI, calendar sync, notifications)
  // - Not be affected by workspace features
  
  // In your task queries, always handle both cases:
  const getPersonalTasks = (userEmail: string) => {
    return query(
      collection(db, COLLECTIONS.TASKS),
      where('userEmail', '==', userEmail),
      where('workspaceId', '==', null) // or use 'not-in' for undefined
    );
  };
  
  // When filtering tasks in the UI:
  const filterTasks = (tasks: Task[], currentWorkspace: Workspace | null) => {
    if (currentWorkspace) {
      // In workspace context, show only workspace tasks
      return tasks.filter(task => task.workspaceId === currentWorkspace.id);
    } else {
      // In personal context, show only personal tasks
      return tasks.filter(task => !task.workspaceId);
    }
  };
  ```



- [ ] Maintain existing notification preferences:
  ```typescript
  // Extend notifications to include workspace context while preserving existing behavior
  export interface NotificationData {
    // Existing fields
    title: string;
    body: string;
    type: string;
    data: any;
    userEmail: string;
    createdAt: number;
    scheduledFor: number;
    
    // New optional workspace fields
    workspaceId?: string;
    workspaceName?: string;
    assignedBy?: string;
  }
  
  // When sending notifications for workspace tasks
  async sendWorkspaceTaskNotification(
    task: Task, 
    workspaceId: string, 
    recipients: string[]
  ): Promise<void> {
    // Get workspace details
    const workspace = await workspaceService.getWorkspaceById(workspaceId);
    if (!workspace) return;
    
    // For each recipient, check their notification preferences
    for (const userEmail of recipients) {
      const userPrefs = await getUserNotificationPreferences(userEmail);
      
      // Only send if user has workspace notifications enabled
      if (userPrefs.enableWorkspaceNotifications) {
        await notificationService.sendNotification({
          title: `[${workspace.name}] ${task.title}`,
          body: task.description || '',
          type: 'workspace_task',
          data: {
            taskId: task.id,
            workspaceId,
            workspaceName: workspace.name
          },
          userEmail,
          createdAt: Date.now(),
          scheduledFor: Date.now()
        });
      }
    }
  }
  ```

- [ ] Gradual feature rollout strategy:
  ```typescript
  // Phase 1: Core workspace infrastructure (this phase)
  // - Users can create workspaces but tasks still work the same
  // - No breaking changes to existing functionality
  // - Workspace features are purely additive
  
  // Phase 2+: Gradually add team features
  // - Each phase should be backward compatible
  // - Feature flags for controlled rollout
  // - Ability to disable team features if needed
  ```

### 1.7 Testing & Refinement

**Tasks:**
- [ ] Comprehensive testing of workspace features:
  - Workspace creation, editing, archiving
  - Task assignment to workspaces
  - Workspace switching
  - **Critical**: Verify existing personal tasks still work perfectly
- [ ] Edge case handling:
  - Offline operation with workspace context
  - Conflict resolution between personal and workspace tasks
  - Error states when workspace is unavailable
- [ ] Performance optimization:
  - Query optimization for workspace filtering
  - Caching strategies for workspace data
  - Lazy loading of workspace members
- [ ] **Backward compatibility verification**:
  - All existing features work for personal tasks
  - No performance degradation for personal task views
  - Existing users can continue using app without workspace features

## Phase 2: Task Assignment & Member Management

This phase extends MindMate's existing task system with team assignment capabilities. All new UI components will seamlessly integrate with the current task management interface, maintaining the app's clean aesthetic and intuitive interaction patterns. Components will be fully responsive and support both light and dark themes.

### 2.1 Member Invitation System

**Tasks:**
- [ ] Implement Email Invitation System:
  - Create invitation email template in `src/lib/email.ts`
  - Add functions to generate and send invitation links
  - Store pending invitations in Firestore
- [ ] Create Invitation Acceptance flow:
  - Create `src/app/workspace/join/page.tsx` for handling invitations
  - Implement invitation validation and acceptance logic
  - Handle edge cases (already member, invalid invitation, etc.)
- [ ] Add Member Management UI in `src/components/workspace-members.tsx`:
  - List workspace members with roles
  - Add invite new member functionality
  - Role management UI

### 2.2 Task Assignment UI

**Tasks:**
- [ ] Update Task Form for Assignment in `src/components/task-form.tsx`:
  ```typescript
  // Add to TaskForm component
  const [assignees, setAssignees] = useState<string[]>([]);
  const { workspaceMembers } = useWorkspaceMembers(currentWorkspace?.id);
  
  // Add assignee selection UI
  <FormField
    name="assignees"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Assign To</FormLabel>
        <MultiSelect 
          options={workspaceMembers.map(m => ({ 
            value: m.email, 
            label: m.name || m.email 
          }))}
          selected={assignees}
          onChange={setAssignees}
        />
      </FormItem>
    )}
  />
  ```
- [ ] Create Assignee component in `src/components/task-assignees.tsx`:
  - Visual component showing assignee avatars
  - Tooltip with assignee information
  - Handling for multiple assignees

### 2.3 Task List Enhancements (Week 2)

**Tasks:**
- [ ] Enhance Task Item component in `src/components/task-item.tsx`:
  - Add assignee visualization
  - Add assignment status indicators
- [ ] Add Assignment Filtering in task lists:
  - Filter by "Assigned to me"
  - Filter by specific assignee
  - Show unassigned tasks
- [ ] Create My Assignments View in `src/app/assignments/page.tsx`:
  - Dedicated view for tasks assigned to current user
  - Grouped by workspace/project
  - Status filtering options

### 2.4 Assignment Workflow Features (Week 2-3)

**Tasks:**
- [ ] Implement Assignment Status Tracking:
  ```typescript
  // Add to Task interface
  export interface Task {
    // Existing fields...
    assignmentStatus?: 'pending' | 'accepted' | 'declined' | 'in_progress' | 'completed';
    assignmentStatusUpdatedAt?: number;
    assignmentStatusUpdatedBy?: string;
  }
  ```
- [ ] Create Assignment Action UI in `src/components/task-assignment-actions.tsx`:
  - Accept/decline buttons
  - Update status functionality
  - Comment field for responses
- [ ] Add Assignment Notifications:
  - Notification when assigned a task
  - Notification when assignment status changes
  - Daily digest of pending assignments

### 2.5 Testing & Refinement (Week 3)

**Tasks:**
- [ ] Comprehensive testing of assignment features:
  - Invitation flow
  - Assignment workflow
  - Notification delivery
- [ ] UX improvements:
  - Assignment status visibility
  - Clear assignment actions
  - Intuitive member management
- [ ] Performance optimization:
  - Efficient member queries
  - Assignment status updates
  - Notification delivery

## Phase 3: Team Calendar & Scheduling

This phase enhances MindMate's existing calendar with powerful team scheduling features. The UI will maintain perfect visual harmony with the current calendar implementation while adding team-specific capabilities. Special attention will be paid to ensuring the calendar remains fully responsive and performs well even with many team members and events.

### 3.1 Calendar Data Integration (Week 1)

**Tasks:**
- [ ] Extend Task model with team scheduling fields:
  ```typescript
  export interface Task {
    // Existing fields...
    assignees?: string[]; // Already added in Phase 2
    scheduledBy?: string; // Who scheduled the task
    scheduledAt?: number; // When it was scheduled
  }
  ```
- [ ] Update Calendar Service to handle team tasks:
  ```typescript
  // In calendar service
  // Get calendar events by workspace
  async getCalendarEventsByWorkspace(workspaceId: string, start: Date, end: Date): Promise<CalendarEvent[]> {
    // Implementation
  }
  
  // Get calendar events by assignee
  async getCalendarEventsByAssignee(email: string, start: Date, end: Date): Promise<CalendarEvent[]> {
    // Implementation
  }
  ```
- [ ] Implement Team Availability Service:
  ```typescript
  export interface AvailabilityWindow {
    userId: string;
    day: number; // 0-6 for day of week
    startTime: string; // HH:mm format
    endTime: string; // HH:mm format
    recurring: boolean;
  }
  
  // Availability service methods
  async setUserAvailability(userId: string, windows: AvailabilityWindow[]): Promise<void> {
    // Implementation
  }
  
  async getUserAvailability(userId: string): Promise<AvailabilityWindow[]> {
    // Implementation
  }
  
  async getTeamAvailability(userIds: string[]): Promise<Record<string, AvailabilityWindow[]>> {
    // Implementation
  }
  ```

### 3.2 Team Calendar Views (Week 1-2)

**Tasks:**
- [ ] Enhance existing Calendar component to support team views:
  ```typescript
  // Add to calendar component props
  interface TeamCalendarProps {
    // Existing props...
    workspaceId?: string;
    viewMode: 'personal' | 'team' | 'member';
    selectedMembers?: string[]; // For member-specific views
  }
  ```
- [ ] Create Member Selection component for calendar:
  - Multi-select UI for choosing which members to display
  - Quick toggles for "Everyone", "Just me", etc.
  - Save view preferences
- [ ] Implement color-coding for different assignees:
  - Consistent color scheme per team member
  - Visual distinction between personal and team tasks

### 3.3 Scheduling & Coordination Features (Week 2)

**Tasks:**
- [ ] Create Availability Setting UI:
  - Weekly schedule interface
  - Working hours definition
  - Recurring and one-time availability settings
- [ ] Implement Conflict Detection:
  - Visual indicators for scheduling conflicts
  - Warning dialog when creating conflicting events
  - Resolution suggestions
- [ ] Create Team Meeting Scheduler:
  - Find optimal meeting times based on availability
  - Bulk invitation system
  - Resource reservation (if applicable)

### 3.4 Calendar View Enhancements (Week 2-3)

**Tasks:**
- [ ] Implement Team Timeline View:
  - Horizontal timeline showing tasks by assignee
  - Drag-and-drop for reassignment
  - Time block visualization
- [ ] Add Resource View:
  - Calendar view filtered by resource
  - Resource booking functionality
  - Conflict prevention for resources
- [ ] Create Team Schedule Dashboard:
  - Overview of team member schedules
  - Upcoming deadlines and milestones
  - Availability at-a-glance

### 3.5 Testing & Refinement (Week 3)

**Tasks:**
- [ ] Comprehensive testing of team calendar features:
  - Different view modes
  - Conflict detection
  - Availability accuracy
- [ ] UX improvements:
  - Intuitive view switching
  - Clear visual distinctions
  - Performance with many team members
- [ ] Edge case handling:
  - Timezone differences
  - Recurring events
  - All-day vs. time-specific events

## Phase 4: Kanban Board & Visual Task Management

This phase introduces a visually appealing Kanban board that integrates with MindMate's existing task system. The board will feature smooth animations, responsive design for all device sizes, and full support for both light and dark themes. The UI will use the app's design language while providing a rich, interactive experience for visualizing and managing team tasks.

### 4.1 Kanban Data Model (Week 1)

**Tasks:**
- [ ] Create Board data model:
  ```typescript
  export interface Board {
    id: string;
    name: string;
    workspaceId: string;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    columns: BoardColumn[];
    settings: {
      showAssignees: boolean;
      showDueDates: boolean;
      enableSwimlanes: boolean;
      swimlaneType?: 'assignee' | 'category' | 'priority';
      defaultView?: 'board' | 'list';
    };
  }
  
  export interface BoardColumn {
    id: string;
    name: string;
    order: number;
    taskStatus: string; // Maps to task status
    wipLimit?: number; // Work in progress limit
    color?: string;
  }
  ```
- [ ] Create Board service in `src/lib/firestore.ts`:
  ```typescript
  // Board operations
  export const boardService = {
    // Create a board
    async createBoard(boardData: Partial<Board>): Promise<Board> {
      // Implementation
    },
    
    // Get boards for workspace
    async getBoardsForWorkspace(workspaceId: string): Promise<Board[]> {
      // Implementation
    },
    
    // Update board
    async updateBoard(boardId: string, data: Partial<Board>): Promise<void> {
      // Implementation
    },
    
    // Update column order
    async updateColumnOrder(boardId: string, columnOrder: string[]): Promise<void> {
      // Implementation
    },
    
    // Delete board
    async deleteBoard(boardId: string): Promise<void> {
      // Implementation
    },
  };
  ```
- [ ] Map task statuses to board columns:
  - Define standard task statuses that map to default columns
  - Create configuration for custom column mappings

### 4.2 Basic Kanban Board UI (Week 1-2)

**Tasks:**
- [ ] Create Board component in `src/components/kanban/board.tsx`:
  - Container for columns and cards
  - Drag-and-drop functionality for cards
  - Board header with controls
- [ ] Implement Column component in `src/components/kanban/column.tsx`:
  - Header with column name and task count
  - Container for task cards
  - WIP limit visualization
- [ ] Create Card component in `src/components/kanban/card.tsx`:
  - Task information display
  - Assignee avatars
  - Quick actions (edit, delete, etc.)
  - Drag handle

### 4.3 Kanban Interactions & State Management (Week 2)

**Tasks:**
- [ ] Implement drag-and-drop functionality:
  - Moving cards between columns
  - Reordering cards within columns
  - Reordering columns
- [ ] Create task status update logic:
  - Update task status when moved between columns
  - Handle task property updates
  - Sync with Firebase in real-time
- [ ] Implement filtering and sorting options:
  - Filter by assignee, category, priority
  - Sort by due date, creation date, priority
  - Save filter/sort preferences

### 4.4 Advanced Kanban Features (Week 2-3)

**Tasks:**
- [ ] Implement Swimlanes:
  - Group tasks by assignee, category, or priority
  - Collapsible swimlane headers
  - Cross-swimlane drag-and-drop
- [ ] Add Board Templates:
  - Pre-defined board layouts (Scrum, Kanban, etc.)
  - Save custom board configurations
  - Apply templates to new boards
- [ ] Create Board Settings UI:
  - Column configuration
  - WIP limit settings
  - Swimlane configuration
  - Card display options

### 4.5 Testing & Refinement (Week 3)

**Tasks:**
- [ ] Comprehensive testing of kanban features:
  - Drag-and-drop functionality
  - Status updates
  - Filter/sort accuracy
- [ ] UX improvements:
  - Smooth animations
  - Clear visual feedback
  - Mobile-friendly interactions
- [ ] Performance optimization:
  - Efficient rendering of many cards
  - Optimistic updates
  - Background syncing

## Phase 5: Team Analytics & Reporting

This phase builds on MindMate's analytics capabilities to provide insightful team performance metrics. The charts and visualizations will use the app's color palette and design language, with responsive layouts that work well on all devices. Special attention will be paid to performance optimization for handling large datasets while maintaining a smooth user experience.

### 5.1 Analytics Data Collection (Week 1)

**Tasks:**
- [ ] Define analytics data points to track:
  ```typescript
  export interface TaskAnalytics {
    taskId: string;
    createdAt: number;
    completedAt?: number;
    timeToComplete?: number; // In milliseconds
    assignees: string[];
    category: string;
    priority: string;
    statusChanges: StatusChange[];
    workspaceId?: string;
  }
  
  export interface StatusChange {
    from: string;
    to: string;
    timestamp: number;
    userId: string;
  }
  ```
- [ ] Implement analytics data collection service:
  ```typescript
  // Analytics service
  export const analyticsService = {
    // Record task creation
    async recordTaskCreation(taskId: string, data: Partial<TaskAnalytics>): Promise<void> {
      // Implementation
    },
    
    // Record task completion
    async recordTaskCompletion(taskId: string, completedAt: number): Promise<void> {
      // Implementation
    },
    
    // Record status change
    async recordStatusChange(taskId: string, change: StatusChange): Promise<void> {
      // Implementation
    },
    
    // Get analytics for workspace
    async getWorkspaceAnalytics(workspaceId: string, startDate: Date, endDate: Date): Promise<TaskAnalytics[]> {
      // Implementation
    },
  };
  ```
- [ ] Integrate analytics tracking into task operations:
  - Hook into task creation, updates, and completion
  - Track user actions and time spent
  - Record assignment changes

### 5.2 Individual Performance Analytics (Week 1-2)

**Tasks:**
- [ ] Create Individual Analytics Dashboard in `src/components/analytics/member-analytics.tsx`:
  - Task completion metrics
  - Average completion time
  - Category distribution
  - On-time completion rate
- [ ] Implement Performance Trends:
  - Time-series charts for key metrics
  - Week-over-week comparisons
  - Improvement indicators
- [ ] Create Personal Goals UI:
  - Set and track individual performance goals
  - Progress visualization
  - Achievement celebrations

### 5.3 Team Performance Analytics (Week 2)

**Tasks:**
- [ ] Create Team Analytics Dashboard in `src/components/analytics/team-analytics.tsx`:
  - Aggregated team metrics
  - Top performers
  - Bottlenecks and issues
  - Workload distribution
- [ ] Implement Comparative Analysis:
  - Member-to-member comparisons
  - Historical comparisons
  - Benchmarking against goals
- [ ] Create Workflow Analysis:
  - Process efficiency metrics
  - Cycle time and lead time
  - Bottleneck identification

### 5.4 Reporting System (Week 2-3)

**Tasks:**
- [ ] Create Report Builder UI in `src/components/analytics/report-builder.tsx`:
  - Select metrics and dimensions
  - Choose visualization types
  - Set date ranges and filters
- [ ] Implement Report Templates:
  - Pre-configured report layouts
  - Save custom report configurations
  - Schedule regular reports
- [ ] Add Export Options:
  - PDF export
  - CSV data export
  - Image export of charts
  - Email delivery

### 5.5 Testing & Refinement (Week 3)

**Tasks:**
- [ ] Comprehensive testing of analytics features:
  - Data accuracy
  - Chart rendering
  - Filter functionality
- [ ] UX improvements:
  - Intuitive data exploration
  - Clear visualization labels
  - Mobile-friendly charts
- [ ] Performance optimization:
  - Efficient data aggregation
  - Progressive loading
  - Caching of analytics results

## Phase 6: Comments & Discussion System

This phase adds a rich commenting and discussion system that feels like a natural extension of MindMate. The comment interface will use the app's existing UI components and animations, with a clean, focused design that encourages collaboration. The system will be fully responsive and accessible, with real-time updates for a dynamic team experience.

### 6.1 Comment Data Model (Week 1)

**Tasks:**
- [ ] Create Comment data model:
  ```typescript
  export interface Comment {
    id: string;
    taskId: string;
    authorId: string;
    authorName?: string;
    authorAvatar?: string;
    content: string;
    createdAt: number;
    updatedAt?: number;
    mentions: string[]; // User IDs mentioned
    parentId?: string; // For threaded comments
    isEdited: boolean;
    isResolved?: boolean;
    reactions?: Record<string, string[]>; // Emoji -> array of user IDs
  }
  ```
- [ ] Implement Comment service in `src/lib/firestore.ts`:
  ```typescript
  // Comment operations
  export const commentService = {
    // Create comment
    async createComment(commentData: Partial<Comment>): Promise<Comment> {
      // Implementation
    },
    
    // Get comments for task
    async getCommentsForTask(taskId: string): Promise<Comment[]> {
      // Implementation
    },
    
    // Update comment
    async updateComment(commentId: string, data: Partial<Comment>): Promise<void> {
      // Implementation
    },
    
    // Delete comment
    async deleteComment(commentId: string): Promise<void> {
      // Implementation
    },
    
    // Add reaction
    async addReaction(commentId: string, emoji: string, userId: string): Promise<void> {
      // Implementation
    },
    
    // Remove reaction
    async removeReaction(commentId: string, emoji: string, userId: string): Promise<void> {
      // Implementation
    },
  };
  ```

### 6.2 Basic Comment UI (Week 1)

**Tasks:**
- [ ] Create Comment Thread component in `src/components/comments/comment-thread.tsx`:
  - Container for all comments on a task
  - New comment input
  - Comment loading states
- [ ] Implement Single Comment component in `src/components/comments/comment.tsx`:
  - Comment content with formatting
  - Author information and avatar
  - Timestamp and edited indicator
  - Action buttons (edit, delete, reply)
- [ ] Create Comment Input component in `src/components/comments/comment-input.tsx`:
  - Rich text editor for comment content
  - Mention picker (@username)
  - Preview functionality
  - Submit and cancel buttons

### 6.3 Advanced Comment Features (Week 1-2)

**Tasks:**
- [ ] Implement Threaded Replies:
  - Reply UI with nesting
  - Collapse/expand thread controls
  - Jump to parent comment
- [ ] Add @Mention System:
  - User mention autocomplete
  - Mention highlighting
  - Notification on mention
- [ ] Create Comment Reactions:
  - Emoji reaction picker
  - Reaction counter
  - User list on hover

### 6.4 Activity Timeline (Week 2)

**Tasks:**
- [ ] Create Activity Timeline component in `src/components/activity-timeline.tsx`:
  - Chronological display of comments and task updates
  - Filter controls for activity types
  - Load more/pagination
- [ ] Implement Activity Grouping:
  - Group similar activities
  - Time-based grouping (Today, Yesterday, etc.)
  - Expandable groups
- [ ] Add Real-time Updates:
  - Live comment additions
  - Activity indicators
  - Unread markers

### 6.5 Testing & Refinement (Week 2)

**Tasks:**
- [ ] Comprehensive testing of comment features:
  - Comment creation and editing
  - Threaded replies
  - Mention functionality
- [ ] UX improvements:
  - Rich text rendering
  - Clear threading visualization
  - Smooth animations
- [ ] Performance optimization:
  - Efficient comment loading
  - Pagination for large threads
  - Optimistic updates

## Phase 7: Approval Workflows

This phase implements structured approval processes that integrate naturally with MindMate's task system. The approval interface will follow the app's established design patterns, with clear status indicators and intuitive controls. The workflow will be visually elegant while providing powerful functionality, with responsive design and theme support for a cohesive experience.

### 7.1 Approval Data Model (Week 1)

**Tasks:**
- [ ] Create Approval data model:
  ```typescript
  export interface ApprovalWorkflow {
    id: string;
    taskId: string;
    status: 'pending' | 'approved' | 'rejected';
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    steps: ApprovalStep[];
    currentStepIndex: number;
  }
  
  export interface ApprovalStep {
    id: string;
    name: string;
    approvers: string[]; // User IDs
    minApprovers: number; // Minimum approvals needed
    status: 'pending' | 'approved' | 'rejected';
    approvals: Approval[];
    order: number;
    isParallel: boolean; // If false, sequential
    deadline?: number; // Optional deadline
  }
  
  export interface Approval {
    approverId: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp?: number;
    comment?: string;
  }
  ```
- [ ] Implement Approval service:
  ```typescript
  // Approval operations
  export const approvalService = {
    // Create approval workflow
    async createApprovalWorkflow(workflowData: Partial<ApprovalWorkflow>): Promise<ApprovalWorkflow> {
      // Implementation
    },
    
    // Get approval workflow for task
    async getApprovalWorkflow(taskId: string): Promise<ApprovalWorkflow | null> {
      // Implementation
    },
    
    // Submit approval
    async submitApproval(taskId: string, stepId: string, approval: Partial<Approval>): Promise<void> {
      // Implementation
    },
    
    // Update workflow status
    async updateWorkflowStatus(workflowId: string, status: string): Promise<void> {
      // Implementation
    },
  };
  ```

### 7.2 Basic Approval UI (Week 1)

**Tasks:**
- [ ] Create Approval Request component in `src/components/approvals/approval-request.tsx`:
  - Form for requesting task approval
  - Approver selection
  - Step configuration
  - Deadline settings
- [ ] Implement Approval Status component in `src/components/approvals/approval-status.tsx`:
  - Visual display of approval progress
  - Step completion indicators
  - Current status badge
  - Approver information
- [ ] Create Approval Action component in `src/components/approvals/approval-action.tsx`:
  - Approve/reject buttons
  - Comment field
  - Confirmation dialog

### 7.3 Workflow Configuration (Week 1-2)

**Tasks:**
- [ ] Create Workflow Editor UI:
  - Add/remove/reorder steps
  - Configure approvers for each step
  - Set parallel vs. sequential steps
  - Configure minimum approvals
- [ ] Implement Approval Templates:
  - Save workflow configurations as templates
  - Apply templates to new approval requests
  - Workspace-specific templates
- [ ] Add Conditional Logic:
  - Define conditions for approval paths
  - Skip steps based on task attributes
  - Dynamic approver assignment

### 7.4 Approval Notifications & Tracking (Week 2)

**Tasks:**
- [ ] Implement Approval Notifications:
  - Notify approvers of pending approvals
  - Alert requesters of approval status changes
  - Reminder notifications for approaching deadlines
- [ ] Create Approval Dashboard in `src/app/approvals/page.tsx`:
  - List of approvals awaiting user action
  - Historical approvals
  - Approval metrics
- [ ] Add Task Integration:
  - Link approval status to task status
  - Block task progression pending approval
  - Task history entries for approval events

### 7.5 Testing & Refinement (Week 2)

**Tasks:**
- [ ] Comprehensive testing of approval features:
  - Approval workflow creation
  - Approval submission
  - Status tracking
- [ ] UX improvements:
  - Clear approval status visualization
  - Intuitive approval actions
  - Helpful guidance text
- [ ] Edge case handling:
  - Missing approvers
  - Deadline management
  - Approval revocation

## Phase 8: File & Document Collaboration

This phase adds seamless file sharing capabilities that complement MindMate's existing functionality. The file management interface will match the app's visual style while providing powerful collaboration features. File uploads, previews, and management will work flawlessly on both mobile and desktop, with elegant animations and consistent theming throughout the experience.

### 8.1 File Storage Integration (Week 1)

**Tasks:**
- [ ] Set up Firebase Storage integration:
  - Configure storage rules
  - Create folder structure
  - Set up metadata tracking
- [ ] Create File data model:
  ```typescript
  export interface FileAttachment {
    id: string;
    name: string;
    size: number;
    type: string;
    url: string;
    thumbnailUrl?: string;
    uploadedBy: string;
    uploadedAt: number;
    parentId: string; // Task or comment ID
    parentType: 'task' | 'comment' | 'note';
    workspaceId?: string;
    metadata?: Record<string, any>;
    versions?: FileVersion[];
  }
  
  export interface FileVersion {
    versionId: string;
    versionNumber: number;
    url: string;
    uploadedBy: string;
    uploadedAt: number;
    comment?: string;
  }
  ```
- [ ] Implement File service:
  ```typescript
  // File operations
  export const fileService = {
    // Upload file
    async uploadFile(file: File, parentId: string, parentType: string, workspaceId?: string): Promise<FileAttachment> {
      // Implementation
    },
    
    // Get files for parent
    async getFilesForParent(parentId: string, parentType: string): Promise<FileAttachment[]> {
      // Implementation
    },
    
    // Delete file
    async deleteFile(fileId: string): Promise<void> {
      // Implementation
    },
    
    // Upload new version
    async uploadNewVersion(fileId: string, file: File, comment?: string): Promise<FileAttachment> {
      // Implementation
    },
  };
  ```

### 8.2 File Upload & Management UI (Week 1)

**Tasks:**
- [ ] Create File Uploader component in `src/components/files/file-uploader.tsx`:
  - Drag-and-drop interface
  - Multiple file selection
  - Upload progress visualization
  - File type validation
- [ ] Implement File List component in `src/components/files/file-list.tsx`:
  - List of attached files
  - File type icons/thumbnails
  - Quick actions (download, delete, etc.)
  - Version history access
- [ ] Create File Preview component in `src/components/files/file-preview.tsx`:
  - In-app preview for common file types
  - External viewer integration for others
  - Navigation between files
  - Download and share options

### 8.3 Version Control & Collaboration (Week 1-2)

**Tasks:**
- [ ] Implement Version History UI:
  - List of file versions
  - Version comparison
  - Restore previous version
  - Version comments
- [ ] Create File Commenting system:
  - Comment on specific files
  - Annotation tools for images/PDFs
  - Comment resolution tracking
- [ ] Add File Sharing options:
  - Generate share links
  - Set permission levels
  - Track sharing activity

### 8.4 Document Organization (Week 2)

**Tasks:**
- [ ] Create File Browser component:
  - Folder structure visualization
  - File sorting and filtering
  - Search functionality
  - Grid/list view toggle
- [ ] Implement File Tagging system:
  - Add/remove tags from files
  - Filter by tags
  - Tag management
  - Auto-tagging suggestions
- [ ] Create Document Templates:
  - Create template files
  - Use templates to create new documents
  - Template categories and search

### 8.5 Testing & Refinement (Week 2)

**Tasks:**
- [ ] Comprehensive testing of file features:
  - Upload and download
  - Preview functionality
  - Version control
- [ ] UX improvements:
  - Drag-and-drop experience
  - Preview performance
  - File organization clarity
- [ ] Performance optimization:
  - Upload chunking for large files
  - Progressive loading of file lists
  - Thumbnail generation and caching

## Phase 9: Team Permissions & Access Control

This phase implements a sophisticated yet user-friendly permission system that integrates naturally with MindMate. The permission interface will be clean and intuitive, following the app's design language while providing powerful access control. The UI will be fully responsive and accessible, with clear visualizations of permission structures that work in both light and dark themes.

### 9.1 Enhanced Permission Model (Week 1)

**Tasks:**
- [ ] Define granular permission types:
  ```typescript
  export type PermissionAction = 
    | 'view' 
    | 'create' 
    | 'edit' 
    | 'delete' 
    | 'assign' 
    | 'approve' 
    | 'manage_members' 
    | 'manage_settings';
  
  export interface Permission {
    action: PermissionAction;
    resource: 'workspace' | 'task' | 'note' | 'file' | 'board' | 'calendar';
    resourceId?: string; // Specific resource ID or * for all
  }
  
  export interface Role {
    id: string;
    name: string;
    workspaceId: string;
    permissions: Permission[];
    isCustom: boolean;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
  }
  ```
- [ ] Create standard roles:
  - Admin: Full control over workspace
  - Manager: Can manage tasks and members
  - Member: Can create and edit own tasks
  - Guest: Limited view access
- [ ] Implement Permission service:
  ```typescript
  // Permission operations
  export const permissionService = {
    // Check if user has permission
    async hasPermission(userId: string, action: PermissionAction, resource: string, resourceId?: string): Promise<boolean> {
      // Implementation
    },
    
    // Get user roles for workspace
    async getUserRoles(userId: string, workspaceId: string): Promise<Role[]> {
      // Implementation
    },
    
    // Create custom role
    async createRole(roleData: Partial<Role>): Promise<Role> {
      // Implementation
    },
    
    // Update role permissions
    async updateRolePermissions(roleId: string, permissions: Permission[]): Promise<void> {
      // Implementation
    },
  };
  ```

### 9.2 Role Management UI (Week 1)

**Tasks:**
- [ ] Create Role Management component in `src/components/permissions/role-manager.tsx`:
  - List of workspace roles
  - Create/edit/delete roles
  - Assign permissions to roles
  - Role description and details
- [ ] Implement Member Role Assignment UI:
  - Assign roles to workspace members
  - Bulk role assignment
  - Role change history
  - Temporary role elevation

### 9.3 Permission Check Integration (Week 1-2)

**Tasks:**
- [ ] Create Permission Hook:
  ```typescript
  export function usePermission(action: PermissionAction, resource: string, resourceId?: string) {
    const { user } = useAuth();
    const [hasPermission, setHasPermission] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
      // Check permission logic
    }, [user, action, resource, resourceId]);
    
    return { hasPermission, isLoading };
  }
  ```
- [ ] Implement Permission Guard components:
  ```typescript
  export function PermissionGuard({ 
    action, 
    resource, 
    resourceId, 
    fallback = null, 
    children 
  }: PermissionGuardProps) {
    const { hasPermission, isLoading } = usePermission(action, resource, resourceId);
    
    if (isLoading) return <LoadingIndicator />;
    if (!hasPermission) return fallback;
    return <>{children}</>;
  }
  ```
- [ ] Add permission checks throughout the app:
  - Task actions
  - Workspace settings
  - Member management
  - File operations

### 9.4 Advanced Permission Features (Week 2)

**Tasks:**
- [ ] Implement Permission Auditing:
  - Track permission changes
  - Log access attempts
  - Permission change history
- [ ] Create Permission Request workflow:
  - Request access to restricted resources
  - Approval process for requests
  - Temporary access grants
- [ ] Add Resource-specific Permissions:
  - Override workspace permissions for specific tasks
  - Private items within workspace
  - Custom sharing settings

### 9.5 Testing & Refinement (Week 2)

**Tasks:**
- [ ] Comprehensive testing of permission features:
  - Role assignment
  - Permission checks
  - Edge cases (nested permissions)
- [ ] UX improvements:
  - Clear permission error messages
  - Intuitive role management
  - Permission visualization
- [ ] Security review:
  - Server-side permission validation
  - Firebase security rules
  - Access control edge cases

## Phase 10: Refinement & Integration

This final phase focuses on polishing all team features to achieve a flawlessly integrated experience within MindMate. The emphasis is on ensuring perfect consistency with the app's design language, smooth performance across all devices, and intuitive user journeys between features. This phase elevates the entire collaboration experience to a professional, production-quality level.

### 10.1 Cross-feature Integration (Week 1)

**Tasks:**
- [ ] Ensure seamless workflow between features:
  - Task assignment → Calendar → Approvals
  - Comments → Notifications → Assignments
  - Board views → Task details → File attachments
- [ ] Create comprehensive navigation:
  - Consistent workspace context
  - Quick access to related features
  - Contextual actions based on permissions

### 10.2 Mobile Experience Optimization (Week 1-2)

**Tasks:**
- [ ] Optimize team features for mobile:
  - Responsive kanban boards
  - Touch-friendly calendar
  - Simplified permission UI
  - Mobile file handling
- [ ] Create mobile-specific workflows:
  - Streamlined approval actions
  - Quick task assignments
  - Compressed analytics views
  - Optimized file previews

### 10.3 Performance Optimization (Week 2)

**Tasks:**
- [ ] Audit and optimize Firebase usage:
  - Query efficiency
  - Index optimization
  - Batch operations
  - Data denormalization where beneficial
- [ ] Implement caching strategies:
  - React Query integration
  - Local storage caching
  - Optimistic UI updates
  - Background data refreshing

### 10.4 Comprehensive Testing (Week 2-3)

**Tasks:**
- [ ] End-to-end testing of workflows:
  - Complete team task lifecycle
  - Workspace management
  - Permission scenarios
  - Edge cases and error handling
- [ ] Performance testing:
  - Large workspace behavior
  - Many concurrent users
  - File handling performance
  - Analytics generation speed

### 10.5 Documentation & User Guidance (Week 3)

**Tasks:**
- [ ] Create in-app guidance:
  - Feature tours
  - Contextual help
  - Video tutorials
  - Tooltips for new features
- [ ] Write comprehensive documentation:
  - Admin guide
  - User documentation
  - API documentation for extensions
  - Troubleshooting guides

## Implementation Notes

### Firebase Structure

For optimal performance, consider this Firebase structure:

```
/workspaces/{workspaceId} - Workspace details
/workspace_members/{workspaceId}_{userEmail} - Individual member records  
/workspace_invitations/{invitationId} - Pending invitations
/tasks/{taskId} - Task details with workspaceId field (extends existing structure)
/task_comments/{taskId}_{commentId} - Comments for specific tasks
/task_assignments/{taskId}_{userEmail} - Assignment tracking
/approval_workflows/{taskId} - Approval workflows
/boards/{workspaceId}_{boardId} - Board configurations per workspace
/files/metadata/{fileId} - File metadata
/analytics/tasks/{taskId} - Task analytics data
/analytics/workspaces/{workspaceId}/summary - Aggregated workspace analytics
```


                     memberId.split('_')[1] == request.auth.token.email;
    }
    
    // Task rules (extend existing)
    match /tasks/{taskId} {
      allow read: if isAuthenticated() && (
        // Personal task access (existing rule)
        resource.data.userEmail == request.auth.token.email
        ||
        // Workspace task access (new rule)
        (resource.data.workspaceId != null && 
         isWorkspaceMember(resource.data.workspaceId, request.auth.token.email))
      );
         
      allow write: if isAuthenticated() && (
### Security Considerations

- **Data Isolation**: Ensure workspace data is completely isolated between different workspaces
- **Permission Validation**: Always validate permissions on both client and server side
- **Audit Logging**: Track all workspace and task modifications for security auditing
- **Rate Limiting**: Implement rate limiting for invitation emails and bulk operations
- **Backup Strategy**: Set up automated backups with workspace-aware restoration
- **Access Tokens**: Consider using Firebase custom claims for complex permission scenarios
- **Input Validation**: Sanitize all user inputs, especially workspace names and descriptions

### Performance Tips

```typescript
// Optimized Compound Queries
// In your workspace task service:
async getWorkspaceTasks(
  workspaceId: string,
  filters: {
    limit?: number;
    startAfter?: DocumentSnapshot;
    status?: string;
    assignee?: string;
    dueAfter?: number;
    dueBefore?: number;
  } = {}
): Promise<{ tasks: Task[]; lastDoc: DocumentSnapshot | null }> {
  // Start with base query
  let q = query(
    collection(db, COLLECTIONS.TASKS),
    where('workspaceId', '==', workspaceId)
  );
  
  // Add filters conditionally - this creates optimal compound queries
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }
  
  if (filters.assignee) {
    q = query(q, where('assignees', 'array-contains', filters.assignee));
  }
  
  if (filters.dueAfter) {
    q = query(q, where('reminderAt', '>=', filters.dueAfter));
  }
  
  if (filters.dueBefore) {
    q = query(q, where('reminderAt', '<=', filters.dueBefore));
  }
  
  // Always add sorting and pagination last
  q = query(q, orderBy('createdAt', 'desc'));
  
  if (filters.startAfter) {
    q = query(q, startAfter(filters.startAfter));
  }
  
  if (filters.limit) {
    q = query(q, limit(filters.limit));
  } else {
    q = query(q, limit(25)); // Default pagination
  }
  
  const querySnapshot = await getDocs(q);
  const tasks = querySnapshot.docs.map(doc => deserializeTaskFromFirestore(doc.data()));
  const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;
  
  return { tasks, lastDoc };
}

// Efficient Workspace Member Caching
// In your workspace context:
const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  // Existing state
  const memberCache = useRef<Record<string, WorkspaceMember[]>>({});
  
  const loadWorkspaceMembers = async (workspaceId: string) => {
    setIsLoading(true);
    
    try {
      // Check cache first
      if (memberCache.current[workspaceId]) {
        setWorkspaceMembers(memberCache.current[workspaceId]);
        
        // Refresh in background without blocking UI
        const members = await workspaceMemberService.getWorkspaceMembers(workspaceId);
        memberCache.current[workspaceId] = members;
        setWorkspaceMembers(members);
      } else {
        const members = await workspaceMemberService.getWorkspaceMembers(workspaceId);
        memberCache.current[workspaceId] = members;
        setWorkspaceMembers(members);
      }
    } catch (err) {
      console.error('Error loading workspace members:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // When switching workspaces, use cached data while loading fresh data
  const setCurrentWorkspace = useCallback((workspace: Workspace | null) => {
    setCurrentWorkspaceState(workspace);
    
    if (workspace) {
      Cookies.set(WORKSPACE_COOKIE_KEY, workspace.id, { expires: 30 });
      
      // Use cached members if available for instant UI updates
      if (memberCache.current[workspace.id]) {
        setWorkspaceMembers(memberCache.current[workspace.id]);
      } else {
        setWorkspaceMembers([]);
      }
      
      // Then load fresh data
      loadWorkspaceMembers(workspace.id);
    } else {
      Cookies.remove(WORKSPACE_COOKIE_KEY);
      setWorkspaceMembers([]);
    }
  }, []);
}

// Virtual Scrolling for Large Task Lists
// In your team task list component:
import { useVirtualizer } from '@tanstack/react-virtual';

const WorkspaceTaskList = ({ workspaceId }: { workspaceId: string }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const loadTasks = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    
    try {
      const { tasks: newTasks, lastDoc: newLastDoc } = await taskService.getWorkspaceTasks(workspaceId, {
        limit: 25,
        startAfter: lastDoc
      });
      
      setTasks(prev => [...prev, ...newTasks]);
      setLastDoc(newLastDoc);
      setHasMore(newTasks.length === 25);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, lastDoc, loading, hasMore]);
  
  // Load initial tasks
  useEffect(() => {
    setTasks([]);
    setLastDoc(null);
    setHasMore(true);
    loadTasks();
  }, [workspaceId]);
  
  // Set up virtualizer for efficient rendering
  const rowVirtualizer = useVirtualizer({
    count: hasMore ? tasks.length + 1 : tasks.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80,
    overscan: 5
  });
  
  // Load more when scrolling to bottom
  const [sentryRef] = useInfiniteScroll({
    loading,
    hasNextPage: hasMore,
    onLoadMore: loadTasks,
    disabled: false,
    rootMargin: '200px'
  });
  
  return (
    <div ref={containerRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const isLoaderRow = virtualRow.index === tasks.length;
          const task = tasks[virtualRow.index];
          
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {isLoaderRow ? (
                <div ref={sentryRef} className="py-4 flex justify-center">
                  {loading && <Spinner />}
                </div>
              ) : (
                <TaskItem task={task} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

Additional Performance Optimizations:

- Use Firebase transactions for concurrent updates (especially for task assignments)
- Implement optimistic UI updates for better user experience
- Consider using Cloud Functions for background processing (notifications, analytics)
- Use `React.memo` to prevent unnecessary re-renders of expensive components
- Implement efficient state management with Context API + useReducer for complex state
- Use indexed queries and avoid collection scans in Firestore
- Batch Firebase writes when performing multiple operations
- Implement service worker strategies for offline support in workspace context

### State Management

```typescript
// Task Context Integration
// Update your TaskProvider in src/contexts/task-context.tsx to be workspace-aware:

export const TaskProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  // ...existing state

  // Update your loading function to handle both personal and workspace tasks
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    
    const loadTasks = async () => {
      if (authLoading || !user?.email) return;
      
      // Unsubscribe from previous listener if it exists
      if (unsubscribe) unsubscribe();
      
      try {
        if (currentWorkspace) {
          // Workspace tasks
          unsubscribe = taskService.subscribeToWorkspaceTasks(
            currentWorkspace.id, 
            (workspaceTasks) => {
              setTasks(workspaceTasks);
              setIsLoading(false);
            }
          );
        } else {
          // Personal tasks only (existing functionality)
          unsubscribe = taskService.subscribeToTasks(
            user.email, 
            (personalTasks) => {
              // Filter out workspace tasks from personal view
              const filteredTasks = personalTasks.filter(task => !task.workspaceId);
              setTasks(filteredTasks);
              setIsLoading(false);
            }
          );
        }
      } catch (error) {
        console.error('Error loading tasks:', error);
        setIsLoading(false);
      }
    };
    
    setIsLoading(true);
    loadTasks();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.email, authLoading, currentWorkspace]);
  
  // Modify your addTask method to handle workspace context
  const addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt' | 'notifiedAt'> & { parentId?: string }) => {
    if (!user?.email) return;
    
    try {
      if (currentWorkspace) {
        // Create workspace task
        await taskService.createWorkspaceTask(currentWorkspace.id, {
          ...task,
          userEmail: user.email, // Still track creator
        });
        
        // If task has assignees, notify them
        if (task.assignees?.length) {
          for (const assignee of task.assignees) {
            await notificationService.sendNotification({
              title: `You've been assigned a task in ${currentWorkspace.name}`,
              body: task.title,
              type: 'task_assignment',
              data: {
                taskId: task.id,
                workspaceId: currentWorkspace.id,
                assignedBy: user.email
              },
              userEmail: assignee,
              createdAt: Date.now(),
              scheduledFor: Date.now()
            });
          }
        }
      } else {
        // Create personal task (existing functionality)
        await taskService.addTask(user.email, task);
      }
      
      // Continue with existing notification/toast logic
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Similarly update your updateTask and other methods to be workspace-aware
  // ...rest of your provider implementation
};

// Error Boundary for Team Features
// Create src/components/workspace-error-boundary.tsx
import { ErrorBoundary } from 'react-error-boundary';

function WorkspaceErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20">
      <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
        Something went wrong with team features
      </h3>
      <p className="mt-2 text-sm text-red-700 dark:text-red-300">
        {error.message || "An unknown error occurred"}
      </p>
      <Button 
        variant="outline" 
        onClick={resetErrorBoundary}
        className="mt-4"
      >
        Try again
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => {
          // Reset to personal context
          Cookies.remove('mindmate-current-workspace');
          window.location.reload();
        }}
        className="mt-4 ml-2"
      >
        Switch to personal tasks
      </Button>
    </div>
  );
}

export function WorkspaceErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={WorkspaceErrorFallback}>
      {children}
    </ErrorBoundary>
  );
}

// Workspace Context with React Query Integration
// Update src/contexts/workspace-context.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  
  // Use React Query for efficient caching and background updates
  const { 
    data: workspaces = [],
    isLoading: isLoadingWorkspaces
  } = useQuery({
    queryKey: ['workspaces', user?.email],
    queryFn: () => workspaceService.getWorkspacesForUser(user?.email!),
    enabled: !!user?.email && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
  
  const {
    data: workspaceMembers = [],
    isLoading: isLoadingMembers
  } = useQuery({
    queryKey: ['workspaceMembers', currentWorkspace?.id],
    queryFn: () => workspaceMemberService.getWorkspaceMembers(currentWorkspace?.id!),
    enabled: !!currentWorkspace?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
  
  // Create workspace mutation
  const createWorkspaceMutation = useMutation({
    mutationFn: (data: Partial<Workspace>) => workspaceService.createWorkspace({
      ...data,
      createdBy: user?.email!
    }),
    onSuccess: (newWorkspace) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setCurrentWorkspace(newWorkspace); // Auto-switch to new workspace
    }
  });
  
  // Rest of implementation...
  
  return (
    <WorkspaceContext.Provider value={{
      currentWorkspace,
      setCurrentWorkspace,
      workspaces,
      workspaceMembers,
      isLoading: isLoadingWorkspaces || isLoadingMembers,
      error,
      refreshWorkspaces: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
      hasPermission,
      createWorkspace: createWorkspaceMutation.mutate,
      isCreatingWorkspace: createWorkspaceMutation.isPending
    }}>
      <WorkspaceErrorBoundary>
        {children}
      </WorkspaceErrorBoundary>
    </WorkspaceContext.Provider>
  );
};
```

Additional State Management Considerations:

- Use a custom hook for workspace-specific state that combines task context and workspace context
- Implement optimistic updates for better UX when working with workspace data
- Use debounced state updates for performance-critical components like Kanban boards
- Properly handle permissions in state to avoid unnecessary API calls
- Use persistent state (localStorage/cookies) for critical user preferences
- Make all components workspace-context-aware through custom hooks

### Integration with Existing MindMate Features

**AI Features Integration:**
```typescript
// Extend your existing enhanceTask AI function in src/ai/flows/enhance-task-flow.ts
export async function enhanceTask(taskDetails: {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  duration?: number;
  timeOfDay?: string;
  // New workspace fields
  workspaceId?: string;
  workspaceName?: string;
  assignees?: string[];
}) {
  // Include workspace context in AI prompt when available
  const workspaceContext = taskDetails.workspaceName 
    ? `This task belongs to the "${taskDetails.workspaceName}" team workspace.` 
    : '';
  
  const assigneeContext = taskDetails.assignees?.length 
    ? `This task is assigned to ${taskDetails.assignees.length} team members.` 
    : '';
  
  // Enhanced AI prompt including workspace context
  const prompt = `
    Task title: ${taskDetails.title}
    Description: ${taskDetails.description || ''}
    Category: ${taskDetails.category || ''}
    Priority: ${taskDetails.priority || ''}
    Duration: ${taskDetails.duration || ''} minutes
    Time of day: ${taskDetails.timeOfDay || ''}
    ${workspaceContext}
    ${assigneeContext}
    
    Please enhance this task with more details, clearer objectives, and any 
    relevant subtasks to make it more actionable and clear for completion.
    ${taskDetails.workspaceId ? 'This is a team task, so ensure the enhancement is clear for all team members.' : ''}
  `;
  
  // Rest of your existing implementation
}
```


```

**Notification System Integration:**
```typescript
// In src/contexts/notification-context.tsx

// Extend your existing notification preferences
interface NotificationPreferences {
  // Existing preferences
  enabled: boolean;
  taskReminders: boolean;
  taskCreation: boolean;
  // New team notification preferences
  workspaceTaskAssignments: boolean;
  workspaceTaskUpdates: boolean;
  workspaceComments: boolean;
  workspaceMentions: boolean;
  workspaceDigest: boolean; // Daily summary
}

// In your notification sending code
export async function sendWorkspaceNotification(
  userEmail: string,
  notification: Omit<NotificationData, 'userEmail'>,
  workspaceId: string
) {
  // Get user's notification preferences
  const prefs = await getUserNotificationPreferences(userEmail);
  
  // Check specific preference based on notification type
  const notifType = notification.type;
  let shouldSend = prefs.enabled; // Base check
  
  if (notifType === 'task_assignment') {
    shouldSend = shouldSend && prefs.workspaceTaskAssignments;
  } else if (notifType === 'task_update') {
    shouldSend = shouldSend && prefs.workspaceTaskUpdates;
  } else if (notifType === 'comment') {
    shouldSend = shouldSend && prefs.workspaceComments;
  } else if (notifType === 'mention') {
    shouldSend = shouldSend && prefs.workspaceMentions;
  }
  
  // Check quiet hours - reuse your existing quiet hours logic
  shouldSend = shouldSend && !isInQuietHours(userEmail);
  
  if (shouldSend) {
    // Add workspace information to notification
    const workspace = await workspaceService.getWorkspaceById(workspaceId);
    const enhancedNotification = {
      ...notification,
      userEmail,
      data: {
        ...notification.data,
        workspaceId,
        workspaceName: workspace?.name
      },
      title: workspace ? `[${workspace.name}] ${notification.title}` : notification.title
    };
    
    // Send using existing notification system
    await notificationService.sendNotification(enhancedNotification);
  }
}
```

**Existing Sharing System Integration:**
```typescript
// Integrate workspace permissions with your existing sharing system
// In src/lib/firestore.ts - sharingService

// Extend createOrGetShareLink to handle workspace items
async createOrGetShareLink(
  itemId: string, 
  itemType: 'task' | 'note' | 'workspace', 
  ownerEmail: string, 
  permission: SharePermission
): Promise<{ shareToken: string; url: string; isNew: boolean }> {
  // Check workspace permissions if this is a workspace item
  if (itemType === 'task') {
    const task = await taskService.getTask(itemId);
    if (task?.workspaceId) {
      // Check if user has share permission for this workspace task
      const canShare = await workspaceMemberService.hasPermission(
        ownerEmail, 
        task.workspaceId, 
        'share', 
        'task'
      );
      
      if (!canShare) {
        throw new Error('You do not have permission to share this task.');
      }
    }
  }
  
  // Rest of your existing implementation
  const sharedItemsRef = collection(db, COLLECTIONS.SHARED_ITEMS);
  // Existing code...
  
  return { shareToken, url, isNew };
}

// When validating access, check workspace permissions
async validateShareAccess(
  token: string, 
  requiredPermission: SharePermission = 'view',
  userEmail?: string
): Promise<{
  isValid: boolean;
  sharedItem?: SharedItem;
  userPermission?: SharePermission;
  error?: string;
}> {
  // Existing validation code
  
  // Additional workspace validation for workspace tasks
  if (sharedItem.itemType === 'task') {
    const task = await taskService.getTask(sharedItem.itemId);
    if (task?.workspaceId && userEmail) {
      // Check workspace membership
      const isMember = await workspaceMemberService.isMember(userEmail, task.workspaceId);
      if (isMember) {
        // Workspace members get their workspace permission level
        const hasPerm = await workspaceMemberService.hasPermission(
          userEmail, 
          task.workspaceId, 
          requiredPermission === 'edit' ? 'edit' : 'view', 
          'task'
        );
        
        if (hasPerm) {
          return { 
            isValid: true, 
            sharedItem, 
            userPermission: hasPerm ? 'edit' : 'view'
          };
        }
      }
    }
  }
  
  // Continue with existing validation
}
```

**Mobile PWA Considerations:**
```typescript
// In your responsive design implementation

// For workspace selector in mobile view
// src/components/workspace-selector.tsx
const WorkspaceSelector = ({ className }: { className?: string }) => {
  const { currentWorkspace, workspaces, setCurrentWorkspace } = useWorkspace();
  const isMobile = useMediaQuery('(max-width: 640px)');
  
  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className={className}>
            <Building2 className="w-4 h-4 mr-2" />
            {currentWorkspace?.name || "Personal"}
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[60vh]">
          <SheetHeader>
            <SheetTitle>Workspaces</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full pt-4">
            <div className="space-y-1">
              <Button
                variant={!currentWorkspace ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setCurrentWorkspace(null)}
              >
                <User className="w-4 h-4 mr-2" />
                Personal
              </Button>
              
              {workspaces.map(workspace => (
                <Button
                  key={workspace.id}
                  variant={currentWorkspace?.id === workspace.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setCurrentWorkspace(workspace)}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  {workspace.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }
  
  // Desktop dropdown version (your existing code)
  return (
    <Select 
      value={currentWorkspace?.id || "personal"}
      onValueChange={(value) => {
        if (value === "personal") {
          setCurrentWorkspace(null);
        } else {
          const workspace = workspaces.find(w => w.id === value);
          if (workspace) setCurrentWorkspace(workspace);
        }
      }}
    >
      {/* Existing SelectTrigger, SelectContent, etc. */}
    </Select>
  );
}
```

**Mobile PWA Considerations:**
- Ensure all team features work seamlessly in mobile PWA mode
- Optimize workspace switching for mobile interfaces
- Maintain offline functionality for workspace tasks
- Ensure responsive design for all team collaboration features

## Professional Implementation Approach

### Excellence in Execution

This implementation requires meticulous attention to detail and professional execution at every stage:

1. **Maintain Design Consistency**
   - Follow MindMate's existing UI component structure
   - Use the same styling variables and design tokens already in the app
   - Ensure all animations match the app's current motion design
   - Maintain consistent spacing, typography, and visual hierarchy

2. **Performance-First Development**
   - Implement virtualization for lists with many items
   - Use memoization for expensive computations
   - Implement proper data fetching patterns with caching
   - Optimize Firebase queries and use aggregation where possible

3. **Code Quality**
   - Maintain consistent naming conventions with the existing codebase
   - Write comprehensive unit and integration tests
   - Use TypeScript types strictly for better reliability
   - Document complex logic and component APIs

4. **User Experience Focus**
   - Design for empty states, loading states, and error states
   - Create helpful onboarding for each new feature
   - Implement progressive disclosure for complex features
   - Ensure features work intuitively without training

5. **Mobile-First Approach**
   - Design for touch interactions first
   - Ensure all features are fully usable on small screens
   - Test on multiple device sizes and orientations
   - Consider network conditions and offline capabilities

6. **Continuous Refinement**
   - Implement each feature iteratively
   - Gather internal feedback after each major component
   - Refine animations and interactions for smoothness
   - Polish visual details for a premium feel

By following this professional approach, the team collaboration features will integrate seamlessly into MindMate, enhancing the product while maintaining its clean, focused experience and exceptional user experience.
