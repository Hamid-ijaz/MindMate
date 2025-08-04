
"use client";

import { useState, useEffect, useRef } from 'react';
import type { Note } from '@/lib/types';
import { useNotes } from '@/contexts/note-context';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Mic, Save, X, Palette, ImageIcon, Type, MoreHorizontal, Share2, Copy, Download } from 'lucide-react';
import { NoteToolbar } from './note-toolbar';
import { AudioRecorder } from './audio-recorder';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_FONT_SIZE = 14;

interface EditNoteDialogProps {
    note: Note | null;
    isOpen: boolean;
    onClose: () => void;
    shareToken?: string; // For tracking edits on shared notes
    sharedBy?: { email: string; name: string }; // User info for shared context
}

export function EditNoteDialog({ note, isOpen, onClose, shareToken, sharedBy }: EditNoteDialogProps) {
    const [title, setTitle] = useState('');
    const [color, setColor] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
    const [audioUrl, setAudioUrl] = useState('');
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const { updateNote, deleteNote } = useNotes();
    const { toast } = useToast();
    
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (note) {
            setTitle(note.title || '');
            setColor(note.color || '');
            setImageUrl(note.imageUrl || '');
            setFontSize(note.fontSize || DEFAULT_FONT_SIZE);
            setAudioUrl(note.audioUrl || '');
            setIsEmpty(!note.content || note.content.trim() === '');
        }
    }, [note]);

    // Check if content is empty on input
    const handleInput = () => {
        if (contentRef.current) {
            const content = contentRef.current.innerHTML.replace(/<[^>]*>/g, '').trim();
            setIsEmpty(content === '');
        }
    };

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

        const currentContent = sanitizeHtml(contentRef.current.innerHTML);
        const hasChanged = title !== (note.title || '') ||
                           currentContent !== (note.content || '') || 
                           color !== (note.color || '') ||
                           imageUrl !== (note.imageUrl || '') ||
                           fontSize !== (note.fontSize || DEFAULT_FONT_SIZE) ||
                           audioUrl !== (note.audioUrl || '');
                           
        if (hasChanged && (title.trim() || currentContent.trim())) {
            handleSave(currentContent);
        }
        
        onClose();
    }

    const handleSave = async (currentContent: string) => {
        if (!note) return;
        setIsSaving(true);
        try {
            await updateNote(note.id, { 
                title, 
                content: currentContent, 
                color, 
                imageUrl, 
                fontSize,
                audioUrl: audioUrl || null
            });

            // If this is a shared note, record the edit in the sharing history
            if (shareToken && sharedBy) {
                const { sharingService } = await import('@/lib/firestore');
                await sharingService.addHistoryEntry(shareToken, {
                    userId: sharedBy.email,
                    userName: sharedBy.name,
                    action: 'content_edited',
                    details: `Modified the shared note: ${title || 'Untitled'}`
                });
            }

            toast({ title: "Note updated" });
        } catch (e) {
            toast({ title: "Error", description: "Failed to save note.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleAudioSave = (blob: Blob, url: string) => {
        setAudioBlob(blob);
        setAudioUrl(url);
    };

    const handleAudioDelete = () => {
        setAudioBlob(null);
        setAudioUrl('');
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
            <DialogContent 
                className="p-0 gap-0 max-w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-2xl overflow-hidden flex flex-col"
                style={{ 
                    borderColor: color || 'hsl(var(--border))',
                    backgroundColor: color ? `${color}15` : undefined
                }}
                showCloseButton={false}
            >
                {/* Enhanced Header with Image - Mobile Optimized */}
                <motion.div 
                    className="relative"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {imageUrl && (
                        <div className="relative w-full h-32 sm:h-40 md:h-56 lg:h-64 flex-shrink-0 overflow-hidden">
                            <img 
                                src={imageUrl} 
                                alt="Note" 
                                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        </div>
                    )}
                    
                    {/* Modern Header - Mobile First Design */}
                    <div className={cn(
                        "p-3 sm:p-4 md:p-6",
                        imageUrl && "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent text-white"
                    )}>
                        <div className="flex items-start justify-between gap-2 sm:gap-4">
                            <div className="flex-1 min-w-0">
                                <Input
                                    placeholder="✨ Note title..."
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className={cn(
                                        "border-none focus-visible:ring-0 text-lg sm:text-xl md:text-2xl font-bold px-0 bg-transparent placeholder:text-muted-foreground/70",
                                        imageUrl && "text-white placeholder:text-white/60"
                                    )}
                                />
                                
                                {/* Note metadata - Mobile Responsive */}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <Badge variant="secondary" className="text-xs">
                                        {note?.content ? `${note.content.replace(/<[^>]*>/g, '').length} chars` : '0 chars'}
                                    </Badge>
                                    {audioUrl && (
                                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                            <Mic className="w-3 h-3" />
                                            <span className="hidden xs:inline">Audio</span>
                                        </Badge>
                                    )}
                                    {shareToken && (
                                        <Badge variant="outline" className="text-xs">
                                            <span className="hidden xs:inline">Shared</span>
                                            <Share2 className="w-3 h-3 xs:hidden" />
                                        </Badge>
                                    )}
                                    <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                                        {new Date(note?.updatedAt || note?.createdAt || Date.now()).toLocaleDateString()}
                                    </Badge>
                                </div>
                            </div>
                            
                            {/* Header Actions - Mobile Optimized */}
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={handleClose} 
                                    disabled={isSaving}
                                    className={cn(
                                        "h-8 px-2 sm:h-9 sm:px-3 rounded-xl text-xs sm:text-sm",
                                        imageUrl && "bg-black/20 text-white hover:bg-black/30 backdrop-blur-sm"
                                    )}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                                            <span className="ml-1 sm:ml-2 hidden xs:inline">Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-3 w-3 sm:h-4 sm:w-4" />
                                            <span className="ml-1 sm:ml-2 hidden xs:inline">Save</span>
                                        </>
                                    )}
                                </Button>
                                
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className={cn(
                                                "h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-xl",
                                                imageUrl && "bg-black/20 text-white hover:bg-black/30 backdrop-blur-sm"
                                            )}
                                        >
                                            <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem>
                                            <Share2 className="w-4 h-4 mr-2" />
                                            Share Note
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                            <Copy className="w-4 h-4 mr-2" />
                                            Copy Content
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                            <Download className="w-4 h-4 mr-2" />
                                            Export
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                            onClick={handleDelete} 
                                            disabled={isDeleting}
                                            className="text-destructive focus:text-destructive"
                                        >
                                            {isDeleting ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4 mr-2" />
                                            )}
                                            Delete Note
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Enhanced Content Area - Mobile First Design */}
                <motion.div 
                    className="flex-1 min-h-0 flex flex-col overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                >
                    <div className="px-3 sm:px-4 md:px-6 flex-1 min-h-0 flex flex-col overflow-y-auto">
                        <Tabs defaultValue="content" className="w-full flex-1 flex flex-col min-h-0">
                            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/50 h-10 sm:h-12 flex-shrink-0 mb-3 sm:mb-4">
                                <TabsTrigger 
                                    value="content" 
                                    className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all text-xs sm:text-sm"
                                >
                                    <Type className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                    Content
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="audio" 
                                    className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all text-xs sm:text-sm"
                                >
                                    <Mic className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                    Audio
                                    {audioUrl && (
                                        <div className="w-2 h-2 bg-green-500 rounded-full ml-1 sm:ml-2" />
                                    )}
                                </TabsTrigger>
                            </TabsList>
                            
                            <TabsContent 
                                value="content" 
                                className="mt-0 flex-1 min-h-0 flex flex-col overflow-y-auto"
                                style={{ maxHeight: 'calc(100vh - 320px)' }}
                            >
                                <div className="space-y-3 sm:space-y-4 flex-1 flex flex-col">
                                    {/* Rich Text Editor - Ultra Mobile Responsive */}
                                    <motion.div 
                                        className="relative flex-1 min-h-[180px] sm:min-h-[200px] md:min-h-[250px] p-3 sm:p-4 rounded-xl border-2 border-dashed border-muted-foreground/20 focus-within:border-primary/30 transition-colors bg-background/50 backdrop-blur-sm"
                                        initial={{ scale: 0.98, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ duration: 0.3, delay: 0.3 }}
                                    >
                                        <div
                                            ref={contentRef}
                                            suppressContentEditableWarning={true}
                                            contentEditable
                                            dangerouslySetInnerHTML={{ __html: note?.content || '' }}
                                            className="w-full h-full min-h-[180px] sm:min-h-[200px] md:min-h-[250px] border-none focus:outline-none resize-none bg-transparent leading-relaxed overflow-y-auto touch-manipulation"
                                            style={{ 
                                                fontSize: `${fontSize}px`,
                                                color: 'hsl(var(--foreground))',
                                                WebkitTouchCallout: 'none',
                                                WebkitUserSelect: 'text',
                                                maxHeight: 'calc(100vh - 450px)'
                                            }}
                                            onInput={handleInput}
                                        />
                                        
                                        {/* Dynamic Placeholder - Mobile Optimized */}
                                        <AnimatePresence>
                                            {isEmpty && (
                                                <motion.div 
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="absolute inset-3 sm:inset-4 pointer-events-none"
                                                >
                                                    <div className="text-muted-foreground/50 text-base sm:text-lg">
                                                        📝 Start writing your note...
                                                    </div>
                                                    <div className="text-muted-foreground/30 text-xs sm:text-sm mt-2">
                                                        <span className="hidden sm:inline">Use the toolbar above to format your text, add images, or change colors</span>
                                                        <span className="sm:hidden">Tap to start writing</span>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                </div>
                            </TabsContent>
                            
                            <TabsContent value="audio" className="mt-0 flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                                <motion.div 
                                    className="p-3 sm:p-4 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-background/50 backdrop-blur-sm h-full min-h-[180px] sm:min-h-[200px]"
                                    initial={{ scale: 0.98, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="h-full flex flex-col">
                                        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Audio Recording</h3>
                                        <div className="flex-1">
                                            <AudioRecorder
                                                onAudioSave={handleAudioSave}
                                                onAudioDelete={handleAudioDelete}
                                                existingAudioUrl={audioUrl}
                                                maxDuration={300}
                                                maxFileSize={10}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </motion.div>

                {/* Enhanced Footer with Toolbar - Mobile First Always Visible */}
                <motion.div 
                    className="p-3 sm:p-4 border-t bg-muted/30 backdrop-blur-sm flex-shrink-0 safe-area-bottom"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 }}
                >
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                            {/* Enhanced Toolbar - Mobile Optimized */}
                            <motion.div 
                                className="flex items-center justify-between flex-1 p-2 sm:p-3 bg-background/50 rounded-xl border backdrop-blur-sm"
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.2, delay: 0.2 }}
                            >
                                <NoteToolbar
                                    onSetColor={setColor}
                                    onSetImageUrl={setImageUrl}
                                    onSetFontSize={setFontSize}
                                    initialFontSize={fontSize}
                                />
                                <div className="text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded-md ml-2">
                                    {fontSize}px
                                </div>
                            </motion.div>
                            
                            {/* Word count and info - Responsive */}
                            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground min-w-0 ml-2">
                                <Separator orientation="vertical" className="h-4" />
                                <span className="truncate">
                                    {note?.content ? note.content.replace(/<[^>]*>/g, '').split(' ').filter(w => w.length > 0).length : 0} words
                                </span>
                                {shareToken && sharedBy && (
                                    <>
                                        <span className="hidden lg:inline">•</span>
                                        <span className="truncate hidden lg:inline">Shared by {sharedBy.name}</span>
                                    </>
                                )}
                            </div>
                            
                            {/* Mobile-only status indicators */}
                            <div className="flex sm:hidden items-center gap-1 ml-auto mr-2">
                                {shareToken && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                )}
                                {audioUrl && (
                                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                                )}
                            </div>
                        </div>
                        
                        {/* Close button - Always visible and prominent */}
                        <Button 
                            variant="ghost" 
                            onClick={handleClose}
                            className="h-8 px-2 sm:px-3 rounded-lg flex-shrink-0 bg-background/50 hover:bg-background/80 border"
                        >
                            <X className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="ml-1 text-xs hidden xs:inline">Close</span>
                        </Button>
                    </div>
                </motion.div>
            </DialogContent>
        </Dialog>
    );
}
