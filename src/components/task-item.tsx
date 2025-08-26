
"use client";

import { useState, useRef, useCallback } from 'react';
import type { Task } from '@/lib/types';
import { useTasks } from '@/contexts/task-context';
import { useTouchGestures } from '@/hooks/use-touch-gestures';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Edit, Trash2, ChevronDown, ChevronUp, RotateCcw, CalendarIcon, Loader2, ExternalLink, Repeat, Plus, Calendar, Archive } from 'lucide-react';
import { TaskForm } from './task-form';
import { SubtaskList } from './subtask-list';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { format } from 'date-fns';
import { useNotifications } from '@/contexts/notification-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCompletionAudio } from '@/hooks/use-completion-audio';
import { ItemActionsDropdown } from './item-actions-dropdown';
import { ShareDialog } from './share-dialog';
import { SharingHistory } from './sharing-history';
import { safeDate, safeDateFormat, isTaskOverdue } from '@/lib/utils';


interface TaskItemProps {
  task: Task;
  extraActions?: React.ReactNode;
  isSubtask?: boolean;
  isHistoryView?: boolean;
  hideSubtaskButton?: boolean;
}

export function TaskItem({ task, extraActions, isSubtask = false, isHistoryView = false, hideSubtaskButton = false, className = "" }: TaskItemProps & { className?: string }) {
  const { tasks, deleteTask, acceptTask, uncompleteTask, startEditingTask } = useTasks();
  const { deleteNotification } = useNotifications();
  const { handleTaskCompletion } = useCompletionAudio();
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareDialog, setShareDialog] = useState<{ isOpen: boolean, itemType: 'task' | 'note', itemTitle: string, itemId: string } | null>(null);
  const [showSharingHistory, setShowSharingHistory] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const router = useRouter();
  const completeButtonRef = useRef<HTMLButtonElement>(null);

  // Touch gesture handlers
  const gestureHandlers = useTouchGestures({
    onSwipeRight: () => {
      if (!task.completedAt && !isHistoryView) {
        setSwipeDirection('right');
        setTimeout(() => {
          // handleComplete();
          setSwipeDirection(null);
        }, 300);
      }
    },
    onSwipeLeft: () => {
      if (!isHistoryView) {
        setSwipeDirection('left');
        setTimeout(() => {
          // handleDelete();
          setSwipeDirection(null);
        }, 300);
      }
    },
    onDoubleTap: () => {
      if (!isSubtask) {
        router.push(`/task/${task.id}`);
      }
    },
    onLongPress: () => {
      if (!isHistoryView) {
        handleEdit();
      }
    },
  });

  const subtasks = tasks.filter(t => t.parentId === task.id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const pendingSubtasks = subtasks.filter(t => !t.completedAt);
  const hasPendingSubtasks = pendingSubtasks.length > 0;

  const handleComplete = async () => {
    setIsCompleting(true);
    await acceptTask(task.id, {
      onComplete: () => handleTaskCompletion(completeButtonRef.current)
    });
    // Notification deletion is now handled in acceptTask
    setIsCompleting(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await deleteTask(task.id);
    // Notification deletion is now handled in deleteTask
    setIsDeleting(false);
  };

  const handleShare = () => {
    setShareDialog({ isOpen: true, itemType: 'task', itemTitle: task.title, itemId: task.id });
  };

  const handleEdit = () => {
    startEditingTask(task.id);
  };

  const handleUncomplete = async () => {
    await uncompleteTask(task.id);
    if (isHistoryView) {
      router.push(`/task/${task.id}`);
    }
  };

  const CompleteButton = useCallback(() => (
    <Button ref={completeButtonRef} variant="outline" size="sm" onClick={handleComplete} disabled={isCompleting}>
      {isCompleting ? <Loader2 className="h-4 w-4 animate-spin md:mr-2" /> : <Check className="h-4 w-4 md:mr-2" />}
      <span className="hidden md:inline">Complete</span>
    </Button>
  ), [isCompleting, handleComplete, completeButtonRef]);

  const RedoButton = () => (
    <Button variant="ghost" size="sm" onClick={handleUncomplete}>
      <RotateCcw className="mr-2 h-4 w-4" />
      Redo
    </Button>
  );

  const isOnTaskPage = typeof window !== 'undefined' && window.location.pathname?.includes('/task/');

  if (isOnTaskPage && !isHistoryView) {
    return (
      <>
        {extraActions}
        {!isSubtask && subtasks.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowSubtasks(!showSubtasks)}>
            {showSubtasks ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
            <span className="hidden md:inline">Subtasks</span>
            <span className="md:ml-1">({pendingSubtasks.length})</span>
          </Button>
        )}

        {!isSubtask && subtasks.length === 0 && !hideSubtaskButton && (
          <Button variant="ghost" size="sm" onClick={() => setShowAddSubtask(!showAddSubtask)}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Add Subtask</span>
          </Button>
        )}

        {!hasPendingSubtasks && !isSubtask && <CompleteButton />}
        {hasPendingSubtasks && !isSubtask && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}><CompleteButton /></span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Complete all sub-tasks first.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {isSubtask && <CompleteButton />}

        <Button variant="ghost" size="icon" onClick={() => startEditingTask(task.id)} disabled={isDeleting || isCompleting}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting || isCompleting}>
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin text-destructive" /> : <Trash2 className="h-4 w-4 text-destructive" />}
        </Button>
      </>
    );
  }

  if (isOnTaskPage && isHistoryView) {
    return <RedoButton />;
  }

  // Destructure gesture handlers to separate DOM props from state
  const { isLongPressed, ...touchHandlers } = gestureHandlers;

  return (
    <Card 
      className={`
        ${isSubtask ? "border-l-4 border-primary/20 mx-2" : ""} 
        group hover:shadow-lg transition-all duration-300 
        ${swipeDirection === 'right' ? 'transform translate-x-2 bg-green-50 border-green-200' : ''}
        ${swipeDirection === 'left' ? 'transform -translate-x-2 bg-red-50 border-red-200' : ''}
        ${isLongPressed ? 'scale-98 shadow-xl' : ''}
        ${task.completedAt ? 'opacity-75' : ''}
        overflow-hidden
        ${className}
      `}
      {...touchHandlers}
    >
      {/* Mobile-optimized header */}
      <div className={`${isSubtask ? "p-3" : "p-4"} pb-2`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Priority indicator */}
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${
                task.priority === 'Critical' ? 'bg-red-500' :
                task.priority === 'High' ? 'bg-orange-500' :
                task.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
              }`} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {task.category}
              </span>
              {task.isArchived && (
                <Badge variant="secondary" className="ml-2 text-xs flex items-center gap-1 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-600 dark:text-white dark:border-orange-600">
                  <Archive className="w-3 h-3 text-orange-600 dark:text-white" />
                  <span className="leading-none">Archived</span>
                </Badge>
              )}
            </div>

            {/* Title - mobile optimized */}
            {(() => {
              const urlRegex = /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(\:\d+)?(\/[\-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(#[\-a-z\d_]*)?$/i;
              if (urlRegex.test(task.title)) {
                const url = task.title.startsWith('http') ? task.title : `https://${task.title}`;
                return (
                  <h3 className={`${isSubtask ? "text-base" : "text-lg"} font-semibold leading-tight mb-1 ${task.completedAt ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-800 underline break-all"
                    >
                      {task.title}
                    </a>
                  </h3>
                );
              }
              return (
                <h3 className={`${isSubtask ? "text-base" : "text-lg"} font-semibold leading-tight mb-1 ${task.completedAt ? "line-through text-muted-foreground" : "text-foreground"} break-words`}>
                  {task.title}
                </h3>
              );
            })()}
            
            {task.description && (
              <p className={`text-sm leading-relaxed ${task.completedAt ? "line-through text-muted-foreground" : "text-muted-foreground"} line-clamp-2`}>
                {task.description}
              </p>
            )}
            
            {task.completedAt && isHistoryView && (
              <p className="text-xs text-green-600 font-medium mt-1">
                ✓ Completed
              </p>
            )}
          </div>

          {/* Mobile-optimized actions - always visible on mobile */}
          <div className="flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity duration-200">
            <ItemActionsDropdown
              item={task}
              itemType="task"
              onShare={handleShare}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isDeleting={isDeleting}
              disabled={isCompleting}
              showExternalLink={!isSubtask}
            />
          </div>
        </div>
      </div>

      {/* Mobile-optimized metadata section */}
      {!isHistoryView && (
        <div className={`${isSubtask ? "px-3" : "px-4"} pb-3`}>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Overdue badge - shows first for high visibility */}
            {!task.completedAt && isTaskOverdue(task.reminderAt) && (
              <Badge 
                variant="destructive" 
                className="text-xs font-medium bg-red-600 text-white border-red-600 animate-pulse"
              >
                🚨 Overdue
              </Badge>
            )}
            
            {/* Priority badge with icon */}
            <Badge
              variant={
                task.priority === 'Critical' ? 'destructive' :
                task.priority === 'High' ? 'default' :
                task.priority === 'Medium' ? 'outline' : 'secondary'
              }
              className="text-xs font-medium"
            >
              {task.priority}
            </Badge>
            
            {/* Duration with better mobile display */}
            <Badge variant="outline" className="text-xs">
              ⏱️ {task.duration}m
            </Badge>
            
            {/* Time of day */}
            <Badge variant="secondary" className="text-xs">
              🕒 {task.timeOfDay}
            </Badge>
            
            {/* Reminder */}
            {task.reminderAt && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                📅 {safeDateFormat(task.reminderAt, "MMM d", "Invalid")}
              </Badge>
            )}
            
            {/* Recurrence indicator */}
            {task.recurrence && task.recurrence.frequency !== 'none' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs flex items-center gap-1 cursor-default capitalize">
                      🔄 {task.recurrence.frequency}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {task.recurrence.endDate ? 
                      `Repeats ${task.recurrence.frequency} until ${safeDateFormat(task.recurrence.endDate, "MMM d, yyyy", "Invalid date")}` :
                      `Repeats ${task.recurrence.frequency}`
                    }
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Google Calendar sync status */}
            {task.syncToGoogleCalendar && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant={task.googleCalendarSyncStatus === 'synced' ? 'default' : 
                               task.googleCalendarSyncStatus === 'error' ? 'destructive' : 'secondary'} 
                      className="text-xs flex items-center gap-1 cursor-default"
                    >
                      <Calendar className="h-3 w-3" />
                      {task.googleCalendarSyncStatus === 'synced' ? 'Synced' :
                       task.googleCalendarSyncStatus === 'error' ? 'Sync Error' :
                       task.googleCalendarSyncStatus === 'pending' ? 'Syncing...' : 'Google Cal'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      {task.googleCalendarSyncStatus === 'synced' && (
                        <>
                          <p>Synced with Google Calendar</p>
                          {task.googleCalendarUrl && (
                            <p className="text-blue-600 underline cursor-pointer mt-1"
                               onClick={() => window.open(task.googleCalendarUrl, '_blank')}>
                              Open in Google Calendar
                            </p>
                          )}
                        </>
                      )}
                      {task.googleCalendarSyncStatus === 'error' && (
                        <p>Failed to sync: {task.googleCalendarError || 'Unknown error'}</p>
                      )}
                      {task.googleCalendarSyncStatus === 'pending' && (
                        <p>Syncing with Google Calendar...</p>
                      )}
                      {!task.googleCalendarSyncStatus && (
                        <p>Scheduled for Google Calendar sync</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      )}

      {/* Mobile-optimized footer */}
      {!isHistoryView && (
        <div className={`flex items-center justify-between gap-2 border-t bg-muted/20 ${isSubtask ? 'px-3 py-2' : 'px-4 py-3'}`}>
          <div className="flex items-center gap-2">
            {/* Subtask indicator */}
            {!isSubtask && subtasks.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowSubtasks(!showSubtasks)}
                className="h-8 px-2 text-xs"
              >
                {showSubtasks ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {pendingSubtasks.length} subtasks
              </Button>
            )}

            {/* Add subtask button for tasks without subtasks - mobile optimized to show only icon */}
            {!isSubtask && subtasks.length === 0 && !hideSubtaskButton && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAddSubtask(!showAddSubtask)}
                className="h-8 w-8 p-0 sm:w-auto sm:px-2"
                title="Add Subtask"
              >
                <Plus className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline text-xs">Add Subtask</span>
              </Button>
            )}
            
            {/* View detail button for mobile */}
            {!isSubtask && (
              <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
                <Link href={`/task/${task.id}`}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Details
                </Link>
              </Button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {extraActions}
            
            {/* Google Calendar action button */}
            {task.syncToGoogleCalendar && task.googleCalendarUrl && task.googleCalendarSyncStatus === 'synced' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => window.open(task.googleCalendarUrl, '_blank')}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Calendar className="h-4 w-4" />
                      <span className="sr-only">Open in Google Calendar</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open in Google Calendar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Complete button - prominent on mobile */}
            {!task.completedAt && !hasPendingSubtasks && (
              <Button 
                ref={completeButtonRef}
                onClick={handleComplete}
                disabled={isCompleting || isDeleting}
                size="sm"
                className="h-8 px-3 text-xs font-medium bg-green-600 hover:bg-green-700 text-white"
              >
                {isCompleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Done
                  </>
                )}
              </Button>
            )}
            
            {/* Disabled complete button with tooltip */}
            {!task.completedAt && hasPendingSubtasks && !isSubtask && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      disabled
                      size="sm"
                      className="h-8 px-3 text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Done
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Complete all subtasks first</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      )}

      {/* Subtasks display */}
      {showSubtasks && !isSubtask && !isHistoryView && (
        <div className="border-t bg-muted/10">
          <div className="p-4">
            <SubtaskList parentTask={task} subtasks={subtasks} />
          </div>
        </div>
      )}

      {/* Add subtask form */}
      {showAddSubtask && !isSubtask && !isHistoryView && (
        <div className="border-t bg-muted/10">
          <div className="p-4">
            <TaskForm 
              parentId={task.id}
              onFinished={() => setShowAddSubtask(false)}
            />
          </div>
        </div>
      )}

      {/* Share Dialog */}
      {shareDialog && (
        <ShareDialog
          isOpen={shareDialog.isOpen}
          onClose={() => setShareDialog(null)}
          itemType={shareDialog.itemType}
          itemTitle={shareDialog.itemTitle}
          itemId={shareDialog.itemId}
        />
      )}
      
      {/* Sharing History */}
      {showSharingHistory && (
        <SharingHistory
          isOpen={showSharingHistory}
          onClose={() => setShowSharingHistory(false)}
          itemId={task.id}
          itemType="task"
          itemTitle={task.title}
        />
      )}
    </Card>
  );
}
