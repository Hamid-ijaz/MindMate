"use client";
import { TaskSuggestion } from "@/components/task-suggestion";
import React, { useState, useMemo } from "react";
import { useTasks } from "@/contexts/task-context";
import { useNotes } from "@/contexts/note-context";
import { useNotifications } from "@/contexts/notification-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Bell, Search, AlarmClock, Repeat, Filter, X, Grid, LayoutGrid, StickyNote, CheckSquare, Edit3, Plus, ArrowRight, MoreHorizontal, Share2 } from "lucide-react";
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
  const [showFilters, setShowFilters] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false); // Controls expanded search UI
  const [searchView, setSearchView] = useState<'unified' | 'separated'>('unified'); // New view toggle
  const [editingNote, setEditingNote] = useState<Note | null>(null); // For note editing in search results
  const [shareDialog, setShareDialog] = useState<{isOpen: boolean, itemType: 'task' | 'note', itemTitle: string, itemId: string} | null>(null);

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

  // Filtered tasks/notes
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = search === "" || t.title.toLowerCase().includes(search.toLowerCase()) || (t.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "" || category === "all-categories" || t.category === category;
      const matchesDate = date === "" || format(new Date(t.createdAt), "yyyy-MM-dd") === date;
      const matchesPriority = priority === "" || priority === "all-priorities" || t.priority === priority;
      return matchesSearch && matchesCategory && matchesDate && matchesPriority;
    });
  }, [tasks, search, category, date, priority]);

  const filteredNotes = useMemo(() => {
    return notes?.filter(n => {
      const matchesSearch = search === "" || n.title.toLowerCase().includes(search.toLowerCase()) || (n.content || "").toLowerCase().includes(search.toLowerCase());
      const matchesDate = date === "" || format(new Date(n.createdAt), "yyyy-MM-dd") === date;
      return matchesSearch && matchesDate;
    }) || [];
  }, [notes, search, date]);

  // Combined and sorted items for unified view
  const unifiedItems = useMemo(() => {
    const items = [
      ...filteredTasks.map(task => ({ ...task, type: 'task' as const })),
      ...filteredNotes.map(note => ({ ...note, type: 'note' as const }))
    ];
    
    // Sort by creation date (newest first)
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }, [filteredTasks, filteredNotes]);

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
            {/* Mobile-first responsive header */}
            <div className="flex flex-col gap-4">
              {/* Title and mobile controls */}
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl md:text-2xl font-bold">
                  <Search className="w-6 h-6 text-primary" />
                  Search & Filter
                </CardTitle>
                {/* Mobile view toggle - only show when searching */}
                {showSearchBar && (
                  <div className="flex md:hidden gap-1">
                    <Button
                      variant={searchView === 'unified' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setSearchView('unified')}
                      className="h-8 w-8 p-0"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={searchView === 'separated' ? 'default' : 'ghost'}
                      size="sm" 
                      onClick={() => setSearchView('separated')}
                      className="h-8 w-8 p-0"
                    >
                      <Grid className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Search Input - Full width and prominent */}
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
              
              {/* Action buttons */}
              <div className="flex gap-2">
                {/* Desktop view toggle */}
                <div className="hidden md:flex border rounded-lg p-1 bg-muted/30">
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
                    "flex-1 md:flex-none h-10 transition-all",
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
                  }}
                  className="flex-1 md:flex-none h-10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </div>
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
                        Filter Options
                      </div>
                      
                      {/* Filter controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
                            <SelectContent className="min-w-[200px]">
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
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Priority</label>
                          <Select value={priority} onValueChange={setPriority}>
                            <SelectTrigger className="h-10 focus:ring-2 focus:ring-primary/20">
                              <div className="flex items-center gap-2 w-full">
                                {priority === "Critical" && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                                {priority === "High" && <div className="w-2 h-2 bg-orange-500 rounded-full" />}
                                {priority === "Medium" && <div className="w-2 h-2 bg-yellow-500 rounded-full" />}
                                {priority === "Low" && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                                <SelectValue placeholder="All Priorities" />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="min-w-[200px]">
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
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                          <Input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="h-10 focus:ring-2 focus:ring-primary/20"
                            placeholder="Select date"
                          />
                        </div>
                        
                        <div className="space-y-2 flex flex-col justify-end">
                          <Button 
                            variant="outline" 
                            onClick={() => { 
                              setCategory(""); 
                              setPriority(""); 
                              setDate(""); 
                            }}
                            className="h-10 w-full"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Clear Filters
                          </Button>
                        </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
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
                          <div className="absolute top-3 right-3 z-10 flex gap-1">
                            <Badge 
                              variant="secondary" 
                              className="text-xs bg-blue-500/10 text-blue-700 border-blue-200 backdrop-blur-sm shadow-sm px-2 py-1 rounded-full"
                            >
                              <CheckSquare className="w-3 h-3 mr-1" />
                              Task
                            </Badge>
                            {item.priority && (
                              <Badge 
                                variant="outline"
                                className={cn(
                                  "text-xs px-2 py-1 rounded-full backdrop-blur-sm shadow-sm",
                                  item.priority === "Critical" && "bg-red-50 text-red-700 border-red-200",
                                  item.priority === "High" && "bg-orange-50 text-orange-700 border-orange-200",
                                  item.priority === "Medium" && "bg-yellow-50 text-yellow-700 border-yellow-200",
                                  item.priority === "Low" && "bg-green-50 text-green-700 border-green-200"
                                )}
                              >
                                {item.priority === "Critical" && "🔥"}
                                {item.priority === "High" && "⚡"}
                                {item.priority === "Medium" && "📋"}
                                {item.priority === "Low" && "📝"}
                                <span className="ml-1">{item.priority}</span>
                              </Badge>
                            )}
                          </div>
                          {/* Share button for tasks */}
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 h-7 w-7 p-0 bg-background/90 backdrop-blur-sm shadow-md hover:shadow-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShareDialog({
                                isOpen: true,
                                itemType: 'task',
                                itemTitle: item.title,
                                itemId: item.id
                              });
                            }}
                          >
                            <Share2 className="w-3 h-3" />
                          </Button>
                          <TaskItem task={item} />
                        </motion.div>
                      ) : (
                        <motion.div 
                          className="relative transform transition-all duration-200 hover:scale-[1.02] hover:shadow-md group"
                          whileHover={{ y: -2 }}
                        >
                          <div className="absolute top-3 right-3 z-10 flex gap-1">
                            <Badge 
                              variant="secondary" 
                              className="text-xs bg-green-500/10 text-green-700 border-green-200 backdrop-blur-sm shadow-sm px-2 py-1 rounded-full"
                            >
                              <StickyNote className="w-3 h-3 mr-1" />
                              Note
                            </Badge>
                            {item.color && (
                              <div 
                                className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                                style={{ backgroundColor: item.color }}
                              />
                            )}
                          </div>
                          {/* Action buttons - show on hover */}
                          <div className="absolute top-3 left-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 w-7 p-0 bg-background/90 backdrop-blur-sm shadow-md hover:shadow-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNote(item);
                              }}
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 w-7 p-0 bg-background/90 backdrop-blur-sm shadow-md hover:shadow-lg"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-48">
                                <DropdownMenuItem onClick={() => convertNoteToTask(item)}>
                                  <ArrowRight className="w-4 h-4 mr-2" />
                                  Convert to Task
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShareDialog({
                                  isOpen: true,
                                  itemType: 'note',
                                  itemTitle: item.title || 'Untitled Note',
                                  itemId: item.id
                                })}>
                                  <Share2 className="w-4 h-4 mr-2" />
                                  Share Note
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setEditingNote(item)}>
                                  <Edit3 className="w-4 h-4 mr-2" />
                                  Edit Note
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <NoteCard note={item} onClick={() => setEditingNote(item)} />
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
                        <Button
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
                        </Button>
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
                          <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
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
                          </div>
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
