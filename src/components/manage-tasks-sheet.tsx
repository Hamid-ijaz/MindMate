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
import { PlusCircle, List, Trash2, Edit } from "lucide-react";
import { TaskForm } from "./task-form";
import { useTasks } from "@/contexts/task-context";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

export function ManageTasksSheet() {
  const { tasks, deleteTask } = useTasks();
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);

  const handleFormFinish = () => {
    setEditingTask(null);
  };
  
  const uncompletedTasks = tasks.filter(t => !t.completedAt);

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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Task
            </TabsTrigger>
            <TabsTrigger value="manage">
              <List className="mr-2 h-4 w-4" />
              All Tasks
            </TabsTrigger>
          </TabsList>
          <TabsContent value="add" className="py-4">
             <TaskForm onFinished={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="manage">
            <ScrollArea className="h-[calc(100vh-10rem)] pr-4">
              <div className="space-y-4 py-4">
                {uncompletedTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground pt-8">No tasks yet. Add one!</p>
                ) : (
                  uncompletedTasks.map((task) => (
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
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
