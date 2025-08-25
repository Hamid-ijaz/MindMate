"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, RotateCcw, Timer, Coffee, Target, Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTasks } from '@/contexts/task-context';
import type { PomodoroStatus, Task, PomodoroSession } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PomodoroTimerProps {
  task?: Task;
  onSessionComplete?: (session: PomodoroSession) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  className?: string;
}

interface PomodoroSettings {
  workDuration: number; // minutes
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  soundEnabled: boolean;
  soundVolume: number;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  soundEnabled: true,
  soundVolume: 50
};

export function PomodoroTimer({ 
  task, 
  onSessionComplete, 
  onTaskUpdate,
  className 
}: PomodoroTimerProps) {
  const { updateTask } = useTasks();
  
  // Settings
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  
  // Timer state
  const [status, setStatus] = useState<PomodoroStatus>('idle');
  const [currentSession, setCurrentSession] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(settings.workDuration * 60); // seconds
  const [sessionType, setSessionType] = useState<'work' | 'short-break' | 'long-break'>('work');
  const [completedSessions, setCompletedSessions] = useState<PomodoroSession[]>([]);
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Initialize audio
  useEffect(() => {
    // Try to load the audio file, fallback to Web Audio API if not available
    audioRef.current = new Audio();
    audioRef.current.src = '/audio/complete-tone.wav';
    audioRef.current.preload = 'auto';
    
    // Test if audio file loads, if not we'll use Web Audio API
    audioRef.current.addEventListener('error', () => {
      console.log('Audio file not found, will use Web Audio API fallback');
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Web Audio API fallback
  const playWebAudioBeep = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.value = settings.soundVolume / 100;
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log('Audio not available');
    }
  }, [settings.soundVolume]);

  // Play completion sound with fallback
  const playSound = useCallback(() => {
    if (!settings.soundEnabled) return;

    // Try to play the audio file first
    if (audioRef.current && audioRef.current.src) {
      audioRef.current.volume = settings.soundVolume / 100;
      audioRef.current.play().catch(() => {
        // Fallback to Web Audio API
        playWebAudioBeep();
      });
    } else {
      // Fallback to Web Audio API
      playWebAudioBeep();
    }
  }, [settings.soundEnabled, settings.soundVolume, playWebAudioBeep]);

  // Web Audio API fallback
  // Update time remaining when settings change
  useEffect(() => {
    if (status === 'idle') {
      const duration = sessionType === 'work' 
        ? settings.workDuration 
        : sessionType === 'short-break' 
          ? settings.shortBreakDuration 
          : settings.longBreakDuration;
      setTimeRemaining(duration * 60);
    }
  }, [settings, sessionType, status]);

  const handleSessionComplete = useCallback(() => {
    if (!startTimeRef.current) return;

    const endTime = Date.now();
    const duration = sessionType === 'work' 
      ? settings.workDuration 
      : sessionType === 'short-break' 
        ? settings.shortBreakDuration 
        : settings.longBreakDuration;

    // Create session record
    const session: PomodoroSession = {
      id: `session-${Date.now()}`,
      taskId: task?.id || 'no-task',
      startTime: startTimeRef.current,
      endTime: endTime,
      duration: duration,
      type: sessionType,
      completed: true,
      interrupted: false
    };

    setCompletedSessions(prev => [...prev, session]);
    onSessionComplete?.(session);
    playSound();

    // Update task if working session
    if (sessionType === 'work' && task) {
      const newPomodoroSessions = (task.pomodoroSessions || 0) + 1;
      const newTimeSpent = (task.timeSpent || 0) + duration;
      
      updateTask(task.id, {
        pomodoroSessions: newPomodoroSessions,
        timeSpent: newTimeSpent
      });
      
      onTaskUpdate?.(task.id, {
        pomodoroSessions: newPomodoroSessions,
        timeSpent: newTimeSpent
      });
    }

    // Determine next session type
    if (sessionType === 'work') {
      const nextSessionType = currentSession % settings.sessionsUntilLongBreak === 0 
        ? 'long-break' 
        : 'short-break';
      
      setSessionType(nextSessionType);
      setCurrentSession(prev => prev + 1);
      
      if (settings.autoStartBreaks) {
        setStatus('active');
        startTimeRef.current = Date.now();
      } else {
        setStatus('idle');
      }
    } else {
      // Break completed, back to work
      setSessionType('work');
      
      if (settings.autoStartPomodoros) {
        setStatus('active');
        startTimeRef.current = Date.now();
      } else {
        setStatus('idle');
      }
    }
  }, [sessionType, settings, currentSession, task, onSessionComplete, onTaskUpdate, updateTask, playSound]);

  // Timer logic
  useEffect(() => {
    if (status === 'active') {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Session completed
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, handleSessionComplete]);

  const handleStart = useCallback(() => {
    setStatus('active');
    startTimeRef.current = Date.now();
  }, []);

  const handlePause = useCallback(() => {
    setStatus('paused');
  }, []);

  const handleResume = useCallback(() => {
    setStatus('active');
  }, []);

  const handleStop = useCallback(() => {
    setStatus('idle');
    startTimeRef.current = null;
    
    // Reset to work session
    setSessionType('work');
    setTimeRemaining(settings.workDuration * 60);
  }, [settings.workDuration]);

  const handleReset = useCallback(() => {
    setStatus('idle');
    setCurrentSession(1);
    setSessionType('work');
    setTimeRemaining(settings.workDuration * 60);
    setCompletedSessions([]);
    startTimeRef.current = null;
  }, [settings.workDuration]);

  const handleSkipSession = useCallback(() => {
    if (status === 'active' || status === 'paused') {
      handleSessionComplete();
    }
  }, [status, handleSessionComplete]);

  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const getCurrentDuration = useCallback((): number => {
    return sessionType === 'work' 
      ? settings.workDuration * 60
      : sessionType === 'short-break' 
        ? settings.shortBreakDuration * 60
        : settings.longBreakDuration * 60;
  }, [sessionType, settings]);

  const getProgress = useCallback((): number => {
    const totalDuration = getCurrentDuration();
    return ((totalDuration - timeRemaining) / totalDuration) * 100;
  }, [timeRemaining, getCurrentDuration]);

  const getSessionIcon = () => {
    switch (sessionType) {
      case 'work': return Timer;
      case 'short-break': return Coffee;
      case 'long-break': return Target;
    }
  };

  const getSessionColor = () => {
    switch (sessionType) {
      case 'work': return 'text-blue-600 dark:text-blue-400';
      case 'short-break': return 'text-green-600 dark:text-green-400';
      case 'long-break': return 'text-purple-600 dark:text-purple-400';
    }
  };

  const getSessionBgColor = () => {
    switch (sessionType) {
      case 'work': return 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/30';
      case 'short-break': return 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800/30';
      case 'long-break': return 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/30';
    }
  };

  const SessionIcon = getSessionIcon();

  return (
    <Card className={cn("w-full max-w-lg mx-auto border-2 shadow-lg", getSessionBgColor(), className)}>
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-2 text-foreground">
          <SessionIcon className={cn("h-5 w-5", getSessionColor())} />
          <span className="capitalize">
            {sessionType.replace('-', ' ')} Session
          </span>
        </CardTitle>
        
        {task && (
          <div className="text-sm text-muted-foreground">
            Working on: <span className="font-medium text-foreground">{task.title}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Timer Display */}
        <div className="text-center">
          <div className={cn("p-6 md:p-8 rounded-xl border-2 transition-all duration-300", getSessionBgColor())}>
            <motion.div
              key={timeRemaining}
              initial={{ scale: 1 }}
              animate={{ scale: status === 'active' ? [1, 1.02, 1] : 1 }}
              transition={{ duration: 1, repeat: status === 'active' ? Infinity : 0 }}
              className={cn("text-4xl md:text-6xl font-mono font-bold mb-4 tracking-tight", getSessionColor())}
            >
              {formatTime(timeRemaining)}
            </motion.div>
            
            <Progress 
              value={getProgress()} 
              className="h-3 mb-4" 
            />
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Session {currentSession}</span>
              <span>{Math.floor(getProgress())}% complete</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {status === 'idle' && (
            <Button 
              onClick={handleStart} 
              size="lg" 
              className="flex items-center gap-2 min-w-[120px]"
            >
              <Play className="h-4 w-4" />
              Start
            </Button>
          )}
          
          {status === 'active' && (
            <Button 
              onClick={handlePause} 
              size="lg" 
              variant="secondary" 
              className="flex items-center gap-2 min-w-[120px]"
            >
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}
          
          {status === 'paused' && (
            <>
              <Button 
                onClick={handleResume} 
                size="lg" 
                className="flex items-center gap-2 min-w-[100px]"
              >
                <Play className="h-4 w-4" />
                Resume
              </Button>
              <Button 
                onClick={handleStop} 
                size="lg" 
                variant="outline" 
                className="flex items-center gap-2 min-w-[80px]"
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            </>
          )}
          
          {(status === 'active' || status === 'paused') && (
            <Button 
              onClick={handleSkipSession} 
              variant="ghost" 
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              Skip Session
            </Button>
          )}
          
          <Button 
            onClick={handleReset} 
            variant="ghost" 
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Session Stats */}
        <div className="grid grid-cols-3 gap-4 text-center pt-4 border-t border-border">
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {completedSessions.filter(s => s.type === 'work').length}
            </div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {completedSessions.filter(s => s.type !== 'work').length}
            </div>
            <div className="text-xs text-muted-foreground">Breaks</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {Math.round(completedSessions.reduce((acc, s) => acc + s.duration, 0) / 60)}h
            </div>
            <div className="text-xs text-muted-foreground">Total Time</div>
          </div>
        </div>

        {/* Quick Settings */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <Label htmlFor="sound-toggle" className="text-sm text-foreground">Sound</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
                className="h-8 w-8 p-0"
              >
                {settings.soundEnabled ? 
                  <Volume2 className="h-4 w-4 text-green-600 dark:text-green-400" /> : 
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                }
              </Button>
            </div>
          </div>
          
          {settings.soundEnabled && (
            <div className="space-y-2">
              <Label className="text-sm text-foreground">Volume</Label>
              <Slider
                value={[settings.soundVolume]}
                onValueChange={(value) => setSettings(prev => ({ ...prev, soundVolume: value[0] }))}
                min={0}
                max={100}
                step={10}
                className="w-full"
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Auto-start breaks</Label>
            <Switch
              checked={settings.autoStartBreaks}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoStartBreaks: checked }))}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Auto-start pomodoros</Label>
            <Switch
              checked={settings.autoStartPomodoros}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoStartPomodoros: checked }))}
            />
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          className="w-full"
        >
          {showSettings ? 'Hide' : 'Show'} Advanced Settings
        </Button>

        {/* Advanced Settings */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-4 pt-4 border-t border-border"
            >
              <h4 className="font-semibold text-foreground">Advanced Settings</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-foreground">Work Duration</Label>
                  <Select
                    value={settings.workDuration.toString()}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, workDuration: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="20">20 min</SelectItem>
                      <SelectItem value="25">25 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">60 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-sm text-foreground">Short Break</Label>
                  <Select
                    value={settings.shortBreakDuration.toString()}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, shortBreakDuration: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 min</SelectItem>
                      <SelectItem value="5">5 min</SelectItem>
                      <SelectItem value="10">10 min</SelectItem>
                      <SelectItem value="15">15 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-foreground">Long Break</Label>
                  <Select
                    value={settings.longBreakDuration.toString()}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, longBreakDuration: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 min</SelectItem>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="20">20 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-sm text-foreground">Sessions until Long Break</Label>
                  <Select
                    value={settings.sessionsUntilLongBreak.toString()}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, sessionsUntilLongBreak: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="6">6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
