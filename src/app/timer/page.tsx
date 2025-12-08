"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Settings, Target, TrendingUp, Clock, Play, Pause, Timer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PomodoroTimer } from '@/components/pomodoro-timer';
import { useTasks } from '@/contexts/task-context';
import { useAuth } from '@/contexts/auth-context';
import type { Task, PomodoroSession } from '@/lib/types';
import { cn } from '@/lib/utils';

const pageVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

interface TimerStats {
  totalSessions: number;
  totalTime: number;
  todaySessions: number;
  todayTime: number;
  currentStreak: number;
}

export default function FocusTimerPage() {
  const router = useRouter();
  const { tasks, updateTask } = useTasks();
  const { user } = useAuth();
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState('timer');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stats, setStats] = useState<TimerStats>({
    totalSessions: 0,
    totalTime: 0,
    todaySessions: 0,
    todayTime: 0,
    currentStreak: 0
  });

  // Get available tasks for timer
  const availableTasks = tasks.filter(task => !task.completedAt);
  const recentTasks = tasks
    .filter(task => task.pomodoroSessions && task.pomodoroSessions > 0)
    .sort((a, b) => (b.pomodoroSessions || 0) - (a.pomodoroSessions || 0))
    .slice(0, 5);

  // Calculate stats
  useEffect(() => {
    const today = new Date().toDateString();
    let totalSessions = 0;
    let totalTime = 0;
    let todaySessions = 0;
    let todayTime = 0;

    tasks.forEach(task => {
      if (task.pomodoroSessions) {
        totalSessions += task.pomodoroSessions;
        totalTime += task.timeSpent || 0;
        
        // Check if task had sessions today (simplified)
        if (task.updatedAt && new Date(task.updatedAt).toDateString() === today) {
          todaySessions += task.pomodoroSessions;
          todayTime += task.timeSpent || 0;
        }
      }
    });

    setStats({
      totalSessions,
      totalTime,
      todaySessions,
      todayTime,
      currentStreak: Math.min(todaySessions, 8) // Simplified streak calculation
    });
  }, [tasks]);

  const handleSessionComplete = (session: PomodoroSession) => {
    // Update stats when session completes
    setStats(prev => ({
      ...prev,
      totalSessions: prev.totalSessions + 1,
      todaySessions: prev.todaySessions + 1,
      totalTime: prev.totalTime + session.duration,
      todayTime: prev.todayTime + session.duration,
    }));
  };

  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    updateTask(taskId, updates);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="w-full max-w-2xl mx-auto p-8">
          <div className="flex items-center justify-between mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Exit Fullscreen
            </Button>
            {selectedTask && (
              <Badge variant="secondary" className="text-sm">
                {selectedTask.title}
              </Badge>
            )}
          </div>
          
          <PomodoroTimer
            task={selectedTask || undefined}
            onSessionComplete={handleSessionComplete}
            onTaskUpdate={handleTaskUpdate}
            className="w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="container mx-auto max-w-6xl py-8 md:py-12 px-4"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">
              Focus Timer
            </h1>
            <p className="text-muted-foreground">
              Deep focus sessions with the Pomodoro technique
            </p>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFullscreen}
          className="hidden md:flex"
        >
          <Target className="h-4 w-4 mr-2" />
          Fullscreen
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <motion.div variants={cardVariants}>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">{stats.todaySessions}</p>
                <p className="text-xs text-muted-foreground">sessions</p>
              </div>
              <Clock className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardVariants}>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Time</p>
                <p className="text-2xl font-bold">{formatTime(stats.todayTime)}</p>
                <p className="text-xs text-muted-foreground">focused</p>
              </div>
              <Timer className="h-5 w-5 text-green-500 dark:text-green-400" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardVariants}>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Streak</p>
                <p className="text-2xl font-bold">{stats.currentStreak}</p>
                <p className="text-xs text-muted-foreground">sessions</p>
              </div>
              <TrendingUp className="h-5 w-5 text-orange-500 dark:text-orange-400" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardVariants}>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.totalSessions}</p>
                <p className="text-xs text-muted-foreground">all time</p>
              </div>
              <Target className="h-5 w-5 text-purple-500 dark:text-purple-400" />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timer">Timer</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="timer" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Timer */}
            <motion.div
              className="md:col-span-2"
              variants={cardVariants}
              initial="initial"
              animate="animate"
            >
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Focus Session</CardTitle>
                    {selectedTask && (
                      <Badge variant="secondary">
                        {selectedTask.title}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <PomodoroTimer
                    task={selectedTask || undefined}
                    onSessionComplete={handleSessionComplete}
                    onTaskUpdate={handleTaskUpdate}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Task Selection */}
            <motion.div
              variants={cardVariants}
              initial="initial"
              animate="animate"
            >
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Select Task</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant={!selectedTask ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTask(null)}
                    className="w-full justify-start"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Free Focus
                  </Button>
                  
                  {availableTasks.slice(0, 5).map((task) => (
                    <Button
                      key={task.id}
                      variant={selectedTask?.id === task.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTask(task)}
                      className="w-full justify-start text-left"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Target className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{task.title}</span>
                      </div>
                    </Button>
                  ))}
                  
                  {availableTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No tasks available
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {task.pomodoroSessions} sessions • {formatTime(task.timeSpent || 0)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTask(task);
                        setActiveTab('timer');
                      }}
                    >
                      Focus
                    </Button>
                  </div>
                ))}
                
                {recentTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No tasks with timer sessions yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Focus History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.totalSessions}</p>
                    <p className="text-sm text-muted-foreground">Total Sessions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{formatTime(stats.totalTime)}</p>
                    <p className="text-sm text-muted-foreground">Total Time</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.todaySessions}</p>
                    <p className="text-sm text-muted-foreground">Today</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{Math.round((stats.totalTime / 60) * 100) / 100}h</p>
                    <p className="text-sm text-muted-foreground">Avg/Day</p>
                  </div>
                </div>
                
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Detailed history coming soon
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
