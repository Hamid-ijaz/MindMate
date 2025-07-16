
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, List, Trash2, Edit, CheckCircle } from "lucide-react";
import { TaskForm } from "./task-form";
import { useTasks } from "@/contexts/task-context";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import type { Task } from "@/lib/types";
import { format } from "date-fns";


export function ManageTasksSheet() {
  const { tasks, deleteTask } = useTasks();
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);

  const handleFormFinish = () => {
    setEditingTask(null);
  };
  
  const uncompletedTasks = tasks.filter(t => !t.completedAt);
  const completedTasks = tasks.filter(t => t.completedAt).sort((a, b) => b.completedAt! - a.completedAt!);


  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add / Manage Tasks
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Your Tasks</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="add" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="add">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add
            </TabsTrigger>
            <TabsTrigger value="pending">
              <List className="mr-2 h-4 w-4" />
              Pending ({uncompletedTasks.length})
            </TabsTrigger>
             <TabsTrigger value="completed">
              <CheckCircle className="mr-2 h-4 w-4" />
              Completed ({completedTasks.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="add" className="py-4">
             <TaskForm onFinished={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="pending">
            <ScrollArea className="h-[calc(100vh-10rem)] pr-4">
              <div className="space-y-4 py-4">
                {uncompletedTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground pt-8">No pending tasks. Add one!</p>
                ) : (
                  uncompletedTasks.map((task: Task) => (
                    editingTask === task.id ? (
                       <Card key={task.id} className="bg-secondary">
                        <CardContent className="p-4">
                          <TaskForm task={task} onFinished={handleFormFinish} />
                        </CardContent>
                      </Card>
                    ) : (
                      <Card key={task.id}>
                        <CardHeader>
                          <CardTitle className="text-lg">{task.title}</CardTitle>
                          {task.description && <CardDescription>{task.description}</CardDescription>}
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{task.category}</Badge>
                            <Badge variant="secondary">{task.energyLevel} Energy</Badge>
                            <Badge variant="secondary">{task.duration} min</Badge>
                            <Badge variant="secondary">{task.timeOfDay}</Badge>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setEditingTask(task.id)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </CardFooter>
                      </Card>
                    )
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
           <TabsContent value="completed">
            <ScrollArea className="h-[calc(100vh-10rem)] pr-4">
              <div className="space-y-4 py-4">
                {completedTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground pt-8">No completed tasks yet.</p>
                ) : (
                  completedTasks.map((task: Task) => (
                      <Card key={task.id} className="bg-secondary/40">
                        <CardHeader>
                          <CardTitle className="text-lg line-through text-muted-foreground">{task.title}</CardTitle>
                           {task.completedAt && (
                            <CardDescription className="text-xs">
                                Completed: {format(new Date(task.completedAt), "MMM d, yyyy")}
                            </CardDescription>
                        )}
                        </CardHeader>
                      </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
