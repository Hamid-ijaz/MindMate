
"use client";

import { useState, useEffect } from 'react';
import type { Note } from '@/lib/types';
import { useNotes } from '@/contexts/note-context';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';

interface EditNoteDialogProps {
    note: Note | null;
    isOpen: boolean;
    onClose: () => void;
}

export function EditNoteDialog({ note, isOpen, onClose }: EditNoteDialogProps) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { updateNote, deleteNote } = useNotes();
    const { toast } = useToast();

    useEffect(() => {
        if (note) {
            setTitle(note.title);
            setContent(note.content);
        }
    }, [note]);
    
    const handleClose = () => {
        if (note && (title !== note.title || content !== note.content)) {
            handleSave();
        }
        onClose();
    }

    const handleSave = async () => {
        if (!note) return;
        setIsSaving(true);
        try {
            await updateNote(note.id, { title, content });
            toast({ title: "Note updated" });
        } catch (e) {
            toast({ title: "Error", description: "Failed to save note.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async () => {
        if (!note) return;
        setIsDeleting(true);
        try {
            await deleteNote(note.id);
            toast({ title: "Note deleted" });
            onClose();
        } catch(e) {
            toast({ title: "Error", description: "Failed to delete note.", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                         <Input
                            placeholder="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="border-none focus-visible:ring-0 text-xl font-bold px-0"
                        />
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <textarea
                        placeholder="Take a note..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full min-h-[200px] border-none focus-visible:ring-0 resize-none bg-transparent p-0 text-base outline-none"
                    />
                </div>
                <DialogFooter className="justify-between">
                     <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 className="text-destructive" />}
                    </Button>
                    <Button onClick={handleClose} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
