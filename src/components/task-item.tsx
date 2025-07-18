
"use client";

import { useState } from 'react';
import type { Task } from '@/lib/types';
import { useTasks } from '@/contexts/task-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Edit, Trash2, ChevronDown, ChevronUp, RotateCcw, CalendarIcon } from 'lucide-react';
import { TaskForm } from './task-form';
import { SubtaskList } from './subtask-list';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { format } from 'date-fns';

interface TaskItemProps {
  task: Task;
  extraActions?: React.ReactNode;
  isSubtask?: boolean;
  isHistoryView?: boolean;
}

export function TaskItem({ task, extraActions, isSubtask = false, isHistoryView = false }: TaskItemProps) {
  const { tasks, deleteTask, acceptTask, uncompleteTask, startEditingTask } = useTasks();
  const [showSubtasks, setShowSubtasks] = useState(false);

  const subtasks = tasks.filter(t => t.parentId === task.id);
  const pendingSubtasks = subtasks.filter(t => !t.completedAt);
  const hasPendingSubtasks = pendingSubtasks.length > 0;


  const CompleteButton = () => (
    <Button variant="outline" size="sm" onClick={() => acceptTask(task.id)}>
      <Check className="h-4 w-4 md:mr-2" />
      <span className="hidden md:inline">Complete</span>
    </Button>
  );

  const RedoButton = () => (
     <Button variant="ghost" size="sm" onClick={() => uncompleteTask(task.id)}>
        <RotateCcw className="mr-2 h-4 w-4" />
        Redo
    </Button>
  );

  return (
    <Card className={isSubtask ? "border-l-4 border-primary/20" : ""}>
      <div className={isSubtask ? "p-3" : "p-6"}>
        <CardTitle className={`${isSubtask ? "font-semibold text-base" : "text-lg"} ${task.completedAt ? "line-through text-muted-foreground" : ""} break-all`}>{task.title}</CardTitle>
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
                      {format(new Date(task.reminderAt), "MMM d")}
                   </Badge>
                )}
            </CardContent>
            <CardFooter className={`flex flex-wrap justify-end gap-2 ${isSubtask ? 'px-3 pb-3 pt-0' : 'p-6 pt-0'}`}>
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

                <Button variant="ghost" size="icon" onClick={() => startEditingTask(task.id)}>
                <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </CardFooter>
        </>
       )}
       {isHistoryView && (
            <CardFooter className={`flex justify-end gap-2 ${isSubtask ? 'px-3 pb-3 pt-0' : 'p-6 pt-0'}`}>
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
