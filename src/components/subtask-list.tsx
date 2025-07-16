
"use client";

import { useState } from 'react';
import type { Task } from '@/lib/types';
import { useTasks } from '@/contexts/task-context';
import { Button } from './ui/button';
import { PlusCircle } from 'lucide-react';
import { TaskItem } from './task-item';
import { TaskForm } from './task-form';
import { Card, CardContent } from './ui/card';

interface SubtaskListProps {
  parentTask: Task;
  subtasks: Task[];
}

export function SubtaskList({ parentTask, subtasks }: SubtaskListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const { addTask } = useTasks();

  const handleFormFinish = () => {
    setIsAdding(false);
  };
  
  const pendingSubtasks = subtasks.filter(st => !st.completedAt);

  return (
    <div className="pl-4 border-l-2 border-muted-foreground/20 space-y-3">
        {pendingSubtasks.map(subtask => (
            <TaskItem key={subtask.id} task={subtask} isSubtask />
        ))}

        {isAdding && (
             <Card className="bg-secondary">
                <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-2">New Sub-task for "{parentTask.title}"</h3>
                    <TaskForm 
                        onFinished={handleFormFinish}
                        parentId={parentTask.id}
                        defaultValues={{
                            category: parentTask.category,
                            timeOfDay: parentTask.timeOfDay,
                        }}
                    />
                </CardContent>
            </Card>
        )}

        {!isAdding && (
            <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Sub-task
            </Button>
        )}
    </div>
  );
}
