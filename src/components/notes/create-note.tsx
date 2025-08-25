
"use client";

import { useState, useRef, useEffect } from 'react';
import { useNotes } from '@/contexts/note-context';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Type, Mic, X } from 'lucide-react';
import { NoteToolbar } from './note-toolbar';
import { AudioRecorder } from './audio-recorder';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const DEFAULT_FONT_SIZE = 14;

export function CreateNote() {
    const [isFocused, setIsFocused] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [color, setColor] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { addNote } = useNotes();
    const { toast } = useToast();
    const cardRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const isEmpty = !title.trim() && !contentRef.current?.innerHTML?.trim();

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
                if (title || contentRef.current?.innerHTML) {
                    handleSave();
                }
                setIsFocused(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [title, isFocused, color, imageUrl, fontSize]);

    const sanitizeHtml = (html: string) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('[style]').forEach(el => {
            const element = el as HTMLElement;
            element.style.color = '';
            element.style.backgroundColor = '';
            if (!element.getAttribute('style')?.trim().replace(/;/g, '')) {
                element.removeAttribute('style');
            }
        });
        return doc.body.innerHTML;
    };

    const handleSave = async () => {
        const finalContent = sanitizeHtml(contentRef.current?.innerHTML || '');
        if (!title.trim() && !finalContent.trim() && !audioUrl) {
             setIsFocused(false);
             return;
        };

        setIsSaving(true);
        try {
            await addNote({
                title: title.trim(),
                content: finalContent,
                color,
                imageUrl,
                fontSize,
                audioUrl,
            });
            // Reset state
            setTitle('');
            setContent('');
            if (contentRef.current) contentRef.current.innerHTML = '';
            setColor('');
            setImageUrl('');
            setFontSize(DEFAULT_FONT_SIZE);
            setAudioBlob(null);
            setAudioUrl('');
            // Note: Toast notification is handled by the note context
        } catch (error) {
            toast({ title: "Error", description: "Could not save the note.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
        setContent(e.currentTarget.innerHTML);
    };

    const handleAudioSave = (blob: Blob, url: string) => {
        setAudioBlob(blob);
        setAudioUrl(url);
    };

    const handleAudioDelete = () => {
        setAudioBlob(null);
        setAudioUrl('');
    };

    const handleClose = () => {
        if (title.trim() || contentRef.current?.innerHTML?.trim() || audioBlob) {
            handleSave();
        }
        setIsFocused(false);
    };

    if (!isFocused) {
        return (
            <div className="max-w-xl mx-auto">
                <Input
                    placeholder="Take a note..."
                    onFocus={() => setIsFocused(true)}
                    className="h-12 text-base shadow-md"
                />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
        >
            <Card 
                ref={cardRef} 
                className="max-w-4xl mx-auto shadow-lg border-2" 
                style={{ 
                    borderColor: color || 'hsl(var(--border))',
                    backgroundColor: color ? `${color}15` : undefined
                }}
            >
                {/* Header with image */}
                <div className="relative">
                    {imageUrl && (
                        <div className="relative w-full h-48 overflow-hidden rounded-t-lg">
                            <img src={imageUrl} alt="Note" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        </div>
                    )}
                    
                    {/* Header content */}
                    <div className={cn(
                        "p-4",
                        imageUrl && "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent text-white"
                    )}>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <Input
                                    placeholder="✨ Note title..."
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className={cn(
                                        "border-none focus-visible:ring-0 text-xl font-bold px-0 bg-transparent placeholder:text-muted-foreground/70",
                                        imageUrl && "text-white placeholder:text-white/60"
                                    )}
                                />
                                
                                {/* Note metadata */}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <Badge variant="secondary" className="text-xs">
                                        {contentRef.current?.innerHTML ? contentRef.current.innerHTML.replace(/<[^>]*>/g, '').length : 0} chars
                                    </Badge>
                                    {audioUrl && (
                                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                            <Mic className="w-3 h-3" />
                                            Audio
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            
                            {/* Close button */}
                            <Button 
                                variant="ghost" 
                                onClick={handleClose}
                                disabled={isSaving}
                                className={cn(
                                    "h-8 px-3 rounded-lg flex-shrink-0",
                                    imageUrl && "bg-black/20 text-white hover:bg-black/30 backdrop-blur-sm"
                                )}
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <X className="w-4 h-4" />
                                )}
                                <span className="ml-1 text-xs">Close</span>
                            </Button>
                        </div>
                    </div>
                </div>

                <CardContent className="p-4 space-y-4">
                    <Tabs defaultValue="content" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/50 h-12">
                            <TabsTrigger 
                                value="content" 
                                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                            >
                                <Type className="w-4 h-4 mr-2" />
                                Content
                            </TabsTrigger>
                            <TabsTrigger 
                                value="audio" 
                                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                            >
                                <Mic className="w-4 h-4 mr-2" />
                                Audio
                                {audioUrl && (
                                    <div className="w-2 h-2 bg-green-500 rounded-full ml-2" />
                                )}
                            </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="content" className="mt-4">
                            <motion.div 
                                className="relative min-h-[200px] p-4 rounded-xl border-2 border-dashed border-muted-foreground/20 focus-within:border-primary/30 transition-colors bg-background/50"
                                initial={{ scale: 0.98, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div
                                    ref={contentRef}
                                    suppressContentEditableWarning={true}
                                    contentEditable
                                    onInput={handleContentChange}
                                    className="w-full min-h-[200px] border-none focus:outline-none resize-none bg-transparent leading-relaxed"
                                    style={{ 
                                        fontSize: `${fontSize}px`,
                                        color: 'hsl(var(--foreground))',
                                    }}
                                    data-placeholder="Start writing your note..."
                                />
                                
                                {/* Placeholder */}
                                <AnimatePresence>
                                    {isEmpty && (
                                        <motion.div 
                                            className="absolute top-4 left-4 text-muted-foreground/60 pointer-events-none select-none"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                        >
                                            <div className="flex items-center gap-2 text-sm">
                                                ✨ Start writing your note...
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </TabsContent>
                        
                        <TabsContent value="audio" className="mt-4">
                            <motion.div 
                                className="p-4 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-background/50 min-h-[200px]"
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
                </CardContent>

                {/* Enhanced Footer with Toolbar */}
                <div className="p-4 border-t bg-muted/30 backdrop-blur-sm">
                    <div className="flex flex-col gap-3">
                        {/* Toolbar */}
                        <div className="flex items-center justify-between p-3 bg-background/50 rounded-xl border backdrop-blur-sm">
                            <NoteToolbar 
                                onSetColor={setColor}
                                onSetImageUrl={setImageUrl}
                                onSetFontSize={setFontSize}
                                initialFontSize={fontSize}
                            />
                            <div className="text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded-md ml-2">
                                {fontSize}px
                            </div>
                        </div>
                        
                        {/* Footer info */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                                {contentRef.current?.innerHTML ? 
                                    contentRef.current.innerHTML.replace(/<[^>]*>/g, '').split(' ').filter(w => w.length > 0).length : 0
                                } words
                            </span>
                            <span>New note</span>
                        </div>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}
