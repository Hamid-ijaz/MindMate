
"use client";

import { useState, useMemo } from 'react';
import { useNotes } from '@/contexts/note-context';
import { useAuth } from '@/contexts/auth-context';
import { CreateNote } from '@/components/notes/create-note';
import { NoteCard } from '@/components/notes/note-card';
import { Skeleton } from '@/components/ui/skeleton';
import { EditNoteDialog } from '@/components/notes/edit-note-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Note } from '@/lib/types';
import { 
  Lightbulb, Search, StickyNote, Calendar, FileText, 
  Grid3X3, List, Filter, BarChart3, TrendingUp, 
  Clock, Hash, Plus, Sparkles
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';

function NotesSkeleton() {
    return (
        <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
            {/* Stats skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-3 sm:p-4">
                            <div className="text-center space-y-1 sm:space-y-2">
                                <Skeleton className="w-6 h-6 sm:w-8 sm:h-8 rounded-md mx-auto" />
                                <Skeleton className="h-5 sm:h-6 w-6 sm:w-8 mx-auto" />
                                <Skeleton className="h-3 w-12 sm:w-16 mx-auto" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            
            {/* Notes grid skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                {[...Array(12)].map((_, i) => (
                    <Card key={i} className="h-40 sm:h-48">
                        <CardHeader className="pb-2 p-3 sm:p-4">
                            <Skeleton className="h-3 sm:h-4 w-3/4" />
                        </CardHeader>
                        <CardContent className="space-y-2 p-3 sm:p-4 pt-0">
                            <Skeleton className="h-2 sm:h-3 w-full" />
                            <Skeleton className="h-2 sm:h-3 w-5/6" />
                            <Skeleton className="h-2 sm:h-3 w-4/6" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

export default function NotesPage() {
    const { notes, isLoading } = useNotes();
    const { isAuthenticated } = useAuth();
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('masonry');
    const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [showCreateNote, setShowCreateNote] = useState(false);

    // Filter notes based on search and time period
    const filteredNotes = useMemo(() => {
        let filtered = notes.filter(note => {
            const titleMatch = note.title.toLowerCase().includes(searchQuery.toLowerCase());
            const contentMatch = note.content.toLowerCase().includes(searchQuery.toLowerCase());
            return titleMatch || contentMatch;
        });

        // Apply time period filter
        if (filterPeriod !== 'all') {
            filtered = filtered.filter(note => {
                const noteDate = new Date(note.createdAt);
                switch (filterPeriod) {
                    case 'today':
                        return isToday(noteDate);
                    case 'week':
                        return isThisWeek(noteDate);
                    case 'month':
                        return isThisMonth(noteDate);
                    default:
                        return true;
                }
            });
        }

        return filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    }, [notes, searchQuery, filterPeriod]);

    // Analytics calculations
    const analytics = useMemo(() => {
        const totalNotes = notes.length;
        const recentNotes = notes.filter(note => {
            const noteDate = new Date(note.updatedAt || note.createdAt);
            return isThisWeek(noteDate);
        }).length;

        const todayNotes = notes.filter(note => {
            const noteDate = new Date(note.updatedAt || note.createdAt);
            return isToday(noteDate);
        }).length;

        // Calculate average content length
        const totalContentLength = notes.reduce((sum, note) => {
            const textContent = note.content.replace(/<[^>]*>/g, ''); // Strip HTML
            return sum + textContent.length;
        }, 0);
        const avgContentLength = totalNotes > 0 ? Math.round(totalContentLength / totalNotes) : 0;

        // Group notes by color for visual stats
        const colorStats = notes.reduce((acc, note) => {
            const color = note.color || 'default';
            acc[color] = (acc[color] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalNotes,
            recentNotes,
            todayNotes,
            avgContentLength,
            colorStats
        };
    }, [notes]);

    if (!isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
            <div className="container mx-auto max-w-7xl py-4 sm:py-6 px-3 sm:px-4 space-y-4 sm:space-y-6">
                {/* Mobile-optimized header */}
                <motion.div 
                    className="text-center sm:text-left px-2 sm:px-0"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="flex items-center justify-center sm:justify-start gap-3 mb-3">
                        <div className="p-2 sm:p-3 bg-amber-100 dark:bg-amber-900 rounded-lg">
                            <StickyNote className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
                            My Notes
                        </h1>
                    </div>
                    <p className="text-muted-foreground text-xs sm:text-sm md:text-base max-w-2xl mx-auto sm:mx-0">
                        Capture your thoughts, ideas, and inspirations in one place
                    </p>
                </motion.div>

                {/* Quick Stats Dashboard - Mobile First */}
                {!isLoading && notes.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.5 }}
                        className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4"
                    >
                        {/* Total Notes */}
                        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                            <CardContent className="p-3 sm:p-4">
                                <div className="text-center">
                                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 mx-auto mb-1 sm:mb-2" />
                                    <p className="text-lg sm:text-2xl font-bold text-blue-900 dark:text-blue-100">
                                        {analytics.totalNotes}
                                    </p>
                                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                        Total Notes
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Today's Notes */}
                        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                            <CardContent className="p-3 sm:p-4">
                                <div className="text-center">
                                    <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 mx-auto mb-1 sm:mb-2" />
                                    <p className="text-lg sm:text-2xl font-bold text-green-900 dark:text-green-100">
                                        {analytics.todayNotes}
                                    </p>
                                    <p className="text-xs font-medium text-green-600 dark:text-green-400">
                                        Today
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* This Week */}
                        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                            <CardContent className="p-3 sm:p-4">
                                <div className="text-center">
                                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500 mx-auto mb-1 sm:mb-2" />
                                    <p className="text-lg sm:text-2xl font-bold text-purple-900 dark:text-purple-100">
                                        {analytics.recentNotes}
                                    </p>
                                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                                        This Week
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Average Length */}
                        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
                            <CardContent className="p-3 sm:p-4">
                                <div className="text-center">
                                    <Hash className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 mx-auto mb-1 sm:mb-2" />
                                    <p className="text-lg sm:text-2xl font-bold text-orange-900 dark:text-orange-100">
                                        {analytics.avgContentLength}
                                    </p>
                                    <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                                        Avg. Length
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Create Note Button - Mobile Friendly */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="flex justify-center px-2 sm:px-0"
                >
                    <Button
                        onClick={() => setShowCreateNote(!showCreateNote)}
                        className="mb-3 sm:mb-4 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium rounded-full shadow-lg hover:shadow-xl transition-all duration-200 min-h-[44px] touch-manipulation"
                        size="lg"
                    >
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                        {showCreateNote ? 'Hide' : 'Create New Note'}
                        <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                    </Button>
                </motion.div>

                {/* Create Note Component */}
                <AnimatePresence>
                    {showCreateNote && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, y: -20 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden px-2 sm:px-0"
                        >
                            <CreateNote />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Search and Filter Controls */}
                {!isLoading && notes.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className="space-y-3 sm:space-y-4 px-2 sm:px-0"
                    >
                        {/* Search Bar */}
                        <div className="max-w-xl mx-auto">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                <Input
                                    placeholder="Search notes by title or content..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 sm:pl-12 h-11 sm:h-12 text-sm sm:text-base rounded-full border-2 focus:border-primary/50 touch-manipulation"
                                />
                            </div>
                        </div>

                        {/* Filter and View Controls */}
                        <div className="flex flex-col space-y-3 sm:space-y-4">
                            {/* Time Period Filter - Mobile Scrollable */}
                            <div className="overflow-x-auto pb-2">
                                <div className="flex gap-2 min-w-max px-1">
                                    {[
                                        { key: 'all', label: '📋 All', icon: FileText },
                                        { key: 'today', label: '📅 Today', icon: Calendar },
                                        { key: 'week', label: '📊 This Week', icon: BarChart3 },
                                        { key: 'month', label: '🗓️ This Month', icon: Clock }
                                    ].map((filter) => (
                                        <Button
                                            key={filter.key}
                                            variant={filterPeriod === filter.key ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setFilterPeriod(filter.key as any)}
                                            className="whitespace-nowrap h-9 sm:h-10 px-3 sm:px-4 rounded-full text-xs sm:text-sm min-h-[36px] touch-manipulation"
                                        >
                                            {filter.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* View Mode Toggle - Centered on Mobile */}
                            <div className="flex items-center justify-center sm:justify-end gap-2">
                                <span className="text-xs sm:text-sm text-muted-foreground">View:</span>
                                <div className="flex rounded-lg border overflow-hidden">
                                    <Button
                                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                        size="sm"
                                        onClick={() => setViewMode('grid')}
                                        className="rounded-none px-2 sm:px-3 h-8 sm:h-9 min-h-[32px] touch-manipulation"
                                    >
                                        <Grid3X3 className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </Button>
                                    <Button
                                        variant={viewMode === 'masonry' ? 'default' : 'ghost'}
                                        size="sm"
                                        onClick={() => setViewMode('masonry')}
                                        className="rounded-none px-2 sm:px-3 h-8 sm:h-9 min-h-[32px] touch-manipulation"
                                    >
                                        <List className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Filter Results Badge */}
                        {(searchQuery || filterPeriod !== 'all') && (
                            <div className="flex items-center justify-center gap-2 pt-1">
                                <Badge variant="secondary" className="px-2 sm:px-3 py-1 text-xs">
                                    {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'} found
                                </Badge>
                                {(searchQuery || filterPeriod !== 'all') && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setFilterPeriod('all');
                                        }}
                                        className="h-7 sm:h-8 px-2 text-xs min-h-[28px] touch-manipulation"
                                    >
                                        Clear filters
                                    </Button>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Notes Content */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="px-2 sm:px-0"
                >
                    {isLoading ? (
                        <NotesSkeleton />
                    ) : filteredNotes.length > 0 ? (
                        <div className={
                            viewMode === 'masonry' 
                                ? "columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-3 sm:gap-4 space-y-3 sm:space-y-4"
                                : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4"
                        }>
                            <AnimatePresence>
                                {filteredNotes.map((note, index) => (
                                    <motion.div
                                        key={note.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ delay: index * 0.05, duration: 0.3 }}
                                        whileHover={{ scale: 1.02, y: -4 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`${viewMode === 'masonry' ? "break-inside-avoid mb-3 sm:mb-4" : ""} cursor-pointer`}
                                    >
                                        <NoteCard 
                                            note={note} 
                                            onClick={() => setEditingNote(note)}
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <motion.div 
                            className="text-center py-12 sm:py-20 px-4"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                        >
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                                <Lightbulb className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-semibold mb-2">
                                {searchQuery || filterPeriod !== 'all' 
                                    ? `No notes found`
                                    : "No notes yet"
                                }
                            </h3>
                            <p className="text-muted-foreground text-sm sm:text-base mb-4 sm:mb-6 max-w-md mx-auto leading-relaxed">
                                {searchQuery 
                                    ? `No notes match "${searchQuery}". Try adjusting your search terms.`
                                    : filterPeriod !== 'all'
                                    ? `No notes found for the selected time period.`
                                    : "Start capturing your thoughts and ideas by creating your first note!"
                                }
                            </p>
                            {!searchQuery && filterPeriod === 'all' && (
                                <Button
                                    onClick={() => setShowCreateNote(true)}
                                    size="lg"
                                    className="rounded-full px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base min-h-[44px] touch-manipulation"
                                >
                                    <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                                    Create Your First Note
                                </Button>
                            )}
                        </motion.div>
                    )}
                </motion.div>

                {/* Edit Note Dialog */}
                <EditNoteDialog 
                    key={editingNote?.id}
                    note={editingNote}
                    isOpen={!!editingNote}
                    onClose={() => setEditingNote(null)}
                />
            </div>
        </div>
    );
}
