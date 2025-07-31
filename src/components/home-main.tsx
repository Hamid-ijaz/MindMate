"use client";
import { TaskSuggestion } from "@/components/task-suggestion";
import { QuickActions } from "@/components/quick-actions";
import { PullToRefresh } from "@/components/pull-to-refresh";
import React, { useState, useMemo, useEffect } from "react";
import { useTasks } from "@/contexts/task-context";
import { useNotes } from "@/contexts/note-context";
import { useNotifications } from "@/contexts/notification-context";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Bell, Search, AlarmClock, Repeat, Filter, X, Grid, LayoutGrid, StickyNote, CheckSquare, Edit3, Plus, ArrowRight, MoreHorizontal, Share2, SortAsc } from "lucide-react";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TaskItem } from "@/components/task-item";
import { NoteCard } from "@/components/notes/note-card";
import { EditNoteDialog } from "@/components/notes/edit-note-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { cn } from "@/lib/utils";
import type { Note, TaskCategory, Priority, TaskDuration, TimeOfDay } from "@/lib/types";

// Main homepage module: advanced notifications + search/filter
export default function HomeMain() {
  // Extend context types for notes and notification actions
  const { tasks, addTask } = useTasks();
  const { notes } = useNotes();
  const { notifications, snoozeNotification, setRecurringNotification, deleteNotification } = useNotifications();
  const { getModifiers } = useKeyboardShortcuts();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState("");
  const [contentType, setContentType] = useState<'all' | 'tasks' | 'notes'>('all'); // New content type filter
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'alphabetical'>('date'); // New sorting option
  const [cardsPerRow, setCardsPerRow] = useState<1 | 2 | 3 | 4 | 5>(2); // Default to 2, will be updated on mount
  const [showFilters, setShowFilters] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false); // Controls expanded search UI
  const [searchView, setSearchView] = useState<'unified' | 'separated'>('unified'); // New view toggle
  const [editingNote, setEditingNote] = useState<Note | null>(null); // For note editing in search results
  const [shareDialog, setShareDialog] = useState<{isOpen: boolean, itemType: 'task' | 'note', itemTitle: string, itemId: string} | null>(null);

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

  // Filtered tasks/notes with improved date filtering
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
  // Fallback for missing snoozeNotification
  const handleSnooze = (id: string) => {
    if (typeof snoozeNotification === "function") {
      snoozeNotification(id, 30);
    } else {
      // fallback: show toast or log
      console.log("Snooze not implemented");
    }
  };
  // Fallback for missing setRecurringNotification
  const handleRecurring = (id: string) => {
    if (typeof setRecurringNotification === "function") {
      setRecurringNotification(id, "daily");
    } else {
      // fallback: show toast or log
      console.log("Recurring not implemented");
    }
  };
  const handleDelete = (id: string) => deleteNotification(id);

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

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="w-full max-w-6xl mx-auto py-4 md:py-8 px-2 md:px-0">
      {/* Enhanced Modern Search Interface */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Card className={cn(
          "overflow-hidden transition-all duration-500 shadow-2xl",
          "bg-gradient-to-br from-card/95 via-card to-muted/10 backdrop-blur-xl border-2",
          showSearchBar 
            ? "border-primary/40 shadow-primary/10 bg-gradient-to-br from-primary/5 via-card to-muted/20" 
            : "border-border/50 hover:border-primary/30 hover:shadow-xl"
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
                      {showSearchBar && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
                        >
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </motion.div>
                      )}
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
                        showSearchBar && "border-primary/30 bg-background/95"
                      )}
                      onFocus={() => setShowSearchBar(true)}
                      autoFocus={showSearchBar}
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
                      <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                        <span>{modifiers.cmd}</span>
                        <span>K</span>
                      </div>
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
                    {/* View Controls & Actions */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* View Toggle */}
                      <div className="flex-1">
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">View Mode</label>
                        <div className="flex border-2 rounded-xl p-1 bg-background/50 backdrop-blur-sm">
                          <Button
                            variant={searchView === 'unified' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setSearchView('unified')}
                            className="flex-1 h-10 rounded-lg"
                          >
                            <LayoutGrid className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">Unified</span>
                            <span className="sm:hidden">Grid</span>
                          </Button>
                          <Button
                            variant={searchView === 'separated' ? 'default' : 'ghost'}
                            size="sm" 
                            onClick={() => setSearchView('separated')}
                            className="flex-1 h-10 rounded-lg"
                          >
                            <Grid className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">Grouped</span>
                            <span className="sm:hidden">List</span>
                          </Button>
                        </div>
                      </div>
                      
                      {/* Layout Control */}
                      <div className="w-full sm:w-32">
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">Layout</label>
                        <Select value={cardsPerRow.toString()} onValueChange={(value) => setCardsPerRow(parseInt(value) as 1 | 2 | 3 | 4 | 5)}>
                          <SelectTrigger className="h-10 border-2 rounded-lg bg-background/50 backdrop-blur-sm">
                            <div className="flex items-center gap-2 w-full">
                              <LayoutGrid className="w-4 h-4 text-primary" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="w-32" align="end">
                            <SelectItem value="1">
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-3 bg-current opacity-20 rounded-sm" />
                                <span>1 Column</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="2">
                              <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                  <div className="w-2 h-3 bg-current opacity-20 rounded-sm" />
                                  <div className="w-2 h-3 bg-current opacity-20 rounded-sm" />
                                </div>
                                <span>2 Columns</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="3">
                              <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                  <div className="w-1.5 h-3 bg-current opacity-20 rounded-sm" />
                                  <div className="w-1.5 h-3 bg-current opacity-20 rounded-sm" />
                                  <div className="w-1.5 h-3 bg-current opacity-20 rounded-sm" />
                                </div>
                                <span>3 Columns</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="4">
                              <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                  {[...Array(4)].map((_, i) => (
                                    <div key={i} className="w-1 h-3 bg-current opacity-20 rounded-sm" />
                                  ))}
                                </div>
                                <span>4 Columns</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="5">
                              <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                  {[...Array(5)].map((_, i) => (
                                    <div key={i} className="w-1 h-3 bg-current opacity-20 rounded-sm" />
                                  ))}
                                </div>
                                <span>5 Columns</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowFilters(f => !f)}
                          className={cn(
                            "h-10 px-4 border-2 rounded-lg bg-background/50 backdrop-blur-sm transition-all",
                            showFilters && "bg-primary/10 border-primary/30 text-primary shadow-md"
                          )}
                        >
                          <Filter className="w-4 h-4 mr-2" />
                          <span className="hidden sm:inline">Filters</span>
                          {showFilters && <div className="w-2 h-2 bg-primary rounded-full ml-2" />}
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
                          className="h-10 px-4 border-2 rounded-lg bg-background/50 backdrop-blur-sm hover:bg-destructive/5 hover:border-destructive/30"
                        >
                          <X className="w-4 h-4 mr-2" />
                          <span className="hidden sm:inline">Close</span>
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
      </motion.div>

      {/* Task Suggestion Carousel */}
      {!showSearchBar && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <TaskSuggestion />
        </motion.div>
      )}

      {/* Quick Actions */}
      {!showSearchBar && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <QuickActions />
        </motion.div>
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
                                <CheckSquare className="w-3 h-3 mr-1" />
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
                        {/* Share button for tasks */}
                        {/* <Button
                          variant="secondary"
                          size="sm"
                          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 h-8 w-8 p-0 bg-background/90 backdrop-blur-sm shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShareDialog({
                              isOpen: true,
                              itemType: 'task',
                              itemTitle: task.title,
                              itemId: task.id
                            });
                          }}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button> */}
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
                          {/* Action buttons - show on hover */}
                          {/* <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 w-8 p-0 bg-background/90 backdrop-blur-sm shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNote(note);
                              }}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-8 w-8 p-0 bg-background/90 backdrop-blur-sm shadow-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => convertNoteToTask(note)}>
                                  <ArrowRight className="w-4 h-4 mr-2" />
                                  Convert to Task
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShareDialog({
                                  isOpen: true,
                                  itemType: 'note',
                                  itemTitle: note.title || 'Untitled Note',
                                  itemId: note.id
                                })}>
                                  <Share2 className="w-4 h-4 mr-2" />
                                  Share Note
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setEditingNote(note)}>
                                  <Edit3 className="w-4 h-4 mr-2" />
                                  Edit Note
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div> */}
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
