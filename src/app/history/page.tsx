
"use client";

import { useTasks } from '@/contexts/task-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { RotateCcw, ChevronDown, ChevronUp, CornerDownRight } from 'lucide-react';
import { SubtaskList } from '@/components/subtask-list';
import { useState } from 'react';
import type { Task } from '@/lib/types';
import Link from 'next/link';

export default function HistoryPage() {
  const { tasks, uncompleteTask } = useTasks();
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const allCompletedTasks = tasks.filter(t => t.completedAt).sort((a, b) => b.completedAt! - a.completedAt!);
  
  const completedRootTasks = allCompletedTasks.filter(t => !t.parentId);
  const completedOrphanedSubtasks = allCompletedTasks.filter(t => {
    if (!t.parentId) return false;
    const parent = tasks.find(p => p.id === t.parentId);
    return parent && !parent.completedAt;
  });

  const getSubtasks = (parentId: string) => {
    return tasks.filter(t => t.parentId === parentId && t.completedAt);
  }

  const getParentTask = (parentId: string): Task | undefined => {
      return tasks.find(t => t.id === parentId);
  }

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => ({...prev, [taskId]: !prev[taskId]}));
  }

  const renderTaskCard = (task: Task) => {
    const subtasks = getSubtasks(task.id);
    const isExpanded = expandedTasks[task.id];
    const parentTask = task.parentId ? getParentTask(task.parentId) : null;

    return (
      <Card key={task.id} className="bg-card/50 opacity-80">
        <CardHeader>
          {parentTask && !parentTask.completedAt && (
             <CardDescription className="flex items-center text-xs mb-2">
                <CornerDownRight className="h-4 w-4 mr-2" />
                Part of: <Link href="/pending" className="font-semibold hover:underline ml-1">{parentTask.title}</Link>
             </CardDescription>
          )}
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
            {subtasks.length > 0 && !task.parentId && (
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
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 md:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">Completed Tasks</h1>
        <p className="mt-2 text-muted-foreground">Review your accomplished tasks.</p>
      </div>
      
      <div className="space-y-12">
        <div>
            <h2 className="text-2xl font-semibold mb-4">History ({allCompletedTasks.length})</h2>
            <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
                 <div className="space-y-4">
                {allCompletedTasks.length === 0 ? (
                    <p className="text-muted-foreground">You haven't completed any tasks yet.</p>
                ) : (
                    allCompletedTasks.map(task => {
                       // Only render root tasks or orphaned subtasks directly
                       // Subtasks of completed parents are rendered recursively
                       if (!task.parentId) {
                         return renderTaskCard(task);
                       }
                       const parent = getParentTask(task.parentId);
                       if (parent && !parent.completedAt) {
                         return renderTaskCard(task);
                       }
                       return null;
                    })
                )}
                </div>
            </ScrollArea>
        </div>
      </div>
    </div>
  );
}
