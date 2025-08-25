'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Zap,
  CheckSquare,
  Users,
  AlertCircle,
  Calendar as CalendarIcon,
  Tag,
  Clock,
  Trash2,
  Edit,
  Copy,
  Archive,
  RotateCcw,
  PlayCircle,
  PauseCircle,
  X,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import type { TeamTask, Priority, TaskCategory, BatchOperation } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BatchOperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTasks: TeamTask[];
  onExecute: (operation: BatchOperationRequest) => Promise<void>;
  workspaceMembers?: { id: string; name: string; email: string }[];
  isExecuting?: boolean;
  executionProgress?: BatchExecutionProgress;
}

interface BatchOperationRequest {
  type: string;
  parameters: any;
  taskIds: string[];
  confirm?: boolean;
}

interface BatchExecutionProgress {
  total: number;
  completed: number;
  failed: number;
  currentTask?: string;
  errors: { taskId: string; error: string }[];
}

const operationTypes = [
  { 
    id: 'assign', 
    label: 'Assign Tasks', 
    icon: Users, 
    description: 'Assign selected tasks to a team member',
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300'
  },
  { 
    id: 'updatePriority', 
    label: 'Change Priority', 
    icon: AlertCircle, 
    description: 'Update the priority level of selected tasks',
    color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300'
  },
  { 
    id: 'updateCategory', 
    label: 'Change Category', 
    icon: Tag, 
    description: 'Update the category of selected tasks',
    color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300'
  },
  { 
    id: 'updateDueDate', 
    label: 'Set Due Date', 
    icon: CalendarIcon, 
    description: 'Set or update the due date for selected tasks',
    color: 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-300'
  },
  { 
    id: 'addEstimate', 
    label: 'Add Time Estimate', 
    icon: Clock, 
    description: 'Add time estimates to selected tasks',
    color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300'
  },
  { 
    id: 'complete', 
    label: 'Mark Complete', 
    icon: CheckSquare, 
    description: 'Mark selected tasks as completed',
    color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300'
  },
  { 
    id: 'duplicate', 
    label: 'Duplicate Tasks', 
    icon: Copy, 
    description: 'Create copies of selected tasks',
    color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/20 dark:text-cyan-300'
  },
  { 
    id: 'archive', 
    label: 'Archive Tasks', 
    icon: Archive, 
    description: 'Move selected tasks to archive',
    color: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300'
  },
  { 
    id: 'delete', 
    label: 'Delete Tasks', 
    icon: Trash2, 
    description: 'Permanently delete selected tasks',
    color: 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-300',
    requiresConfirmation: true
  },
];

