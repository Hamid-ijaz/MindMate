"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Timer, Play, Pause, Square, RotateCcw, Settings, 
  Target, Coffee, Brain, TrendingUp, Clock, CheckCircle2,
  BarChart3, Calendar, Plus, Zap, Award, Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PomodoroTimer } from '@/components/pomodoro-timer';
import { useTasks } from '@/contexts/task-context';
import type { Task, PomodoroSession } from '@/lib/types';
import { format } from 'date-fns';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function FocusTimerPage() {
  const { tasks } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState('timer');
  const [completedSessions, setCompletedSessions] = useState<PomodoroSession[]>([]);

  // Calculate statistics
  const pendingTasks = tasks.filter((task: Task) => !task.completedAt);
  const totalPomodoros = tasks.reduce((acc: number, task: Task) => acc + (task.pomodoroSessions || 0), 0);
  const totalTimeSpent = tasks.reduce((acc: number, task: Task) => acc + (task.timeSpent || 0), 0);
  const todaysPomodoros = completedSessions.filter(session => {
    const today = new Date();
    const sessionDate = new Date(session.startTime);
    return sessionDate.toDateString() === today.toDateString();
  }).length;

  // Get today's focus data
  const todaysFocusTime = completedSessions
    .filter(session => {
      const today = new Date();
      const sessionDate = new Date(session.startTime);
      return sessionDate.toDateString() === today.toDateString() && session.type === 'work';
    })
    .reduce((acc, session) => acc + session.duration, 0);

  const handleSessionComplete = (session: PomodoroSession) => {
    setCompletedSessions(prev => [...prev, session]);
  };

  const handleTaskSelect = (task: Task) => {
    setSelectedTask(task);
    setActiveTab('timer');
  };

  // Calculate streak (consecutive days with pomodoros)
  const calculateStreak = () => {
    const dates = [...new Set(completedSessions
      .filter(s => s.type === 'work')
      .map(s => new Date(s.startTime).toDateString())
    )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    let streak = 0;
    const today = new Date().toDateString();
    
    for (let i = 0; i < dates.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      
      if (dates[i] === expectedDate.toDateString()) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const currentStreak = calculateStreak();

  return (
    <motion.div
      className="container mx-auto max-w-7xl py-8 md:py-12 px-4"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Header Section */}
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl mb-2 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl border border-primary/20">
              <Timer className="h-8 w-8 text-primary" />
            </div>
            Focus Timer
          </h1>
          <p className="text-muted-foreground text-lg">
            Boost your productivity with focused work sessions and strategic breaks using the proven Pomodoro Technique.
          </p>
        </motion.div>
      </div>

      {/* Quick Stats Dashboard */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-600">{todaysPomodoros}</p>
                <p className="text-xs text-muted-foreground">Today's Sessions</p>
              </div>
              <Target className="h-8 w-8 text-orange-600/60" />
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-orange-300" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">{Math.round(todaysFocusTime)}m</p>
                <p className="text-xs text-muted-foreground">Focus Time</p>
              </div>
              <Brain className="h-8 w-8 text-blue-600/60" />
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-300" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-purple-600">{currentStreak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
              <Zap className="h-8 w-8 text-purple-600/60" />
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-300" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{totalPomodoros}</p>
                <p className="text-xs text-muted-foreground">Total Sessions</p>
              </div>
              <Award className="h-8 w-8 text-green-600/60" />
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-300" />
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content */}
      <Tabs defaultValue="timer" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timer" className="flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Focus Timer
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Timer Tab */}
        <TabsContent value="timer">
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Timer Component */}
            <motion.div
              className="lg:col-span-3"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.3 }}
            >
              <div className="space-y-6">
                <PomodoroTimer 
                  task={selectedTask || undefined}
                  onSessionComplete={handleSessionComplete}
                  className="w-full"
                />
                
                {/* Quick Timer Controls */}
                {!selectedTask && (
                  <Card className="bg-gradient-to-br from-muted/30 to-muted/10 border-dashed">
                    <CardContent className="text-center py-8">
                      <Timer className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="font-semibold mb-2">Ready to Focus?</h3>
                      <p className="text-muted-foreground mb-4 text-sm">
                        Select a task from the Tasks tab or start a general focus session
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button 
                          onClick={() => setActiveTab('tasks')}
                          className="flex items-center gap-2"
                        >
                          <Target className="h-4 w-4" />
                          Choose Task
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            // Start a general timer without specific task
                            setSelectedTask(null);
                          }}
                        >
                          General Focus
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </motion.div>

            {/* Current Task & Quick Actions */}
            <motion.div
              className="lg:col-span-2 space-y-6"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.4 }}
            >
              {/* Current Task */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Current Focus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedTask ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-lg mb-2">{selectedTask.title}</h3>
                        {selectedTask.description && (
                          <p className="text-muted-foreground text-sm mb-3">{selectedTask.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{selectedTask.category}</Badge>
                          <Badge variant="outline">{selectedTask.priority}</Badge>
                          <Badge variant="outline">{selectedTask.duration}m</Badge>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedTask(null)}
                        className="w-full"
                      >
                        Change Task
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground mb-4">No task selected</p>
                      <Button onClick={() => setActiveTab('tasks')} className="w-full">
                        Choose a Task
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Today's Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sessions Completed</span>
                    <Badge variant="secondary">{todaysPomodoros}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Focus Time</span>
                    <Badge variant="secondary">{Math.round(todaysFocusTime)}m</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Current Streak</span>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {currentStreak} days
                    </Badge>
                  </div>
                  
                  {/* Progress towards daily goal */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Daily Goal Progress</span>
                      <span className="text-xs text-muted-foreground">{todaysPomodoros}/8</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-primary to-primary/80 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((todaysPomodoros / 8) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Motivational Section */}
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-4 text-center">
                  <div className="mb-3">
                    {currentStreak === 0 && (
                      <div className="text-sm text-muted-foreground">
                        🌟 Start your focus journey today!
                      </div>
                    )}
                    {currentStreak === 1 && (
                      <div className="text-sm text-primary">
                        🔥 Great start! Keep the momentum going!
                      </div>
                    )}
                    {currentStreak >= 2 && currentStreak < 7 && (
                      <div className="text-sm text-primary">
                        🚀 You're on fire! {currentStreak} days strong!
                      </div>
                    )}
                    {currentStreak >= 7 && (
                      <div className="text-sm text-primary font-medium">
                        🏆 Amazing! {currentStreak} day streak! You're a focus master!
                      </div>
                    )}
                  </div>
                  {todaysPomodoros >= 8 && (
                    <div className="text-xs text-green-600 font-medium">
                      ✅ Daily goal achieved! Fantastic work!
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Available Tasks
                  <Badge variant="secondary" className="ml-auto">
                    {pendingTasks.length} pending
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingTasks.length > 0 ? (
                  <div className="grid gap-3">
                    {pendingTasks.slice(0, 20).map((task: Task) => (
                      <motion.div
                        key={task.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                          selectedTask?.id === task.id 
                            ? 'border-primary bg-primary/5 shadow-md' 
                            : 'hover:bg-muted/50 hover:border-muted-foreground/20'
                        }`}
                        onClick={() => handleTaskSelect(task)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-lg">{task.title}</h4>
                          <div className="flex items-center gap-2">
                            {selectedTask?.id === task.id && (
                              <Badge variant="default" className="text-xs">
                                Selected
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTaskSelect(task);
                              }}
                            >
                              Focus
                            </Button>
                          </div>
                        </div>
                        
                        {task.description && (
                          <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="secondary">{task.category}</Badge>
                          <Badge variant="outline">{task.priority}</Badge>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {task.duration}m
                          </Badge>
                          {task.pomodoroSessions && task.pomodoroSessions > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              {task.pomodoroSessions} sessions
                            </Badge>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                    <p className="text-muted-foreground mb-6">
                      No pending tasks found. Create some tasks to start your focus sessions.
                    </p>
                    <Button className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add New Task
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <motion.div
            className="grid gap-6 md:grid-cols-2"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.3 }}
          >
            {/* Session History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Recent Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completedSessions.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {completedSessions
                      .slice(-10)
                      .reverse()
                      .map((session, index) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {session.type === 'work' ? (
                              <Timer className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Coffee className="h-4 w-4 text-green-600" />
                            )}
                            <div>
                              <p className="font-medium capitalize">
                                {session.type === 'work' ? 'Focus Session' : 'Break'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(session.startTime), 'MMM d, h:mm a')}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">
                            {session.duration}m
                          </Badge>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No sessions completed yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Overall Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Overall Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{totalPomodoros}</p>
                    <p className="text-xs text-muted-foreground">Total Sessions</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {Math.round(totalTimeSpent / 60)}h
                    </p>
                    <p className="text-xs text-muted-foreground">Total Focus Time</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Session Length</span>
                    <Badge variant="outline">
                      {completedSessions.length > 0 
                        ? Math.round(completedSessions.reduce((acc, s) => acc + s.duration, 0) / completedSessions.length)
                        : 0}m
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Current Streak</span>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {currentStreak} days
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tasks with Focus Sessions</span>
                    <Badge variant="outline">
                      {tasks.filter(t => t.pomodoroSessions && t.pomodoroSessions > 0).length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
