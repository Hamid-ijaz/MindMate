
"use client";

import { useState } from 'react';
import { useNotes } from '@/contexts/note-context';
import { useAuth } from '@/contexts/auth-context';
import { CreateNote } from '@/components/notes/create-note';
import { NoteCard } from '@/components/notes/note-card';
import { Skeleton } from '@/components/ui/skeleton';
import { EditNoteDialog } from '@/components/notes/edit-note-dialog';
import type { Note } from '@/lib/types';
import { Lightbulb } from 'lucide-react';

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

    if (!isAuthenticated) return null;

    return (
        <div className="container mx-auto max-w-7xl py-8 md:py-12 px-4">
            <CreateNote />

            <div className="mt-12">
                {isLoading ? (
                    <NotesSkeleton />
                ) : notes.length > 0 ? (
                    <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
                       {notes.map(note => (
                           <NoteCard key={note.id} note={note} onClick={() => setEditingNote(note)} />
                       ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-muted-foreground">
                        <Lightbulb className="mx-auto h-16 w-16" />
                        <p className="mt-4 text-lg">Your notes will appear here</p>
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
