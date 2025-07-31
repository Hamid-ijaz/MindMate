"use client";

import React, { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, isToday, isSameMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { Plus, MoreHorizontal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarUtils } from '@/lib/calendar-utils';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CalendarMonthViewProps {
  date: Date;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onDateClick?: (date: Date) => void;
  isLoading?: boolean;
  weekStartsOn?: number;
}

export function CalendarMonthView({
  date,
  tasks,
  onTaskClick,
  onDateClick,
  isLoading = false,
  weekStartsOn = 1 // Monday
}: CalendarMonthViewProps) {
  
  // Get all days to display in the month view (including previous/next month days)
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(date), { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    const end = endOfWeek(endOfMonth(date), { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    return eachDayOfInterval({ start, end });
  }, [date, weekStartsOn]);

  // Filter tasks for this month (extended to include visible days)
  const monthTasks = useMemo(() => 
    CalendarUtils.getTasksForView(tasks, date, 'month', weekStartsOn), 
    [tasks, date, weekStartsOn]
  );

  const handleDateClick = useCallback((clickedDate: Date) => {
    onDateClick?.(clickedDate);
  }, [onDateClick]);

  const handleTaskClick = useCallback((task: Task, event: React.MouseEvent) => {
    event.stopPropagation();
    onTaskClick?.(task);
  }, [onTaskClick]);

  const getTasksForDate = useCallback((targetDate: Date) => {
    return CalendarUtils.filterTasksForDate(monthTasks, targetDate);
  }, [monthTasks]);

  const renderDay = useCallback((day: Date, dayIndex: number) => {
    const dayTasks = getTasksForDate(day);
    const isCurrentMonth = isSameMonth(day, date);
    const isCurrentDay = isToday(day);
    const maxVisibleTasks = 3;
    const visibleTasks = dayTasks.slice(0, maxVisibleTasks);
    const hiddenTasksCount = Math.max(0, dayTasks.length - maxVisibleTasks);

    return (
      <motion.div
        key={day.toISOString()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: dayIndex * 0.01 }}
        className={cn(
          "min-h-[120px] border-b border-r cursor-pointer transition-all hover:bg-muted/30",
          !isCurrentMonth && "bg-muted/10 text-muted-foreground",
          isCurrentDay && "bg-primary/5 border-primary/20"
        )}
        onClick={() => handleDateClick(day)}
      >
        <div className="p-2 h-full flex flex-col">
          {/* Day Number */}
          <div className="flex items-center justify-between mb-2">
            <span className={cn(
              "text-sm font-medium",
              isCurrentDay && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs"
            )}>
              {format(day, 'd')}
            </span>
            
            {dayTasks.length > 0 && (
              <Badge variant="secondary" className="text-xs h-5 px-1">
                {dayTasks.length}
              </Badge>
            )}
          </div>

          {/* Tasks */}
          <div className="space-y-1 flex-1 overflow-hidden">
            {visibleTasks.map((task, taskIndex) => {
              const priorityColor = CalendarUtils.getColorForPriority(task.priority);
              const categoryColor = CalendarUtils.getColorForCategory(task.category);
              
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: taskIndex * 0.05 }}
                  className={cn(
                    "px-2 py-1 rounded text-xs cursor-pointer transition-all hover:scale-[1.02] border-l-2",
                    task.completedAt 
                      ? "bg-green-50 text-green-800 border-l-green-500 line-through" 
                      : "bg-card border-l-primary shadow-sm hover:shadow-md"
                  )}
                  style={{
                    borderLeftColor: task.completedAt ? '#10b981' : priorityColor
                  }}
                  onClick={(e) => handleTaskClick(task, e)}
                >
                  <div className="font-medium truncate mb-1">
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
                </motion.div>
              );
            })}
            
            {hiddenTasksCount > 0 && (
              <div className="px-2 py-1 text-xs text-muted-foreground flex items-center gap-1">
                <MoreHorizontal className="h-3 w-3" />
                {hiddenTasksCount} more
              </div>
            )}
          </div>

          {/* Add Task Button (visible on hover or for today) */}
          {(isCurrentDay || dayTasks.length === 0) && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 w-6 p-0 mt-auto opacity-0 group-hover:opacity-100 transition-opacity",
                isCurrentDay && "opacity-50 hover:opacity-100"
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleDateClick(day);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  }, [getTasksForDate, date, handleDateClick, handleTaskClick]);

  const renderWeekHeader = () => {
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    if (weekStartsOn === 0) {
      weekDays.unshift(weekDays.pop()!); // Move Sunday to front
    }
    
    return (
      <div className="grid grid-cols-7 border-b bg-card">
        {weekDays.map((day) => (
          <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
            {day}
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-full p-4">
        <div className="grid grid-cols-7 gap-4">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Month Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {format(date, 'MMMM yyyy')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {monthTasks.length} tasks this month
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              <span className="text-green-600 font-semibold">
                {monthTasks.filter(t => t.completedAt).length}
              </span>
              {' '}completed
            </div>
            
            <div className="text-sm text-muted-foreground">
              <span className="text-orange-600 font-semibold">
                {monthTasks.filter(t => !t.completedAt).length}
              </span>
              {' '}pending
            </div>
          </div>
        </div>
      </div>

      {/* Week Headers */}
      {renderWeekHeader()}

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div 
          className="grid grid-cols-7 min-h-full"
          style={{ gridTemplateRows: `repeat(${Math.ceil(calendarDays.length / 7)}, minmax(120px, 1fr))` }}
        >
          {calendarDays.map((day, index) => renderDay(day, index))}
        </div>
      </div>

      {/* Month Statistics */}
      <div className="border-t bg-card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {monthTasks.filter(t => t.isTimeBlocked).length}
            </div>
            <div className="text-xs text-muted-foreground">Time Blocked</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {monthTasks.reduce((acc, t) => acc + (t.pomodoroSessions || 0), 0)}
            </div>
            <div className="text-xs text-muted-foreground">Pomodoros</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(monthTasks.reduce((acc, t) => acc + (t.timeSpent || 0), 0) / 60)}h
            </div>
            <div className="text-xs text-muted-foreground">Time Spent</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {new Set(monthTasks.map(t => t.category)).size}
            </div>
            <div className="text-xs text-muted-foreground">Categories</div>
          </div>
        </div>
      </div>
    </div>
  );
}
