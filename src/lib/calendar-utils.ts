// Calendar utility functions
import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  eachDayOfInterval,
  eachHourOfInterval,
  format,
  isSameDay,
  isSameWeek,
  isSameMonth,
  addDays,
  addWeeks,
  addMonths,
  isToday,
  isThisWeek,
  isThisMonth
} from 'date-fns';
import type { Task, CalendarEvent, TimeBlock, CalendarView } from './types';

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  events: CalendarEvent[];
  timeBlocks: TimeBlock[];
}

export interface CalendarWeek {
  days: CalendarDay[];
  weekNumber: number;
}

export interface CalendarMonth {
  weeks: CalendarWeek[];
  month: number;
  year: number;
}

export class CalendarUtils {
  static getDaysInView(date: Date, view: CalendarView, weekStartsOn: number = 1): Date[] {
    switch (view) {
      case 'day':
        return [startOfDay(date)];
      
      case 'week':
        const startOfWeekDate = startOfWeek(date, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        const endOfWeekDate = endOfWeek(date, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        return eachDayOfInterval({ start: startOfWeekDate, end: endOfWeekDate });
      
      case 'month':
        const startOfMonthDate = startOfMonth(date);
        const endOfMonthDate = endOfMonth(date);
        const startOfCalendar = startOfWeek(startOfMonthDate, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        const endOfCalendar = endOfWeek(endOfMonthDate, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        return eachDayOfInterval({ start: startOfCalendar, end: endOfCalendar });
      
      default:
        return [date];
    }
  }

  static getHoursInDay(date: Date, workingHours?: { start: string; end: string }): Date[] {
    if (workingHours) {
      const [startHour, startMinute] = workingHours.start.split(':').map(Number);
      const [endHour, endMinute] = workingHours.end.split(':').map(Number);
      
      const startTime = new Date(date);
      startTime.setHours(startHour, startMinute, 0, 0);
      
      const endTime = new Date(date);
      endTime.setHours(endHour, endMinute, 0, 0);
      
      return eachHourOfInterval({ start: startTime, end: endTime });
    }
    
    // Default to full day (24 hours)
    return eachHourOfInterval({ 
      start: startOfDay(date), 
      end: endOfDay(date) 
    });
  }

  static filterTasksForDate(tasks: Task[], date: Date): Task[] {
    return tasks.filter(task => {
      if (task.scheduledAt) {
        return isSameDay(new Date(task.scheduledAt), date);
      }
      return false;
    });
  }

  static filterTasksForPeriod(tasks: Task[], startDate: Date, endDate: Date): Task[] {
    return tasks.filter(task => {
      if (task.scheduledAt) {
        const taskDate = new Date(task.scheduledAt);
        return taskDate >= startDate && taskDate <= endDate;
      }
      return false;
    });
  }

  static getTasksForView(tasks: Task[], date: Date, view: CalendarView, weekStartsOn: number = 1): Task[] {
    switch (view) {
      case 'day':
        return this.filterTasksForDate(tasks, date);
      
      case 'week':
        const weekStart = startOfWeek(date, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        const weekEnd = endOfWeek(date, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        return this.filterTasksForPeriod(tasks, weekStart, weekEnd);
      
      case 'month':
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        return this.filterTasksForPeriod(tasks, monthStart, monthEnd);
      
      case 'agenda':
        // For agenda view, show upcoming tasks for next 30 days
        const agendaEnd = addDays(date, 30);
        return this.filterTasksForPeriod(tasks, date, agendaEnd);
      
      default:
        return [];
    }
  }

  static createTimeGrid(date: Date, intervalMinutes: number = 30): { time: Date; label: string }[] {
    const grid: { time: Date; label: string }[] = [];
    const start = startOfDay(date);
    const end = endOfDay(date);
    
    let current = start;
    while (current <= end) {
      grid.push({
        time: new Date(current),
        label: format(current, 'HH:mm')
      });
      current = new Date(current.getTime() + intervalMinutes * 60 * 1000);
    }
    
    return grid;
  }

  static getOverlappingTasks(tasks: Task[], timeSlot: Date, durationMinutes: number): Task[] {
    const slotStart = timeSlot.getTime();
    const slotEnd = slotStart + (durationMinutes * 60 * 1000);
    
    return tasks.filter(task => {
      if (!task.scheduledAt || !task.scheduledEndAt) return false;
      
      const taskStart = task.scheduledAt;
      const taskEnd = task.scheduledEndAt;
      
      // Check for overlap
      return taskStart < slotEnd && taskEnd > slotStart;
    });
  }

  static calculateTaskPosition(task: Task, dayStart: Date): { top: number; height: number } | null {
    if (!task.scheduledAt || !task.scheduledEndAt) return null;
    
    const minutesInDay = 24 * 60;
    const dayStartTime = dayStart.getTime();
    
    const taskStartMinutes = (task.scheduledAt - dayStartTime) / (1000 * 60);
    const taskDurationMinutes = (task.scheduledEndAt - task.scheduledAt) / (1000 * 60);
    
    return {
      top: (taskStartMinutes / minutesInDay) * 100, // percentage from top
      height: (taskDurationMinutes / minutesInDay) * 100 // percentage height
    };
  }

  static formatTimeRange(start: number, end: number): string {
    return `${format(new Date(start), 'HH:mm')} - ${format(new Date(end), 'HH:mm')}`;
  }

  static getColorForPriority(priority: string): string {
    switch (priority) {
      case 'Critical': return '#ef4444'; // red-500
      case 'High': return '#f97316'; // orange-500
      case 'Medium': return '#eab308'; // yellow-500
      case 'Low': return '#22c55e'; // green-500
      default: return '#6b7280'; // gray-500
    }
  }

  static getColorForCategory(category: string): string {
    // Generate consistent colors based on category name
    const colors = [
      '#3b82f6', // blue-500
      '#8b5cf6', // violet-500
      '#ec4899', // pink-500
      '#06b6d4', // cyan-500
      '#84cc16', // lime-500
      '#f59e0b', // amber-500
      '#ef4444', // red-500
      '#10b981', // emerald-500
    ];
    
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  static isTimeSlotAvailable(
    tasks: Task[], 
    startTime: number, 
    durationMinutes: number,
    excludeTaskId?: string
  ): boolean {
    const endTime = startTime + (durationMinutes * 60 * 1000);
    
    return !tasks.some(task => {
      if (task.id === excludeTaskId) return false;
      if (!task.scheduledAt || !task.scheduledEndAt) return false;
      
      // Check for overlap
      return task.scheduledAt < endTime && task.scheduledEndAt > startTime;
    });
  }

  static findNextAvailableSlot(
    tasks: Task[],
    preferredStartTime: number,
    durationMinutes: number,
    workingHours?: { start: string; end: string }
  ): number | null {
    const slotDuration = durationMinutes * 60 * 1000;
    let currentTime = preferredStartTime;
    const maxSearchDays = 30; // Search up to 30 days ahead
    
    for (let day = 0; day < maxSearchDays; day++) {
      const dayStart = startOfDay(new Date(currentTime));
      const dayEnd = endOfDay(new Date(currentTime));
      
      // Set working hours if specified
      let searchStart = dayStart.getTime();
      let searchEnd = dayEnd.getTime();
      
      if (workingHours) {
        const [startHour, startMinute] = workingHours.start.split(':').map(Number);
        const [endHour, endMinute] = workingHours.end.split(':').map(Number);
        
        const workStart = new Date(dayStart);
        workStart.setHours(startHour, startMinute, 0, 0);
        
        const workEnd = new Date(dayStart);
        workEnd.setHours(endHour, endMinute, 0, 0);
        
        searchStart = Math.max(searchStart, workStart.getTime());
        searchEnd = Math.min(searchEnd, workEnd.getTime());
      }
      
      // If this is the first day, start from the preferred time
      if (day === 0) {
        searchStart = Math.max(searchStart, preferredStartTime);
      }
      
      // Search in 15-minute increments
      const increment = 15 * 60 * 1000;
      for (let time = searchStart; time + slotDuration <= searchEnd; time += increment) {
        if (this.isTimeSlotAvailable(tasks, time, durationMinutes)) {
          return time;
        }
      }
      
      // Move to next day
      currentTime = addDays(new Date(currentTime), 1).getTime();
    }
    
    return null; // No available slot found
  }
}
