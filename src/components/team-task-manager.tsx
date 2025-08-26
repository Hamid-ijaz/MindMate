'use client';

import React, { useState, useEffect } from 'react';
import { useTeam } from '@/contexts/team-context';
import { useAuth } from '@/contexts/auth-context';
import { useTasks } from '@/hooks/use-tasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  User,
  CheckSquare,
  MoreHorizontal,
  Edit3,
  Trash2,
  Send,
  UserPlus,
  Target,
  Timer,
  Flag,
  FileText,
  MessageSquare,
  Bell,
  CheckCircle2,
  XCircle,
  PlayCircle,
  PauseCircle,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import type { Task, TeamTask, TeamMember, Priority, TaskCategory, TimeOfDay } from '@/lib/types';
import type { Task as HookTask } from '@/hooks/use-tasks';

interface TeamTaskManagerProps {
  workspaceId: string;
}

interface TaskAssignmentData {
  assigneeId: string;
  priority: Priority;
  dueDate?: Date;
  notes?: string;
}

interface TaskFormData {
  title: string;
  description: string;
  category: TaskCategory;
  priority: Priority;
  duration: number;
  timeOfDay: TimeOfDay;
  dueDate?: Date;
  assigneeId?: string;
  assignmentNotes?: string;
}

const priorityConfig = {
  Low: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300', icon: '🟢' },
  Medium: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300', icon: '🟡' },
  High: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300', icon: '🟠' },
  Critical: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300', icon: '🔴' },
};

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300', icon: Clock },
  accepted: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300', icon: PlayCircle },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300', icon: XCircle },
  reassigned: { label: 'Reassigned', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300', icon: ArrowRight },
};

