
"use client";

import { useState, useRef, useEffect } from 'react';
import { useNotes } from '@/contexts/note-context';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { NoteToolbar } from './note-toolbar';

const DEFAULT_FONT_SIZE = 14;

export function CreateNote() {
    const [isFocused, setIsFocused] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [color, setColor] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
    const [isSaving, setIsSaving] = useState(false);
    const { addNote } = useNotes();
    const { toast } = useToast();
    const cardRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

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
    }, [title, isFocused]);

    const handleSave = async () => {
        const finalContent = contentRef.current?.innerHTML || '';
        if (!title.trim() && !finalContent.trim()) {
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
            });
            // Reset state
            setTitle('');
            setContent('');
            if (contentRef.current) contentRef.current.innerHTML = '';
            setColor('');
            setImageUrl('');
            setFontSize(DEFAULT_FONT_SIZE);
        } catch (error) {
            toast({ title: "Error", description: "Could not save the note.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
        setContent(e.currentTarget.innerHTML);
    }

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
        <Card 
            ref={cardRef} 
            className="max-w-xl mx-auto shadow-lg border-2" 
            style={{ borderColor: color || 'hsl(var(--border))' }}
        >
            {imageUrl && (
                <div className="relative w-full h-48">
                    <img src={imageUrl} alt="Note" className="w-full h-full object-cover rounded-t-lg" />
                </div>
            )}
            <CardContent className="p-0">
                <div className="p-4">
                    <Input
                        placeholder="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="border-none focus-visible:ring-0 text-lg font-semibold px-2 bg-transparent"
                    />
                    <div
                        ref={contentRef}
                        contentEditable
                        onInput={handleContentChange}
                        className="w-full min-h-[100px] border-none focus-visible:ring-0 resize-none bg-transparent p-2 outline-none"
                        style={{ fontSize: `${fontSize}px` }}
                        data-placeholder="Take a note..."
                    />
                </div>
                <div className="flex justify-between items-center p-2">
                     <NoteToolbar 
                        onSetColor={setColor}
                        onSetImageUrl={setImageUrl}
                        onSetFontSize={setFontSize}
                        initialFontSize={fontSize}
                     />
                     <Button variant="ghost" onClick={() => { handleSave(); setIsFocused(false); }} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Close
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
