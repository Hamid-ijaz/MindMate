"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMinutes, startOfDay, endOfDay } from 'date-fns';
import { Clock, Calendar, MapPin, Users, Timer, Save, X, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTasks } from '@/contexts/task-context';
import { CalendarUtils } from '@/lib/calendar-utils';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TimeBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  selectedHour?: number;
  existingTask?: Task;
  onTaskScheduled?: (task: Task) => void;
}

export function TimeBlockDialog({
  open,
  onOpenChange,
  selectedDate,
  selectedHour,
  existingTask,
  onTaskScheduled
}: TimeBlockDialogProps) {
  const { tasks, addTask, updateTask, taskCategories } = useTasks();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(60); // minutes
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [newAttendee, setNewAttendee] = useState('');
  const [estimatedPomodoros, setEstimatedPomodoros] = useState(2);
  const [isTimeBlocked, setIsTimeBlocked] = useState(true);
  
  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<Task[]>([]);

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (existingTask) {
        // Edit existing task
        setTitle(existingTask.title);
        setDescription(existingTask.description || '');
        setCategory(existingTask.category);
        setPriority(existingTask.priority);
        setLocation(existingTask.location || '');
        setAttendees(existingTask.attendees || []);
        setEstimatedPomodoros(existingTask.estimatedPomodoros || 2);
        setIsTimeBlocked(existingTask.isTimeBlocked || false);
        setIsAllDay(existingTask.isAllDay || false);
        
        if (existingTask.scheduledAt) {
          const startDate = new Date(existingTask.scheduledAt);
          setStartTime(format(startDate, 'HH:mm'));
          
          if (existingTask.scheduledEndAt) {
            const durationMinutes = (existingTask.scheduledEndAt - existingTask.scheduledAt) / (1000 * 60);
            setDuration(durationMinutes);
          }
        }
      } else {
        // New task
        setTitle('');
        setDescription('');
        setCategory(taskCategories[0] || 'Work');
        setPriority('Medium');
        setLocation('');
        setAttendees([]);
        setNewAttendee('');
        setEstimatedPomodoros(2);
        setIsTimeBlocked(true);
        setIsAllDay(false);
        
        if (selectedDate && selectedHour !== undefined) {
          const initialTime = new Date(selectedDate);
          initialTime.setHours(selectedHour, 0, 0, 0);
          setStartTime(format(initialTime, 'HH:mm'));
        } else if (selectedDate) {
          setStartTime('09:00');
        }
      }
    }
  }, [open, existingTask, selectedDate, selectedHour, taskCategories]);

  // Calculate scheduled times
  const scheduledTimes = useMemo(() => {
    if (!selectedDate || !startTime || isAllDay) return null;
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const start = new Date(selectedDate);
    start.setHours(hours, minutes, 0, 0);
    const end = addMinutes(start, duration);
    
    return { start: start.getTime(), end: end.getTime() };
  }, [selectedDate, startTime, duration, isAllDay]);

  // Check for conflicts
  useEffect(() => {
    if (scheduledTimes && !isAllDay) {
      const conflictingTasks = tasks.filter((task: Task) => {
        if (task.id === existingTask?.id) return false; // Exclude current task
        if (!task.scheduledAt || !task.scheduledEndAt) return false;
        
        // Check for overlap
        return task.scheduledAt < scheduledTimes.end && task.scheduledEndAt > scheduledTimes.start;
      });
      
      setConflicts(conflictingTasks);
    } else {
      setConflicts([]);
    }
  }, [scheduledTimes, tasks, existingTask, isAllDay]);

  const handleAddAttendee = useCallback(() => {
    if (newAttendee.trim() && !attendees.includes(newAttendee.trim())) {
      setAttendees(prev => [...prev, newAttendee.trim()]);
      setNewAttendee('');
    }
  }, [newAttendee, attendees]);

  const handleRemoveAttendee = useCallback((email: string) => {
    setAttendees(prev => prev.filter(a => a !== email));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      const taskData: Partial<Task> = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        priority,
        duration,
        location: location.trim() || undefined,
        attendees: attendees.length > 0 ? attendees : undefined,
        estimatedPomodoros,
        isTimeBlocked,
        isAllDay,
      };

      if (scheduledTimes && !isAllDay) {
        taskData.scheduledAt = scheduledTimes.start;
        taskData.scheduledEndAt = scheduledTimes.end;
      } else if (isAllDay && selectedDate) {
        taskData.scheduledAt = startOfDay(selectedDate).getTime();
        taskData.scheduledEndAt = endOfDay(selectedDate).getTime();
      }

      let savedTask: Task;
      
      if (existingTask) {
        await updateTask(existingTask.id, taskData);
        savedTask = { ...existingTask, ...taskData } as Task;
      } else {
        await addTask(taskData as any);
        // The task will be created with a new ID, so we'll simulate the saved task
        savedTask = {
          id: 'temp-id',
          userEmail: 'user@example.com',
          createdAt: Date.now(),
          rejectionCount: 0,
          isMuted: false,
          ...taskData
        } as Task;
      }
      
      onTaskScheduled?.(savedTask);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    title, description, category, priority, duration, location, attendees,
    estimatedPomodoros, isTimeBlocked, isAllDay, scheduledTimes, selectedDate,
    existingTask, updateTask, addTask, onTaskScheduled, onOpenChange
  ]);

  const suggestAlternativeTime = useCallback(() => {
    if (!selectedDate || !scheduledTimes) return;
    
    const nextSlot = CalendarUtils.findNextAvailableSlot(
      tasks,
      scheduledTimes.start,
      duration,
      { start: '09:00', end: '17:00' }
    );
    
    if (nextSlot) {
      const suggestedTime = new Date(nextSlot);
      setStartTime(format(suggestedTime, 'HH:mm'));
      
      // Update selected date if suggestion is for a different day
      const suggestedDate = new Date(nextSlot);
      if (!selectedDate || suggestedDate.toDateString() !== selectedDate.toDateString()) {
        // Note: This would need to be handled by parent component
        console.log('Suggested date:', suggestedDate);
      }
    }
  }, [selectedDate, scheduledTimes, tasks, duration]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {existingTask ? 'Edit Time Block' : 'Schedule Task'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add more details..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taskCategories.map((cat: string) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Time & Duration */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="all-day"
                  checked={isAllDay}
                  onCheckedChange={setIsAllDay}
                />
                <Label htmlFor="all-day">All day event</Label>
              </div>

              {!isAllDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-time">Start Time</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <div className="mt-1 space-y-2">
                      <Slider
                        value={[duration]}
                        onValueChange={(value) => setDuration(value[0])}
                        min={15}
                        max={480}
                        step={15}
                        className="w-full"
                      />
                      <div className="text-sm text-muted-foreground text-center">
                        {duration} minutes ({Math.round(duration / 60 * 10) / 10} hours)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {scheduledTimes && (
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Scheduled for:</span>
                  </div>
                  <div>
                    {format(selectedDate || new Date(), 'EEEE, MMMM d, yyyy')} at{' '}
                    {format(new Date(scheduledTimes.start), 'h:mm a')} -{' '}
                    {format(new Date(scheduledTimes.end), 'h:mm a')}
                  </div>
                </div>
              )}
            </div>

            {/* Conflicts */}
            {conflicts.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Time conflict detected with {conflicts.length} task(s):</p>
                    <ul className="list-disc list-inside space-y-1">
                      {conflicts.map(task => (
                        <li key={task.id} className="text-sm">
                          {task.title} ({task.scheduledAt && task.scheduledEndAt && 
                            CalendarUtils.formatTimeRange(task.scheduledAt, task.scheduledEndAt)
                          })
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={suggestAlternativeTime}
                      className="mt-2"
                    >
                      Suggest alternative time
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Additional Options */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="time-blocked"
                  checked={isTimeBlocked}
                  onCheckedChange={setIsTimeBlocked}
                />
                <Label htmlFor="time-blocked">Time blocked (prevents other scheduling)</Label>
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Meeting room, address, or online"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label>Attendees</Label>
                <div className="mt-1 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={newAttendee}
                        onChange={(e) => setNewAttendee(e.target.value)}
                        placeholder="Enter email address"
                        className="pl-10"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddAttendee()}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddAttendee}
                      disabled={!newAttendee.trim()}
                    >
                      Add
                    </Button>
                  </div>
                  
                  {attendees.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attendees.map(email => (
                        <Badge
                          key={email}
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleRemoveAttendee(email)}
                        >
                          {email}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="pomodoros">Estimated Pomodoro Sessions</Label>
                <div className="mt-1 space-y-2">
                  <Slider
                    value={[estimatedPomodoros]}
                    onValueChange={(value) => setEstimatedPomodoros(value[0])}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Timer className="h-4 w-4" />
                    <span>
                      {estimatedPomodoros} session{estimatedPomodoros !== 1 ? 's' : ''} 
                      ({estimatedPomodoros * 25} minutes of focused work)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-4 w-4 mr-2"
              >
                <Save className="h-4 w-4" />
              </motion.div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {existingTask ? 'Update Task' : 'Schedule Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
