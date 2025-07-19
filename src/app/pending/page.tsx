
"use client";

import { useState, useTransition, useEffect, useRef, Suspense } from 'react';
import { useTasks } from '@/contexts/task-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskItem } from '@/components/task-item';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2, PlusCircle } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { rewordTask } from '@/ai/flows/reword-task-flow';
import { useToast } from '@/hooks/use-toast';
import type { Task } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

interface SuggestedTask {
  title: string;
  description: string;
}

function PendingTasksSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
         <Card key={i}>
            <div className="p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full" />
            </div>
            <CardContent className="flex flex-wrap gap-2 pt-0">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
            </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PendingTasksContent() {
  const { tasks, addTask, isLoading } = useTasks();
  const { toast } = useToast();
  const [isRewording, startRewordTransition] = useTransition();
  const [showRewordDialog, setShowRewordDialog] = useState(false);
  const [rewordedSuggestions, setRewordedSuggestions] = useState<SuggestedTask[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Record<string, boolean>>({});
  const [taskToReword, setTaskToReword] = useState<Task | null>(null);
  
  const searchParams = useSearchParams();
  const taskRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { user } = useAuth();

  const rootTasks = tasks.filter(t => !t.parentId);
  const uncompletedTasks = rootTasks.filter(t => !t.completedAt);

  useEffect(() => {
    const taskId = searchParams.get('taskId');
    if (taskId && !isLoading) {
      setTimeout(() => {
        const el = taskRefs.current[taskId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('animate-pulse', 'bg-primary/10', 'rounded-lg');
          setTimeout(() => {
            el.classList.remove('animate-pulse', 'bg-primary/10', 'rounded-lg');
          }, 2000);
        }
      }, 100); 
    }
  }, [searchParams, isLoading]);

  const handleRewordClick = (task: Task) => {
    setTaskToReword(task);
    startRewordTransition(async () => {
      try {
        const result = await rewordTask({
          title: task.title,
          description: task.description || "",
        });
        setRewordedSuggestions(result.suggestedTasks);
        setSelectedTasks(result.suggestedTasks.reduce((acc, task) => {
          acc[task.title] = true; // Default all to selected
          return acc;
        }, {} as Record<string, boolean>));
        setShowRewordDialog(true);
      } catch (error) {
        console.error("Failed to reword task:", error);
        toast({
          title: "AI Error",
          description: "Could not get suggestions. Please try again.",
          variant: "destructive",
        });
      }
    });
  };
  
  const handleToggleSelection = (title: string) => {
    setSelectedTasks(prev => ({...prev, [title]: !prev[title]}));
  };

  const handleAcceptReword = () => {
    if (!taskToReword || rewordedSuggestions.length === 0) return;

    const tasksToAdd = rewordedSuggestions.filter(suggestion => selectedTasks[suggestion.title]);

    if(tasksToAdd.length === 0) {
        toast({
            title: "No tasks selected",
            description: "Please select at least one task to add.",
            variant: "destructive"
        });
        return;
    }
    
    tasksToAdd.forEach(suggestion => {
        addTask({
            parentId: taskToReword.id, // Set the parent ID
            title: suggestion.title,
            description: suggestion.description,
            category: taskToReword.category,
            timeOfDay: taskToReword.timeOfDay,
            energyLevel: 'Low',
            duration: 15,
            userEmail: user?.email || '', // Add missing userEmail
        });
    });
    
    toast({
      title: `${tasksToAdd.length} New Sub-task(s) Added!`,
      description: `The selected tasks are now under "${taskToReword.title}".`,
    });

    setShowRewordDialog(false);
    setRewordedSuggestions([]);
    setSelectedTasks({});
    setTaskToReword(null);
  };


  return (
    <div className="container mx-auto max-w-4xl py-8 md:py-16 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">Pending Tasks</h1>
        <p className="mt-2 text-muted-foreground">Here's what's on your plate. You can do it!</p>
      </div>
      
      <div className="space-y-12">
        <div>
          <h2 className="text-2xl font-semibold mb-4">To-Do ({isLoading ? '...' : uncompletedTasks.length})</h2>
          <ScrollArea className="h-[calc(100vh-16rem)] md:h-[calc(100vh-20rem)] pr-4">
            <div className="space-y-4">
              {isLoading ? (
                <PendingTasksSkeleton />
              ) : uncompletedTasks.length === 0 ? (
                <p className="text-muted-foreground">No pending tasks. Great job!</p>
              ) : (
                uncompletedTasks.map(task => (
                  <div key={task.id} ref={el => { taskRefs.current[task.id] = el; }}>
                    <TaskItem 
                      task={task}
                      extraActions={
                        <Button variant="outline" size="sm" onClick={() => handleRewordClick(task)} disabled={isRewording && taskToReword?.id === task.id}>
                            {isRewording && taskToReword?.id === task.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Wand2 className="h-4 w-4 md:mr-2" />
                            )}
                            <span className="hidden md:inline">Divide Task</span>
                        </Button>
                      }
                    />
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

       <AlertDialog open={showRewordDialog} onOpenChange={setShowRewordDialog}>
            <AlertDialogContent className="max-w-xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2"><Wand2 className="text-primary"/>Here's a breakdown</AlertDialogTitle>
                    <AlertDialogDescription className="break-words">
                       Select which steps you'd like to add as new sub-tasks for "{taskToReword?.title}". They will be low-energy tasks.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4 space-y-3 max-h-64 overflow-y-auto pr-2">
                    {rewordedSuggestions.map((suggestion, index) => (
                       <div key={index} className="flex items-start gap-3 rounded-md border p-3">
                         <Checkbox 
                           id={`task-${index}`} 
                           checked={!!selectedTasks[suggestion.title]}
                           onCheckedChange={() => handleToggleSelection(suggestion.title)}
                           className="mt-1"
                         />
                         <Label htmlFor={`task-${index}`} className="flex-1 cursor-pointer">
                            <p className="font-semibold">{suggestion.title}</p>
                            <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                         </Label>
                       </div>
                    ))}
                </div>
                <AlertDialogFooter>
                    <Button variant="ghost" onClick={() => setShowRewordDialog(false)}>Cancel</Button>
                    <Button onClick={handleAcceptReword}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Selected Tasks
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

export default function PendingTasksPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PendingTasksContent />
    </Suspense>
  );
}
