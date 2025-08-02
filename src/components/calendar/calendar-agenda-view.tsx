"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isTomorrow, isYesterday, addDays, differenceInDays, isSameDay } from 'date-fns';
import { Calendar, Clock, MapPin, Users, CheckCircle, Circle, Timer, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { CalendarUtils } from '@/lib/calendar-utils';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CalendarAgendaViewProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onDateClick?: (date: Date) => void;
  isLoading?: boolean;
  daysAhead?: number;
}

interface AgendaDay {
  date: Date;
  tasks: Task[];
  label: string;
  isToday: boolean;
  isOverdue: boolean;
}

export function CalendarAgendaView({
  tasks,
  onTaskClick,
  onDateClick,
  isLoading = false,
  daysAhead = 30
}: CalendarAgendaViewProps) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');

  // Group tasks by date for agenda view
  const agendaDays = useMemo((): AgendaDay[] => {
    const today = new Date();
    const days: AgendaDay[] = [];
    
    // Add days with tasks
    const taskDates = new Set<string>();
    const filteredTasks = tasks.filter(task => {
      if (filter === 'completed' && !task.completedAt) return false;
      if (filter === 'pending' && task.completedAt) return false;
      if (filter === 'overdue' && (task.completedAt || !task.scheduledAt || task.scheduledAt > today.getTime())) return false;
      return task.scheduledAt; // Only show scheduled tasks
    });

    filteredTasks.forEach(task => {
      if (task.scheduledAt) {
        const dateKey = format(new Date(task.scheduledAt), 'yyyy-MM-dd');
        taskDates.add(dateKey);
      }
    });

    // Create agenda days
    Array.from(taskDates).sort().forEach(dateKey => {
      const date = new Date(dateKey + 'T00:00:00');
      const dayTasks = filteredTasks.filter(task => 
        task.scheduledAt && isSameDay(new Date(task.scheduledAt), date)
      ).sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0));

      if (dayTasks.length > 0) {
        days.push({
          date,
          tasks: dayTasks,
          label: getDateLabel(date),
          isToday: isToday(date),
          isOverdue: date < today && dayTasks.some(task => !task.completedAt)
        });
      }
    });

    // Add upcoming days with no tasks (for context)
    for (let i = 0; i < daysAhead; i++) {
      const date = addDays(today, i);
      const dateKey = format(date, 'yyyy-MM-dd');
      if (!taskDates.has(dateKey) && i < 7) { // Only show next 7 empty days
        days.push({
          date,
          tasks: [],
          label: getDateLabel(date),
          isToday: isToday(date),
          isOverdue: false
        });
      }
    }

    return days.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [tasks, filter, daysAhead]);

  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    
    const daysDiff = differenceInDays(date, new Date());
    if (daysDiff > 0 && daysDiff <= 7) {
      return `${format(date, 'EEEE')} (in ${daysDiff} day${daysDiff !== 1 ? 's' : ''})`;
    }
    if (daysDiff < 0 && daysDiff >= -7) {
      return `${format(date, 'EEEE')} (${Math.abs(daysDiff)} day${Math.abs(daysDiff) !== 1 ? 's' : ''} ago)`;
    }
    
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const toggleDayExpansion = useCallback((dateKey: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  }, []);

  const handleTaskClick = useCallback((task: Task, event: React.MouseEvent) => {
    event.stopPropagation();
    onTaskClick?.(task);
  }, [onTaskClick]);

  const handleDateClick = useCallback((date: Date) => {
    onDateClick?.(date);
  }, [onDateClick]);

  const renderTask = useCallback((task: Task, index: number) => {
    const priorityColor = CalendarUtils.getColorForPriority(task.priority);
    const categoryColor = CalendarUtils.getColorForCategory(task.category);
    const isCompleted = !!task.completedAt;
    const isOverdue = task.scheduledAt && task.scheduledAt < new Date().getTime() && !isCompleted;

    return (
      <motion.div
        key={task.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={cn(
          "group border rounded-lg cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]",
          isCompleted 
            ? "bg-green-50 border-green-200" 
            : isOverdue
              ? "bg-red-50 border-red-200"
              : "bg-card border-border hover:border-primary/50"
        )}
        onClick={(e) => handleTaskClick(task, e)}
      >
        <div className="flex items-start gap-3 p-4">
          {/* Completion Status */}
          <div className="flex-shrink-0 mt-0.5">
            {isCompleted ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
            )}
          </div>

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className={cn(
                  "font-medium text-sm mb-1",
                  isCompleted && "line-through text-muted-foreground"
                )}>
                  {task.title}
                </h4>
                
                {task.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {task.description}
                  </p>
                )}
                
                <div className="flex items-center gap-2 mb-2">
                  <Badge 
                    variant="secondary" 
                    className="text-xs"
                    style={{ backgroundColor: `${categoryColor}15`, color: categoryColor }}
                  >
                    {task.category}
                  </Badge>
                  
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                    style={{ borderColor: priorityColor, color: priorityColor }}
                  >
                    {task.priority}
                  </Badge>

                  {isOverdue && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Overdue
                    </Badge>
                  )}
                </div>
              </div>

              {/* Time */}
              <div className="flex flex-col items-end text-right">
                {task.scheduledAt && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {task.scheduledEndAt ? (
                      <span>
                        {format(new Date(task.scheduledAt), 'HH:mm')} - {format(new Date(task.scheduledEndAt), 'HH:mm')}
                      </span>
                    ) : (
                      <span>{format(new Date(task.scheduledAt), 'HH:mm')}</span>
                    )}
                  </div>
                )}
                
                {task.duration && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {task.duration} min
                  </div>
                )}
              </div>
            </div>

            {/* Additional Details */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {task.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">{task.location}</span>
                </div>
              )}
              
              {task.attendees?.length && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{task.attendees.length} attendee{task.attendees.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              
              {task.pomodoroSessions && (
                <div className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  <span>{task.pomodoroSessions} pomodoro{task.pomodoroSessions !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }, [handleTaskClick]);

  const renderDay = useCallback((day: AgendaDay, dayIndex: number) => {
    const dateKey = format(day.date, 'yyyy-MM-dd');
    const isExpanded = expandedDays.has(dateKey);
    const completedTasks = day.tasks.filter(t => t.completedAt).length;
    const totalTasks = day.tasks.length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return (
      <motion.div
        key={dateKey}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: dayIndex * 0.1 }}
      >
        <Card className={cn(
          "mb-4 overflow-hidden transition-all",
          day.isToday && "ring-2 ring-primary/20 bg-primary/5",
          day.isOverdue && "ring-2 ring-red-200 bg-red-50"
        )}>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => {
              if (day.tasks.length > 0) {
                toggleDayExpansion(dateKey);
              } else {
                handleDateClick(day.date);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className={cn(
                    "text-base",
                    day.isToday && "text-primary"
                  )}>
                    {day.label}
                  </CardTitle>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {format(day.date, 'MMM d, yyyy')}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {totalTasks > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">
                      <span className="text-green-600 font-medium">{completedTasks}</span>
                      /{totalTasks}
                    </div>
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                )}
                
                <Badge variant={totalTasks > 0 ? "default" : "secondary"}>
                  {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <AnimatePresence>
            {(isExpanded || day.tasks.length <= 3) && day.tasks.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {day.tasks.map((task, index) => renderTask(task, index))}
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>

          {!isExpanded && day.tasks.length > 3 && (
            <CardContent className="pt-0">
              <div className="space-y-3">
                {day.tasks.slice(0, 3).map((task, index) => renderTask(task, index))}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3"
                onClick={() => toggleDayExpansion(dateKey)}
              >
                Show {day.tasks.length - 3} more task{day.tasks.length - 3 !== 1 ? 's' : ''}
              </Button>
            </CardContent>
          )}

          {day.tasks.length === 0 && (
            <CardContent className="pt-0">
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tasks scheduled</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => handleDateClick(day.date)}
                >
                  Schedule a task
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </motion.div>
    );
  }, [expandedDays, toggleDayExpansion, handleDateClick, renderTask]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filter Controls */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Upcoming Tasks</h3>
            <p className="text-sm text-muted-foreground">
              {agendaDays.reduce((acc, day) => acc + day.tasks.length, 0)} tasks in your agenda
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {(['all', 'pending', 'completed', 'overdue'] as const).map((filterOption) => (
              <Button
                key={filterOption}
                variant={filter === filterOption ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(filterOption)}
                className="capitalize"
              >
                {filterOption}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Agenda List */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {agendaDays.length > 0 ? (
            agendaDays.map((day, index) => renderDay(day, index))
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No tasks found</h3>
              <p className="text-muted-foreground mb-4">
                {filter === 'all' 
                  ? 'You have no scheduled tasks in your agenda.' 
                  : `No ${filter} tasks found.`}
              </p>
              <Button
                variant="outline"
                onClick={() => handleDateClick(new Date())}
              >
                Schedule your first task
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
