
"use client";

import { useTasks } from '@/contexts/task-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export default function HistoryPage() {
  const { tasks, uncompleteTask } = useTasks();

  const completedTasks = tasks.filter(t => t.completedAt).sort((a, b) => b.completedAt! - a.completedAt!);

  return (
    <div className="container mx-auto max-w-4xl py-8 md:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">Completed Tasks</h1>
        <p className="mt-2 text-muted-foreground">Review your accomplished tasks.</p>
      </div>
      
      <div className="space-y-12">
        <div>
            <h2 className="text-2xl font-semibold mb-4">Completed ({completedTasks.length})</h2>
            <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
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
    </div>
  );
}
