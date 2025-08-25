"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarComponent } from '@/components/calendar/calendar-component';
import { useTasks } from '@/contexts/task-context';
import type { Task } from '@/lib/types';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

export default function CalendarPage() {
  const { tasks } = useTasks();

  const handleTaskClick = (task: Task) => {
    // Handle task click - could open task details
    console.log('Task clicked:', task);
  };

  const handleTimeSlotClick = (date: Date, hour?: number) => {
    // This could open the time block dialog or create a new task
    console.log('Time slot clicked:', date, hour);
  };

  // Calculate some quick stats
  const scheduledTasks = tasks.filter((task: Task) => task.scheduledAt);
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
          Calendar & Scheduling
        </h1>
        <p className="text-muted-foreground">
          View and manage your scheduled tasks in a beautiful calendar interface.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-8">
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
              <p className="text-2xl font-bold text-green-600">
                {Math.round(totalTimeSpent / 60)}h
              </p>
              <p className="text-xs text-muted-foreground">Total Time Logged</p>
            </div>
            <BarChart3 className="h-8 w-8 text-green-600/60" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <CalendarComponent
          onTaskClick={handleTaskClick}
          onTimeSlotClick={handleTimeSlotClick}
        />
      </div>
    </motion.div>
  );
}
