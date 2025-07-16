
"use client";

import { useTasks } from '@/contexts/task-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { SubtaskList } from '@/components/subtask-list';
import { useState } from 'react';

export default function HistoryPage() {
  const { tasks, uncompleteTask } = useTasks();
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const completedRootTasks = tasks.filter(t => t.completedAt && !t.parentId).sort((a, b) => b.completedAt! - a.completedAt!);

  const getSubtasks = (parentId: string) => {
    return tasks.filter(t => t.parentId === parentId);
  }

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => ({...prev, [taskId]: !prev[taskId]}));
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 md:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">Completed Tasks</h1>
        <p className="mt-2 text-muted-foreground">Review your accomplished tasks.</p>
      </div>
      
      <div className="space-y-12">
        <div>
            <h2 className="text-2xl font-semibold mb-4">Completed ({completedRootTasks.length})</h2>
            <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
                 <div className="space-y-4">
                {completedRootTasks.length === 0 ? (
                    <p className="text-muted-foreground">You haven't completed any tasks yet.</p>
                ) : (
                    completedRootTasks.map(task => {
                      const subtasks = getSubtasks(task.id);
                      const isExpanded = expandedTasks[task.id];
                      return (
                        <Card key={task.id} className="bg-card/50 opacity-80">
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
                          <CardFooter className="justify-end gap-2">
                              {subtasks.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => toggleExpand(task.id)}>
                                  {isExpanded ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                                  Subtasks ({subtasks.length})
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => uncompleteTask(task.id)}>
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Redo
                              </Button>
                          </CardFooter>
                          {isExpanded && subtasks.length > 0 && (
                            <CardContent>
                              <SubtaskList parentTask={task} subtasks={subtasks} isHistoryView={true} />
                            </CardContent>
                          )}
                        </Card>
                      )
                    })
                )}
                </div>
            </ScrollArea>
        </div>
      </div>
    </div>
  );
}
