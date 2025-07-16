
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

  if (isEditing) {
    return (
      <Card className="bg-secondary">
        <CardContent className="p-4">
          <TaskForm task={task} onFinished={handleEditFinish} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isSubtask ? "border-l-4 border-primary/20" : ""}>
      <CardHeader>
        <CardTitle className="text-lg">{task.title}</CardTitle>
        {task.description && <CardDescription>{task.description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Badge variant="secondary">{task.category}</Badge>
        <Badge variant="secondary">{task.energyLevel} Energy</Badge>
        <Badge variant="secondary">{task.duration} min</Badge>
        <Badge variant="secondary">{task.timeOfDay}</Badge>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        {extraActions}
         {!isSubtask && (
          <Button variant="ghost" size="sm" onClick={() => setShowSubtasks(!showSubtasks)}>
            {showSubtasks ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
            Subtasks ({subtasks.length})
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => acceptTask(task.id)}>
          <Check className="h-4 w-4 mr-2" />
          Complete
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </CardFooter>
      {showSubtasks && !isSubtask && (
        <CardContent>
            <SubtaskList parentTask={task} subtasks={subtasks} />
        </CardContent>
      )}
    </Card>
  );
}
