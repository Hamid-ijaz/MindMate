
"use client";

import { useState, useRef, useCallback } from 'react';
import type { Task } from '@/lib/types';
import { useTasks } from '@/contexts/task-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Edit, Trash2, ChevronDown, ChevronUp, RotateCcw, CalendarIcon, Loader2, ExternalLink, Repeat } from 'lucide-react';
import { TaskForm } from './task-form';
import { SubtaskList } from './subtask-list';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { format } from 'date-fns';
import { useNotifications } from '@/contexts/notification-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCompletionAudio } from '@/hooks/use-completion-audio';


interface TaskItemProps {
  task: Task;
  extraActions?: React.ReactNode;
  isSubtask?: boolean;
  isHistoryView?: boolean;
}

export function TaskItem({ task, extraActions, isSubtask = false, isHistoryView = false }: TaskItemProps) {
  const { tasks, deleteTask, acceptTask, uncompleteTask, startEditingTask } = useTasks();
  const { deleteNotification } = useNotifications();
  const { handleTaskCompletion } = useCompletionAudio();
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const completeButtonRef = useRef<HTMLButtonElement>(null);

  const subtasks = tasks.filter(t => t.parentId === task.id);
  const pendingSubtasks = subtasks.filter(t => !t.completedAt);
  const hasPendingSubtasks = pendingSubtasks.length > 0;

  const handleComplete = async () => {
    setIsCompleting(true);
    await acceptTask(task.id, {
      onComplete: () => handleTaskCompletion(completeButtonRef.current)
    });
    await deleteNotification(task.id);
    setIsCompleting(false);
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    await deleteTask(task.id);
    await deleteNotification(task.id);
    setIsDeleting(false);
  }

  const handleUncomplete = async () => {
    await uncompleteTask(task.id);
    if(isHistoryView) {
        router.push(`/task/${task.id}`);
    }
  }

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

  // If we are on the task detail page, we don't need to render the full card again.
  // We just provide the action buttons. This logic is a bit of a hack.
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
     )
  }

   if (isOnTaskPage && isHistoryView) {
       return <RedoButton />;
   }


  return (
    <Card className={isSubtask ? "border-l-4 border-primary/20" : ""}>
      <div className={isSubtask ? "p-3" : "p-6"}>
        <CardTitle className={`${isSubtask ? "font-semibold text-base" : "text-lg"} ${task.completedAt ? "line-through text-muted-foreground" : ""} break-word`}>{task.title}</CardTitle>
        {task.description && <CardDescription className="pt-1">{task.description}</CardDescription>}
        {task.completedAt && isHistoryView && (
            <CardDescription className="text-xs pt-1">
                Completed
            </CardDescription>
        )}
      </div>
       {!isHistoryView && (
        <>
            <CardContent className={`flex flex-wrap gap-2 ${isSubtask ? 'px-3 pt-0 pb-2' : 'p-6 pt-0'}`}>
                <Badge variant="secondary">{task.category}</Badge>
                <Badge variant="secondary">{task.energyLevel} Energy</Badge>
                <Badge variant="secondary">{task.duration} min</Badge>
                <Badge variant="secondary">{task.timeOfDay}</Badge>
                {task.reminderAt && (
                   <Badge variant="outline" className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {format(new Date(task.reminderAt), "MMM d, h:mm a")}
                   </Badge>
                )}
                {task.recurrence && task.recurrence.frequency !== 'none' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <Badge variant="outline" className="flex items-center gap-1 cursor-default capitalize">
                            <Repeat className="h-3 w-3" />
                            {task.recurrence.frequency}
                         </Badge>
                      </TooltipTrigger>
                       <TooltipContent>
                          {task.recurrence.endDate ? `Repeats ${task.recurrence.frequency} until ${format(new Date(task.recurrence.endDate), "MMM d, yyyy")}` : `Repeats ${task.recurrence.frequency}`}
                       </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
            </CardContent>
            <CardFooter className={`flex flex-wrap justify-end gap-2 ${isSubtask ? 'px-3 pb-3 pt-0' : 'p-6 pt-0'}`}>
                {extraActions}
                {!isSubtask && (
                     <Button variant="ghost" size="sm" asChild>
                        <Link href={`/task/${task.id}`}>
                            <ExternalLink className="h-4 w-4 md:mr-2"/>
                             <span className="hidden md:inline">View</span>
                        </Link>
                     </Button>
                )}
                {!isSubtask && subtasks.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setShowSubtasks(!showSubtasks)}>
                    {showSubtasks ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                    <span className="hidden md:inline">Subtasks</span>
                    <span className="md:ml-1">({pendingSubtasks.length})</span>
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
            </CardFooter>
        </>
       )}
       {isHistoryView && (
            <CardFooter className={`flex justify-end gap-2 ${isSubtask ? 'px-3 pb-3 pt-0' : 'p-6 pt-0'}`}>
                 <Button variant="ghost" size="sm" asChild>
                    <Link href={`/task/${task.id}`}>
                        <ExternalLink className="h-4 w-4 md:mr-2"/>
                            <span className="hidden md:inline">View Details</span>
                    </Link>
                </Button>
                <RedoButton />
            </CardFooter>
       )}
      {showSubtasks && !isSubtask && !isHistoryView && (
        <CardContent>
            <SubtaskList parentTask={task} subtasks={subtasks} />
        </CardContent>
      )}
    </Card>
  );
}
