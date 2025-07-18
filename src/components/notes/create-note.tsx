
"use client";

import { useState, useRef, useEffect } from 'react';
import { useNotes } from '@/contexts/note-context';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export function CreateNote() {
    const [isFocused, setIsFocused] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { addNote } = useNotes();
    const { toast } = useToast();
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
                if (title || content) {
                    handleSave();
                } else {
                    setIsFocused(false);
                }
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [title, content]);

    const handleSave = async () => {
        if (!title.trim() && !content.trim()) {
             setIsFocused(false);
             return;
        };

        setIsSaving(true);
        try {
            await addNote({
                title: title.trim(),
                content: content.trim(),
                // other fields like imageUrl and color can be added later
            });
            setTitle('');
            setContent('');
            setIsFocused(false);
            toast({ title: "Note saved!" });
        } catch (error) {
            toast({ title: "Error", description: "Could not save the note.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
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
        <Card ref={cardRef} className="max-w-xl mx-auto shadow-lg">
            <CardContent className="p-4">
                <Input
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border-none focus-visible:ring-0 text-lg font-semibold px-2"
                />
                <textarea
                    placeholder="Take a note..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full min-h-[100px] border-none focus-visible:ring-0 resize-none bg-transparent p-2 text-base outline-none"
                    autoFocus
                />
                <div className="flex justify-end items-center gap-2">
                     <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Close
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
