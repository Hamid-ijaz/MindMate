
"use client";

import type { Note } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

interface NoteCardProps {
    note: Note;
    onClick: () => void;
}

export function NoteCard({ note, onClick }: NoteCardProps) {
    return (
        <Card 
            className="break-inside-avoid cursor-pointer hover:shadow-lg transition-shadow border"
            onClick={onClick}
            style={{ backgroundColor: note.color || 'transparent' }}
        >
            {note.imageUrl && (
                 <div className="relative w-full h-40">
                    <img
                      src={note.imageUrl}
                      alt={note.title || 'Note image'}
                      className="w-full h-full object-cover rounded-t-lg"
                    />
                </div>
            )}
            <div className="p-4">
                {note.title && <CardTitle className="text-lg font-semibold mb-2">{note.title}</CardTitle>}
                {note.content && (
                    <div 
                        className="prose prose-sm dark:prose-invert max-h-60 overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                )}
            </div>
        </Card>
    )
}
