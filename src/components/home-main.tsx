"use client";
import { TaskSuggestion } from "@/components/task-suggestion";
import React, { useState, useMemo } from "react";
import { useTasks } from "@/contexts/task-context";
import { useNotifications } from "@/contexts/notification-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Bell, Search, AlarmClock, Repeat, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TaskItem } from "@/components/task-item";
import { NoteCard } from "@/components/notes/note-card";

// Main homepage module: advanced notifications + search/filter
export default function HomeMain() {
  // Extend context types for notes and notification actions
  const { tasks, notes = [] } = useTasks();
  const { notifications, snoozeNotification, setRecurringNotification, deleteNotification } = useNotifications();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Filtered tasks/notes
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = search === "" || t.title.toLowerCase().includes(search.toLowerCase()) || (t.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "" || t.category === category;
      const matchesDate = date === "" || format(new Date(t.createdAt), "yyyy-MM-dd") === date;
      const matchesPriority = priority === "" || t.priority === priority;
      return matchesSearch && matchesCategory && matchesDate && matchesPriority;
    });
  }, [tasks, search, category, date, priority]);

  const filteredNotes = useMemo(() => {
    return notes?.filter(n => {
      const matchesSearch = search === "" || n.title.toLowerCase().includes(search.toLowerCase()) || (n.content || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "" || n.category === category;
      const matchesDate = date === "" || format(new Date(n.createdAt), "yyyy-MM-dd") === date;
      return matchesSearch && matchesCategory && matchesDate;
    }) || [];
  }, [notes, search, category, date]);

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
    <div className="w-full max-w-5xl mx-auto py-8 px-2 md:px-0">
      {/* Search & Filter Bar */}
      <Card className="mb-6 shadow-lg">
        <CardHeader className="flex flex-col md:flex-row md:items-center gap-4">
          <CardTitle className="flex items-center gap-2 text-2xl font-bold">
            <Search className="w-6 h-6 text-primary" />
            Find Tasks & Notes
          </CardTitle>
          <div className="flex-1 flex gap-2 items-center">
            <Input
              placeholder="Search by keyword..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-xs"
            />
            <Button variant="ghost" onClick={() => setShowFilters(f => !f)}>
              <Filter className="w-5 h-5" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
          </div>
        </CardHeader>
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-wrap gap-4 px-6 pb-4"
            >
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="Work">Work</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Health">Health</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-40"
              />
              <Button variant="outline" onClick={() => { setCategory(""); setPriority(""); setDate(""); }}>
                <X className="w-4 h-4" />
                Clear
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Notification Center */}
      <div className="mb-6">
        <TaskSuggestion />
      </div>

      {/* Search Results: Tasks & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div layout className="space-y-4">
          <h2 className="text-lg font-semibold mb-2">Tasks</h2>
          <AnimatePresence>
            {filteredTasks.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-muted-foreground py-8 text-center">
                No tasks found.
              </motion.div>
            ) : (
              filteredTasks.map(task => (
                <motion.div key={task.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                  <TaskItem task={task} />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
        <motion.div layout className="space-y-4">
          <h2 className="text-lg font-semibold mb-2">Notes</h2>
          <AnimatePresence>
            {filteredNotes.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-muted-foreground py-8 text-center">
                No notes found.
              </motion.div>
            ) : (
              filteredNotes.map(note => (
                <motion.div key={note.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                  <NoteCard note={note} onClick={() => {}} />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
