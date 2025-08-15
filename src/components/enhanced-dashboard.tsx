"use client";

import { TaskSuggestion } from "@/components/task-suggestion";
import { QuickActions } from "@/components/quick-actions";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { NotificationPrompt } from "@/components/notification-prompt";
import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/contexts/task-context";
import { useNotes } from "@/contexts/note-context";
import { useNotifications } from "@/contexts/notification-context";
import { useAuth } from "@/contexts/auth-context";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useToast } from "@/hooks/use-toast";
import { useNotificationManager } from "@/hooks/use-notification-manager";
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

// Weather API integration
const useWeatherData = () => {
  const [weather, setWeather] = useState({
    temperature: 22,
    condition: "sunny",
    humidity: 45,
    location: "Getting location...",
    suggestion: "Loading weather data..."
  });
  const [isLoading, setIsLoading] = useState(true);
  // Fetch weather data using OpenWeatherMap API
  const fetchWeatherData = async () => {
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;

            try {
              const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
              if (API_KEY) {
                const response = await fetch(
                  `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`
                );

                if (response.ok) {
                  const data = await response.json();
                  setWeather({
                    temperature: Math.round(data.main.temp),
                    condition: data.weather[0].main.toLowerCase(),
                    humidity: data.main.humidity,
                    location: `${data.name}, ${data.sys.country}`,
                    suggestion: data.main.temp > 20 && data.weather[0].main === 'Clear'
                      ? "Perfect weather for outdoor tasks!"
                      : data.main.temp < 10
                        ? "Cozy weather for indoor focus!"
                        : "Great day for productive work!"
                  });
                } else {
                  throw new Error('Weather API failed');
                }
              } else {
                throw new Error('No API key');
              }
            } catch (error) {
              setWeather({
                temperature: 22 + Math.floor(Math.random() * 10),
                condition: ["sunny", "cloudy", "partly-cloudy"][Math.floor(Math.random() * 3)],
                humidity: 40 + Math.floor(Math.random() * 30),
                location: "Your Location",
                suggestion: "Great day for productive work!"
              });
            }
            setIsLoading(false);
          },
          (error) => {
            setWeather({
              temperature: 22,
              condition: "sunny",
              humidity: 45,
              location: "Location unavailable",
              suggestion: "Perfect weather for productive tasks!"
            });
            setIsLoading(false);
          }
        );
      } else {
        setWeather({
          temperature: 22,
          condition: "sunny",
          humidity: 45,
          location: "Location unavailable",
          suggestion: "Perfect weather for productive tasks!"
        });
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
    }
  };

  useEffect(() => {

    fetchWeatherData();
  }, []);

  return { weather, isLoading };
};

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
  const { tasks, addTask, acceptTask, updateTask, taskCategories, startEditingTask } = useTasks();
  const { notes } = useNotes();
  const { notifications, snoozeNotification, setRecurringNotification, deleteNotification } = useNotifications();
  const { user } = useAuth();
  const { getModifiers } = useKeyboardShortcuts();
  const { toast } = useToast();
  const { shouldShowPrompt } = useNotificationManager();

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
  const [category, setCategory] = useState("all");
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState("all");
  const [contentType, setContentType] = useState<'all' | 'tasks' | 'notes'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'alphabetical'>('date');
  const [cardsPerRow, setCardsPerRow] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [showFilters, setShowFilters] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchView, setSearchView] = useState<'unified' | 'separated'>('unified');
  const [showCompletedTasks, setShowCompletedTasks] = useState(false); // Default to false
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [shareDialog, setShareDialog] = useState<{ isOpen: boolean, itemType: 'task' | 'note', itemTitle: string, itemId: string } | null>(null);
  const [showTaskSuggestions, setShowTaskSuggestions] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(shouldShowPrompt());

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
    setShowCompletedTasks(false);

    // Force re-render by clearing and restoring state if needed
    console.log('Refreshed home page content');
  };

  // Set cards per row based on screen size after component mounts
  useEffect(() => {
    if (typeof window === 'undefined') return;

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
        category: (taskCategories[0] || "Personal") as TaskCategory,
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
  const { weather, isLoading: weatherLoading } = useWeatherData();
  const timeInfo = getTimeBasedInfo();
  const router = useRouter();

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

    // Overdue tasks (unified logic)
    const overdueTasks = tasks.filter(task => {
      // Skip completed or muted tasks
      if (task.completedAt || task.isMuted) return false;

      // Check if task has a reminder date set
      if (task.reminderAt) {
        const reminderDate = new Date(task.reminderAt);
        return reminderDate.getTime() < today.getTime();

      }

      // For tasks without reminders, consider them overdue if created more than 3 days ago
      const createdDate = new Date(task.createdAt);
      const threeDaysAgo = subDays(startOfDay(today), 3);
      return false;
    });

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
  notifications: notifications.length,
  // overall task counts
  totalTasks: tasks.length,
  totalCompleted: completedTasks.length,
  remainingTasks: tasks.length - completedTasks.length,
  overallCompletionRate: tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0
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
      // Filter out child tasks - only show parent tasks
      const isParentTask = !t.parentId;
      if (!isParentTask) return false;

      // Filter by completion status
      const matchesCompletionStatus = showCompletedTasks || !t.completedAt;

      const matchesSearch = search === "" || t.title.toLowerCase().includes(search.toLowerCase()) || (t.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "all" || category === "" || category === "all-categories" || t.category === category;

      // Improved date filtering - show tasks that are due on or before the selected date
      const matchesDate = date === "" || (() => {
        // For tasks with reminderAt, use that date, otherwise use createdAt
        const taskDate = new Date(t.reminderAt || t.createdAt);
        const selectedDate = new Date(date);
        selectedDate.setHours(23, 59, 59, 999); // Include the entire selected day
        return taskDate <= selectedDate;
      })();

      const matchesPriority = priority === "all" || priority === "" || priority === "all-priorities" || t.priority === priority;
      const matchesContentType = contentType === 'all' || contentType === 'tasks';

      return matchesCompletionStatus && matchesSearch && matchesCategory && matchesDate && matchesPriority && matchesContentType;
    });
  }, [tasks, search, category, date, priority, contentType, showCompletedTasks]);

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

  // Calculate completion rate
  const completionRate = useMemo(() => {
    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter(t => t.completedAt).length;
    return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  }, [filteredTasks]);

  // Calculate overdue tasks
  const overdueTasks = useMemo(() => {
    const now = new Date();
    const todayStart = now;
    console.log("🚀 > EnhancedDashboard > todayStart:", todayStart)
    
    return tasks.filter(task => {
      // Skip completed or muted tasks
      if (task.completedAt || task.isMuted) return false;
      
      // Check if task has a reminder date set
      if (task.reminderAt) {
        const reminderDate = new Date(task.reminderAt);
        // Compare both date and time (not just date)
        return reminderDate.getTime() < todayStart.getTime();
      }
      
      // For tasks without reminders, consider them overdue if created more than 3 days ago
      const createdDate = new Date(task.createdAt);
      const threeDaysAgo = subDays(todayStart, 3);
      // return createdDate < threeDaysAgo;
      return false;
    }).sort((a, b) => {
      // Sort by reminder date first (if available), then by creation date
      const aDate = a.reminderAt || a.createdAt;
      const bDate = b.reminderAt || b.createdAt;
      return aDate - bDate;
    });
  }, [tasks]);

  // Tasks due today (reminderAt or scheduledAt)
  const dueTodayTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.completedAt || t.isMuted) return false;
      const reminder = t.reminderAt ? new Date(t.reminderAt) : null;
      const scheduled = t.scheduledAt ? new Date(t.scheduledAt) : null;

      return (reminder && isToday(reminder)) || (scheduled && isToday(scheduled));
    }).sort((a, b) => {
      const aDate = a.reminderAt || a.scheduledAt || a.createdAt;
      const bDate = b.reminderAt || b.scheduledAt || b.createdAt;
      return aDate - bDate;
    });
  }, [tasks]);

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

  // Voice recording with actual speech recognition
  const handleVoiceRecord = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: "Speech Recognition Not Supported",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive"
      });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    setVoiceRecording(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setNewTaskText(transcript);
      setVoiceRecording(false);
      toast({
        title: "Voice Captured",
        description: "Task text has been transcribed successfully.",
      });
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setVoiceRecording(false);
      toast({
        title: "Voice Recognition Error",
        description: "Could not capture voice. Please try again.",
        variant: "destructive"
      });
    };

    recognition.onend = () => {
      setVoiceRecording(false);
    };

    recognition.start();
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
        {/* Ultra-Modern Compact Search Interface */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          {!showSearchBar ? (
            <div className="flex justify-between items-center">
              {/* Quick Stats on the left */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <CheckSquare className="w-4 h-4 text-green-600" />
                  <span>{analytics.todayCompleted} done today</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span>{filteredTasks.filter(t => !t.completedAt && !t.isMuted && isToday(new Date(t.reminderAt))).length} due today</span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowSearchBar(true)}
                className="h-10 px-4 bg-background/50 backdrop-blur-sm border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 shadow-sm hover:shadow-md group"
              >
                <Search className="w-4 h-4 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">Search</span>
                {/* <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded ml-2">
                  <span>{modifiers.cmd}</span>
                  <span>K</span>
                </div> */}
              </Button>
            </div>
          ) : (
            <Card className="border-2 border-primary/30 shadow-xl backdrop-blur-sm bg-background/95">
              <CardContent className="p-0">
                {/* Streamlined Search Header */}
                <div className="p-4 pb-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Search className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">Search & Filter</h2>
                        <p className="text-xs text-muted-foreground">
                          {tasks.length} tasks • {notes.length} notes
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setShowSearchBar(false);
                        setSearch("");
                        setShowFilters(false);
                        setShowCompletedTasks(false);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Enhanced Search Input */}
                  <div className="relative mt-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tasks, notes, or anything..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-10 pr-10 h-10 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                      autoFocus
                    />
                    {search && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                        onClick={() => setSearch("")}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Compact Controls */}
                <div className="p-4 space-y-4">
                  <div className="flex flex-wrap gap-3 items-center">
                    {/* View Toggle */}
                    <div className="flex border rounded-lg p-0.5 bg-muted/30">
                      <Button
                        variant={searchView === 'unified' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setSearchView('unified')}
                        className="h-7 px-3 text-xs"
                      >
                        <LayoutGrid className="w-3 h-3 mr-1" />
                        Unified
                      </Button>
                      <Button
                        variant={searchView === 'separated' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setSearchView('separated')}
                        className="h-7 px-3 text-xs"
                      >
                        <Grid className="w-3 h-3 mr-1" />
                        Grouped
                      </Button>
                    </div>

                    {/* Show Completed Tasks Toggle */}
                    <div className="flex items-center gap-2 px-3 py-1 border rounded-lg bg-background/50">
                      <Checkbox
                        id="show-completed"
                        checked={showCompletedTasks}
                        onCheckedChange={(checked) => setShowCompletedTasks(!!checked)}
                        className="h-3 w-3"
                      />
                      <Label htmlFor="show-completed" className="text-xs cursor-pointer">
                        Show completed
                      </Label>
                    </div>

                    {/* Layout Control */}
                    <Select value={cardsPerRow.toString()} onValueChange={(value) => setCardsPerRow(parseInt(value) as 1 | 2 | 3 | 4 | 5)}>
                      <SelectTrigger className="h-7 w-20 text-xs border-border/50 bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Col</SelectItem>
                        <SelectItem value="2">2 Cols</SelectItem>
                        <SelectItem value="3">3 Cols</SelectItem>
                        <SelectItem value="4">4 Cols</SelectItem>
                        <SelectItem value="5">5 Cols</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Filters Toggle */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(f => !f)}
                      className={cn(
                        "h-7 px-3 text-xs transition-all",
                        showFilters && "bg-primary/10 border-primary/30 text-primary"
                      )}
                    >
                      <Filter className="w-3 h-3 mr-1" />
                      Filters
                      {showFilters && <div className="w-1 h-1 bg-primary rounded-full ml-1" />}
                    </Button>

                    {/* Clear All */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setShowFilters(false);
                        setCategory("");
                        setPriority("");
                        setDate("");
                        setContentType('all');
                        setSortBy('date');
                        setShowCompletedTasks(false);
                      }}
                      className="h-7 px-3 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Clear All
                    </Button>
                  </div>

                  {/* Results Summary */}
                  <div className="text-xs text-muted-foreground flex items-center gap-4">
                    <span>
                      {searchView === 'unified'
                        ? `${unifiedItems.length} results found`
                        : `${filteredTasks.length} tasks • ${filteredNotes.length} notes`
                      }
                    </span>
                    {!showCompletedTasks && (
                      <span className="text-orange-600 bg-orange-100 dark:bg-orange-900/20 px-2 py-1 rounded-md">
                        Completed tasks hidden
                      </span>
                    )}
                  </div>
                </div>

                {/* Advanced Filters Panel */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border/50 bg-muted/20"
                    >
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {/* Content Type */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Content</label>
                            <Select value={contentType} onValueChange={(value: 'all' | 'tasks' | 'notes') => setContentType(value)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Content</SelectItem>
                                <SelectItem value="tasks">Tasks Only</SelectItem>
                                <SelectItem value="notes">Notes Only</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Category Filter - Dynamic */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                            <Select value={category} onValueChange={setCategory}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="All Categories" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {taskCategories.map((cat) => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Priority Filter */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
                            <Select value={priority} onValueChange={setPriority}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="All Priorities" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Priorities</SelectItem>
                                <SelectItem value="Critical">Critical</SelectItem>
                                <SelectItem value="High">High</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Sort By */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort By</label>
                            <Select value={sortBy} onValueChange={(value: 'date' | 'priority' | 'alphabetical') => setSortBy(value)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="date">Date Created</SelectItem>
                                <SelectItem value="priority">Priority</SelectItem>
                                <SelectItem value="alphabetical">A-Z</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Date Filter */}
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Created Before</label>
                          <Input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="h-8 text-xs max-w-40"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Notification Prompt */}
        {showNotificationPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <NotificationPrompt
              onDismiss={() => setShowNotificationPrompt(false)}
              onSubscribed={() => setShowNotificationPrompt(false)}
            />
          </motion.div>
        )}


        {/* Analytics Cards - Always Visible */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        </div>

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

            {/* Productivity Stats - Compact Version - Takes 1 column */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-1"
            >
              <Card className="h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Task Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-950/20 rounded-lg">
                      <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                        {analytics.totalTasks}
                      </div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>

                    <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {analytics.totalCompleted}
                      </div>
                      <div className="text-xs text-green-600/80 dark:text-green-400/80">Completed</div>
                    </div>

                    <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                      <div className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
                        {analytics.remainingTasks}
                      </div>
                      <div className="text-xs text-yellow-700/80 dark:text-yellow-300/80">Remaining</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Overall Progress</span>
                      <span className="font-medium">{Math.round(analytics.overallCompletionRate)}%</span>
                    </div>
                    <Progress value={analytics.overallCompletionRate} className="h-2" />
                  </div>
                </CardContent>
              </Card>
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
                              <TaskItem task={item} className="pt-4" hideSubtaskButton={true} />

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
                          <TaskItem task={task} hideSubtaskButton={true} />
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
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6 mt-5"
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

              {/* Overdue Tasks Card */}
              {overdueTasks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                        <AlertCircle className="w-5 h-5" />
                        Overdue Tasks
                        <Badge variant="secondary" className="ml-auto bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          {overdueTasks.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {overdueTasks.slice(0, 5).map((task, index) => (
                          <motion.div
                            key={task.id}
                            className="flex items-center gap-3 p-3 bg-white/80 dark:bg-gray-800/50 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer border border-orange-200/50 dark:border-orange-800/50"
                            whileHover={{ scale: 1.02 }}
                            onClick={() => startEditingTask(task.id)}
                          >
                            <div className={cn(
                              "w-3 h-3 rounded-full",
                              task.priority === 'Critical' ? 'bg-red-500' :
                                task.priority === 'High' ? 'bg-orange-500' :
                                  task.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                            )} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{task.title}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {task.reminderAt ? (
                                  <span>Due {format(new Date(task.reminderAt), 'MMM d')}</span>
                                ) : (
                                  <span>Created {format(new Date(task.createdAt), 'MMM d')}</span>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {task.priority}
                                </Badge>
                                <span className="text-orange-600 dark:text-orange-400 font-medium">
                                  {task.reminderAt 
                                    ? differenceInDays(new Date(), new Date(task.reminderAt)) + ' days overdue'
                                    : differenceInDays(new Date(), new Date(task.createdAt)) + ' days old'
                                  }
                                </span>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                acceptTask(task.id);
                              }}
                              className="shrink-0"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          </motion.div>
                        ))}
                        
                        {overdueTasks.length > 5 && (
                          <div className="text-center pt-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200"
                              onClick={() => {
                                // Open search with filter for overdue tasks
                                setShowSearchBar(true);
                                setSearch(''); // Clear search but could add overdue filter logic
                              }}
                            >
                              View all {overdueTasks.length} overdue tasks
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

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
                          onClick={() => window.location.href = `/task/${task.id}`}
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
                      <TrendingUp className="w-5 h-5" />
                      Weekly Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Daily Average</span>
                        <span className="text-sm font-medium">
                          {Math.round(analytics.todayCompleted / Math.max(1, 1))} tasks/day
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                            {Math.round(analytics.completionRate)}%
                          </p>
                          <p className="text-xs text-purple-600/80 dark:text-purple-400/80">Success Rate</p>
                        </div>
                        <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
                          <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                            {analytics.streak}
                          </p>
                          <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80">Day Streak</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Most Productive Day</span>
                          <span className="font-medium">Today</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">High Priority Tasks</span>
                          <span className="font-medium text-orange-600">
                            {analytics.highPriorityTasks} remaining
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Active Notes</span>
                          <span className="font-medium text-blue-600">
                            {analytics.totalNotes}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Quick Action Cards */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        className="h-16 flex flex-col items-center justify-center gap-1 hover:bg-primary/5"
                        onClick={() => {
                          const event = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true });
                          document.dispatchEvent(event);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-xs">New Task</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-16 flex flex-col items-center justify-center gap-1 hover:bg-secondary/50"
                        onClick={() => {
                          const event = new KeyboardEvent('keydown', { key: 'm', ctrlKey: true });
                          document.dispatchEvent(event);
                        }}
                      >
                        <StickyNote className="w-4 h-4" />
                        <span className="text-xs">New Note</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-16 flex flex-col items-center justify-center gap-1 hover:bg-green-50 dark:hover:bg-green-950/20"
                        onClick={() => window.location.href = '/pending'}
                      >
                        <Target className="w-4 h-4" />
                        <span className="text-xs">View Tasks</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-16 flex flex-col items-center justify-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                        onClick={() => window.location.href = '/notes'}
                      >
                        <BookOpen className="w-4 h-4" />
                        <span className="text-xs">All Notes</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Right Column - Context & Tools */}
            <div className="space-y-6">
              {/* Due Today Card (replaces Focus Timer) */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5" />
                      Due Today
                      <Badge variant="secondary" className="ml-auto">{dueTodayTasks.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dueTodayTasks.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground py-6">
                          <p>No tasks due today</p>
                          <Button size="sm" className="mt-3" onClick={() => setShowSearchBar(true)}>Add or schedule a task</Button>
                        </div>
                      ) : (
                        dueTodayTasks.slice(0, 5).map(task => (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 p-3 bg-white/80 dark:bg-gray-800/50 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer border"
                            onClick={() => router.push(`/task/${task.id}`)}
                          >
                            <div className={cn(
                              "w-3 h-3 rounded-full",
                              task.priority === 'Critical' ? 'bg-red-500' :
                                task.priority === 'High' ? 'bg-orange-500' :
                                  task.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                            )} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{task.title}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {task.reminderAt ? (
                                  <span>Due {format(new Date(task.reminderAt), 'h:mm a')}</span>
                                ) : (
                                  <span>Due today</span>
                                )}
                                <Badge variant="outline" className="text-xs">{task.priority}</Badge>
                              </div>
                            </div>
                            <div className="flex gap-2 items-center">
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); acceptTask(task.id); }}>
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); startEditingTask(task.id); }}>
                                <Edit3 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}

                      {dueTodayTasks.length > 5 && (
                        <div className="text-center pt-2">
                          <Button variant="ghost" size="sm" onClick={() => { setShowSearchBar(true); }}>
                            View all {dueTodayTasks.length} due today
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      )}
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

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPinIcon className="w-3 h-3" />
                      <span>{weather.location}</span>
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
            {/* Category Breakdown Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {taskCategories.slice(0, 4).map((category, index) => {
                    const categoryTasks = filteredTasks.filter(t => t.category === category && !t.completedAt);
                    const completedCategoryTasks = filteredTasks.filter(t => t.category === category && t.completedAt);
                    const total = categoryTasks.length + completedCategoryTasks.length;
                    const progress = total > 0 ? (completedCategoryTasks.length / total) * 100 : 0;

                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="truncate">{category}</span>
                          <span className="text-muted-foreground">{categoryTasks.length}</span>
                        </div>
                        <Progress value={progress} className="h-1" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

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

            {/* <Card>
              <CardHeader>
                <CardTitle className="text-base">Category Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
            </Card> */}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Productivity Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
