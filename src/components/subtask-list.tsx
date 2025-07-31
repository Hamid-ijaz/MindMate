
"use client";

import { useState } from 'react';
import type { Task } from '@/lib/types';
import { useTasks } from '@/contexts/task-context';
import { useNotifications } from '@/contexts/notification-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { PlusCircle, Edit, Trash2, Check, RotateCcw, Loader2 } from 'lucide-react';
import { TaskForm } from './task-form';

interface SubtaskListProps {
  parentTask: Task;
  subtasks: Task[];
  isHistoryView?: boolean;
  isSharedView?: boolean;
  canEdit?: boolean;
  onSubtaskUpdate?: (subtaskId: string, updates: Partial<Task>) => Promise<void>;
  onSubtaskDelete?: (subtaskId: string) => Promise<void>;
  onSubtaskComplete?: (subtaskId: string) => Promise<void>;
  onSubtaskReopen?: (subtaskId: string) => Promise<void>;
}

export function SubtaskList({ 
  parentTask, 
  subtasks, 
  isHistoryView = false, 
  isSharedView = false,
  canEdit = false,
  onSubtaskUpdate,
  onSubtaskDelete,
  onSubtaskComplete,
  onSubtaskReopen
}: SubtaskListProps) {
  const { updateTask, deleteTask, acceptTask, uncompleteTask } = useTasks();
  const { deleteNotification } = useNotifications();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [completingSubtasks, setCompletingSubtasks] = useState<Set<string>>(new Set());

  const handleFormFinish = () => {
    setIsAdding(false);
  };

  const handleSubtaskEdit = async (subtaskId: string, updates: Partial<Task>) => {
    if (isSharedView && onSubtaskUpdate) {
      await onSubtaskUpdate(subtaskId, updates);
    } else {
      await updateTask(subtaskId, updates);
    }
    setEditingSubtaskId(null);
  };

  const handleSubtaskDelete = async (subtaskId: string) => {
    if (isSharedView && onSubtaskDelete) {
      await onSubtaskDelete(subtaskId);
    } else {
      await deleteTask(subtaskId);
    }
  };

  const handleSubtaskComplete = async (subtaskId: string) => {
    if (isSharedView && onSubtaskComplete) {
      await onSubtaskComplete(subtaskId);
      return;
    }

    setCompletingSubtasks(prev => new Set(prev).add(subtaskId));
    try {
      await acceptTask(subtaskId);
      await deleteNotification(subtaskId);
      toast({
        title: "Subtask completed!",
        description: "Great job! The subtask has been marked as complete"
      });
    } catch (error) {
      toast({
        title: "Complete failed",
        description: "Failed to complete the subtask",
        variant: "destructive"
      });
    } finally {
      setCompletingSubtasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(subtaskId);
        return newSet;
      });
    }
  };

  const handleSubtaskReopen = async (subtaskId: string) => {
    if (isSharedView && onSubtaskReopen) {
      await onSubtaskReopen(subtaskId);
      return;
    }

    try {
      await uncompleteTask(subtaskId);
      toast({
        title: "Subtask reopened",
        description: "The subtask has been marked as pending"
      });
    } catch (error) {
      toast({
        title: "Reopen failed",
        description: "Failed to reopen the subtask",
        variant: "destructive"
      });
    }
  };
  
  // In history view, show all associated subtasks. Otherwise, show all subtasks (both pending and completed).
  const subtasksToDisplay = subtasks;

  return (
    <div className="space-y-3">
        {subtasksToDisplay.map((subtask, index) => (
          <div key={subtask.id} className="relative">
            {editingSubtaskId === subtask.id && (isSharedView ? canEdit : true) ? (
              <Card className="bg-secondary border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Edit Subtask</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSubtaskId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                  <TaskForm
                    task={subtask}
                    onFinished={() => setEditingSubtaskId(null)}
                    defaultValues={{
                      title: subtask.title,
                      description: subtask.description,
                      category: subtask.category,
                      priority: subtask.priority,
                      duration: subtask.duration,
                      timeOfDay: subtask.timeOfDay,
                      reminderAt: subtask.reminderAt ? new Date(subtask.reminderAt) : undefined,
                    }}
                    customSaveHandler={(taskData) => handleSubtaskEdit(subtask.id, taskData)}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className={`border-l-4 ${subtask.completedAt ? 'border-l-green-500 bg-green-50/50' : 'border-l-primary'} transition-all duration-200 hover:shadow-md`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Subtask number and title */}
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary mt-0.5">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className={`font-semibold text-base leading-tight ${subtask.completedAt ? 'line-through text-muted-foreground' : ''}`}>
                            {subtask.title}
                          </h4>
                          {subtask.description && (
                            <p className={`text-sm mt-1 leading-relaxed ${subtask.completedAt ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                              {subtask.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Subtask metadata */}
                      <div className="flex items-center gap-2 ml-9 flex-wrap">
                        <Badge 
                          variant="secondary" 
                          className="text-xs"
                        >
                          {subtask.category}
                        </Badge>
                        <Badge
                          variant={
                            subtask.priority === 'Critical' ? 'destructive' :
                            subtask.priority === 'High' ? 'default' :
                            subtask.priority === 'Medium' ? 'outline' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {subtask.priority}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {subtask.duration} min
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {subtask.timeOfDay}
                        </Badge>
                        {subtask.completedAt && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            Completed
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {!isSharedView && !isHistoryView && (
                      <div className="flex gap-1 flex-shrink-0">
                        {subtask.completedAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSubtaskReopen(subtask.id)}
                            className="h-8 px-2 text-orange-600 hover:text-orange-700"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            <span className="text-xs">Reopen</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSubtaskComplete(subtask.id)}
                            disabled={completingSubtasks.has(subtask.id)}
                            className="h-8 px-2 text-green-600 hover:text-green-700"
                          >
                            {completingSubtasks.has(subtask.id) ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3 mr-1" />
                            )}
                            <span className="text-xs">Complete</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSubtaskId(subtask.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSubtaskDelete(subtask.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Shared view edit actions */}
                    {isSharedView && canEdit && !isHistoryView && (
                      <div className="flex gap-1 flex-shrink-0">
                        {subtask.completedAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSubtaskReopen(subtask.id)}
                            className="h-8 px-2 text-orange-600 hover:text-orange-700"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            <span className="text-xs">Reopen</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSubtaskComplete(subtask.id)}
                            className="h-8 px-2 text-green-600 hover:text-green-700"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            <span className="text-xs">Complete</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSubtaskId(subtask.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSubtaskDelete(subtask.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ))}

        {!isHistoryView && isAdding && (canEdit || !isSharedView) && (
            <Card className="bg-secondary/50 border-l-4 border-l-primary border-dashed">
                <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <PlusCircle className="h-4 w-4" />
                      New Sub-task for "{parentTask.title}"
                    </h3>
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

        {!isHistoryView && !isAdding && (canEdit || !isSharedView) && (
            <div className="pt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsAdding(true)}
                className="w-full border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5"
              >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Sub-task
              </Button>
            </div>
        )}
    </div>
  );
}
