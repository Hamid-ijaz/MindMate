"use client";
import { TaskSuggestion } from "@/components/task-suggestion";
import React, { useState, useMemo, useEffect } from "react";
import { useTasks } from "@/contexts/task-context";
import { useNotes } from "@/contexts/note-context";
import { useNotifications } from "@/contexts/notification-context";
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
    <div className="w-full max-w-6xl mx-auto py-4 md:py-8 px-2 md:px-0">
      {/* Modern Search Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Card className="border-0 shadow-xl bg-gradient-to-r from-background to-muted/30 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              {/* Title and search input */}
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl md:text-2xl font-bold">
                  <Search className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  <span className="hidden md:inline">Search</span>
                </CardTitle>
              </div>
              
              {/* Search Input - Always visible but expanded controls only show when focused */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search tasks, notes, or content..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full h-12 pl-12 pr-12 text-base border-2 focus:border-primary/50 transition-all rounded-xl bg-background/80 backdrop-blur-sm"
                  onFocus={() => setShowSearchBar(true)}
                  autoFocus={showSearchBar}
                />
                {search && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-destructive/10"
                    onClick={() => setSearch("")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              {/* Enhanced Controls - Only show when search is focused */}
              <AnimatePresence>
                {showSearchBar && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {/* View controls and action buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Mobile view toggle - only on mobile */}
                      <div className="flex sm:hidden border rounded-lg p-1 bg-muted/30">
                        <Button
                          variant={searchView === 'unified' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setSearchView('unified')}
                          className="flex-1 h-9"
                        >
                          <LayoutGrid className="w-4 h-4 mr-2" />
                          Grid
                        </Button>
                        <Button
                          variant={searchView === 'separated' ? 'default' : 'ghost'}
                          size="sm" 
                          onClick={() => setSearchView('separated')}
                          className="flex-1 h-9"
                        >
                          <Grid className="w-4 h-4 mr-2" />
                          List
                        </Button>
                      </div>
                      
                      {/* Desktop view toggle */}
                      <div className="hidden sm:flex border rounded-lg p-1 bg-muted/30">
                        <Button
                          variant={searchView === 'unified' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setSearchView('unified')}
                          className="h-9 px-4"
                        >
                          <LayoutGrid className="w-4 h-4 mr-2" />
                          Unified
                        </Button>
                        <Button
                          variant={searchView === 'separated' ? 'default' : 'ghost'}
                          size="sm" 
                          onClick={() => setSearchView('separated')}
                          className="h-9 px-4"
                        >
                          <Grid className="w-4 h-4 mr-2" />
                          Grouped
                        </Button>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex gap-2 flex-1">
                        {/* Cards per row selector - compact version */}
                        <Select value={cardsPerRow.toString()} onValueChange={(value) => setCardsPerRow(parseInt(value) as 1 | 2 | 3 | 4 | 5)}>
                          <SelectTrigger className="w-16 h-10 border-2 focus:border-primary/50">
                            <div className="flex items-center justify-center w-full">
                              <LayoutGrid className="w-4 h-4 text-indigo-500" />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="w-32" align="start">
                            <SelectItem value="1">1 col</SelectItem>
                            <SelectItem value="2">2 cols</SelectItem>
                            <SelectItem value="3">3 cols</SelectItem>
                            <SelectItem value="4">4 cols</SelectItem>
                            <SelectItem value="5">5 cols</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            try {
                              setShowFilters(f => !f);
                            } catch (error) {
                              console.error('Error toggling filters:', error);
                            }
                          }}
                          className={cn(
                            "flex-1 sm:flex-none h-10 transition-all",
                            showFilters && "bg-primary/10 border-primary/30 shadow-sm"
                          )}
                        >
                          <Filter className="w-4 h-4 mr-2" />
                          Filters
                          {showFilters && <span className="ml-1 text-xs">✓</span>}
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
                          className="flex-1 sm:flex-none h-10"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Close
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Enhanced Animated Filters */}
            <AnimatePresence>
              {showFilters && showSearchBar && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 border-t mt-4 border-border/50">
                    <div className="space-y-4">
                      {/* Filter header */}
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Filter className="w-4 h-4" />
                        Filter & Sort Options
                      </div>
                      
                      {/* Filter controls - Mobile responsive grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                        {/* Content Type Filter */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Content Type</label>
                          <Select value={contentType} onValueChange={(value: 'all' | 'tasks' | 'notes') => setContentType(value)}>
                            <SelectTrigger className="h-10 focus:ring-2 focus:ring-primary/20">
                              <div className="flex items-center gap-2 w-full">
                                {contentType === "tasks" && <CheckSquare className="w-4 h-4 text-blue-500" />}
                                {contentType === "notes" && <StickyNote className="w-4 h-4 text-green-500" />}
                                {contentType === "all" && <LayoutGrid className="w-4 h-4 text-purple-500" />}
                                <SelectValue placeholder="All Content" />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[160px]">
                              <SelectItem value="all" className="py-3">
                                <div className="flex items-center gap-2">
                                  <LayoutGrid className="w-4 h-4 text-purple-500" />
                                  <span className="font-medium">All Content</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="tasks" className="py-3">
                                <div className="flex items-center gap-2">
                                  <CheckSquare className="w-4 h-4 text-blue-500" />
                                  <span className="font-medium">Tasks Only</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="notes" className="py-3">
                                <div className="flex items-center gap-2">
                                  <StickyNote className="w-4 h-4 text-green-500" />
                                  <span className="font-medium">Notes Only</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Category Filter */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Category</label>
                          <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="h-10 focus:ring-2 focus:ring-primary/20">
                              <div className="flex items-center gap-2 w-full">
                                {category === "Work" && <span className="text-blue-500">💼</span>}
                                {category === "Personal" && <span className="text-purple-500">🏠</span>}
                                {category === "Health" && <span className="text-green-500">❤️</span>}
                                {category === "Other" && <span className="text-gray-500">📂</span>}
                                <SelectValue placeholder="All Categories" />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[160px]">
                              <SelectItem value="all-categories" className="py-3">
                                <div className="flex items-center gap-2">
                                  <span>📁</span>
                                  <span className="font-medium">All Categories</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="Work" className="py-3">
                                <div className="flex items-center gap-2">
                                  <span>💼</span>
                                  <span className="font-medium">Work</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="Personal" className="py-3">
                                <div className="flex items-center gap-2">
                                  <span>🏠</span>
                                  <span className="font-medium">Personal</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="Health" className="py-3">
                                <div className="flex items-center gap-2">
                                  <span>❤️</span>
                                  <span className="font-medium">Health</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="Other" className="py-3">
                                <div className="flex items-center gap-2">
                                  <span>📂</span>
                                  <span className="font-medium">Other</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Priority Filter - Mobile responsive */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Priority</label>
                          <Select value={priority} onValueChange={setPriority}>
                            <SelectTrigger className="h-10 focus:ring-2 focus:ring-primary/20 w-full max-w-full">
                              <div className="flex items-center gap-2 w-full overflow-hidden min-w-0">
                                {priority === "Critical" && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />}
                                {priority === "High" && <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />}
                                {priority === "Medium" && <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0" />}
                                {priority === "Low" && <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />}
                                <SelectValue placeholder="All Priorities" className="truncate flex-1 min-w-0" />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[160px] max-w-[calc(100vw-2rem)]">
                              <SelectItem value="all-priorities" className="py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-gray-400 rounded-full" />
                                  <span className="font-medium">All Priorities</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="Critical" className="py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                  <span className="font-medium text-red-600">Critical</span>
                                  <span className="text-xs text-muted-foreground ml-auto">🔥</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="High" className="py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                                  <span className="font-medium text-orange-600">High</span>
                                  <span className="text-xs text-muted-foreground ml-auto">⚡</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="Medium" className="py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                                  <span className="font-medium text-yellow-600">Medium</span>
                                  <span className="text-xs text-muted-foreground ml-auto">📋</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="Low" className="py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                                  <span className="font-medium text-green-600">Low</span>
                                  <span className="text-xs text-muted-foreground ml-auto">📝</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Due Date Filter */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                          <Input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="h-10 focus:ring-2 focus:ring-primary/20"
                            placeholder="Select date"
                            title="Show tasks that are due on or before this date"
                          />
                        </div>

                        {/* Sort By */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Sort By</label>
                          <Select value={sortBy} onValueChange={(value: 'date' | 'priority' | 'alphabetical') => setSortBy(value)}>
                            <SelectTrigger className="h-10 focus:ring-2 focus:ring-primary/20">
                              <div className="flex items-center gap-2 w-full">
                                {sortBy === "date" && <CalendarIcon className="w-4 h-4 text-blue-500" />}
                                {sortBy === "priority" && <AlarmClock className="w-4 h-4 text-orange-500" />}
                                {sortBy === "alphabetical" && <span className="text-green-500 font-semibold text-sm">A→Z</span>}
                                <SelectValue placeholder="Sort by" />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[160px]">
                              <SelectItem value="date" className="py-3">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="w-4 h-4 text-blue-500" />
                                  <span className="font-medium">Date Added</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="priority" className="py-3">
                                <div className="flex items-center gap-2">
                                  <AlarmClock className="w-4 h-4 text-orange-500" />
                                  <span className="font-medium">Priority Level</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="alphabetical" className="py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-500 font-semibold text-sm">A→Z</span>
                                  <span className="font-medium">Alphabetical</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Clear filters button */}
                      <div className="flex justify-end pt-2">
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
                          className="h-9"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Clear All Filters
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardHeader>
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
  );
}