export default function TeamTaskManager({ workspaceId }: TeamTaskManagerProps) {
  const { user } = useAuth();
  const { tasks, createTask, updateTask, deleteTask } = useTasks();
  const { 
    teamMembers, 
    teamTasks, 
    assignTask, 
    updateAssignmentStatus,
    currentWorkspace 
  } = useTeam();

  // State
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TeamTask | null>(null);
  const [taskFormData, setTaskFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    category: 'Work',
    priority: 'Medium',
    duration: 30,
    timeOfDay: 'Morning',
  });
  const [assignmentData, setAssignmentData] = useState<TaskAssignmentData>({
    assigneeId: '',
    priority: 'Medium',
  });

  // Filter workspace tasks
  const workspaceTasks = teamTasks.filter(task => task.workspaceId === workspaceId);
  const myTasks = workspaceTasks.filter(task => task.assigneeId === user?.email);
  const unassignedTasks = workspaceTasks.filter(task => !task.assigneeId);
  const assignedTasks = workspaceTasks.filter(task => task.assigneeId && task.assigneeId !== user?.email);

  // Task creation
  const handleCreateTask = async () => {
    if (!user?.email || !taskFormData.title.trim()) return;

    try {
      const newTask: Omit<HookTask, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        title: taskFormData.title.trim(),
        description: taskFormData.description.trim() || undefined,
        completed: false,
        priority: taskFormData.priority.toLowerCase() as 'low' | 'medium' | 'high',
        category: taskFormData.category,
        dueDate: taskFormData.dueDate,
        tags: [],
      };

      await createTask(newTask);

      // If assigned to someone, also create team task assignment
      if (taskFormData.assigneeId) {
        // This would need to be implemented in the team context
        // await createTeamTaskAssignment(taskId, taskFormData.assigneeId);
      }

      setIsCreateTaskOpen(false);
      setTaskFormData({
        title: '',
        description: '',
        category: 'Work',
        priority: 'Medium',
        duration: 30,
        timeOfDay: 'Morning',
      });
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  // Task assignment
  const handleAssignTask = async () => {
    if (!selectedTask || !assignmentData.assigneeId) return;

    try {
      await assignTask(selectedTask.id, assignmentData.assigneeId, assignmentData.notes);
      setIsAssignTaskOpen(false);
      setSelectedTask(null);
      setAssignmentData({
        assigneeId: '',
        priority: 'Medium',
      });
    } catch (error) {
      console.error('Failed to assign task:', error);
    }
  };

  // Task status update
  const handleStatusUpdate = async (taskId: string, status: 'accepted' | 'declined') => {
    try {
      await updateAssignmentStatus(taskId, status);
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getMemberById = (id: string) => {
    return teamMembers.find(member => member.userId === id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Team Tasks</h3>
        <div className="flex space-x-2">
          <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Create a new task and optionally assign it to a team member.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      value={taskFormData.title}
                      onChange={(e) => setTaskFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter task title"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select
                      value={taskFormData.category}
                      onValueChange={(value: TaskCategory) => setTaskFormData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Work">Work</SelectItem>
                        <SelectItem value="Personal">Personal</SelectItem>
                        <SelectItem value="Study">Study</SelectItem>
                        <SelectItem value="Chores">Chores</SelectItem>
                        <SelectItem value="Writing">Writing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={taskFormData.description}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter task description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Priority</label>
                    <Select
                      value={taskFormData.priority}
                      onValueChange={(value: Priority) => setTaskFormData(prev => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
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
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Duration (minutes)</label>
                    <Select
                      value={taskFormData.duration.toString()}
                      onValueChange={(value) => setTaskFormData(prev => ({ ...prev, duration: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Time of Day</label>
                    <Select
                      value={taskFormData.timeOfDay}
                      onValueChange={(value: TimeOfDay) => setTaskFormData(prev => ({ ...prev, timeOfDay: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Morning">Morning</SelectItem>
                        <SelectItem value="Afternoon">Afternoon</SelectItem>
                        <SelectItem value="Evening">Evening</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assign to (Optional)</label>
                    <Select
                      value={taskFormData.assigneeId || 'unassigned'}
                      onValueChange={(value) => setTaskFormData(prev => ({ ...prev, assigneeId: value === 'unassigned' ? undefined : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.userId}>
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={member.userAvatar} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(member.userName)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{member.userName || member.userId.split('@')[0]}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Due Date (Optional)</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {taskFormData.dueDate ? format(taskFormData.dueDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={taskFormData.dueDate}
                          onSelect={(date) => setTaskFormData(prev => ({ ...prev, dueDate: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {taskFormData.assigneeId && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assignment Notes</label>
                    <Textarea
                      value={taskFormData.assignmentNotes || ''}
                      onChange={(e) => setTaskFormData(prev => ({ ...prev, assignmentNotes: e.target.value }))}
                      placeholder="Add notes for the assignee"
                      rows={2}
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button onClick={handleCreateTask} disabled={!taskFormData.title.trim()} className="flex-1">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Task Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>My Tasks</span>
              </div>
              <Badge variant="secondary">{myTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            <AnimatePresence>
              {myTasks.map((task, index) => {
                const statusInfo = statusConfig[task.assignmentStatus || 'pending'];
                const priorityInfo = priorityConfig[task.priority];
                const StatusIcon = statusInfo.icon;

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{task.title}</h4>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge className={priorityInfo.color} variant="secondary">
                            {priorityInfo.icon} {task.priority}
                          </Badge>
                          <Badge className={statusInfo.color} variant="secondary">
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                        {task.reminderAt && (
                          <div className="flex items-center space-x-1 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Due {format(new Date(task.reminderAt), 'MMM d')}</span>
                          </div>
                        )}
                      </div>
                      
                      {task.assignmentStatus === 'pending' && (
                        <div className="flex space-x-1 ml-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(task.id, 'accepted')}
                            className="h-8 w-8 p-0"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(task.id, 'declined')}
                            className="h-8 w-8 p-0"
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {myTasks.length === 0 && (
              <div className="text-center py-8">
                <CheckSquare className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">No tasks assigned to you</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unassigned Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5" />
                <span>Unassigned</span>
              </div>
              <Badge variant="secondary">{unassignedTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            <AnimatePresence>
              {unassignedTasks.map((task, index) => {
                const priorityInfo = priorityConfig[task.priority];

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{task.title}</h4>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge className={priorityInfo.color} variant="secondary">
                            {priorityInfo.icon} {task.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {task.category}
                          </Badge>
                        </div>
                        {task.reminderAt && (
                          <div className="flex items-center space-x-1 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Due {format(new Date(task.reminderAt), 'MMM d')}</span>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedTask(task);
                          setIsAssignTaskOpen(true);
                        }}
                        className="ml-2"
                      >
                        <UserPlus className="h-3 w-3" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {unassignedTasks.length === 0 && (
              <div className="text-center py-8">
                <CheckSquare className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">All tasks are assigned</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned to Others */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Team Tasks</span>
              </div>
              <Badge variant="secondary">{assignedTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            <AnimatePresence>
              {assignedTasks.map((task, index) => {
                const assignee = getMemberById(task.assigneeId!);
                const statusInfo = statusConfig[task.assignmentStatus || 'pending'];
                const priorityInfo = priorityConfig[task.priority];
                const StatusIcon = statusInfo.icon;

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={assignee?.userAvatar} />
                        <AvatarFallback className="text-xs">
                          {getInitials(assignee?.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{task.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          Assigned to {assignee?.userName || task.assigneeId?.split('@')[0]}
                        </p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge className={priorityInfo.color} variant="secondary">
                            {priorityInfo.icon} {task.priority}
                          </Badge>
                          <Badge className={statusInfo.color} variant="secondary">
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                        {task.reminderAt && (
                          <div className="flex items-center space-x-1 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Due {format(new Date(task.reminderAt), 'MMM d')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {assignedTasks.length === 0 && (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">No tasks assigned to others</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assignment Dialog */}
      <Dialog open={isAssignTaskOpen} onOpenChange={setIsAssignTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
            <DialogDescription>
              Assign this task to a team member and add optional notes.
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg">
                <h4 className="font-medium">{selectedTask.title}</h4>
                {selectedTask.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedTask.description}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to</label>
                <Select
                  value={assignmentData.assigneeId}
                  onValueChange={(value) => setAssignmentData(prev => ({ ...prev, assigneeId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.userId}>
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={member.userAvatar} />
                            <AvatarFallback className="text-xs">
                              {getInitials(member.userName)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{member.userName || member.userId.split('@')[0]}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Assignment Notes (Optional)</label>
                <Textarea
                  value={assignmentData.notes || ''}
                  onChange={(e) => setAssignmentData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add notes for the assignee"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleAssignTask} 
                  disabled={!assignmentData.assigneeId} 
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Assign Task
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsAssignTaskOpen(false)} 
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
