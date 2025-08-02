"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Grid, List, Clock, Plus, MoreHorizontal, Settings, Filter, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTasks } from '@/contexts/task-context';
import { CalendarUtils } from '@/lib/calendar-utils';
import type { CalendarView, Task } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CalendarDayView } from '@/components/calendar/calendar-day-view';
import { CalendarWeekView } from '@/components/calendar/calendar-week-view';
import { CalendarMonthView } from '@/components/calendar/calendar-month-view';
import { CalendarAgendaView } from '@/components/calendar/calendar-agenda-view';
import { TimeBlockDialog } from '@/components/calendar/time-block-dialog';
import { CalendarSettings } from '@/components/calendar/calendar-settings-dialog';

interface CalendarComponentProps {
  initialView?: CalendarView;
  onTaskClick?: (task: Task) => void;
  onTimeSlotClick?: (date: Date, hour?: number) => void;
}

export function CalendarComponent({ 
  initialView = 'week',
  onTaskClick,
  onTimeSlotClick 
}: CalendarComponentProps) {
  const { tasks, isLoading } = useTasks();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>(initialView);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTimeBlockDialogOpen, setIsTimeBlockDialogOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: Date; hour?: number } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Get tasks for current view
  const viewTasks = CalendarUtils.getTasksForView(tasks, currentDate, view);

  const handlePrevious = useCallback(() => {
    switch (view) {
      case 'day':
        setCurrentDate(prev => subDays(prev, 1));
        break;
      case 'week':
        setCurrentDate(prev => subWeeks(prev, 1));
        break;
      case 'month':
        setCurrentDate(prev => subMonths(prev, 1));
        break;
      case 'agenda':
        setCurrentDate(prev => subWeeks(prev, 1));
        break;
    }
  }, [view]);

  const handleNext = useCallback(() => {
    switch (view) {
      case 'day':
        setCurrentDate(prev => addDays(prev, 1));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
      case 'month':
        setCurrentDate(prev => addMonths(prev, 1));
        break;
      case 'agenda':
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
    }
  }, [view]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
    onTaskClick?.(task);
  }, [onTaskClick]);

  const handleTimeSlotClick = useCallback((date: Date, hour?: number) => {
    setSelectedTimeSlot({ date, hour });
    setIsTimeBlockDialogOpen(true);
    onTimeSlotClick?.(date, hour);
  }, [onTimeSlotClick]);

  const getViewTitle = () => {
    switch (view) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week':
        const weekStart = CalendarUtils.getDaysInView(currentDate, 'week')[0];
        const weekEnd = CalendarUtils.getDaysInView(currentDate, 'week')[6];
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'agenda':
        return 'Upcoming Tasks';
      default:
        return '';
    }
  };

  const viewIcons = {
    day: Calendar,
    week: Grid,
    month: Grid,
    agenda: List
  };

  const getViewIcon = (viewType: CalendarView) => {
    const Icon = viewIcons[viewType];
    return <Icon className="h-4 w-4" />;
  };

  const getViewLabel = (viewType: CalendarView) => {
    return viewType.charAt(0).toUpperCase() + viewType.slice(1);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-background">
        {/* Modern Calendar Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
          {/* Main Header */}
          <div className="flex items-center justify-between px-4 py-3 md:px-6">
            {/* Left Section - Navigation */}
            <div className="flex items-center gap-1">
              <div className="flex items-center bg-muted/50 rounded-lg p-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrevious}
                      className="h-8 w-8 p-0 hover:bg-background"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Previous {view}</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToday}
                      className="h-8 px-3 text-sm font-medium hover:bg-background"
                    >
                      Today
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Go to today</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNext}
                      className="h-8 w-8 p-0 hover:bg-background"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Next {view}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Center Section - Title */}
            <div className="flex-1 text-center px-4">
              <motion.h1
                key={`${view}-${currentDate.toISOString()}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-lg md:text-xl font-semibold text-foreground truncate"
              >
                {getViewTitle()}
              </motion.h1>
            </div>

            {/* Right Section - Actions */}
            <div className="flex items-center gap-2">
              {/* View Selector - Mobile Dropdown, Desktop Tabs */}
              <div className="hidden sm:block">
                <div className="flex items-center bg-muted/50 rounded-lg p-1">
                  {(['day', 'week', 'month', 'agenda'] as CalendarView[]).map((viewOption) => (
                    <Tooltip key={viewOption}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={view === viewOption ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setView(viewOption)}
                          className={cn(
                            "h-8 px-3 text-xs font-medium transition-all duration-200",
                            view === viewOption 
                              ? "bg-background shadow-sm" 
                              : "hover:bg-background/50"
                          )}
                        >
                          {getViewIcon(viewOption)}
                          <span className="ml-1.5 hidden md:inline">
                            {getViewLabel(viewOption)}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{getViewLabel(viewOption)} view</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Mobile View Selector */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 px-3">
                      {getViewIcon(view)}
                      <span className="ml-1.5 text-xs font-medium">
                        {getViewLabel(view)}
                      </span>
                      <ChevronRight className="h-3 w-3 ml-1 rotate-90" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    {(['day', 'week', 'month', 'agenda'] as CalendarView[]).map((viewOption) => (
                      <DropdownMenuItem
                        key={viewOption}
                        onClick={() => setView(viewOption)}
                        className="flex items-center gap-2"
                      >
                        {getViewIcon(viewOption)}
                        <span className="font-medium">{getViewLabel(viewOption)}</span>
                        {view === viewOption && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={() => handleTimeSlotClick(new Date())}
                      className="h-9 px-3 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="ml-1.5 hidden sm:inline text-sm font-medium">
                        Schedule
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Create new task</p>
                  </TooltipContent>
                </Tooltip>

                {/* More Options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Calendar Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Filter className="h-4 w-4 mr-2" />
                      Filter Tasks
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Calendar className="h-4 w-4 mr-2" />
                      Sync Calendars
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Quick Stats Bar - Mobile Responsive */}
          <div className="px-4 pb-3 md:px-6">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4 overflow-x-auto">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span className="text-muted-foreground">
                    {viewTasks.filter(t => !t.completedAt).length} pending
                  </span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-muted-foreground">
                    {viewTasks.filter(t => t.completedAt).length} completed
                  </span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  <span className="text-muted-foreground">
                    {viewTasks.filter(t => t.isTimeBlocked).length} time blocked
                  </span>
                </div>
              </div>
              
              <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">
                  {viewTasks.reduce((acc, t) => acc + (t.pomodoroSessions || 0), 0)} pomodoros
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Body */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${view}-${currentDate.toISOString()}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {view === 'day' && (
                <CalendarDayView
                  date={currentDate}
                  tasks={viewTasks}
                  onTaskClick={handleTaskClick}
                  onTimeSlotClick={handleTimeSlotClick}
                  isLoading={isLoading}
                />
              )}
              
              {view === 'week' && (
                <CalendarWeekView
                  date={currentDate}
                  tasks={viewTasks}
                  onTaskClick={handleTaskClick}
                  onTimeSlotClick={handleTimeSlotClick}
                  isLoading={isLoading}
                />
              )}
              
              {view === 'month' && (
                <CalendarMonthView
                  date={currentDate}
                  tasks={viewTasks}
                  onTaskClick={handleTaskClick}
                  onDateClick={(date: Date) => {
                    setCurrentDate(date);
                    setView('day');
                  }}
                  isLoading={isLoading}
                />
              )}
              
              {view === 'agenda' && (
                <CalendarAgendaView
                  tasks={viewTasks}
                  onTaskClick={handleTaskClick}
                  onDateClick={(date: Date) => {
                    setCurrentDate(date);
                    setView('day');
                  }}
                  isLoading={isLoading}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Time Block Dialog */}
        <TimeBlockDialog
          open={isTimeBlockDialogOpen}
          onOpenChange={setIsTimeBlockDialogOpen}
          selectedDate={selectedTimeSlot?.date}
          selectedHour={selectedTimeSlot?.hour}
          onTaskScheduled={(task: Task) => {
            setIsTimeBlockDialogOpen(false);
            setSelectedTimeSlot(null);
          }}
        />
      )}

      <CalendarSettings
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        currentView={view}
        onViewChange={setView}
      />
    </div>
  </TooltipProvider>
  );
}
