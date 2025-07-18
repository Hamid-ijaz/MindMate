
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
            className="break-inside-avoid cursor-pointer hover:shadow-lg transition-shadow"
            onClick={onClick}
            style={{ backgroundColor: note.color }}
        >
            {note.imageUrl && (
                 <div className="relative w-full h-40">
                    <Image
                      src={note.imageUrl}
                      alt={note.title}
                      layout="fill"
                      objectFit="cover"
                      className="rounded-t-lg"
                    />
                </div>
            )}
            <CardHeader>
                <CardTitle className="text-lg">{note.title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div 
                    className="prose prose-sm dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: note.content }}
                />
            </CardContent>
        </Card>
    )
}
