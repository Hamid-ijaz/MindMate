"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Eye, 
  Edit3, 
  Lock, 
  Share2, 
  User, 
  Clock, 
  AlertTriangle,
  CheckSquare,
  FileText,
  Loader2,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  PlusCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { sharingService, taskService, noteService } from '@/lib/firestore';
import type { SharedItem, Task, Note, SharePermission } from '@/lib/types';
import { motion } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { TaskForm } from '@/components/task-form';
import { EditNoteDialog } from '@/components/notes/edit-note-dialog';
import { TaskItem } from '@/components/task-item';
import { SubtaskList } from '@/components/subtask-list';
import { useTasks } from '@/contexts/task-context';
import { useNotes } from '@/contexts/note-context';
import { safeDateFormat, isTaskOverdue } from '@/lib/utils';

interface SharedContentPageProps {
  params: {
    itemType: 'task' | 'note';
    itemId: string;
  };
}

function SharedContentContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { taskCategories, taskDurations } = useTasks();
  const { updateNote: updateNoteLocal } = useNotes();

  const itemType = params.itemType as 'task' | 'note';
  const itemId = params.itemId as string;
  const token = searchParams.get('token');
  const permission = searchParams.get('permission') as SharePermission;

  const [sharedItem, setSharedItem] = useState<SharedItem | null>(null);
  const [content, setContent] = useState<Task | Note | null>(null);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [showAddSubtask, setShowAddSubtask] = useState(false);

  // For note editing using the EditNoteDialog
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useEffect(() => {
    if (token && itemId) {
      loadSharedContent();
    } else {
      setError('Invalid share link');
      setIsLoading(false);
    }
  }, [token, itemId, user]);

  const loadSharedContent = async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validate share access
      const validationResult = await sharingService.validateShareAccess(
        token,
        'view',
        user?.email
      );

      if (!validationResult.isValid) {
        setError(validationResult.error || 'Access denied');
        setIsLoading(false);
        return;
      }

      setSharedItem(validationResult.sharedItem!);
      setAccessGranted(true);

      // Record view
      await sharingService.recordView(
        token,
        user?.email,
        user ? `${user.firstName} ${user.lastName}` : undefined
      );

      // Load the actual content
      let itemContent;
      if (itemType === 'task') {
        itemContent = await taskService.getTask(itemId);
        
        // Load subtasks for tasks
        if (itemContent) {
          const allTasks = await taskService.getTasks(itemContent.userEmail);
          const taskSubtasks = allTasks.filter(t => t.parentId === itemId).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          setSubtasks(taskSubtasks);
        }
      } else {
        itemContent = await noteService.getNote(itemId);
      }

      if (!itemContent) {
        setError('Content not found');
        return;
      }

      setContent(itemContent);
      
    } catch (error) {
      console.error('Error loading shared content:', error);
      setError('Failed to load shared content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!token) return;

    // Check edit permission before allowing edit
    const validationResult = await sharingService.validateShareAccess(
      token,
      'edit',
      user?.email
    );

    if (!validationResult.isValid) {
      toast({
        title: "Access Denied",
        description: validationResult.error || "You don't have edit permission",
        variant: "destructive"
      });
      return;
    }

    // Record the start of edit session
    if (user) {
      await sharingService.addHistoryEntry(token, {
        userId: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        action: itemType === 'note' ? 'note_edit_started' : 'task_edit_started',
        details: `Started editing the shared ${itemType}`
      });
    }

    if (itemType === 'note') {
      setEditingNote(content as Note);
    } else {
      setIsEditing(true);
    }
  };

  const handleTaskSave = async (taskData: Partial<Task>) => {
    if (!content || !token || !user) return;

    setIsSaving(true);
    try {
      // Track what fields were changed for better history tracking
      const changedFields = [];
      const originalTask = content as Task;
      
      if (taskData.title && taskData.title !== originalTask.title) changedFields.push('title');
      if (taskData.description !== originalTask.description) changedFields.push('description');
      if (taskData.category && taskData.category !== originalTask.category) changedFields.push('category');
      if (taskData.priority && taskData.priority !== originalTask.priority) changedFields.push('priority');
      if (taskData.duration && taskData.duration !== originalTask.duration) changedFields.push('duration');
      if (taskData.timeOfDay && taskData.timeOfDay !== originalTask.timeOfDay) changedFields.push('timeOfDay');
      if (taskData.reminderAt !== originalTask.reminderAt) changedFields.push('reminder');

      // Update the task
      await taskService.updateTask(itemId, taskData);

      // Record the edit action with detailed information
      await sharingService.addHistoryEntry(token, {
        userId: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        action: 'task_content_edited',
        details: changedFields.length > 0 
          ? `Modified task fields: ${changedFields.join(', ')}` 
          : 'Updated task details'
      });

      // Reload the content to get the updated version
      const updatedContent = await taskService.getTask(itemId);
      
      if (updatedContent) {
        setContent(updatedContent);
      }
      
      setIsEditing(false);
      
      toast({
        title: "Changes saved!",
        description: "The task has been updated successfully"
      });

    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        title: "Save failed",
        description: "Failed to save your changes",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubtaskAdd = async (subtaskData: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt' | 'notifiedAt'>) => {
    if (!content || !token || !user) return;

    try {
      // Add the subtask
      await taskService.addTask(content.userEmail, {
        ...subtaskData,
        parentId: itemId,
        rejectionCount: 0,
        isMuted: false,
        createdAt: Date.now(),
      });

      // Record the action
      await sharingService.addHistoryEntry(token, {
        userId: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        action: 'subtask_added',
        details: `Added subtask: ${subtaskData.title}`
      });

      // Reload subtasks
  const allTasks = await taskService.getTasks(content.userEmail);
  const taskSubtasks = allTasks.filter(t => t.parentId === itemId).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  setSubtasks(taskSubtasks);
      setShowAddSubtask(false);

      toast({
        title: "Subtask added!",
        description: "The subtask has been created successfully"
      });

    } catch (error) {
      console.error('Error adding subtask:', error);
      toast({
        title: "Add failed",
        description: "Failed to add the subtask",
        variant: "destructive"
      });
    }
  };

  const handleSubtaskUpdate = async (subtaskId: string, updates: Partial<Task>) => {
    if (!content || !token || !user) return;

    try {
      // Update the subtask
      await taskService.updateTask(subtaskId, updates);

      // Record the action
      await sharingService.addHistoryEntry(token, {
        userId: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        action: 'subtask_edited',
        details: `Modified subtask: ${updates.title || 'details updated'}`
      });

      // Reload subtasks
  const allTasks = await taskService.getTasks(content.userEmail);
  const taskSubtasks = allTasks.filter(t => t.parentId === itemId).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  setSubtasks(taskSubtasks);

      toast({
        title: "Subtask updated!",
        description: "The subtask has been updated successfully"
      });

    } catch (error) {
      console.error('Error updating subtask:', error);
      toast({
        title: "Update failed",
        description: "Failed to update the subtask",
        variant: "destructive"
      });
    }
  };

  const handleSubtaskDelete = async (subtaskId: string) => {
    if (!content || !token || !user) return;

    try {
      // Get subtask details before deletion for history
      const subtaskToDelete = subtasks.find(s => s.id === subtaskId);
      
      // Delete the subtask
      await taskService.deleteTask(subtaskId);

      // Record the action
      await sharingService.addHistoryEntry(token, {
        userId: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        action: 'subtask_deleted',
        details: `Deleted subtask: ${subtaskToDelete?.title || 'Unknown'}`
      });

      // Update local state
      setSubtasks(prev => prev.filter(s => s.id !== subtaskId));

      toast({
        title: "Subtask deleted!",
        description: "The subtask has been deleted successfully"
      });

    } catch (error) {
      console.error('Error deleting subtask:', error);
      toast({
        title: "Delete failed",
        description: "Failed to delete the subtask",
        variant: "destructive"
      });
    }
  };

  const handleSubtaskComplete = async (subtaskId: string) => {
    if (!content || !token || !user) return;

    try {
      // Get subtask details for history
      const subtaskToComplete = subtasks.find(s => s.id === subtaskId);
      
      // Complete the subtask
      await taskService.updateTask(subtaskId, { 
        completedAt: Date.now() 
      });

      // Record the action
      await sharingService.addHistoryEntry(token, {
        userId: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        action: 'subtask_completed',
        details: `Completed subtask: ${subtaskToComplete?.title || 'Unknown'}`
      });

      // Reload subtasks to get updated state
  const allTasks = await taskService.getTasks(content.userEmail);
  const taskSubtasks = allTasks.filter(t => t.parentId === itemId).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  setSubtasks(taskSubtasks);

      toast({
        title: "Subtask completed!",
        description: "Great job! The subtask has been marked as complete"
      });

    } catch (error) {
      console.error('Error completing subtask:', error);
      toast({
        title: "Complete failed",
        description: "Failed to complete the subtask",
        variant: "destructive"
      });
    }
  };

  const handleSubtaskReopen = async (subtaskId: string) => {
    if (!content || !token || !user) return;

    try {
      // Get subtask details for history
      const subtaskToReopen = subtasks.find(s => s.id === subtaskId);
      
      // Reopen the subtask
      await taskService.updateTask(subtaskId, { 
        completedAt: null 
      });

      // Record the action
      await sharingService.addHistoryEntry(token, {
        userId: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        action: 'subtask_reopened',
        details: `Reopened subtask: ${subtaskToReopen?.title || 'Unknown'}`
      });

      // Reload subtasks to get updated state
      const allTasks = await taskService.getTasks(content.userEmail);
  const taskSubtasks = allTasks.filter(t => t.parentId === itemId).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  setSubtasks(taskSubtasks);

      toast({
        title: "Subtask reopened!",
        description: "The subtask has been marked as pending"
      });

    } catch (error) {
      console.error('Error reopening subtask:', error);
      toast({
        title: "Reopen failed",
        description: "Failed to reopen the subtask",
        variant: "destructive"
      });
    }
  };

  const handleNoteClose = async () => {
    setEditingNote(null);
    
    // Record view action when note editing is closed (in case changes were made)
    if (token && user) {
      await sharingService.addHistoryEntry(token, {
        userId: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        action: 'note_edit_session_ended',
        details: 'Finished editing the shared note'
      });
    }
    
    // Reload the note content to get any updates
    loadSharedContent();
  };

  const copyShareLink = async () => {
    const shareUrl = window.location.href;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Link copied to clipboard!" });
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          toast({ title: "Link copied to clipboard!" });
        } else {
          toast({ 
            title: "Copy failed", 
            description: "Please copy the URL manually from the address bar",
            variant: "destructive" 
          });
        }
      }
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      toast({ 
        title: "Copy failed", 
        description: "Please copy the URL manually from the address bar",
        variant: "destructive" 
      });
    }
  };

  const getPermissionIcon = (perm: SharePermission) => {
    switch (perm) {
      case 'view': return <Eye className="h-4 w-4" />;
      case 'edit': return <Edit3 className="h-4 w-4" />;
      default: return <Lock className="h-4 w-4" />;
    }
  };

  const getPermissionColor = (perm: SharePermission) => {
    switch (perm) {
      case 'view': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'edit': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading shared content...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !accessGranted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <h2 className="text-lg font-semibold">Access Denied</h2>
                <p className="text-muted-foreground mt-2">
                  {error || 'You do not have permission to view this content'}
                </p>
              </div>
              {!user && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You may need to sign in to access this content
                  </p>
                  <Button onClick={() => window.location.href = '/login'}>
                    Sign In
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main content view
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {itemType === 'task' ? (
                <CheckSquare className="h-8 w-8 text-primary" />
              ) : (
                <FileText className="h-8 w-8 text-primary" />
              )}
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Shared {itemType === 'task' ? 'Task' : 'Note'}
                </h1>
                <p className="text-muted-foreground">
                  Shared by {sharedItem?.ownerName} • {sharedItem?.viewCount || 0} views
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge 
                variant="outline" 
                className={`${getPermissionColor(sharedItem?.permission || 'view')} px-3 py-1`}
              >
                {getPermissionIcon(sharedItem?.permission || 'view')}
                <span className="ml-1 capitalize">{sharedItem?.permission}</span>
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={copyShareLink}
                className="shrink-0"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Task Content */}
          {itemType === 'task' && (
            <div className="space-y-6">
              {isEditing ? (
                <Card className="bg-secondary/50 border-2 border-primary/20">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Edit3 className="h-5 w-5" />
                        Edit Task
                      </h3>
                      <Button 
                        onClick={() => setIsEditing(false)} 
                        variant="outline" 
                        size="sm"
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                    </div>
                    <TaskForm 
                      task={content as Task}
                      onFinished={() => setIsEditing(false)}
                      defaultValues={{
                        title: (content as Task).title,
                        description: (content as Task).description,
                        category: (content as Task).category,
                        priority: (content as Task).priority,
                        duration: (content as Task).duration,
                        timeOfDay: (content as Task).timeOfDay,
                        reminderAt: (content as Task).reminderAt ? new Date((content as Task).reminderAt!) : undefined,
                        recurrence: (content as Task).recurrence ? {
                          frequency: (content as Task).recurrence!.frequency,
                          endDate: (content as Task).recurrence!.endDate && typeof (content as Task).recurrence!.endDate === 'number' 
                            ? new Date((content as Task).recurrence!.endDate as number) 
                            : undefined
                        } : { frequency: 'none' },
                      }}
                      customSaveHandler={handleTaskSave}
                    />
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Main Task Display - Professional Card Design */}
                  <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-lg">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-2xl font-bold leading-tight break-words mb-2">
                            {(content as Task).title}
                          </CardTitle>
                          {(content as Task).description && (
                            <CardDescription className="text-base leading-relaxed">
                              {(content as Task).description}
                            </CardDescription>
                          )}
                        </div>
                        {sharedItem?.permission === 'edit' && (
                          <Button 
                            onClick={handleEdit} 
                            size="sm"
                            disabled={isSaving}
                            className="flex-shrink-0"
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Edit3 className="h-4 w-4 mr-2" />
                                Edit
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      {/* Task Metadata */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {isTaskOverdue((content as Task).reminderAt) && (
                          <Badge variant="destructive" className="font-medium animate-pulse">
                            🚨 Overdue
                          </Badge>
                        )}
                        <Badge variant="secondary" className="font-medium">
                          {(content as Task).category}
                        </Badge>
                        <Badge
                          variant={
                            (content as Task).priority === 'Critical' ? 'destructive' :
                            (content as Task).priority === 'High' ? 'default' :
                            (content as Task).priority === 'Medium' ? 'outline' : 'secondary'
                          }
                          className="font-medium"
                        >
                          {(content as Task).priority} Priority
                        </Badge>
                        <Badge variant="secondary" className="font-medium">
                          <Clock className="h-3 w-3 mr-1" />
                          {(content as Task).duration} min
                        </Badge>
                        <Badge variant="secondary" className="font-medium">
                          {(content as Task).timeOfDay}
                        </Badge>
                        {(content as Task).reminderAt && (
                          <Badge variant="outline" className="font-medium">
                            Reminder: {safeDateFormat((content as Task).reminderAt, "MMM d, h:mm a", "Invalid date")}
                          </Badge>
                        )}
                      </div>

                      {/* Sharing Info */}
                      <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          <span>{sharedItem?.viewCount || 0} views</span>
                          <span>•</span>
                          <span>Created {formatDistanceToNow(new Date((content as Task).createdAt), { addSuffix: true })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>Shared by {sharedItem?.ownerName}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Subtasks Section */}
                  {subtasks.length > 0 && (
                    <Card className="border border-muted">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => setShowSubtasks(!showSubtasks)}
                              className="flex items-center gap-2 font-semibold p-0 h-auto hover:bg-transparent"
                            >
                              {showSubtasks ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              <span className="text-lg">Subtasks</span>
                              <Badge variant="outline" className="ml-2">
                                {subtasks.length}
                              </Badge>
                            </Button>
                          </div>
                          {sharedItem?.permission === 'edit' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAddSubtask(true)}
                            >
                              <PlusCircle className="h-4 w-4 mr-2" />
                              Add Subtask
                            </Button>
                          )}
                        </div>
                      </CardHeader>

                      {showSubtasks && (
                        <CardContent className="pt-0">
                          <SubtaskList 
                            parentTask={content as Task}
                            subtasks={subtasks}
                            isSharedView={true}
                            canEdit={sharedItem?.permission === 'edit'}
                            onSubtaskUpdate={handleSubtaskUpdate}
                            onSubtaskDelete={handleSubtaskDelete}
                            onSubtaskComplete={handleSubtaskComplete}
                            onSubtaskReopen={handleSubtaskReopen}
                          />
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* Add Subtask Form */}
                  {showAddSubtask && sharedItem?.permission === 'edit' && (
                    <Card className="bg-secondary/50 border-2 border-primary/20">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold flex items-center gap-2">
                            <PlusCircle className="h-4 w-4" />
                            New Subtask for "{content?.title}"
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAddSubtask(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                        <TaskForm
                          parentId={itemId}
                          onFinished={() => setShowAddSubtask(false)}
                          defaultValues={{
                            category: (content as Task).category,
                            timeOfDay: (content as Task).timeOfDay,
                          }}
                          customAddHandler={handleSubtaskAdd}
                        />
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {/* Note Content */}
          {itemType === 'note' && !isEditing && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Shared Note
                  </span>
                </div>
                {sharedItem?.permission === 'edit' && (
                  <Button 
                    onClick={handleEdit} 
                    size="sm"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Note Card */}
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{content?.title}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      <span>{sharedItem?.viewCount || 0} views</span>
                      <span>•</span>
                      <span>Shared by {sharedItem?.ownerName}</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Note content with better typography */}
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: (content as Note)?.content || 'No content available' 
                      }} 
                      className="min-h-[100px]"
                      style={{ fontSize: `${(content as Note)?.fontSize || 14}px` }}
                    />
                  </div>

                  {/* Note attachments */}
                  {((content as Note)?.imageUrl || (content as Note)?.audioUrl) && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground">Attachments</h3>
                      
                      {(content as Note)?.imageUrl && (
                        <div className="border rounded-lg overflow-hidden">
                          <img 
                            src={(content as Note).imageUrl || ''} 
                            alt="Note attachment"
                            className="max-w-full h-auto"
                          />
                        </div>
                      )}

                      {(content as Note)?.audioUrl && (
                        <div className="border rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-2">Audio Recording</p>
                          <audio controls className="w-full">
                            <source src={(content as Note).audioUrl || ''} type="audio/wav" />
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}
                    </div>
                  )}

                </CardContent>
              </Card>
            </div>
          )}

          {/* Metadata Section - moved outside the main content card */}
        </motion.div>

        {/* Share info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <Alert className="border-primary/20 bg-primary/5">
            <Share2 className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              This {itemType} is being shared with{' '}
              <span className="font-semibold text-primary">{sharedItem?.permission}</span> access.{' '}
              {sharedItem?.permission === 'edit' 
                ? 'You can make changes to this content.' 
                : 'You can view but cannot edit this content.'}
            </AlertDescription>
          </Alert>
          
          {/* Additional metadata */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4 border-t">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                Created {formatDistanceToNow(content?.createdAt || Date.now())} ago
              </span>
            </div>
            {('updatedAt' in content! && content.updatedAt && content.updatedAt !== content.createdAt) && (
              <div className="flex items-center gap-1">
                <span>•</span>
                <span>
                  Updated {formatDistanceToNow(content.updatedAt)} ago
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Note Edit Dialog */}
      {editingNote && (
        <EditNoteDialog
          note={editingNote}
          isOpen={!!editingNote}
          onClose={handleNoteClose}
          shareToken={token || undefined}
          sharedBy={user ? { email: user.email, name: `${user.firstName} ${user.lastName}` } : undefined}
        />
      )}
    </div>
  );
}

export default function SharedContentPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <Card className="border shadow-md">
          <CardHeader className="pb-4 space-y-1">
            <CardTitle className="text-xl">Loading shared content...</CardTitle>
            <CardDescription>Please wait</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    }>
      <SharedContentContent />
    </Suspense>
  );
}
