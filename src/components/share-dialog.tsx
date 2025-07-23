"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, Mail, Users, Link, Check, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ShareDialogProps {
    isOpen: boolean;
    onClose: () => void;
    itemType: 'task' | 'note';
    itemTitle: string;
    itemId: string;
}

type SharePermission = 'view' | 'edit' | 'admin';

export function ShareDialog({ isOpen, onClose, itemType, itemTitle, itemId }: ShareDialogProps) {
    const [email, setEmail] = useState('');
    const [permission, setPermission] = useState<SharePermission>('view');
    const [message, setMessage] = useState('');
    const [shareLink, setShareLink] = useState('');
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [sharedUsers, setSharedUsers] = useState<Array<{email: string, permission: SharePermission}>>([]);
    
    const { toast } = useToast();

    const generateShareLink = async () => {
        setIsGeneratingLink(true);
        try {
            // Simulate API call to generate share link
            await new Promise(resolve => setTimeout(resolve, 1000));
            const link = `https://mindmate.app/share/${itemType}/${itemId}?token=${Math.random().toString(36).substr(2, 9)}`;
            setShareLink(link);
            toast({ title: "Share link generated successfully!" });
        } catch (error) {
            toast({ 
                title: "Error", 
                description: "Failed to generate share link",
                variant: "destructive" 
            });
        } finally {
            setIsGeneratingLink(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
            toast({ title: "Copied to clipboard!" });
        } catch (error) {
            toast({ 
                title: "Failed to copy", 
                description: "Please copy the link manually",
                variant: "destructive" 
            });
        }
    };

    const shareWithUser = async () => {
        if (!email.trim()) {
            toast({ 
                title: "Email required", 
                description: "Please enter an email address",
                variant: "destructive" 
            });
            return;
        }

        try {
            // Simulate API call to share with user
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            setSharedUsers(prev => [...prev, { email, permission }]);
            setEmail('');
            setMessage('');
            
            toast({ 
                title: "Shared successfully!", 
                description: `${itemTitle} has been shared with ${email}` 
            });
        } catch (error) {
            toast({ 
                title: "Error", 
                description: "Failed to share item",
                variant: "destructive" 
            });
        }
    };

    const removeUserAccess = (userEmail: string) => {
        setSharedUsers(prev => prev.filter(user => user.email !== userEmail));
        toast({ title: "Access removed", description: `Removed access for ${userEmail}` });
    };

    const getPermissionColor = (perm: SharePermission) => {
        switch (perm) {
            case 'view': return 'bg-blue-100 text-blue-800';
            case 'edit': return 'bg-green-100 text-green-800';
            case 'admin': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="w-5 h-5" />
                        Share {itemType}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        "{itemTitle}"
                    </p>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Share with specific users */}
                    <div className="space-y-3">
                        <h3 className="font-medium text-sm">Share with people</h3>
                        
                        <div className="flex gap-2">
                            <Input
                                type="email"
                                placeholder="Enter email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="flex-1"
                            />
                            <Select value={permission} onValueChange={(value) => setPermission(value as SharePermission)}>
                                <SelectTrigger className="w-24">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="view">View</SelectItem>
                                    <SelectItem value="edit">Edit</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Textarea
                            placeholder="Add a message (optional)"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="h-20 resize-none"
                        />

                        <Button onClick={shareWithUser} className="w-full">
                            <Mail className="w-4 h-4 mr-2" />
                            Send Invitation
                        </Button>
                    </div>

                    {/* Current shared users */}
                    {sharedUsers.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-medium text-sm flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Shared with ({sharedUsers.length})
                            </h3>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                {sharedUsers.map((user, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-sm truncate">{user.email}</span>
                                            <Badge variant="secondary" className={getPermissionColor(user.permission)}>
                                                {user.permission}
                                            </Badge>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeUserAccess(user.email)}
                                            className="h-6 w-6 p-0 hover:bg-destructive/10"
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Generate shareable link */}
                    <div className="space-y-3">
                        <h3 className="font-medium text-sm">Share with link</h3>
                        
                        {shareLink ? (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Input 
                                        value={shareLink} 
                                        readOnly 
                                        className="flex-1 bg-muted/30"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copyToClipboard(shareLink)}
                                        className="w-20"
                                    >
                                        {isCopied ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4 mr-1" />
                                                Copy
                                            </>
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Anyone with this link can view this {itemType}
                                </p>
                            </div>
                        ) : (
                            <Button 
                                variant="outline" 
                                onClick={generateShareLink}
                                disabled={isGeneratingLink}
                                className="w-full"
                            >
                                <Link className="w-4 h-4 mr-2" />
                                {isGeneratingLink ? 'Generating...' : 'Generate Share Link'}
                            </Button>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
