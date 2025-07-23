
"use client";

import { Bold, Italic, List, Image as ImageIcon, Palette, Check, TextQuote, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "../ui/input";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "../ui/slider";

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
    onSetFontSize: (size: number) => void;
    initialFontSize: number;
}

export function NoteToolbar({ onSetColor, onSetImageUrl, onSetFontSize, initialFontSize }: NoteToolbarProps) {
    const [imageUrl, setImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFormat = (command: string) => {
        // This is a legacy API, but simple for this use case.
        // It's important to prevent the default mousedown event on the button
        // to avoid the contentEditable div from losing focus.
        document.execCommand(command, false, undefined);
    };

    const handleFileUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast({ 
                title: "Invalid file type", 
                description: "Please select an image file",
                variant: "destructive" 
            });
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast({ 
                title: "File too large", 
                description: "Please select an image smaller than 5MB",
                variant: "destructive" 
            });
            return;
        }

        setIsUploading(true);
        
        try {
            // Convert file to base64 data URL for local storage
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                onSetImageUrl(dataUrl);
                toast({ title: "Image uploaded successfully!" });
                setIsUploading(false);
            };
            reader.onerror = () => {
                toast({ 
                    title: "Upload failed", 
                    description: "Failed to read the image file",
                    variant: "destructive" 
                });
                setIsUploading(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            toast({ 
                title: "Upload failed", 
                description: "An error occurred while uploading the image",
                variant: "destructive" 
            });
            setIsUploading(false);
        }
    };

    const handleAddImage = () => {
        if (!imageUrl) return;
        onSetImageUrl(imageUrl);
        toast({ title: "Image added!" });
        setImageUrl('');
    };

    const handleClearImage = () => {
        onSetImageUrl('');
        setImageUrl('');
        toast({ title: "Image removed" });
    };

    return (
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('bold')}><Bold className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('italic')}><Italic className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('insertUnorderedList')}><List className="h-4 w-4" /></Button>
            
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon"><ImageIcon className="h-4 w-4" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                    <div className="space-y-4">
                        <div className="text-sm font-medium">Add Image</div>
                        
                        {/* File Upload Option */}
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Upload from device</label>
                            <div className="flex items-center gap-2">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(file);
                                    }}
                                    className="hidden"
                                />
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="flex-1"
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    {isUploading ? 'Uploading...' : 'Choose File'}
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleClearImage}
                                    title="Remove current image"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                        
                        {/* URL Input Option */}
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Or paste image URL</label>
                            <div className="flex items-center gap-2">
                                <Input 
                                    type="url"
                                    placeholder="https://example.com/image.jpg" 
                                    className="h-9 flex-1"
                                    value={imageUrl}
                                    onChange={(e) => setImageUrl(e.target.value)}
                                />
                                <Button 
                                    size="sm" 
                                    onClick={handleAddImage}
                                    disabled={!imageUrl.trim()}
                                >
                                    Add
                                </Button>
                            </div>
                        </div>
                        
                        {/* Drag and Drop Zone */}
                        <div 
                            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center transition-colors hover:border-muted-foreground/50"
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.add('border-primary');
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('border-primary');
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('border-primary');
                                const files = Array.from(e.dataTransfer.files);
                                const imageFile = files.find(file => file.type.startsWith('image/'));
                                if (imageFile) {
                                    handleFileUpload(imageFile);
                                }
                            }}
                        >
                            <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Drag & drop an image here
                            </p>
                        </div>
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
            
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon"><TextQuote className="h-4 w-4" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-3">
                   <div className="space-y-2">
                     <p className="text-sm font-medium">Font Size</p>
                     <Slider
                        defaultValue={[initialFontSize]}
                        min={12}
                        max={24}
                        step={1}
                        onValueChange={(value) => onSetFontSize(value[0])}
                    />
                   </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
