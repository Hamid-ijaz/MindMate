
"use client";

import { Bold, Italic, List, Image as ImageIcon, Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "../ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const NOTE_COLORS = [
    { name: 'Default', value: '' },
    { name: 'Red', value: '#fecaca' },
    { name: 'Orange', value: '#fed7aa' },
    { name: 'Yellow', value: '#fef08a' },
    { name: 'Green', value: '#bbf7d0' },
    { name: 'Blue', value: '#bfdbfe' },
    { name: 'Purple', value: '#e9d5ff' },
    { name: 'Pink', value: '#fbcfe8' },
];


interface NoteToolbarProps {
    onSetColor: (color: string) => void;
    onSetImageUrl: (url: string) => void;
}

export function NoteToolbar({ onSetColor, onSetImageUrl }: NoteToolbarProps) {
    const [imageUrl, setImageUrl] = useState('');
    const { toast } = useToast();

    const handleFormat = (command: string) => {
        document.execCommand(command, false, undefined);
    };

    const handleAddImage = () => {
        if (!imageUrl) return;
        onSetImageUrl(imageUrl);
        toast({ title: "Image added!" });
        // Close popover logic would be handled by Popover's onOpenChange if needed
    }

    return (
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('bold')}><Bold className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('italic')}><Italic className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('insertUnorderedList')}><List className="h-4 w-4" /></Button>

            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon"><ImageIcon className="h-4 w-4" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                    <div className="flex items-center gap-2">
                        <Input 
                            type="url"
                            placeholder="Enter image URL" 
                            className="h-9"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                         />
                        <Button size="sm" onClick={handleAddImage}>Add</Button>
                    </div>
                </PopoverContent>
            </Popover>

            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon"><Palette className="h-4 w-4" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                    <div className="grid grid-cols-4 gap-2">
                        {NOTE_COLORS.map(color => (
                            <Button
                                key={color.name}
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                style={{ backgroundColor: color.value || 'hsl(var(--card))' }}
                                onClick={() => onSetColor(color.value)}
                            >
                                {!color.value && <Check className="h-4 w-4" />}
                            </Button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
