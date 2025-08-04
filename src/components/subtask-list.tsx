
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
    <div className="space-y-2">
        {subtasksToDisplay.map((subtask, index) => (
          <div key={subtask.id} className="relative">
            {editingSubtaskId === subtask.id && (isSharedView ? canEdit : true) ? (
              <Card className="bg-secondary/50 border-l-4 border-l-primary shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Edit Subtask</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSubtaskId(null)}
                      className="h-8 px-2 text-xs"
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
              <Card className={`
                border-l-4 transition-all duration-200 hover:shadow-md group overflow-hidden
                ${subtask.completedAt 
                  ? 'border-l-green-500 bg-green-50/30 border-green-200/50' 
                  : 'border-l-primary hover:border-l-primary/80'
                }
              `}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Subtask number indicator */}
                    <div className={`
                      flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5
                      ${subtask.completedAt 
                        ? 'bg-green-100 text-green-700 border-2 border-green-300' 
                        : 'bg-primary/10 text-primary border-2 border-primary/20'
                      }
                    `}>
                      {subtask.completedAt ? '✓' : index + 1}
                    </div>

                    {/* Content area */}
                    <div className="flex-1 min-w-0">
                      {/* Title and description */}
                      <div className="mb-2">
                        <h4 className={`
                          font-semibold text-sm leading-tight mb-1
                          ${subtask.completedAt ? 'line-through text-muted-foreground' : 'text-foreground'}
                        `}>
                          {subtask.title}
                        </h4>
                        {subtask.description && (
                          <p className={`
                            text-xs leading-relaxed line-clamp-2
                            ${subtask.completedAt ? 'line-through text-muted-foreground/70' : 'text-muted-foreground'}
                          `}>
                            {subtask.description}
                          </p>
                        )}
                      </div>

                      {/* Mobile-optimized metadata */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <Badge
                          variant={
                            subtask.priority === 'Critical' ? 'destructive' :
                            subtask.priority === 'High' ? 'default' :
                            subtask.priority === 'Medium' ? 'outline' : 'secondary'
                          }
                          className="text-xs px-1.5 py-0.5 h-5"
                        >
                          {subtask.priority}
                        </Badge>
                        
                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-5">
                          {subtask.category}
                        </Badge>
                        
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5">
                          ⏱️ {subtask.duration}m
                        </Badge>
                        
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5">
                          🕒 {subtask.timeOfDay}
                        </Badge>
                        
                        {subtask.completedAt && (
                          <Badge className="text-xs px-1.5 py-0.5 h-5 bg-green-100 text-green-800 border-green-200">
                            ✓ Done
                          </Badge>
                        )}
                      </div>

                      {/* Mobile-optimized action buttons */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {/* Complete/Reopen button */}
                          {!subtask.completedAt ? (
                            <Button
                              onClick={() => handleSubtaskComplete(subtask.id)}
                              disabled={completingSubtasks.has(subtask.id)}
                              size="sm"
                              className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                            >
                              {completingSubtasks.has(subtask.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Done
                                </>
                              )}
                            </Button>
                          ) : (
                            isHistoryView && (
                              <Button
                                onClick={() => handleSubtaskReopen(subtask.id)}
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Reopen
                              </Button>
                            )
                          )}
                        </div>

                        {/* Edit and delete buttons - show on hover or always on mobile */}
                        {(isSharedView ? canEdit : true) && !isHistoryView && (
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingSubtaskId(subtask.id)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSubtaskDelete(subtask.id)}
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ))}

        {/* Add new subtask button - mobile optimized */}
        {!isHistoryView && (isSharedView ? canEdit : true) && (
          <div className="pt-2">
            {isAdding ? (
              <Card className="bg-primary/5 border-dashed border-2 border-primary/30">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Add Subtask</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAdding(false)}
                      className="h-8 px-2 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                  <TaskForm
                    parentId={parentTask.id}
                    onFinished={handleFormFinish}
                    defaultValues={{
                      category: parentTask.category,
                      priority: parentTask.priority,
                      timeOfDay: parentTask.timeOfDay,
                    }}
                  />
                </CardContent>
              </Card>
            ) : (
              <Button
                onClick={() => setIsAdding(true)}
                variant="outline"
                size="sm"
                className="w-full h-10 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-colors duration-200"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Subtask
              </Button>
            )}
          </div>
        )}
    </div>
  );
}
