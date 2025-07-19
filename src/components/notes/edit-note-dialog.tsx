
"use client";

import { useState, useEffect, useRef } from 'react';
import type { Note } from '@/lib/types';
import { useNotes } from '@/contexts/note-context';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';
import { NoteToolbar } from './note-toolbar';

const DEFAULT_FONT_SIZE = 14;

interface EditNoteDialogProps {
    note: Note | null;
    isOpen: boolean;
    onClose: () => void;
}

export function EditNoteDialog({ note, isOpen, onClose }: EditNoteDialogProps) {
    const [title, setTitle] = useState('');
    const [color, setColor] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
    
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const { updateNote, deleteNote } = useNotes();
    const { toast } = useToast();
    
    const contentRef = useRef<HTMLDivElement>(null);
    const lastContent = useRef('');

    useEffect(() => {
        if (note && contentRef.current) {
            setTitle(note.title || '');
            setColor(note.color || '');
            setImageUrl(note.imageUrl || '');
            setFontSize(note.fontSize || DEFAULT_FONT_SIZE);
            contentRef.current.innerHTML = note.content || '';
            lastContent.current = note.content || '';
        }
    }, [note, isOpen]);

    const sanitizeHtml = (html: string) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('[style]').forEach(el => {
            const element = el as HTMLElement;
            // More specific regex to only remove color and background-color
            if (element.style.color) element.style.color = '';
            if (element.style.backgroundColor) element.style.backgroundColor = '';
            
            if (!element.getAttribute('style')?.trim().replace(/;/g, '')) {
                element.removeAttribute('style');
            }
        });
        return doc.body.innerHTML;
    };

     const handlePaste = (e: ClipboardEvent) => {
        e.preventDefault();
        const pastedHtml = e.clipboardData?.getData('text/html');
        const pastedText = e.clipboardData?.getData('text/plain');

        if (pastedHtml) {
            const sanitizedHtml = sanitizeHtml(pastedHtml);
            document.execCommand('insertHTML', false, sanitizedHtml);
        } else if (pastedText) {
            document.execCommand('insertText', false, pastedText);
        }
    }

     useEffect(() => {
        const editor = contentRef.current;
        if (editor) {
            editor.addEventListener('paste', handlePaste);
            return () => editor.removeEventListener('paste', handlePaste);
        }
    }, [isOpen]); // Re-attach if dialog re-opens

    const handleClose = () => {
        if (!note || !contentRef.current) {
            onClose();
            return;
        }

        const currentContent = sanitizeHtml(lastContent.current);
        const hasChanged = title !== (note.title || '') ||
                           currentContent !== (note.content || '') || 
                           color !== (note.color || '') ||
                           imageUrl !== (note.imageUrl || '') ||
                           fontSize !== (note.fontSize || DEFAULT_FONT_SIZE);
                           
        if (hasChanged && (title.trim() || currentContent.trim())) {
            handleSave(currentContent);
        }
        
        onClose();
    }

    const handleSave = async (currentContent: string) => {
        if (!note) return;
        setIsSaving(true);
        try {
            await updateNote(note.id, { title, content: currentContent, color, imageUrl, fontSize });
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

    const handleContentInput = (e: React.FormEvent<HTMLDivElement>) => {
        lastContent.current = e.currentTarget.innerHTML;
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent 
                className="p-0 border-2 flex flex-col h-screen md:h-auto md:max-h-[90vh] md:max-w-xl md:rounded-lg"
                style={{ borderColor: color || 'hsl(var(--border))' }}
                showCloseButton={false}
            >
                {imageUrl && (
                    <div className="relative w-full h-56 flex-shrink-0">
                        <img src={imageUrl} alt="Note" className="w-full h-full object-cover md:rounded-t-lg" />
                    </div>
                )}
                <div className="flex-grow overflow-y-auto">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>
                             <Input
                                placeholder="Title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="border-none focus-visible:ring-0 text-xl font-bold px-0 bg-transparent"
                            />
                        </DialogTitle>
                    </DialogHeader>

                    <div className="px-6">
                        <div
                            ref={contentRef}
                            suppressContentEditableWarning={true}
                            onInput={handleContentInput}
                            className="w-full min-h-[200px] border-none focus-visible:ring-0 resize-none bg-transparent p-0 outline-none max-w-none"
                            style={{ 
                                fontSize: `${fontSize}px`,
                                color: 'hsl(var(--foreground))'
                            }}
                        />
                    </div>
                </div>
                
                <DialogFooter className="justify-between items-center p-3 border-t flex-shrink-0">
                     <div className="flex items-center">
                        <NoteToolbar
                            onSetColor={setColor}
                            onSetImageUrl={setImageUrl}
                            onSetFontSize={setFontSize}
                            initialFontSize={fontSize}
                        />
                        <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 className="text-destructive h-5 w-5" />}
                        </Button>
                     </div>
                    <Button variant="ghost" onClick={handleClose} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
