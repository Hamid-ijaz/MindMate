
"use client";

import { useState } from 'react';
import type { Task } from '@/lib/types';
import { useTasks } from '@/contexts/task-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { TaskForm } from './task-form';
import { SubtaskList } from './subtask-list';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface TaskItemProps {
  task: Task;
  extraActions?: React.ReactNode;
  isSubtask?: boolean;
}

export function TaskItem({ task, extraActions, isSubtask = false }: TaskItemProps) {
  const { tasks, deleteTask, acceptTask } = useTasks();
  const [isEditing, setIsEditing] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);

  const handleEditFinish = () => {
    setIsEditing(false);
  };

  const subtasks = tasks.filter(t => t.parentId === task.id);
  const pendingSubtasks = subtasks.filter(t => !t.completedAt);
  const hasPendingSubtasks = pendingSubtasks.length > 0;

  if (isEditing) {
    return (
      <Card className="bg-secondary">
        <CardContent className="p-4">
          <TaskForm task={task} onFinished={handleEditFinish} />
        </CardContent>
      </Card>
    );
  }

  const CompleteButton = () => (
    <Button variant="outline" size="sm" onClick={() => acceptTask(task.id)}>
      <Check className="h-4 w-4 mr-2" />
      Complete
    </Button>
  );

  return (
    <Card className={isSubtask ? "border-l-4 border-primary/20" : ""}>
      <div className={isSubtask ? "p-3" : "p-6"}>
        <CardTitle className={isSubtask ? "font-semibold text-base" : "text-lg"}>{task.title}</CardTitle>
        {task.description && <CardDescription className="pt-1">{task.description}</CardDescription>}
      </div>
       {!task.completedAt && (
        <>
            <CardContent className={`flex flex-wrap gap-2 ${isSubtask ? 'px-3 pt-0 pb-2' : 'p-6 pt-0'}`}>
                <Badge variant="secondary">{task.category}</Badge>
                <Badge variant="secondary">{task.energyLevel} Energy</Badge>
                <Badge variant="secondary">{task.duration} min</Badge>
                <Badge variant="secondary">{task.timeOfDay}</Badge>
            </CardContent>
            <CardFooter className={`flex justify-end gap-2 ${isSubtask ? 'px-3 pb-3 pt-0' : 'p-6 pt-0'}`}>
                {extraActions}
                {!isSubtask && subtasks.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setShowSubtasks(!showSubtasks)}>
                    {showSubtasks ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                    Subtasks ({pendingSubtasks.length})
                </Button>
                )}
                
                {hasPendingSubtasks ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button variant="outline" size="sm" disabled>
                            <Check className="h-4 w-4 mr-2" />
                            Complete
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Complete all sub-tasks first.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  !isSubtask && <CompleteButton />
                )}
                
                {isSubtask && <CompleteButton />}

                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </CardFooter>
        </>
       )}
      {showSubtasks && !isSubtask && (
        <CardContent>
            <SubtaskList parentTask={task} subtasks={subtasks} />
        </CardContent>
      )}
    </Card>
  );
}
