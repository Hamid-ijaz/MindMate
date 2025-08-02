"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Share2, 
  Edit, 
  Trash2, 
  Copy, 
  ExternalLink,
  FileText,
  CheckSquare,
  Loader2
} from 'lucide-react';
import { useTasks } from '@/contexts/task-context';
import { useNotes } from '@/contexts/note-context';
import type { Task, Note } from '@/lib/types';

interface ItemActionsDropdownProps {
  item: Task | Note;
  itemType: 'task' | 'note';
  onShare: (itemType: 'task' | 'note', itemTitle: string, itemId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onConvertToTask?: () => void; // For notes
  onDuplicate?: () => void;
  isDeleting?: boolean;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'ghost' | 'outline' | 'default';
  showExternalLink?: boolean;
  disabled?: boolean;
}

export function ItemActionsDropdown({
  item,
  itemType,
  onShare,
  onEdit,
  onDelete,
  onConvertToTask,
  onDuplicate,
  isDeleting = false,
  className = '',
  size = 'sm',
  variant = 'ghost',
  showExternalLink = true,
  disabled = false
}: ItemActionsDropdownProps) {
  const { deleteTask, startEditingTask } = useTasks();
  const { deleteNote } = useNotes();
  const [isOpen, setIsOpen] = useState(false);

  const handleShare = () => {
    onShare(itemType, item.title, item.id);
    setIsOpen(false);
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    } else if (itemType === 'task') {
      startEditingTask(item.id);
    }
    setIsOpen(false);
  };

  const handleDelete = async () => {
    if (onDelete) {
      onDelete();
    } else if (itemType === 'task') {
      await deleteTask(item.id);
    } else if (itemType === 'note') {
      await deleteNote(item.id);
    }
    setIsOpen(false);
  };

  const handleConvertToTask = () => {
    if (onConvertToTask) {
      onConvertToTask();
    }
    setIsOpen(false);
  };

  const handleDuplicate = () => {
    if (onDuplicate) {
      onDuplicate();
    }
    // TODO: Implement default duplication logic
    setIsOpen(false);
  };

  const handleExternalLink = () => {
    if (itemType === 'task') {
      window.open(`/task/${item.id}`, '_blank');
    }
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size === 'sm' ? 'icon' : size === 'lg' ? 'default' : 'sm'}
          className={`${className} ${size === 'sm' ? 'h-8 w-8' : ''}`}
          disabled={disabled || isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
          <span className="sr-only">Open actions menu</span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-48">
        {/* Share option */}
        <DropdownMenuItem onClick={handleShare} className="cursor-pointer">
          <Share2 className="mr-2 h-4 w-4" />
          Share {itemType}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Edit option */}
        <DropdownMenuItem onClick={handleEdit} className="cursor-pointer">
          <Edit className="mr-2 h-4 w-4" />
          Edit {itemType}
        </DropdownMenuItem>
        
        {/* Duplicate option */}
        <DropdownMenuItem onClick={handleDuplicate} className="cursor-pointer">
          <Copy className="mr-2 h-4 w-4" />
          Duplicate {itemType}
        </DropdownMenuItem>
        
        {/* Convert note to task (only for notes) */}
        {itemType === 'note' && (
          <DropdownMenuItem onClick={handleConvertToTask} className="cursor-pointer">
            <CheckSquare className="mr-2 h-4 w-4" />
            Convert to Task
          </DropdownMenuItem>
        )}
        
        {/* External link (only for tasks) */}
        {itemType === 'task' && showExternalLink && (
          <DropdownMenuItem onClick={handleExternalLink} className="cursor-pointer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open in new tab
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        
        {/* Delete option */}
        <DropdownMenuItem 
          onClick={handleDelete} 
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete {itemType}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
