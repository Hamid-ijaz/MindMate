"use client";

import { TaskSuggestion } from "@/components/task-suggestion";
import { QuickActions } from "@/components/quick-actions";
import { PullToRefresh } from "@/components/pull-to-refresh";
import React, { useState, useMemo, useEffect } from "react";
import { useTasks } from "@/contexts/task-context";
import { useNotes } from "@/contexts/note-context";
import { useNotifications } from "@/contexts/notification-context";
import { useAuth } from "@/contexts/auth-context";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TaskItem } from "@/components/task-item";
import { NoteCard } from "@/components/notes/note-card";
import { EditNoteDialog } from "@/components/notes/edit-note-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { 
  Clock, Target, Zap, TrendingUp, Calendar, Plus, Settings, 
  Sun, CloudRain, Thermometer, Brain, Timer, Trophy, 
  BarChart3, Activity, CheckCircle2, AlertCircle, 
  Lightbulb, Mic, Play, Pause, SkipForward, Volume2,
  Grip, Eye, EyeOff, Maximize2, Minimize2, RotateCcw,
  Sparkles, MapPin, Users, Share2, Award, Star,
  Coffee, Moon, Sunrise, Sunset, ChevronRight, ChevronDown,
  Circle, Headphones, BellOff, Heart, Smile,
  Calendar as CalendarIcon, Cloud, MapPinIcon, Search,
  Filter, X, Wand2, Bot, ArrowRight, Command, BookOpen,
  Rocket, Workflow, ChevronUp, Globe, Compass, Wand,
  Bell, AlarmClock, Repeat, Grid, LayoutGrid, StickyNote, 
  Edit3, MoreHorizontal, SortAsc, CheckSquare
} from "lucide-react";
import { format, isToday, startOfDay, endOfDay, addDays, subDays, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import type { Task, Note, TaskCategory, Priority, TaskDuration, TimeOfDay } from "@/lib/types";

// Weather simulation - in real app, this would come from an API
const getWeatherData = () => ({
  temperature: 22,
  condition: "sunny",
  humidity: 45,
  suggestion: "Perfect weather for outdoor tasks!"
});

// Time-based greeting and suggestions
const getTimeBasedInfo = () => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return {
      greeting: "Good morning!",
      icon: <Sunrise className="w-5 h-5" />,
      suggestion: "Start with your most important tasks",
      energy: "high"
    };
  } else if (hour < 17) {
    return {
      greeting: "Good afternoon!",
      icon: <Sun className="w-5 h-5" />,
      suggestion: "Keep the momentum going",
      energy: "medium"
    };
  } else {
    return {
      greeting: "Good evening!",
      icon: <Sunset className="w-5 h-5" />,
      suggestion: "Review and plan for tomorrow",
      energy: "low"
    };
  }
};

// Task suggestions based on context
const getTaskSuggestions = (timeInfo: any, weather: any, energyLevel: number) => [
  {
    id: 'suggestion-1',
    title: 'Review morning emails',
    description: 'Check and respond to important emails',
    category: 'Work',
    priority: 'Medium',
    duration: 20,
    timeOfDay: 'Morning',
    icon: <BookOpen className="w-4 h-4" />,
    reason: 'Perfect for high energy morning time'
  },
  {
    id: 'suggestion-2',
    title: 'Take a walk outside',
    description: 'Enjoy the beautiful weather',
    category: 'Health',
    priority: 'Low',
    duration: 30,
    timeOfDay: 'Afternoon',
    icon: <Globe className="w-4 h-4" />,
    reason: weather.condition === 'sunny' ? 'Great weather for outdoor activity' : 'Good for mental clarity'
  },
  {
    id: 'suggestion-3',
    title: 'Deep work session',
    description: 'Focus on your most important project',
    category: 'Work',
    priority: 'High',
    duration: 90,
    timeOfDay: timeInfo.energy === 'high' ? 'Morning' : 'Afternoon',
    icon: <Rocket className="w-4 h-4" />,
    reason: energyLevel > 70 ? 'High energy level detected' : 'Good for sustained focus'
  },
  {
    id: 'suggestion-4',
    title: 'Quick team check-in',
    description: 'Sync with team members',
    category: 'Work',
    priority: 'Medium',
    duration: 15,
    timeOfDay: 'Afternoon',
    icon: <Users className="w-4 h-4" />,
    reason: 'Good time for team collaboration'
  },
  {
    id: 'suggestion-5',
    title: 'Plan tomorrow',
    description: 'Review and organize upcoming tasks',
    category: 'Personal',
    priority: 'Medium',
    duration: 25,
    timeOfDay: 'Evening',
    icon: <Compass className="w-4 h-4" />,
    reason: timeInfo.energy === 'low' ? 'Perfect evening activity' : 'Great for reflection'
  }
];

// Motivational quotes
const quotes = [
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" }
];

// Widget configuration interface
interface WidgetConfig {
  id: string;
  title: string;
  component: React.ReactNode;
  size: 'small' | 'medium' | 'large';
  visible: boolean;
  order: number;
}

