
"use client";

import { useState } from 'react';
import { useNotes } from '@/contexts/note-context';
import { useAuth } from '@/contexts/auth-context';
import { CreateNote } from '@/components/notes/create-note';
import { NoteCard } from '@/components/notes/note-card';
import { Skeleton } from '@/components/ui/skeleton';
import { EditNoteDialog } from '@/components/notes/edit-note-dialog';
import type { Note } from '@/lib/types';
import { Lightbulb, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

function NotesSkeleton() {
    return (
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
            {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
        </div>
    )
}

export default function NotesPage() {
    const { notes, isLoading } = useNotes();
    const { isAuthenticated } = useAuth();
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredNotes = notes.filter(note => {
        const titleMatch = note.title.toLowerCase().includes(searchQuery.toLowerCase());
        const contentMatch = note.content.toLowerCase().includes(searchQuery.toLowerCase());
        return titleMatch || contentMatch;
    });

    if (!isAuthenticated) return null;

    return (
        <motion.div 
            className="container mx-auto max-w-7xl py-8 md:py-12 px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
            >
                <CreateNote />
            </motion.div>
            
            <motion.div 
                className="max-w-xl mx-auto my-8"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
            >
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Search notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-12 text-base"
                    />
                </div>
            </motion.div>

            <motion.div 
                className="mt-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
            >
                {isLoading ? (
                    <NotesSkeleton />
                ) : filteredNotes.length > 0 ? (
                    <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
                       <AnimatePresence>
                           {filteredNotes.map((note, index) => (
                               <motion.div
                                   key={note.id}
                                   initial={{ opacity: 0, y: 20 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   exit={{ opacity: 0, y: -20 }}
                                   transition={{ delay: index * 0.05, duration: 0.3 }}
                                   whileHover={{ scale: 1.02, y: -4 }}
                                   className="break-inside-avoid"
                               >
                                   <NoteCard key={note.id} note={note} onClick={() => setEditingNote(note)} />
                               </motion.div>
                           ))}
                       </AnimatePresence>
                    </div>
                ) : (
                    <motion.div 
                        className="text-center py-20 text-muted-foreground"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                    >
                        <Lightbulb className="mx-auto h-16 w-16 mb-4" />
                        <p className="text-lg">
                            {searchQuery ? `No notes found for "${searchQuery}"` : "Your notes will appear here"}
                        </p>
                    </motion.div>
                )}
            </motion.div>

            <EditNoteDialog 
                key={editingNote?.id}
                note={editingNote}
                isOpen={!!editingNote}
                onClose={() => setEditingNote(null)}
            />
        </motion.div>
    );
}