export function BatchOperationDialog({
  open,
  onOpenChange,
  selectedTasks,
  onExecute,
  workspaceMembers = [],
  isExecuting = false,
  executionProgress
}: BatchOperationDialogProps) {
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [parameters, setParameters] = useState<any>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();

  const operationType = operationTypes.find(op => op.id === selectedOperation);
  const isDestructive = ['delete', 'archive'].includes(selectedOperation);
  const requiresConfirmation = operationType?.requiresConfirmation;

  const handleExecute = async () => {
    if (!selectedOperation) return;

    const operation: BatchOperationRequest = {
      type: selectedOperation,
      parameters,
      taskIds: selectedTasks.map(t => t.id),
      confirm: requiresConfirmation ? confirmDelete : undefined
    };

    await onExecute(operation);
    
    // Reset form
    setSelectedOperation('');
    setParameters({});
    setConfirmDelete(false);
    setSelectedDate(undefined);
    onOpenChange(false);
  };

  const renderParameterInput = () => {
    switch (selectedOperation) {
      case 'assign':
        return (
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select value={parameters.assigneeId || ''} onValueChange={(value) => setParameters({ assigneeId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassign</SelectItem>
                {workspaceMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {member.name || member.email}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'updatePriority':
        return (
          <div className="space-y-2">
            <Label>Priority Level</Label>
            <Select value={parameters.priority || ''} onValueChange={(value) => setParameters({ priority: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    Low Priority
                  </div>
                </SelectItem>
                <SelectItem value="Medium">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                    Medium Priority
                  </div>
                </SelectItem>
                <SelectItem value="High">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                    High Priority
                  </div>
                </SelectItem>
                <SelectItem value="Critical">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    Critical Priority
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 'updateCategory':
        return (
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={parameters.category || ''} onValueChange={(value) => setParameters({ category: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {['Work', 'Personal', 'Meeting', 'Development', 'Design', 'Marketing', 'Admin'].map((category) => (
                  <SelectItem key={category} value={category}>
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      {category}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'updateDueDate':
        return (
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Select due date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setParameters({ dueDate: date?.toISOString() });
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );

      case 'addEstimate':
        return (
          <div className="space-y-2">
            <Label>Time Estimate (minutes)</Label>
            <Input
              type="number"
              placeholder="Enter time in minutes"
              value={parameters.duration || ''}
              onChange={(e) => setParameters({ duration: parseInt(e.target.value) })}
              min="5"
              max="480"
            />
          </div>
        );

      case 'duplicate':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Number of copies</Label>
              <Input
                type="number"
                placeholder="1"
                value={parameters.copies || 1}
                onChange={(e) => setParameters({ copies: parseInt(e.target.value) || 1 })}
                min="1"
                max="10"
              />
            </div>
            <div className="space-y-2">
              <Label>Prefix for copied tasks (optional)</Label>
              <Input
                placeholder="Copy of"
                value={parameters.prefix || ''}
                onChange={(e) => setParameters({ prefix: e.target.value })}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getProgressMessage = () => {
    if (!executionProgress) return '';
    
    const { completed, total, failed, currentTask } = executionProgress;
    
    if (currentTask) {
      return `Processing: ${currentTask}`;
    }
    
    if (completed === total) {
      return failed > 0 
        ? `Completed with ${failed} error${failed === 1 ? '' : 's'}`
        : 'Operation completed successfully';
    }
    
    return `Processing ${completed + 1} of ${total} tasks...`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Batch Operations
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Perform actions on {selectedTasks.length} selected task{selectedTasks.length === 1 ? '' : 's'}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Execution Progress */}
          {isExecuting && executionProgress && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {getProgressMessage()}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {executionProgress.completed}/{executionProgress.total}
                    </span>
                  </div>
                  
                  <Progress 
                    value={(executionProgress.completed / executionProgress.total) * 100} 
                    className="h-2"
                  />
                  
                  {executionProgress.errors.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-destructive">Errors occurred:</p>
                      <div className="max-h-24 overflow-y-auto space-y-1">
                        {executionProgress.errors.map((error, index) => (
                          <div key={index} className="text-xs text-destructive bg-destructive/5 p-2 rounded">
                            <span className="font-medium">Task {error.taskId}:</span> {error.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Operation Selection */}
          {!isExecuting && (
            <>
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Select Operation</Label>
                  <p className="text-sm text-muted-foreground">Choose what action to perform on the selected tasks</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {operationTypes.map((operation) => {
                    const Icon = operation.icon;
                    const isSelected = selectedOperation === operation.id;
                    
                    return (
                      <Card
                        key={operation.id}
                        className={cn(
                          "cursor-pointer transition-all duration-200 hover:shadow-md",
                          isSelected && "ring-2 ring-primary ring-offset-2 border-primary/50",
                          operation.requiresConfirmation && "border-destructive/20"
                        )}
                        onClick={() => setSelectedOperation(operation.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={cn("p-2 rounded-lg", operation.color)}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm">{operation.label}</h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                {operation.description}
                              </p>
                              {operation.requiresConfirmation && (
                                <Badge variant="destructive" className="mt-2 text-xs">
                                  Destructive Action
                                </Badge>
                              )}
                            </div>
                            {isSelected && (
                              <CheckCircle className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Parameter Input */}
              {selectedOperation && (
                <div className="space-y-4">
                  <Separator />
                  <div>
                    <Label className="text-base font-medium">Configure Operation</Label>
                    <p className="text-sm text-muted-foreground">
                      Set the parameters for {operationType?.label.toLowerCase()}
                    </p>
                  </div>
                  
                  <Card>
                    <CardContent className="p-4">
                      {renderParameterInput()}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Confirmation for destructive actions */}
              {requiresConfirmation && selectedOperation === 'delete' && (
                <Card className="border-destructive/20 bg-destructive/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-destructive">Permanent Deletion</h4>
                          <p className="text-sm text-muted-foreground">
                            This action cannot be undone. The selected tasks will be permanently deleted.
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="confirm-delete"
                            checked={confirmDelete}
                            onCheckedChange={setConfirmDelete}
                          />
                          <Label htmlFor="confirm-delete" className="text-sm">
                            I understand that this action cannot be undone
                          </Label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Task Preview */}
              {selectedTasks.length <= 5 && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">Affected Tasks ({selectedTasks.length})</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                        <CheckSquare className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.category} • {task.priority} priority
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleExecute}
                  disabled={!selectedOperation || (requiresConfirmation && !confirmDelete)}
                  className={isDestructive ? "bg-destructive hover:bg-destructive/90" : ""}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Execute Operation
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}