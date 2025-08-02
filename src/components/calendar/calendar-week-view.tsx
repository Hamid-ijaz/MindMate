"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, isToday, isSameDay, startOfWeek, addDays } from 'date-fns';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarUtils } from '@/lib/calendar-utils';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CalendarWeekViewProps {
  date: Date;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTimeSlotClick?: (date: Date, hour?: number) => void;
  isLoading?: boolean;
  weekStartsOn?: number;
}

export function CalendarWeekView({
  date,
  tasks,
  onTaskClick,
  onTimeSlotClick,
  isLoading = false,
  weekStartsOn = 1 // Monday
}: CalendarWeekViewProps) {
  const [showWorkingHoursOnly, setShowWorkingHoursOnly] = useState(true);
  const [workingHours] = useState({ start: '09:00', end: '17:00' });

  // Get all days in the week
  const weekDays = useMemo(() => {
    const start = startOfWeek(date, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [date, weekStartsOn]);

  // Filter tasks for this week
  const weekTasks = useMemo(() => 
    CalendarUtils.getTasksForView(tasks, date, 'week', weekStartsOn), 
    [tasks, date, weekStartsOn]
  );

  // Create time grid
  const timeGrid = useMemo(() => {
    const sampleDay = weekDays[0];
    if (showWorkingHoursOnly) {
      return CalendarUtils.getHoursInDay(sampleDay, workingHours).map(hour => ({
        time: hour,
        label: format(hour, 'HH:mm')
      }));
    }
    return CalendarUtils.createTimeGrid(sampleDay, 60); // 1-hour intervals for week view
  }, [weekDays, showWorkingHoursOnly, workingHours]);

  const handleTimeSlotClick = useCallback((day: Date, hour: number) => {
    onTimeSlotClick?.(day, hour);
  }, [onTimeSlotClick]);

  const handleTaskClick = useCallback((task: Task, event: React.MouseEvent) => {
    event.stopPropagation();
    onTaskClick?.(task);
  }, [onTaskClick]);

  const getTasksForDay = useCallback((day: Date) => {
    return CalendarUtils.filterTasksForDate(weekTasks, day);
  }, [weekTasks]);

  const renderDayColumn = useCallback((day: Date, dayIndex: number) => {
    const dayTasks = getTasksForDay(day);
    const scheduledTasks = dayTasks.filter(task => task.scheduledAt && task.scheduledEndAt);
    const allDayTasks = dayTasks.filter(task => task.isAllDay);

    return (
      <div key={day.toISOString()} className="flex-1 min-w-0 border-r last:border-r-0">
        {/* Day Header */}
        <div className={cn(
          "p-3 border-b text-center bg-card",
          isToday(day) && "bg-primary/5 border-primary/20"
        )}>
          <div className="text-xs font-medium text-muted-foreground uppercase">
            {format(day, 'EEE')}
          </div>
          <div className={cn(
            "text-lg font-semibold mt-1",
            isToday(day) ? "text-primary" : "text-foreground"
          )}>
            {format(day, 'd')}
          </div>
          
          {dayTasks.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* All-day tasks */}
        {allDayTasks.length > 0 && (
          <div className="border-b bg-muted/30 p-2 space-y-1">
            {allDayTasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "px-2 py-1 rounded text-xs cursor-pointer transition-all hover:scale-[1.02]",
                  task.completedAt 
                    ? "bg-green-100 text-green-800 line-through" 
                    : "bg-primary/10 text-primary"
                )}
                onClick={(e) => handleTaskClick(task, e)}
              >
                <div className="font-medium truncate">{task.title}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Time slots */}
        <div className="relative">
          {timeGrid.map((timeSlot, timeIndex) => (
            <div
              key={timeIndex}
              className="h-12 border-b border-muted/30 cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => handleTimeSlotClick(day, timeSlot.time.getHours())}
            >
              {/* Render scheduled tasks for this time slot */}
              {scheduledTasks
                .filter(task => {
                  if (!task.scheduledAt) return false;
                  const taskHour = new Date(task.scheduledAt).getHours();
                  return taskHour === timeSlot.time.getHours();
                })
                .map((task, taskIndex) => {
                  const priorityColor = CalendarUtils.getColorForPriority(task.priority);
                  const categoryColor = CalendarUtils.getColorForCategory(task.category);
                  
                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: taskIndex * 0.1 }}
                      className={cn(
                        "absolute inset-x-1 top-1 bottom-1 rounded border-l-2 cursor-pointer transition-all hover:shadow-sm hover:scale-[1.01]",
                        task.completedAt 
                          ? "bg-muted/50 border-l-green-500" 
                          : "bg-card border-l-primary shadow-sm"
                      )}
                      style={{
                        borderLeftColor: task.completedAt ? '#10b981' : priorityColor,
                        zIndex: 10 + taskIndex
                      }}
                      onClick={(e) => handleTaskClick(task, e)}
                    >
                      <div className="p-1 h-full overflow-hidden">
                        <div className="text-xs font-medium truncate">
                          {task.title}
                        </div>
                        
                        {task.scheduledAt && task.scheduledEndAt && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(task.scheduledAt), 'HH:mm')}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1 mt-1">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: categoryColor }}
                          />
                          <span className="text-xs text-muted-foreground truncate">
                            {task.category}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    );
  }, [getTasksForDay, timeGrid, handleTimeSlotClick, handleTaskClick]);

  if (isLoading) {
    return (
      <div className="h-full p-4">
        <div className="grid grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Week Controls */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              Week of {format(weekDays[0], 'MMM d, yyyy')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {weekTasks.length} tasks scheduled this week
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={showWorkingHoursOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowWorkingHoursOnly(!showWorkingHoursOnly)}
              className="h-8"
            >
              {showWorkingHoursOnly ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Business Hours
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  All Hours
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Week Grid */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* Time Column */}
          <div className="w-16 border-r bg-card">
            <div className="h-20 border-b" /> {/* Header space */}
            <ScrollArea className="h-[calc(100%-5rem)]">
              {timeGrid.map((timeSlot, index) => (
                <div key={index} className="h-12 border-b border-muted/30 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground font-mono">
                    {timeSlot.label}
                  </span>
                </div>
              ))}
            </ScrollArea>
          </div>

          {/* Days Grid */}
          <ScrollArea className="flex-1">
            <div className="flex min-w-full">
              {weekDays.map((day, index) => renderDayColumn(day, index))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Week Summary */}
      <div className="border-t bg-card p-4">
        <div className="grid grid-cols-7 gap-4 text-center">
          {weekDays.map((day, index) => {
            const dayTasks = getTasksForDay(day);
            const completed = dayTasks.filter(t => t.completedAt).length;
            const total = dayTasks.length;
            
            return (
              <div key={index} className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  {format(day, 'EEE')}
                </div>
                <div className="text-sm">
                  <span className="text-green-600 font-semibold">{completed}</span>
                  <span className="text-muted-foreground">/{total}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1">
                  <div 
                    className="bg-green-500 h-1 rounded-full transition-all"
                    style={{ width: total > 0 ? `${(completed / total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
