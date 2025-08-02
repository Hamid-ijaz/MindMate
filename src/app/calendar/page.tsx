"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Timer, Settings, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarComponent } from '@/components/calendar/calendar-component';
import { PomodoroTimer } from '@/components/pomodoro-timer';
import { useTasks } from '@/contexts/task-context';
import type { Task } from '@/lib/types';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

export default function CalendarPage() {
  const { tasks } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState('calendar');

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setActiveTab('pomodoro'); // Switch to pomodoro tab when task is selected
  };

  const handleTimeSlotClick = (date: Date, hour?: number) => {
    // This could open the time block dialog or create a new task
    console.log('Time slot clicked:', date, hour);
  };

  // Calculate some quick stats
  const scheduledTasks = tasks.filter((task: Task) => task.scheduledAt);
  const timeBlockedTasks = tasks.filter((task: Task) => task.isTimeBlocked);
  const totalPomodoros = tasks.reduce((acc: number, task: Task) => acc + (task.pomodoroSessions || 0), 0);
  const totalTimeSpent = tasks.reduce((acc: number, task: Task) => acc + (task.timeSpent || 0), 0);

  return (
    <motion.div
      className="container mx-auto max-w-7xl py-8 md:py-12 px-4"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl mb-2">
          Calendar & Time Management
        </h1>
        <p className="text-muted-foreground">
          Schedule tasks, manage time blocks, and track your productivity with the Pomodoro technique.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-2xl font-bold text-primary">{scheduledTasks.length}</p>
              <p className="text-xs text-muted-foreground">Scheduled Tasks</p>
            </div>
            <Calendar className="h-8 w-8 text-primary/60" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-2xl font-bold text-orange-600">{timeBlockedTasks.length}</p>
              <p className="text-xs text-muted-foreground">Time Blocked</p>
            </div>
            <Settings className="h-8 w-8 text-orange-600/60" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-2xl font-bold text-purple-600">{totalPomodoros}</p>
              <p className="text-xs text-muted-foreground">Pomodoros</p>
            </div>
            <Timer className="h-8 w-8 text-purple-600/60" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-2xl font-bold text-green-600">
                {Math.round(totalTimeSpent / 60)}h
              </p>
              <p className="text-xs text-muted-foreground">Time Spent</p>
            </div>
            <BarChart3 className="h-8 w-8 text-green-600/60" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="calendar" className="space-y-6" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="timeblock">Time Blocking</TabsTrigger>
          <TabsTrigger value="pomodoro">Pomodoro Timer</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <div className="grid gap-6">
            <CalendarComponent
              onTaskClick={handleTaskClick}
              onTimeSlotClick={handleTimeSlotClick}
            />
          </div>
        </TabsContent>

        <TabsContent value="timeblock">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Time Block Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  This feature will allow you to create and manage time blocks for focused work sessions.
                </p>
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Time blocking interface coming soon!</p>
                  <p className="text-sm">For now, you can schedule tasks in the calendar view.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pomodoro">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <PomodoroTimer task={selectedTask || undefined} />
            </div>
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Available Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  {tasks.filter((task: Task) => !task.completedAt).length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid gap-2">
                        {tasks
                          .filter((task: Task) => !task.completedAt)
                          .slice(0, 10)
                          .map((task: Task) => (
                            <div
                              key={task.id}
                              onClick={() => setSelectedTask(task)}
                              className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                            >
                              <h4 className="font-medium mb-1">{task.title}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{task.category}</span>
                                <span>•</span>
                                <span>{task.priority}</span>
                                <span>•</span>
                                <span>{task.duration} min</span>
                                {task.pomodoroSessions && (
                                  <>
                                    <span>•</span>
                                    <span>{task.pomodoroSessions} 🍅</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                      
                      {tasks.filter((task: Task) => !task.completedAt).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Timer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No pending tasks found.</p>
                          <p className="text-sm">Create some tasks to start your focus sessions!</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Timer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No pending tasks found.</p>
                      <p className="text-sm">Create some tasks to start your focus sessions!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