export default function EnhancedDashboard() {
  const { tasks, addTask, acceptTask, updateTask } = useTasks();
  const { notes } = useNotes();
  const { notifications, snoozeNotification, setRecurringNotification, deleteNotification } = useNotifications();
  const { user } = useAuth();
  const { getModifiers } = useKeyboardShortcuts();

  // Dashboard state
  const [currentView, setCurrentView] = useState<'minimal' | 'detailed' | 'analytics'>('detailed');
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60); // 25 minutes in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentQuote] = useState(quotes[Math.floor(Math.random() * quotes.length)]);
  const [energyLevel, setEnergyLevel] = useState(80);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  
  // Enhanced search and filter state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState("");
  const [contentType, setContentType] = useState<'all' | 'tasks' | 'notes'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'alphabetical'>('date');
  const [cardsPerRow, setCardsPerRow] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [showFilters, setShowFilters] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchView, setSearchView] = useState<'unified' | 'separated'>('unified');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [shareDialog, setShareDialog] = useState<{isOpen: boolean, itemType: 'task' | 'note', itemTitle: string, itemId: string} | null>(null);
  const [showTaskSuggestions, setShowTaskSuggestions] = useState(false);

  // Get OS-appropriate modifier keys
  const modifiers = getModifiers();

  // Refresh function for pull-to-refresh
  const handleRefresh = async () => {
    // Simulate a refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Clear filters and search to show fresh content
    setSearch("");
    setCategory("");
    setDate("");
    setPriority("");
    setContentType('all');
    setSortBy('date');
    setShowFilters(false);
    
    // Force re-render by clearing and restoring state if needed
    console.log('Refreshed home page content');
  };

  // Set cards per row based on screen size after component mounts
  useEffect(() => {
    const updateCardsPerRow = () => {
      const width = window.innerWidth;
      if (width < 640) setCardsPerRow(1); // sm
      else if (width < 1024) setCardsPerRow(2); // lg
      else if (width < 1280) setCardsPerRow(3); // xl
      else setCardsPerRow(4); // 2xl+
    };

    updateCardsPerRow();
    window.addEventListener('resize', updateCardsPerRow);
    return () => window.removeEventListener('resize', updateCardsPerRow);
  }, []);

  // Function to convert note to task
  const convertNoteToTask = async (note: Note) => {
    try {
      const newTask = {
        id: Date.now().toString(),
        userEmail: note.userEmail,
        title: note.title || "Task from Note",
        description: note.content.replace(/<[^>]*>/g, ''), // Strip HTML tags
        category: "Personal" as TaskCategory,
        priority: "Medium" as Priority,
        duration: 30 as TaskDuration,
        timeOfDay: "Morning" as TimeOfDay,
        createdAt: Date.now(),
        rejectionCount: 0,
        isMuted: false,
      };
      
      await addTask(newTask);
      // You could show a toast notification here
      console.log("Note converted to task successfully");
    } catch (error) {
      console.error("Failed to convert note to task:", error);
    }
  };

  // Dynamic grid class based on cardsPerRow
  const getGridClass = () => {
    switch (cardsPerRow) {
      case 1: return "grid grid-cols-1 gap-4 auto-rows-max";
      case 2: return "grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-max";
      case 3: return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max";
      case 4: return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max";
      case 5: return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 auto-rows-max";
      default: return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max";
    }
  };

  // Weather and time data
  const weather = getWeatherData();
  const timeInfo = getTimeBasedInfo();

  // Analytics calculations
  const analytics = useMemo(() => {
    const today = new Date();
    const activeTasks = tasks.filter(t => !t.completedAt);
    const completedTasks = tasks.filter(t => t.completedAt);
    
    // Today's tasks
    const todayTasks = activeTasks.filter(t => 
      t.scheduledAt && isToday(new Date(t.scheduledAt))
    );
    const todayCompleted = completedTasks.filter(t => 
      t.completedAt && isToday(new Date(t.completedAt))
    ).length;
    
    // Overdue tasks
    const overdueTasks = activeTasks.filter(t => 
      t.scheduledAt && new Date(t.scheduledAt) < startOfDay(today)
    );
    
    // Time spent today
    const timeSpentToday = completedTasks
      .filter(t => t.completedAt && isToday(new Date(t.completedAt)))
      .reduce((sum, task) => sum + (task.duration || 0), 0);
    
    // Streak calculation
    let streak = 0;
    let checkDate = new Date();
    while (true) {
      const dayCompleted = completedTasks.some(t => 
        t.completedAt && startOfDay(new Date(t.completedAt)).getTime() === startOfDay(checkDate).getTime()
      );
      if (dayCompleted) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
    
    // Completion rate (last 7 days)
    const weekAgo = subDays(today, 7);
    const weekTasks = tasks.filter(t => new Date(t.createdAt) >= weekAgo);
    const weekCompleted = weekTasks.filter(t => t.completedAt).length;
    const completionRate = weekTasks.length > 0 ? (weekCompleted / weekTasks.length) * 100 : 0;
    
    // Priority breakdown
    const highPriorityTasks = activeTasks.filter(t => t.priority === 'High' || t.priority === 'Critical').length;
    
    return {
      totalActive: activeTasks.length,
      todayTasks: todayTasks.length,
      todayCompleted,
      overdueTasks: overdueTasks.length,
      timeSpentToday,
      streak,
      completionRate,
      highPriorityTasks,
      totalNotes: notes.length,
      notifications: notifications.length
    };
  }, [tasks, notes, notifications]);

  // Smart task prioritization
  const smartTasks = useMemo(() => {
    const activeTasks = tasks.filter(t => !t.completedAt);
    
    return activeTasks
      .map(task => {
        let score = 0;
        
        // Priority scoring
        if (task.priority === 'Critical') score += 100;
        else if (task.priority === 'High') score += 75;
        else if (task.priority === 'Medium') score += 50;
        else score += 25;
        
        // Due date scoring
        if (task.scheduledAt) {
          const daysUntilDue = differenceInDays(new Date(task.scheduledAt), new Date());
          if (daysUntilDue < 0) score += 200; // Overdue
          else if (daysUntilDue === 0) score += 150; // Due today
          else if (daysUntilDue === 1) score += 100; // Due tomorrow
          else score += Math.max(0, 50 - daysUntilDue * 5);
        }
        
        // Time of day matching
        const currentHour = new Date().getHours();
        if (task.timeOfDay === 'Morning' && currentHour < 12) score += 25;
        else if (task.timeOfDay === 'Afternoon' && currentHour >= 12 && currentHour < 17) score += 25;
        else if (task.timeOfDay === 'Evening' && currentHour >= 17) score += 25;
        
        // Energy level matching
        if (task.priority === 'Critical' && energyLevel > 70) score += 30;
        else if (task.priority === 'Low' && energyLevel < 40) score += 20;
        
        return { ...task, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [tasks, energyLevel]);

  // Task suggestions
  const taskSuggestions = useMemo(() => {
    return getTaskSuggestions(timeInfo, weather, energyLevel)
      .filter(suggestion => {
        // Filter based on current time
        const currentHour = new Date().getHours();
        if (suggestion.timeOfDay === 'Morning' && currentHour >= 12) return false;
        if (suggestion.timeOfDay === 'Afternoon' && (currentHour < 12 || currentHour >= 17)) return false;
        if (suggestion.timeOfDay === 'Evening' && currentHour < 17) return false;
        return true;
      })
      .slice(0, 4);
  }, [timeInfo, weather, energyLevel]);

  // Enhanced filtered tasks/notes with improved date filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = search === "" || t.title.toLowerCase().includes(search.toLowerCase()) || (t.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "" || category === "all-categories" || t.category === category;
      
      // Improved date filtering - show tasks that are due on or before the selected date
      const matchesDate = date === "" || (() => {
        // For tasks with reminderAt, use that date, otherwise use createdAt
        const taskDate = new Date(t.reminderAt || t.createdAt);
        const selectedDate = new Date(date);
        selectedDate.setHours(23, 59, 59, 999); // Include the entire selected day
        return taskDate <= selectedDate;
      })();
      
      const matchesPriority = priority === "" || priority === "all-priorities" || t.priority === priority;
      const matchesContentType = contentType === 'all' || contentType === 'tasks';
      
      return matchesSearch && matchesCategory && matchesDate && matchesPriority && matchesContentType;
    });
  }, [tasks, search, category, date, priority, contentType]);

  const filteredNotes = useMemo(() => {
    return notes?.filter(n => {
      const matchesSearch = search === "" || n.title.toLowerCase().includes(search.toLowerCase()) || (n.content || "").toLowerCase().includes(search.toLowerCase());
      const matchesDate = date === "" || (() => {
        const noteDate = new Date(n.createdAt);
        const selectedDate = new Date(date);
        return noteDate <= selectedDate;
      })();
      const matchesContentType = contentType === 'all' || contentType === 'notes';
      return matchesSearch && matchesDate && matchesContentType;
    }) || [];
  }, [notes, search, date, contentType]);

  // Combined and sorted items for unified view with enhanced sorting
  const unifiedItems = useMemo(() => {
    const items = [
      ...filteredTasks.map(task => ({ ...task, type: 'task' as const })),
      ...filteredNotes.map(note => ({ ...note, type: 'note' as const }))
    ];
    
    // Sort based on selected option
    return items.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          // Only apply priority sorting to tasks
          if (a.type === 'task' && b.type === 'task') {
            const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          // Fall back to date for notes or mixed items
          return b.createdAt - a.createdAt;
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'date':
        default:
          return b.createdAt - a.createdAt;
      }
    });
  }, [filteredTasks, filteredNotes, sortBy]);

  // Notification center actions
  const handleSnooze = (id: string) => {
    if (typeof snoozeNotification === "function") {
      snoozeNotification(id, 30);
    } else {
      console.log("Snooze not implemented");
    }
  };
  
  const handleRecurring = (id: string) => {
    if (typeof setRecurringNotification === "function") {
      setRecurringNotification(id, "daily");
    } else {
      console.log("Recurring not implemented");
    }
  };
  
  
  const handleDelete = (id: string) => deleteNotification(id);

  // Pomodoro timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && pomodoroTime > 0) {
      interval = setInterval(() => {
        setPomodoroTime(time => {
          if (time <= 1) {
            setIsTimerRunning(false);
            // Play notification sound or show notification
            return 25 * 60; // Reset to 25 minutes
          }
          return time - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, pomodoroTime]);

  // Format timer display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Voice recording simulation
  const handleVoiceRecord = () => {
    setVoiceRecording(true);
    setTimeout(() => {
      setVoiceRecording(false);
      setNewTaskText("Review project proposal and send feedback to team");
    }, 3000);
  };

  // Quick task creation
  const handleQuickAdd = () => {
    if (newTaskText.trim()) {
      addTask({
        userEmail: user?.email || 'user@example.com',
        title: newTaskText,
        category: 'Work',
        priority: 'Medium',
        duration: 30,
        timeOfDay: timeInfo.energy === 'high' ? 'Morning' : 'Afternoon'
      });
      setNewTaskText("");
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="w-full max-w-6xl mx-auto py-4 md:py-8 px-2 md:px-0">
        {/* Compact Search Interface - Smaller & Positioned Better */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          {!showSearchBar ? (
            <div className="flex justify-start">
              <Card className="w-fit shadow-md">
                <CardContent className="p-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowSearchBar(true)}
                    className="flex items-center gap-2 h-8 px-3 text-sm"
                  >
                    <Search className="w-3 h-3" />
                    <span className="hidden sm:inline">Search...</span>
                    <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      <span>{modifiers.cmd}</span>
                      <span>K</span>
                    </div>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className={cn(
              "overflow-hidden transition-all duration-500 shadow-2xl",
              "bg-gradient-to-br from-card/95 via-card to-muted/10 backdrop-blur-xl border-2",
              "border-primary/40 shadow-primary/10 bg-gradient-to-br from-primary/5 via-card to-muted/20"
            )}>
              <CardContent className="p-0">
                {/* Modern Search Header */}
                <div className="p-4 sm:p-6 pb-4">
                  <div className="space-y-4">
                    {/* Title Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            <Search className="w-5 h-5 text-primary" />
                          </div>
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
                          >
                            <div className="w-2 h-2 bg-white rounded-full" />
                          </motion.div>
                        </div>
                        <div>
                          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                            Smart Search
                          </h2>
                          <p className="text-sm text-muted-foreground hidden sm:block">
                            Find tasks, notes, and content instantly
                          </p>
                        </div>
                      </div>
                      
                      {/* Quick Stats */}
                      <div className="hidden md:flex items-center gap-4 opacity-70">
                        <div className="text-center">
                          <div className="text-lg font-bold text-primary">{tasks.length}</div>
                          <div className="text-xs text-muted-foreground">Tasks</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{notes.length}</div>
                          <div className="text-xs text-muted-foreground">Notes</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Enhanced Search Input */}
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          placeholder="🔍 Search tasks, notes, or anything..."
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          className={cn(
                            "w-full h-14 pl-12 pr-16 text-base font-medium border-2 rounded-2xl transition-all duration-300",
                            "bg-background/80 backdrop-blur-sm placeholder:text-muted-foreground/70",
                            "focus:border-primary/60 focus:ring-4 focus:ring-primary/10 focus:bg-background/95",
                            "border-primary/30 bg-background/95"
                          )}
                          autoFocus
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          {search && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-destructive/10 rounded-full"
                              onClick={() => setSearch("")}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-muted rounded-full"
                            onClick={() => setShowSearchBar(false)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              {/* Advanced Controls Panel */}
              <AnimatePresence>
                {showSearchBar && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="border-t border-border/30 bg-gradient-to-r from-muted/30 to-muted/20"
                  >
                    <div className="p-4 sm:p-6 space-y-6">
                        {/* View Controls & Actions - More Compact */}
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                          {/* View Toggle - Compact */}
                          <div className="flex-shrink-0">
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">View</label>
                            <div className="flex border rounded-md p-0.5 bg-background/50 backdrop-blur-sm w-fit">
                              <Button
                                variant={searchView === 'unified' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setSearchView('unified')}
                                className="h-7 px-2 rounded text-xs"
                              >
                                <LayoutGrid className="w-3 h-3 mr-1" />
                                Unified
                              </Button>
                              <Button
                                variant={searchView === 'separated' ? 'default' : 'ghost'}
                                size="sm" 
                                onClick={() => setSearchView('separated')}
                                className="h-7 px-2 rounded text-xs"
                              >
                                <Grid className="w-3 h-3 mr-1" />
                                Grouped
                              </Button>
                            </div>
                          </div>
                          
                          {/* Layout Control - Compact */}
                          <div className="flex-shrink-0">
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Layout</label>
                            <Select value={cardsPerRow.toString()} onValueChange={(value) => setCardsPerRow(parseInt(value) as 1 | 2 | 3 | 4 | 5)}>
                              <SelectTrigger className="h-7 w-20 border rounded-md bg-background/50 backdrop-blur-sm text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="w-28" align="end">
                                <SelectItem value="1">1 Col</SelectItem>
                                <SelectItem value="2">2 Cols</SelectItem>
                                <SelectItem value="3">3 Cols</SelectItem>
                                <SelectItem value="4">4 Cols</SelectItem>
                                <SelectItem value="5">5 Cols</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        
                          {/* Action Buttons - Aligned Right */}
                          <div className="flex gap-2 ml-auto">
                            <Button 
                              variant="outline" 
                              onClick={() => setShowFilters(f => !f)}
                              className={cn(
                                "h-7 px-2 border rounded-md bg-background/50 backdrop-blur-sm transition-all text-xs",
                                showFilters && "bg-primary/10 border-primary/30 text-primary shadow-sm"
                              )}
                            >
                              <Filter className="w-3 h-3 mr-1" />
                              Filters
                              {showFilters && <div className="w-1 h-1 bg-primary rounded-full ml-1" />}
                            </Button>
                            
                            <Button 
                              variant="outline" 
                              onClick={() => { 
                                setShowSearchBar(false); 
                                setSearch(""); 
                                setShowFilters(false);
                                setCategory("");
                                setPriority("");
                                setDate("");
                                setContentType('all');
                                setSortBy('date');
                              }}
                              className="h-7 px-2 border rounded-md bg-background/50 backdrop-blur-sm hover:bg-destructive/5 hover:border-destructive/30 text-xs"
                            >
                              <X className="w-3 h-3 mr-1" />
                              Close
                            </Button>
                          </div>
                        </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Advanced Filter Panel */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden border-t border-border/30"
                  >
                    <div className="p-4 sm:p-6 bg-gradient-to-br from-muted/20 to-muted/10">
                      <div className="space-y-6">
                        {/* Filter Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Filter className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">Advanced Filters</h3>
                              <p className="text-sm text-muted-foreground">Refine your search results</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {Object.values({category, priority, date, contentType: contentType !== 'all' ? contentType : '', sortBy: sortBy !== 'date' ? sortBy : ''}).filter(Boolean).length} active
                          </Badge>
                        </div>
                        
                        {/* Filter Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                          {/* Content Type Filter */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <LayoutGrid className="w-3 h-3" />
                              Content Type
                            </label>
                            <Select value={contentType} onValueChange={(value: 'all' | 'tasks' | 'notes') => setContentType(value)}>
                              <SelectTrigger className="h-11 focus:ring-2 focus:ring-primary/20 border-2 rounded-xl bg-background/50 backdrop-blur-sm">
                                <div className="flex items-center gap-2 w-full">
                                  {contentType === "tasks" && <CheckSquare className="w-4 h-4 text-blue-500" />}
                                  {contentType === "notes" && <StickyNote className="w-4 h-4 text-green-500" />}
                                  {contentType === "all" && <LayoutGrid className="w-4 h-4 text-purple-500" />}
                                  <SelectValue placeholder="All Content" />
                                </div>
                              </SelectTrigger>
                              <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[180px]">
                                <SelectItem value="all" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <LayoutGrid className="w-4 h-4 text-purple-500" />
                                    <div>
                                      <span className="font-medium">All Content</span>
                                      <div className="text-xs text-muted-foreground">Tasks & Notes</div>
                                    </div>
                                  </div>
                                </SelectItem>
                                <SelectItem value="tasks" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <CheckSquare className="w-4 h-4 text-blue-500" />
                                    <div>
                                      <span className="font-medium">Tasks Only</span>
                                      <div className="text-xs text-muted-foreground">Todo items</div>
                                    </div>
                                  </div>
                                </SelectItem>
                                <SelectItem value="notes" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <StickyNote className="w-4 h-4 text-green-500" />
                                    <div>
                                      <span className="font-medium">Notes Only</span>
                                      <div className="text-xs text-muted-foreground">Written content</div>
                                    </div>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Category Filter */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                              Category
                            </label>
                            <Select value={category} onValueChange={setCategory}>
                              <SelectTrigger className="h-11 focus:ring-2 focus:ring-primary/20 border-2 rounded-xl bg-background/50 backdrop-blur-sm">
                                <div className="flex items-center gap-2 w-full">
                                  {category === "Work" && <span className="text-blue-500">💼</span>}
                                  {category === "Personal" && <span className="text-purple-500">🏠</span>}
                                  {category === "Health" && <span className="text-green-500">❤️</span>}
                                  {category === "Other" && <span className="text-gray-500">📂</span>}
                                  <SelectValue placeholder="All Categories" />
                                </div>
                              </SelectTrigger>
                              <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[180px]">
                                <SelectItem value="all-categories" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">📁</span>
                                    <div>
                                      <span className="font-medium">All Categories</span>
                                      <div className="text-xs text-muted-foreground">No filter</div>
                                    </div>
                                  </div>
                                </SelectItem>
                                <SelectItem value="Work" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">💼</span>
                                    <div>
                                      <span className="font-medium">Work</span>
                                      <div className="text-xs text-muted-foreground">Professional tasks</div>
                                    </div>
                                  </div>
                                </SelectItem>
                                <SelectItem value="Personal" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">🏠</span>
                                    <div>
                                      <span className="font-medium">Personal</span>
                                      <div className="text-xs text-muted-foreground">Life & hobbies</div>
                                    </div>
                                  </div>
                                </SelectItem>
                                <SelectItem value="Health" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">❤️</span>
                                    <div>
                                      <span className="font-medium">Health</span>
                                      <div className="text-xs text-muted-foreground">Wellness & fitness</div>
                                    </div>
                                  </div>
                                </SelectItem>
                                <SelectItem value="Other" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">📂</span>
                                    <div>
                                      <span className="font-medium">Other</span>
                                      <div className="text-xs text-muted-foreground">Miscellaneous</div>
                                    </div>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Priority Filter */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-orange-500" />
                              Priority
                            </label>
                            <Select value={priority} onValueChange={setPriority}>
                              <SelectTrigger className="h-11 focus:ring-2 focus:ring-primary/20 border-2 rounded-xl bg-background/50 backdrop-blur-sm">
                                <div className="flex items-center gap-2 w-full overflow-hidden min-w-0">
                                  {priority === "Critical" && <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse flex-shrink-0" />}
                                  {priority === "High" && <div className="w-3 h-3 bg-orange-500 rounded-full flex-shrink-0" />}
                                  {priority === "Medium" && <div className="w-3 h-3 bg-yellow-500 rounded-full flex-shrink-0" />}
                                  {priority === "Low" && <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0" />}
                                  <SelectValue placeholder="All Priorities" className="truncate flex-1 min-w-0" />
                                </div>
                              </SelectTrigger>
                              <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[180px]">
                                <SelectItem value="all-priorities" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-gray-400 rounded-full" />
                                    <div>
                                      <span className="font-medium">All Priorities</span>
                                      <div className="text-xs text-muted-foreground">No filter</div>
                                    </div>
                                  </div>
                                </SelectItem>
                                <SelectItem value="Critical" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                    <div>
                                      <span className="font-medium text-red-600">Critical</span>
                                      <div className="text-xs text-muted-foreground">Urgent & important</div>
                                    </div>
                                    <span className="text-sm ml-auto">🔥</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="High" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-orange-500 rounded-full" />
                                    <div>
                                      <span className="font-medium text-orange-600">High</span>
                                      <div className="text-xs text-muted-foreground">Important tasks</div>
                                    </div>
                                    <span className="text-sm ml-auto">⚡</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="Medium" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                                    <div>
                                      <span className="font-medium text-yellow-600">Medium</span>
                                      <div className="text-xs text-muted-foreground">Standard priority</div>
                                    </div>
                                    <span className="text-sm ml-auto">📋</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="Low" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                                    <div>
                                      <span className="font-medium text-green-600">Low</span>
                                      <div className="text-xs text-muted-foreground">When time allows</div>
                                    </div>
                                    <span className="text-sm ml-auto">🌱</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Date Filter */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <CalendarIcon className="w-3 h-3" />
                              Due Date
                            </label>
                            <div className="relative">
                              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="h-11 pl-10 focus:ring-2 focus:ring-primary/20 border-2 rounded-xl bg-background/50 backdrop-blur-sm"
                                placeholder="Select date"
                              />
                            </div>
                          </div>

                          {/* Sort Filter */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <SortAsc className="w-3 h-3" />
                              Sort By
                            </label>
                            <Select value={sortBy} onValueChange={(value: 'date' | 'priority' | 'alphabetical') => setSortBy(value)}>
                              <SelectTrigger className="h-11 focus:ring-2 focus:ring-primary/20 border-2 rounded-xl bg-background/50 backdrop-blur-sm">
                                <div className="flex items-center gap-2 w-full">
                                  {sortBy === "date" && <CalendarIcon className="w-4 h-4 text-blue-500" />}
                                  {sortBy === "priority" && <SortAsc className="w-4 h-4 text-orange-500" />}
                                  {sortBy === "alphabetical" && <Edit3 className="w-4 h-4 text-green-500" />}
                                  <SelectValue placeholder="Date Created" />
                                </div>
                              </SelectTrigger>
                              <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[180px]">
                                <SelectItem value="date" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <CalendarIcon className="w-4 h-4 text-blue-500" />
                                    <div>
                                      <span className="font-medium">Date Created</span>
                                      <div className="text-xs text-muted-foreground">Newest first</div>
                                    </div>
                                  </div>
                                </SelectItem>
                                <SelectItem value="priority" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <SortAsc className="w-4 h-4 text-orange-500" />
                                    <div>
                                      <span className="font-medium">Priority</span>
                                      <div className="text-xs text-muted-foreground">Critical first</div>
                                    </div>
                                  </div>
                                </SelectItem>
                                <SelectItem value="alphabetical" className="py-3">
                                  <div className="flex items-center gap-3">
                                    <Edit3 className="w-4 h-4 text-green-500" />
                                    <div>
                                      <span className="font-medium">Alphabetical</span>
                                      <div className="text-xs text-muted-foreground">A to Z</div>
                                    </div>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Filter Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-border/30">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                            <span>Filters applied instantly</span>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setCategory("");
                              setPriority("");
                              setDate("");
                              setContentType('all');
                              setSortBy('date');
                            }}
                            className="h-9 px-4 border-2 rounded-lg bg-background/50 backdrop-blur-sm hover:bg-destructive/5 hover:border-destructive/30"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Reset All
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
          )}
        </motion.div>

        {/* Task Suggestion & Quick Actions Row - Better Space Management */}
        {!showSearchBar && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Task Suggestion - Takes 2 columns */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2"
            >
              <TaskSuggestion />
            </motion.div>

            {/* Quick Actions - Compact Version - Takes 1 column */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-1"
            >
              <QuickActions className="h-fit" />
            </motion.div>
          </div>
        )}

        {/* Enhanced Search Results */}
        {showSearchBar && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Search Stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{filteredTasks.length} tasks</span>
                <span>{filteredNotes.length} notes</span>
                <span>{unifiedItems.length} total results</span>
              </div>
            </div>

            {searchView === 'unified' ? (
              /* Modern Unified Google Keep-style Grid */
              <div className={getGridClass()}>
                <AnimatePresence mode="popLayout">
                  {unifiedItems.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="col-span-full text-center py-12"
                    >
                      <div className="text-muted-foreground space-y-2">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">No results found</p>
                        <p className="text-sm">Try adjusting your search terms or filters</p>
                      </div>
                    </motion.div>
                  ) : (
                    unifiedItems.map((item, index) => (
                      <motion.div
                        key={`${item.type}-${item.id}`}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        className="break-inside-avoid"
                      >
                        {item.type === 'task' ? (
                          <motion.div 
                            className="relative transform transition-all duration-200 hover:scale-[1.02] hover:shadow-md group"
                            whileHover={{ y: -2 }}
                          >
                            {/* Task content wrapper */}
                            <div className="relative ">
                              <TaskItem task={item} className="pt-4"  />

                              {/* Tags overlay - positioned inside the card */}
                              <div className="absolute top-3 left-3 z-20 flex gap-1">
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs bg-blue-500/20 text-blue-700 border-blue-200 backdrop-blur-sm shadow-sm px-2 py-1 rounded-full"
                                >
                                  <CheckSquare className="w-3 h-3 mr-1" />
                                  Task
                                </Badge>
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div 
                            className="relative transform transition-all duration-200 hover:scale-[1.02] hover:shadow-md group"
                            whileHover={{ y: -2 }}
                          >
                            {/* Add padding-top to card content to avoid tag overlap */}
                            <div className="">
                              <NoteCard note={item} onClick={() => setEditingNote(item)} className="pt-5" />

                                <div className="absolute top-3 left-3 z-20 flex gap-1">
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs bg-green-500/20 text-green-700 border-green-200 backdrop-blur-sm shadow-sm px-2 py-1 rounded-full"
                                >
                                  <StickyNote className="w-3 h-3 mr-1" />
                                  Note
                                </Badge>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* Enhanced Separated View with Modern Layout */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Tasks Section */}
                <motion.div 
                  layout 
                  className="space-y-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <CheckSquare className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold">Tasks</h2>
                    <Badge variant="secondary" className="ml-auto">
                      {filteredTasks.length}
                    </Badge>
                  </div>
                  <AnimatePresence mode="popLayout">
                    {filteredTasks.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        className="text-muted-foreground py-8 text-center space-y-2"
                      >
                        <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No tasks found</p>
                      </motion.div>
                    ) : (
                      filteredTasks.map((task, index) => (
                        <motion.div 
                          key={task.id} 
                          layout 
                          initial={{ opacity: 0, x: -20 }} 
                          animate={{ opacity: 1, x: 0 }} 
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ 
                            type: "spring", 
                            stiffness: 500, 
                            damping: 30, 
                            delay: index * 0.05 
                          }}
                          whileHover={{ scale: 1.02, y: -2 }}
                          className="relative group"
                        >
                          <TaskItem task={task} />
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Notes Section */}
                <motion.div 
                  layout 
                  className="space-y-4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <StickyNote className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold">Notes</h2>
                    <Badge variant="secondary" className="ml-auto">
                      {filteredNotes.length}
                    </Badge>
                  </div>
                  <AnimatePresence mode="popLayout">
                    {filteredNotes.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        className="text-muted-foreground py-8 text-center space-y-2"
                      >
                        <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No notes found</p>
                      </motion.div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {filteredNotes.map((note, index) => (
                          <motion.div 
                            key={note.id} 
                            layout 
                            initial={{ opacity: 0, x: 20 }} 
                            animate={{ opacity: 1, x: 0 }} 
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ 
                              type: "spring", 
                              stiffness: 500, 
                              damping: 30, 
                              delay: index * 0.05 
                            }}
                            whileHover={{ scale: 1.02, y: -2 }}
                            className="break-inside-avoid relative group"
                          >
                            <NoteCard note={note} onClick={() => setEditingNote(note)} />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}

        {/* Quick Stats Overview */}
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Target className="w-8 h-8 text-blue-600" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{analytics.totalActive}</p>
                  <p className="text-xs text-muted-foreground">Active Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <AlertCircle className="w-8 h-8 text-orange-600" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{analytics.overdueTasks}</p>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{analytics.todayCompleted}</p>
                  <p className="text-xs text-muted-foreground">Completed Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Clock className="w-8 h-8 text-purple-600" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{Math.floor(analytics.timeSpentToday / 60)}</p>
                  <p className="text-xs text-muted-foreground">Hours Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Zap className="w-8 h-8 text-yellow-600" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{analytics.streak}</p>
                  <p className="text-xs text-muted-foreground">Day Streak</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-indigo-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <TrendingUp className="w-8 h-8 text-indigo-600" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{Math.round(analytics.completionRate)}</p>
                  <p className="text-xs text-muted-foreground">% Complete</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Dashboard Content - Only show when search is not active */}
        {!showSearchBar && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Smart Tasks & Quick Actions */}
            <div className="lg:col-span-2 space-y-6">
              {/* Quick Task Creation */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Quick Add Task
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Input
                        placeholder="What needs to be done?"
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleQuickAdd()}
                        className="flex-1"
                      />
                      <Button
                        variant={voiceRecording ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={handleVoiceRecord}
                        disabled={voiceRecording}
                      >
                        <Mic className={cn("w-4 h-4", voiceRecording && "animate-pulse")} />
                      </Button>
                      <Button onClick={handleQuickAdd} disabled={!newTaskText.trim()}>
                        Add
                      </Button>
                    </div>
                    {voiceRecording && (
                      <p className="text-sm text-muted-foreground mt-2 animate-pulse">
                        Listening... Speak your task
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Smart Task Prioritization */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5" />
                      Smart Suggestions
                      <Badge variant="secondary" className="ml-auto">
                        AI Powered
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {smartTasks.slice(0, 3).map((task, index) => (
                        <motion.div
                          key={task.id}
                          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                          whileHover={{ scale: 1.02 }}
                          onClick={() => acceptTask(task.id)}
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            task.priority === 'Critical' ? 'bg-red-500' :
                            task.priority === 'High' ? 'bg-orange-500' :
                            task.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                          )} />
                          <div className="flex-1">
                            <p className="font-medium">{task.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {task.duration}m
                              <Badge variant="outline" className="text-xs">
                                {task.priority}
                              </Badge>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost">
                            <Play className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

            {/* Progress Visualization */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Daily Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Tasks Completed</span>
                      <span className="text-sm font-medium">
                        {analytics.todayCompleted} / {analytics.todayTasks + analytics.todayCompleted}
                      </span>
                    </div>
                    <Progress 
                      value={
                        analytics.todayTasks + analytics.todayCompleted > 0 
                          ? (analytics.todayCompleted / (analytics.todayTasks + analytics.todayCompleted)) * 100 
                          : 0
                      } 
                      className="h-3"
                    />
                    
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{analytics.todayCompleted}</p>
                        <p className="text-xs text-muted-foreground">Completed</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{analytics.todayTasks}</p>
                        <p className="text-xs text-muted-foreground">Remaining</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">{analytics.overdueTasks}</p>
                        <p className="text-xs text-muted-foreground">Overdue</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Context & Tools */}
          <div className="space-y-6">
            {/* Focus Timer */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Timer className="w-5 h-5" />
                    Focus Timer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-4">
                    <div className="relative w-32 h-32 mx-auto">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          className="text-muted"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={`${2 * Math.PI * 56}`}
                          strokeDashoffset={`${2 * Math.PI * 56 * (1 - (pomodoroTime / (25 * 60)))}`}
                          className="text-primary transition-all duration-1000 ease-in-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-mono font-bold">
                          {formatTime(pomodoroTime)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex justify-center gap-2">
                      <Button
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                        variant={isTimerRunning ? 'destructive' : 'default'}
                      >
                        {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button
                        onClick={() => {
                          setPomodoroTime(25 * 60);
                          setIsTimerRunning(false);
                        }}
                        variant="outline"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Weather & Context */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="w-5 h-5" />
                    Context
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4" />
                      <span className="text-sm">Weather</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{weather.temperature}°C</p>
                      <p className="text-xs text-muted-foreground capitalize">{weather.condition}</p>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm">{weather.suggestion}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Energy Level</span>
                      <span className="text-sm font-medium">{energyLevel}%</span>
                    </div>
                    <Slider
                      value={[energyLevel]}
                      onValueChange={(value) => setEnergyLevel(value[0])}
                      max={100}
                      step={10}
                      className="mt-2"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Motivational Quote */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Daily Inspiration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <blockquote className="text-center space-y-2">
                    <p className="italic text-sm">"{currentQuote.text}"</p>
                    <footer className="text-xs text-muted-foreground">
                      — {currentQuote.author}
                    </footer>
                  </blockquote>
                </CardContent>
              </Card>
            </motion.div>

            {/* Achievement Badges */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                      <Award className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
                      <p className="text-xs font-medium">Streak</p>
                      <p className="text-xs text-muted-foreground">{analytics.streak} days</p>
                    </div>
                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <Target className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                      <p className="text-xs font-medium">Focus</p>
                      <p className="text-xs text-muted-foreground">{Math.floor(analytics.timeSpentToday / 60)}h</p>
                    </div>
                    <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
                      <p className="text-xs font-medium">Tasks</p>
                      <p className="text-xs text-muted-foreground">{analytics.todayCompleted}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
        )}

        {/* Additional Analytics Cards - Always Visible */}
        {!showSearchBar && (
          <motion.div
            className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                    <div key={day} className="flex items-center gap-2">
                      <span className="text-xs w-6">{day}</span>
                      <Progress value={Math.random() * 100} className="flex-1 h-1.5" />
                      <span className="text-xs w-4">{Math.floor(Math.random() * 10)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {['Work', 'Personal', 'Health', 'Other'].map(category => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-xs">{category}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.random() * 100} className="w-16 h-1.5" />
                        <span className="text-xs w-4">{Math.floor(Math.random() * 20)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Productivity Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Most Productive Hour</span>
                    <span className="font-medium text-xs">10:00 AM</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Average Task Duration</span>
                    <span className="font-medium text-xs">45 min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Best Day This Week</span>
                    <span className="font-medium text-xs">Wednesday</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Tasks per Day Average</span>
                    <span className="font-medium text-xs">7.2</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Original Analytics View - Conditional */}
        {currentView === 'analytics' && (
          <motion.div
            className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Weekly Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                    <div key={day} className="flex items-center gap-3">
                      <span className="text-sm w-8">{day}</span>
                      <Progress value={Math.random() * 100} className="flex-1" />
                      <span className="text-sm w-8">{Math.floor(Math.random() * 10)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['Work', 'Personal', 'Health', 'Other'].map(category => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-sm">{category}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.random() * 100} className="w-20" />
                        <span className="text-sm w-8">{Math.floor(Math.random() * 20)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Productivity Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Most Productive Hour</span>
                    <span className="font-medium">10:00 AM</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Task Duration</span>
                    <span className="font-medium">45 min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Best Day This Week</span>
                    <span className="font-medium">Wednesday</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tasks per Day Average</span>
                    <span className="font-medium">7.2</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        
        {/* Edit Note Dialog */}
        <EditNoteDialog
          note={editingNote}
          isOpen={!!editingNote}
          onClose={() => setEditingNote(null)}
        />
        
        {/* Share Dialog */}
        {shareDialog && (
          <ShareDialog
            isOpen={shareDialog.isOpen}
            onClose={() => setShareDialog(null)}
            itemType={shareDialog.itemType}
            itemTitle={shareDialog.itemTitle}
            itemId={shareDialog.itemId}
          />
        )}
      </div>
    </PullToRefresh>
  );
}
