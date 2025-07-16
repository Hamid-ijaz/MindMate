
"use client";

import { useTasks } from '@/contexts/task-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export default function HistoryPage() {
  const { tasks } = useTasks();

  const completedTasks = tasks.filter(t => t.completedAt).sort((a, b) => b.completedAt! - a.completedAt!);
  const uncompletedTasks = tasks.filter(t => !t.completedAt);

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
                  <Card key={task.id}>
                    <CardHeader>
                      <CardTitle className="text-xl">{task.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{task.category}</Badge>
                      <Badge variant="secondary">{task.energyLevel} Energy</Badge>
                      <Badge variant="secondary">{task.duration} min</Badge>
                    </CardContent>
                  </Card>
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
