
"use client";

import { useState, useTransition } from 'react';
import { useTasks } from '@/contexts/task-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TaskItem } from '@/components/task-item';
import { Button } from '@/components/ui/button';
import { RotateCcw, Wand2, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { rewordTask } from '@/ai/flows/reword-task-flow';
import { useToast } from '@/hooks/use-toast';
import type { Task } from '@/lib/types';

export default function HistoryPage() {
  const { tasks, uncompleteTask, addTask } = useTasks();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showRewordDialog, setShowRewordDialog] = useState(false);
  const [rewordedSuggestion, setRewordedSuggestion] = useState<{ title: string; description: string } | null>(null);
  const [taskToReword, setTaskToReword] = useState<Task | null>(null);


  const completedTasks = tasks.filter(t => t.completedAt).sort((a, b) => b.completedAt! - a.completedAt!);
  const uncompletedTasks = tasks.filter(t => !t.completedAt);

  const handleRewordClick = (task: Task) => {
    setTaskToReword(task);
    startTransition(async () => {
      try {
        const result = await rewordTask({
          title: task.title,
          description: task.description || "",
        });
        setRewordedSuggestion(result);
        setShowRewordDialog(true);
      } catch (error) {
        console.error("Failed to reword task:", error);
        toast({
          title: "AI Error",
          description: "Could not get a suggestion. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const handleAcceptReword = () => {
    if (!taskToReword || !rewordedSuggestion) return;
    
    addTask({
      title: rewordedSuggestion.title,
      description: rewordedSuggestion.description,
      category: taskToReword.category,
      timeOfDay: taskToReword.timeOfDay,
      energyLevel: 'Low',
      duration: 15,
    });
    
    toast({
      title: "New Task Added!",
      description: `"${rewordedSuggestion.title}" is now on your list.`,
    });

    setShowRewordDialog(false);
    setRewordedSuggestion(null);
    setTaskToReword(null);
  };


  return (
    <div className="container mx-auto max-w-4xl py-8 md:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">Task History</h1>
        <p className="mt-2 text-muted-foreground">Review your completed and pending tasks.</p>
      </div>
      
      <div className="space-y-12">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Pending Tasks ({uncompletedTasks.length})</h2>
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-4">
              {uncompletedTasks.length === 0 ? (
                <p className="text-muted-foreground">No pending tasks. Great job!</p>
              ) : (
                uncompletedTasks.map(task => (
                  <TaskItem 
                    key={task.id} 
                    task={task}
                    extraActions={
                      <Button variant="outline" size="sm" onClick={() => handleRewordClick(task)} disabled={isPending && taskToReword?.id === task.id}>
                          {isPending && taskToReword?.id === task.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                              <Wand2 className="mr-2 h-4 w-4" />
                          )}
                          Divide Task
                      </Button>
                    }
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        <div>
            <h2 className="text-2xl font-semibold mb-4">Completed Tasks ({completedTasks.length})</h2>
            <ScrollArea className="h-[32rem] pr-4">
                 <div className="space-y-4">
                {completedTasks.length === 0 ? (
                    <p className="text-muted-foreground">You haven't completed any tasks yet.</p>
                ) : (
                    completedTasks.map(task => (
                    <Card key={task.id} className="bg-secondary/50 opacity-80">
                        <CardHeader>
                        <CardTitle className="text-xl line-through">{task.title}</CardTitle>
                        {task.completedAt && (
                            <CardDescription>
                            Completed on: {format(new Date(task.completedAt), "MMMM d, yyyy 'at' h:mm a")}
                            </CardDescription>
                        )}
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            <Badge variant="outline">{task.category}</Badge>
                            <Badge variant="outline">{task.energyLevel} Energy</Badge>
                            <Badge variant="outline">{task.duration} min</Badge>
                        </CardContent>
                        <CardFooter className="justify-end">
                            <Button variant="ghost" size="sm" onClick={() => uncompleteTask(task.id)}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Redo
                            </Button>
                        </CardFooter>
                    </Card>
                    ))
                )}
                </div>
            </ScrollArea>
        </div>
      </div>

       <AlertDialog open={showRewordDialog} onOpenChange={setShowRewordDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2"><Wand2 className="text-primary"/>How about this instead?</AlertDialogTitle>
                    {rewordedSuggestion && (
                        <div className="pt-4 space-y-2 text-left">
                            <p className="font-bold text-lg">{rewordedSuggestion.title}</p>
                            <p className="text-muted-foreground">{rewordedSuggestion.description}</p>
                            <p className="text-sm text-blue-500 pt-2">This will be added as a new 15-minute, low-energy task.</p>
                        </div>
                    )}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <Button variant="ghost" onClick={() => setShowRewordDialog(false)}>No, thanks</Button>
                    <Button onClick={handleAcceptReword}>Yes, add this task</Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
