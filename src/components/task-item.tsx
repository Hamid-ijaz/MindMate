
"use client";

import { useState } from 'react';
import type { Task } from '@/lib/types';
import { useTasks } from '@/contexts/task-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Edit, Trash2 } from 'lucide-react';
import { TaskForm } from './task-form';

interface TaskItemProps {
  task: Task;
}

export function TaskItem({ task }: TaskItemProps) {
  const { deleteTask, acceptTask } = useTasks();
  const [isEditing, setIsEditing] = useState(false);

  const handleEditFinish = () => {
    setIsEditing(false);
  };

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
    <Card>
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
    </Card>
  );
}
