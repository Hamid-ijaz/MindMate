"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, isToday, isSameHour } from 'date-fns';
import { Clock, MapPin, Users, MoreVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarUtils } from '@/lib/calendar-utils';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CalendarDayViewProps {
  date: Date;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTimeSlotClick?: (date: Date, hour?: number) => void;
  isLoading?: boolean;
}

export function CalendarDayView({
  date,
  tasks,
  onTaskClick,
  onTimeSlotClick,
  isLoading = false
}: CalendarDayViewProps) {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<Date | null>(null);

  // Filter tasks for this specific day
  const dayTasks = useMemo(() => 
    CalendarUtils.filterTasksForDate(tasks, date), 
    [tasks, date]
  );

  // Create time grid (24 hours with 30-minute intervals)
  const timeGrid = useMemo(() => 
    CalendarUtils.createTimeGrid(date, 30), 
    [date]
  );

  const handleTimeSlotClick = useCallback((timeSlot: Date) => {
    setSelectedTimeSlot(timeSlot);
    const hour = timeSlot.getHours();
    onTimeSlotClick?.(date, hour);
  }, [date, onTimeSlotClick]);

  const handleTaskClick = useCallback((task: Task, event: React.MouseEvent) => {
    event.stopPropagation();
    onTaskClick?.(task);
  }, [onTaskClick]);

  const getTasksForTimeSlot = useCallback((timeSlot: Date, duration: number = 30) => {
    return CalendarUtils.getOverlappingTasks(dayTasks, timeSlot, duration);
  }, [dayTasks]);

  const renderTask = useCallback((task: Task, index: number) => {
    const position = CalendarUtils.calculateTaskPosition(task, timeGrid[0]?.time || date);
    if (!position) return null;

    const priorityColor = CalendarUtils.getColorForPriority(task.priority);
    const categoryColor = CalendarUtils.getColorForCategory(task.category);

    return (
      <motion.div
        key={task.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        className={cn(
          "absolute left-12 right-2 rounded-lg border-l-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]",
          task.completedAt 
            ? "bg-muted/50 border-l-green-500" 
            : "bg-card border-l-primary shadow-sm"
        )}
        style={{
          top: `${position.top}%`,
          height: `${Math.max(position.height, 8)}%`, // Minimum height
          borderLeftColor: task.completedAt ? '#10b981' : priorityColor,
          zIndex: 10 + index
        }}
        onClick={(e) => handleTaskClick(task, e)}
      >
        <div className="p-2 h-full overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className={cn(
                "text-sm font-medium truncate",
                task.completedAt && "line-through text-muted-foreground"
              )}>
                {task.title}
              </h4>
              
              {task.scheduledAt && task.scheduledEndAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  {CalendarUtils.formatTimeRange(task.scheduledAt, task.scheduledEndAt)}
                </p>
              )}
              
              <div className="flex items-center gap-1 mt-1">
                <Badge 
                  variant="secondary" 
                  className="text-xs px-1 py-0"
                  style={{ backgroundColor: `${categoryColor}15`, color: categoryColor }}
                >
                  {task.category}
                </Badge>
                
                <Badge 
                  variant="outline" 
                  className="text-xs px-1 py-0"
                  style={{ borderColor: priorityColor, color: priorityColor }}
                >
                  {task.priority}
                </Badge>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                // Handle task options
              }}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </div>
          
          {task.description && position.height > 15 && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {task.description}
            </p>
          )}
          
          {(task.location || task.attendees?.length) && position.height > 20 && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              {task.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{task.location}</span>
                </div>
              )}
              
              {task.attendees?.length && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{task.attendees.length}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  }, [handleTaskClick, timeGrid, date]);

  if (isLoading) {
    return (
      <div className="h-full p-4">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Day Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {format(date, 'EEEE, MMMM d')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {dayTasks.length} tasks scheduled
            </p>
          </div>
          
          {isToday(date) && (
            <Badge variant="default" className="bg-primary/10 text-primary">
              Today
            </Badge>
          )}
        </div>
      </div>

      {/* Time Grid */}
      <ScrollArea className="flex-1">
        <div className="relative min-h-[1200px]"> {/* 24 hours * 50px per hour */}
          {/* Time labels and grid lines */}
          {timeGrid.map((timeSlot, index) => {
            const isHourMark = timeSlot.time.getMinutes() === 0;
            const tasksInSlot = getTasksForTimeSlot(timeSlot.time);
            
            return (
              <div
                key={index}
                className={cn(
                  "relative flex items-start border-b cursor-pointer transition-colors hover:bg-muted/30",
                  isHourMark ? "border-border h-12" : "border-muted h-6",
                  selectedTimeSlot && 
                  isSameHour(selectedTimeSlot, timeSlot.time) && 
                  "bg-primary/5"
                )}
                onClick={() => handleTimeSlotClick(timeSlot.time)}
              >
                {/* Time Label */}
                {isHourMark && (
                  <div className="w-12 pr-2 text-right">
                    <span className="text-xs text-muted-foreground font-mono">
                      {timeSlot.label}
                    </span>
                  </div>
                )}
                
                {/* Content Area */}
                <div className="flex-1 relative">
                  {tasksInSlot.length === 0 && isHourMark && (
                    <div className={cn(
                      "absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity",
                      "text-xs text-muted-foreground"
                    )}>
                      Click to schedule
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Render Tasks */}
          {dayTasks.map((task, index) => renderTask(task, index))}
          
          {/* Current Time Indicator */}
          {isToday(date) && (
            <motion.div
              className="absolute left-0 right-0 h-0.5 bg-red-500 z-20"
              style={{
                top: `${(new Date().getHours() * 60 + new Date().getMinutes()) / (24 * 60) * 100}%`
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
              <div className="absolute -right-16 -top-2 text-xs text-red-500 font-mono">
                {format(new Date(), 'HH:mm')}
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* All-day tasks */}
      {dayTasks.filter(task => task.isAllDay).length > 0 && (
        <div className="border-t bg-card p-4">
          <h4 className="text-sm font-medium mb-2">All Day</h4>
          <div className="space-y-2">
            {dayTasks
              .filter(task => task.isAllDay)
              .map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]",
                      task.completedAt && "opacity-60"
                    )}
                    onClick={() => onTaskClick?.(task)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h5 className={cn(
                            "text-sm font-medium",
                            task.completedAt && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </h5>
                          
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {task.category}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                        
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
