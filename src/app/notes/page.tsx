
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
        <div className="container mx-auto max-w-7xl py-8 md:py-12 px-4">
            <CreateNote />
            
            <div className="max-w-xl mx-auto my-8">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Search notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-12 text-base"
                    />
                </div>
            </div>

            <div className="mt-12">
                {isLoading ? (
                    <NotesSkeleton />
                ) : filteredNotes.length > 0 ? (
                    <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
                       {filteredNotes.map(note => (
                           <NoteCard key={note.id} note={note} onClick={() => setEditingNote(note)} />
                       ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-muted-foreground">
                        <Lightbulb className="mx-auto h-16 w-16" />
                        <p className="mt-4 text-lg">
                            {searchQuery ? `No notes found for "${searchQuery}"` : "Your notes will appear here"}
                        </p>
                    </div>
                )}
            </div>
            
            <EditNoteDialog 
                key={editingNote?.id}
                note={editingNote}
                isOpen={!!editingNote}
                onClose={() => setEditingNote(null)}
            />
        </div>
    );
}
