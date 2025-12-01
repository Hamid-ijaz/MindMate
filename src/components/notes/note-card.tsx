
"use client";

import { useState } from 'react';
import type { Note } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemActionsDropdown } from '@/components/item-actions-dropdown';
import { ShareDialog } from '@/components/share-dialog';
import { SharingHistory } from '@/components/sharing-history';
import { useNotes } from '@/contexts/note-context';
import { useTasks } from '@/contexts/task-context';
import type { TaskCategory, Priority, TaskDuration } from '@/lib/types';

interface NoteCardProps {
    note: Note;
    onClick: () => void;
}

export function NoteCard({ note, onClick, className = "" }: NoteCardProps & { className?: string }) {
    const [shareDialog, setShareDialog] = useState<{isOpen: boolean, itemType: 'task' | 'note', itemTitle: string, itemId: string} | null>(null);
    const [showSharingHistory, setShowSharingHistory] = useState(false);
    const { deleteNote } = useNotes();
    const { addTask } = useTasks();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleShare = (itemType: 'task' | 'note', itemTitle: string, itemId: string) => {
        setShareDialog({ isOpen: true, itemType, itemTitle, itemId });
    };

    const handleEdit = () => {
        onClick(); // Use the existing onClick handler for editing
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        await deleteNote(note.id);
        setIsDeleting(false);
    };

    const handleConvertToTask = async () => {
        try {
            const newTask = {
                userEmail: note.userEmail,
                title: note.title || "Task from Note",
                description: note.content.replace(/<[^>]*>/g, ''), // Strip HTML tags
                category: "Personal" as TaskCategory,
                priority: "Medium" as Priority,
                duration: 30 as TaskDuration,
                googleTaskId: null,
            };
            
            await addTask(newTask);
            // You could show a toast notification here
            console.log("Note converted to task successfully");
        } catch (error) {
            console.error("Failed to convert note to task:", error);
        }
    };

    return (
        <Card 
            className={`break-inside-avoid cursor-pointer hover:shadow-lg transition-all duration-200 border-2 group ${note.imageUrl ? '' : className}`}
            style={{ borderColor: note.color || 'hsl(var(--border))' }}
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
            <CardContent className="p-4" onClick={onClick}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        {note.title && <CardTitle className="text-lg font-semibold mb-2">{note.title}</CardTitle>}
                        {note.content && (
                            <div 
                                className="max-h-60 overflow-hidden"
                                style={{ 
                                    fontSize: note.fontSize ? `${note.fontSize}px` : 'inherit',
                                    color: 'hsl(var(--foreground))' 
                                }}
                                dangerouslySetInnerHTML={{ __html: note.content }}
                            />
                        )}
                        {note.audioUrl && (
                            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                                🎵 Audio recording available
                            </div>
                        )}
                    </div>

                    {/* Actions dropdown - visible on hover or always on mobile */}
                    <div 
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200"
                        onClick={(e) => e.stopPropagation()} // Prevent card click when clicking dropdown
                    >
                        <ItemActionsDropdown
                            item={note}
                            itemType="note"
                            onShare={handleShare}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onConvertToTask={handleConvertToTask}
                            isDeleting={isDeleting}
                            showExternalLink={false}
                        />
                    </div>
                </div>
            </CardContent>

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
        </Card>
    )
}
