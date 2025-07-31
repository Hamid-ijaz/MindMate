
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
            {/* Text Formatting */}
            <div className="flex items-center gap-1 mr-2">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10" 
                    onMouseDown={(e) => e.preventDefault()} 
                    onClick={() => handleFormat('bold')}
                    title="Bold (Ctrl+B)"
                >
                    <Bold className="h-4 w-4" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10" 
                    onMouseDown={(e) => e.preventDefault()} 
                    onClick={() => handleFormat('italic')}
                    title="Italic (Ctrl+I)"
                >
                    <Italic className="h-4 w-4" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10" 
                    onMouseDown={(e) => e.preventDefault()} 
                    onClick={() => handleFormat('insertUnorderedList')}
                    title="Bullet List"
                >
                    <List className="h-4 w-4" />
                </Button>
            </div>
            
            {/* Visual Enhancements */}
            <div className="flex items-center gap-1">
                {/* Enhanced Image Popover */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-lg hover:bg-blue/10"
                            title="Add Image"
                        >
                            <ImageIcon className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                        <div className="p-4 space-y-4">
                            <div className="flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-primary" />
                                <span className="font-semibold">Add Image</span>
                            </div>
                            
                            {/* File Upload Option */}
                            <div className="space-y-3">
                                <div className="text-sm text-muted-foreground">Upload from device</div>
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
                                        className="flex-1 h-9 rounded-lg"
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        {isUploading ? 'Uploading...' : 'Choose File'}
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={handleClearImage}
                                        title="Remove current image"
                                        className="h-9 w-9 p-0 rounded-lg"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            
                            {/* URL Input Option */}
                            <div className="space-y-3">
                                <div className="text-sm text-muted-foreground">Or paste image URL</div>
                                <div className="flex items-center gap-2">
                                    <Input 
                                        type="url"
                                        placeholder="https://example.com/image.jpg" 
                                        className="h-9 flex-1 rounded-lg"
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                    />
                                    <Button 
                                        size="sm" 
                                        onClick={handleAddImage}
                                        disabled={!imageUrl.trim()}
                                        className="h-9 px-4 rounded-lg"
                                    >
                                        Add
                                    </Button>
                                </div>
                            </div>
                            
                            {/* Enhanced Drag and Drop Zone */}
                            <div 
                                className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.add('border-primary', 'bg-primary/10');
                                }}
                                onDragLeave={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.remove('border-primary', 'bg-primary/10');
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.remove('border-primary', 'bg-primary/10');
                                    const files = Array.from(e.dataTransfer.files);
                                    const imageFile = files.find(file => file.type.startsWith('image/'));
                                    if (imageFile) {
                                        handleFileUpload(imageFile);
                                    }
                                }}
                            >
                                <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground font-medium">
                                    Drag & drop an image here
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-1">
                                    Supports JPG, PNG, GIF up to 5MB
                                </p>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Enhanced Color Palette */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-lg hover:bg-purple/10"
                            title="Change Color"
                        >
                            <Palette className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Palette className="w-4 h-4 text-primary" />
                                <span className="font-semibold text-sm">Note Color</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {NOTE_COLORS.map(color => (
                                    <Button
                                        key={color.name}
                                        variant="outline"
                                        size="sm"
                                        className="h-10 w-10 rounded-xl border-2 transition-all hover:scale-105"
                                        style={{ 
                                            backgroundColor: color.value || 'hsl(var(--card))',
                                            borderColor: color.value ? 'transparent' : 'hsl(var(--border))'
                                        }}
                                        onClick={() => onSetColor(color.value)}
                                        title={color.name}
                                    >
                                        {!color.value && <Check className="h-4 w-4" />}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
                
                {/* Enhanced Font Size Control */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-lg hover:bg-green/10"
                            title="Font Size"
                        >
                            <TextQuote className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3" align="start">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <TextQuote className="w-4 h-4 text-primary" />
                                <span className="font-semibold text-sm">Font Size</span>
                                <span className="ml-auto text-xs text-muted-foreground">{initialFontSize}px</span>
                            </div>
                            <div className="space-y-2">
                                <Slider
                                    defaultValue={[initialFontSize]}
                                    min={12}
                                    max={24}
                                    step={1}
                                    onValueChange={(value) => onSetFontSize(value[0])}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>12px</span>
                                    <span>18px</span>
                                    <span>24px</span>
                                </div>
                            </div>
                            
                            {/* Quick size presets */}
                            <div className="flex gap-1">
                                {[12, 14, 16, 18, 20, 24].map(size => (
                                    <Button
                                        key={size}
                                        variant={initialFontSize === size ? "default" : "ghost"}
                                        size="sm"
                                        className="h-8 w-10 p-0 text-xs rounded-md"
                                        onClick={() => onSetFontSize(size)}
                                    >
                                        {size}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
