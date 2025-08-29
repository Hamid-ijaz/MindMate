"use client";

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  CheckCircle, 
  Archive, 
  TrendingUp,
  Calendar,
  Clock,
  User,
  Tag,
  Settings,
  ChevronDown,
  Calendar as CalendarIcon,
  X,
  Upload,
  FileText,
  Loader2,
  MoreHorizontal,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  ChevronUp,
  Eye,
  EyeOff,
  RefreshCcw,
  Edit,
  Copy,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  Table as TableIcon,
  Grid3X3
} from 'lucide-react';
import { useTasks } from '@/contexts/task-context';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { Task, Priority, TaskCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Column {
  key: keyof Task | 'select' | 'actions';
  label: string;
  visible: boolean;
  sortable: boolean;
  width?: string;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
}

interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive' | 'secondary';
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
}

interface FilterState {
  search: string;
  category: string;
  priority: string;
  status: 'all' | 'pending' | 'completed' | 'overdue' | 'archived';
  createdDateRange: {
    from?: Date;
    to?: Date;
  };
  completedDateRange: {
    from?: Date;
    to?: Date;
  };
}

interface SortState {
  column: keyof Task | null;
  direction: 'asc' | 'desc' | null;
}

export function BulkTaskManagement() {
  const { tasks, updateTask, deleteTask, acceptTask, taskCategories, addTask, uncompleteTask } = useTasks();
  const { user } = useAuth();
  const { toast } = useToast();

  // State management
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  } | null>(null);

  // View and pagination
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Column resizing
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);

  // Table configuration
  const [columns, setColumns] = useState<Column[]>([
    { key: 'select', label: '', visible: true, sortable: false, width: '48px', minWidth: 48, maxWidth: 60, resizable: false },
    { key: 'title', label: 'Title', visible: true, sortable: true, width: '300px', minWidth: 200, maxWidth: 1000, resizable: true },
    { key: 'category', label: 'Category', visible: true, sortable: true, width: '120px', minWidth: 100, maxWidth: 200, resizable: true },
    { key: 'priority', label: 'Priority', visible: true, sortable: true, width: '100px', minWidth: 80, maxWidth: 150, resizable: true },
    { key: 'duration', label: 'Duration', visible: true, sortable: true, width: '100px', minWidth: 80, maxWidth: 150, resizable: true },
    { key: 'createdAt', label: 'Created', visible: true, sortable: true, width: '120px', minWidth: 100, maxWidth: 180, resizable: true },
    { key: 'reminderAt', label: 'Due Date', visible: true, sortable: true, width: '120px', minWidth: 100, maxWidth: 180, resizable: true },
    { key: 'completedAt', label: 'Status/Completed', visible: true, sortable: true, width: '140px', minWidth: 120, maxWidth: 200, resizable: true },
    { key: 'actions', label: 'Actions', visible: true, sortable: false, width: '80px', minWidth: 80, maxWidth: 120, resizable: false },
  ]);

  // Filtering and sorting
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: 'all',
    priority: 'all',
    status: 'all',
    createdDateRange: {},
    completedDateRange: {}
  });

  const [sort, setSort] = useState<SortState>({
    column: null,
    direction: null
  });

  // Filter presets
  const [filterPresets] = useState<FilterPreset[]>([
    {
      id: 'overdue',
      name: 'Overdue Tasks',
      filters: { search: '', category: 'all', priority: 'all', status: 'overdue', createdDateRange: {}, completedDateRange: {} }
    },
    {
      id: 'high-priority',
      name: 'High Priority',
      filters: { search: '', category: 'all', priority: 'High', status: 'pending', createdDateRange: {}, completedDateRange: {} }
    },
    {
      id: 'critical-priority',
      name: 'Critical Priority',
      filters: { search: '', category: 'all', priority: 'Critical', status: 'pending', createdDateRange: {}, completedDateRange: {} }
    },
    {
      id: 'completed-today',
      name: 'Completed Today',
      filters: { 
        search: '', 
        category: 'all', 
        priority: 'all', 
        status: 'completed', 
        createdDateRange: {}, 
        completedDateRange: {} // Will be set dynamically when applied
      }
    },
    {
      id: 'work-tasks',
      name: 'Work Tasks',
      filters: { search: '', category: 'Work', priority: 'all', status: 'pending', createdDateRange: {}, completedDateRange: {} }
    }
  ]);

  // Bulk actions configuration
  const bulkActions: BulkAction[] = useMemo(() => {
    const selectedTasksArray = Array.from(selectedTasks).map(id => tasks.find(t => t.id === id)).filter(Boolean);
    const hasCompletedTasks = selectedTasksArray.some(task => task!.completedAt);
    const hasPendingTasks = selectedTasksArray.some(task => !task!.completedAt);
    
    const actions: BulkAction[] = [];
    
    // Show appropriate completion actions
    if (hasPendingTasks) {
      actions.push({
        id: 'complete',
        label: 'Mark Complete',
        icon: CheckCircle,
        variant: 'default'
      });
    }
    
    if (hasCompletedTasks) {
      actions.push({
        id: 'uncomplete',
        label: 'Mark Incomplete',
        icon: RefreshCcw,
        variant: 'secondary'
      });
    }
    
    // Archive actions
    actions.push({
      id: 'archive',
      label: 'Archive',
      icon: Archive,
      variant: 'secondary'
    });
    
    // Delete action
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirmation: true,
      confirmationMessage: 'This action cannot be undone. Are you sure you want to delete the selected tasks?'
    });
    
    // Unarchive if needed
    const hasArchivedTasks = selectedTasksArray.some(task => task!.isArchived);
    if (hasArchivedTasks) {
      actions.push({
        id: 'unarchive',
        label: 'Unarchive',
        icon: RefreshCcw,
        variant: 'secondary'
      });
    }
    
    // Priority actions
    actions.push(
      {
        id: 'priority-critical',
        label: 'Set Critical Priority',
        icon: TrendingUp,
        variant: 'destructive'
      },
      {
        id: 'priority-high',
        label: 'Set High Priority',
        icon: TrendingUp,
        variant: 'default'
      },
      {
        id: 'priority-medium',
        label: 'Set Medium Priority',
        icon: TrendingUp,
        variant: 'secondary'
      },
      {
        id: 'priority-low',
        label: 'Set Low Priority',
        icon: TrendingUp,
        variant: 'secondary'
      }
    );
    
    return actions;
  }, [selectedTasks, tasks]);

  // Filter and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!task.title.toLowerCase().includes(searchLower) && 
            !(task.description || '').toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Category filter
      if (filters.category !== 'all' && task.category !== filters.category) {
        return false;
      }

      // Priority filter
      if (filters.priority !== 'all' && task.priority !== filters.priority) {
        return false;
      }

      // Status filter
      if (filters.status !== 'all') {
        const now = new Date();
        const isOverdue = !!(task.reminderAt && new Date(task.reminderAt) < now && !task.completedAt);
        
        let statusMatch = false;
        switch (filters.status) {
          case 'pending':
            statusMatch = !task.completedAt && !task.isArchived;
            break;
          case 'completed':
            statusMatch = !!task.completedAt;
            break;
          case 'overdue':
            statusMatch = isOverdue;
            break;
          case 'archived':
            statusMatch = !!task.isArchived;
            break;
        }
        
        if (!statusMatch) return false;
      }

      // Created date range filter
      if (filters.createdDateRange.from || filters.createdDateRange.to) {
        const taskDate = new Date(task.createdAt);
        
        if (filters.createdDateRange.from) {
          const fromDate = new Date(filters.createdDateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          if (taskDate < fromDate) return false;
        }
        
        if (filters.createdDateRange.to) {
          const toDate = new Date(filters.createdDateRange.to);
          toDate.setHours(23, 59, 59, 999);
          if (taskDate > toDate) return false;
        }
      }

      // Completed date range filter
      if (filters.completedDateRange.from || filters.completedDateRange.to) {
        if (!task.completedAt) return false; // Skip tasks that are not completed
        
        const taskDate = new Date(task.completedAt);
        
        if (filters.completedDateRange.from) {
          const fromDate = new Date(filters.completedDateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          if (taskDate < fromDate) return false;
        }
        
        if (filters.completedDateRange.to) {
          const toDate = new Date(filters.completedDateRange.to);
          toDate.setHours(23, 59, 59, 999);
          if (taskDate > toDate) return false;
        }
      }

      return true;
    });

    // Apply sorting
    if (sort.column && sort.direction) {
      filtered.sort((a, b) => {
        const aValue = a[sort.column!];
        const bValue = b[sort.column!];
        
        if (aValue === null || aValue === undefined) return sort.direction === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sort.direction === 'asc' ? -1 : 1;
        
        // Special handling for priority sorting
        if (sort.column === 'priority') {
          const priorityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
          const aPriority = priorityOrder[aValue as Priority] || 0;
          const bPriority = priorityOrder[bValue as Priority] || 0;
          return sort.direction === 'asc' ? aPriority - bPriority : bPriority - aPriority;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sort.direction === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        return 0;
      });
    }

    return filtered;
  }, [tasks, filters, sort]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedTasks.length / itemsPerPage);
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedTasks.slice(startIndex, endIndex);
  }, [filteredAndSortedTasks, currentPage, itemsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sort]);

  // Selection handlers
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedTasks(new Set(paginatedTasks.map(task => task.id)));
    } else {
      setSelectedTasks(new Set());
    }
  }, [paginatedTasks]);

  const selectAllVisible = useCallback(() => {
    setSelectedTasks(new Set(paginatedTasks.map(task => task.id)));
  }, [paginatedTasks]);

  const selectAllFiltered = useCallback(() => {
    setSelectedTasks(new Set(filteredAndSortedTasks.map(task => task.id)));
  }, [filteredAndSortedTasks]);

  const handleSelectTask = useCallback((taskId: string, checked: boolean) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      return newSet;
    });
  }, []);

  // Column visibility toggle
  const toggleColumnVisibility = useCallback((columnKey: string) => {
    setColumns(prev => prev.map(col => 
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    ));
  }, []);

  // Sorting handler
  const handleSort = useCallback((column: keyof Task) => {
    setSort(prev => {
      if (prev.column === column) {
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc'
        };
      } else {
        return { column, direction: 'asc' };
      }
    });
  }, []);

  // Column resizing handlers
  const handleResizeStart = useCallback((columnKey: string, event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    setIsResizing(true);
    setResizingColumn(columnKey);
    
    // Add body class to prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    
    const startX = event.clientX;
    const column = columns.find(col => col.key === columnKey);
    const startWidth = column?.width ? parseInt(column.width.replace('px', '')) : 100;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const deltaX = clientX - startX;
      const newWidth = Math.max(
        column?.minWidth || 50,
        Math.min(column?.maxWidth || 500, startWidth + deltaX)
      );
      
      // Real-time update with smooth transition
      setColumns(prev => prev.map(col => 
        col.key === columnKey ? { ...col, width: `${newWidth}px` } : col
      ));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizingColumn(null);
      
      // Restore body styles
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };

    // Add both mouse and touch event listeners for mobile support
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);
  }, [columns]);

  // Bulk actions
  const executeBulkAction = useCallback(async (actionId: string) => {
    if (selectedTasks.size === 0) return;

    const action = bulkActions.find(a => a.id === actionId);
    if (!action) return;

    if (action.requiresConfirmation) {
      setConfirmDialog({
        open: true,
        title: `${action.label} ${selectedTasks.size} task${selectedTasks.size > 1 ? 's' : ''}`,
        description: action.confirmationMessage || 'Are you sure?',
        action: () => performBulkAction(actionId)
      });
      return;
    }

    performBulkAction(actionId);
  }, [selectedTasks]);

  const performBulkAction = useCallback(async (actionId: string) => {
    // Add this action to loading states
    setLoadingActions(prev => new Set([...prev, actionId]));
    setIsLoading(true);
    
    try {
      const taskIds = Array.from(selectedTasks);
      const promises = taskIds.map(async (taskId) => {
        if (actionId.startsWith('category-')) {
          const category = actionId.replace('category-', '') as TaskCategory;
          return updateTask(taskId, { category });
        }
        
        switch (actionId) {
          case 'complete':
            return acceptTask(taskId);
          case 'uncomplete':
            return uncompleteTask(taskId);
          case 'archive':
            return updateTask(taskId, { isArchived: true });
          case 'unarchive':
            return updateTask(taskId, { isArchived: false });
          case 'priority-critical':
            return updateTask(taskId, { priority: 'Critical' as Priority });
          case 'priority-high':
            return updateTask(taskId, { priority: 'High' as Priority });
          case 'priority-medium':
            return updateTask(taskId, { priority: 'Medium' as Priority });
          case 'priority-low':
            return updateTask(taskId, { priority: 'Low' as Priority });
          case 'delete':
            return deleteTask(taskId);
          default:
            return Promise.resolve();
        }
      });

      await Promise.all(promises);
      
      setSelectedTasks(new Set());
      toast({
        title: 'Bulk action completed',
        description: `Successfully updated ${taskIds.length} task${taskIds.length > 1 ? 's' : ''}`
      });
    } catch (error) {
      toast({
        title: 'Bulk action failed',
        description: 'Some tasks could not be updated. Please try again.',
        variant: 'destructive'
      });
    } finally {
      // Remove this action from loading states
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionId);
        return newSet;
      });
      setIsLoading(false);
      setConfirmDialog(null);
    }
  }, [selectedTasks, acceptTask, uncompleteTask, updateTask, deleteTask, taskCategories, toast]);

  // Export functionality
  const exportTasks = useCallback(() => {
    const tasksToExport = selectedTasks.size > 0 
      ? filteredAndSortedTasks.filter(task => selectedTasks.has(task.id))
      : filteredAndSortedTasks;

    const csvContent = [
      ['Title', 'Description', 'Category', 'Priority', 'Duration', 'Created', 'Due Date', 'Status', 'Completed Date'],
      ...tasksToExport.map(task => [
        task.title,
        task.description || '',
        task.category,
        task.priority,
        task.duration.toString(),
        format(new Date(task.createdAt), 'yyyy-MM-dd HH:mm'),
        task.reminderAt ? format(new Date(task.reminderAt), 'yyyy-MM-dd HH:mm') : '',
        task.completedAt ? 'Completed' : task.isArchived ? 'Archived' : 'Pending',
        task.completedAt ? format(new Date(task.completedAt), 'yyyy-MM-dd HH:mm') : ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export completed',
      description: `Exported ${tasksToExport.length} tasks to CSV`
    });
  }, [filteredAndSortedTasks, selectedTasks, toast]);

  // Import functionality
  const importTasks = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          throw new Error('CSV file must contain at least a header row and one data row');
        }

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
        const tasks = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
          
          if (values.length < headers.length) continue; // Skip incomplete rows
          
          const taskData: any = {};
          headers.forEach((header, index) => {
            if (values[index]) {
              taskData[header] = values[index];
            }
          });

          // Map CSV fields to Task fields and validate
          const title = taskData.title;
          if (!title) continue; // Skip rows without title

          const category = taskCategories.includes(taskData.category) ? taskData.category : taskCategories[0];
          const priority = ['Critical', 'High', 'Medium', 'Low'].includes(taskData.priority) ? taskData.priority : 'Medium';
          const duration = parseInt(taskData.duration) || 30;
          
          // Parse due date more robustly
          let reminderAt: number | undefined = undefined;
          if (taskData['due date']) {
            const parsedDate = new Date(taskData['due date']);
            if (!isNaN(parsedDate.getTime())) {
              reminderAt = parsedDate.getTime();
            }
          }
          
          const task = {
            title,
            description: taskData.description || '',
            category,
            priority,
            duration,
            reminderAt,
            isArchived: false,
            userEmail: user?.email || ''
          };

          tasks.push(task);
        }

        // Import tasks
        let successCount = 0;
        let errorCount = 0;

        for (const taskData of tasks) {
          try {
            await addTask(taskData);
            successCount++;
          } catch (error) {
            errorCount++;
          }
        }

        toast({
          title: 'Import completed',
          description: `Successfully imported ${successCount} tasks${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
        });

      } catch (error) {
        toast({
          title: 'Import failed',
          description: error instanceof Error ? error.message : 'Failed to parse CSV file',
          variant: 'destructive'
        });
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  }, [addTask, taskCategories, toast]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      category: 'all',
      priority: 'all',
      status: 'all',
      createdDateRange: {},
      completedDateRange: {}
    });
    setSort({ column: null, direction: null });
  }, []);

  // Apply filter preset
  const applyFilterPreset = useCallback((preset: FilterPreset) => {
    let filtersToApply = { ...preset.filters };
    
    // For "completed-today" preset, set dynamic date boundaries for current day
    if (preset.name === "Completed Today") {
      const today = new Date();
      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);
      
      filtersToApply.completedDateRange = {
        from: startOfToday,
        to: endOfToday
      };
    }
    
    setFilters(filtersToApply);
    setSort({ column: null, direction: null });
  }, []);

  // Show bulk actions toolbar when tasks are selected
  useEffect(() => {
    setShowBulkActions(selectedTasks.size > 0);
  }, [selectedTasks.size]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A to select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && e.target instanceof HTMLElement && 
          !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        selectAllFiltered();
      }
      
      // Escape to clear selection
      if (e.key === 'Escape') {
        setSelectedTasks(new Set());
      }
      
      // Delete key to delete selected tasks
      if (e.key === 'Delete' && selectedTasks.size > 0 && e.target instanceof HTMLElement && 
          !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        executeBulkAction('delete');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTasks, selectAllFiltered, executeBulkAction]);

  const visibleColumns = columns.filter(col => col.visible);
  const isAllPageSelected = paginatedTasks.length > 0 && paginatedTasks.every(task => selectedTasks.has(task.id));
  const isPageIndeterminate = paginatedTasks.some(task => selectedTasks.has(task.id)) && !isAllPageSelected;

  const getStatusBadge = (task: Task) => {
    if (task.completedAt) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>;
    }
    if (task.isArchived) {
      return <Badge variant="outline">Archived</Badge>;
    }
    if (task.reminderAt && new Date(task.reminderAt) < new Date()) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    return <Badge variant="default">Pending</Badge>;
  };

  const getPriorityBadge = (priority: Priority) => {
    const variants = {
      Critical: 'destructive',
      High: 'default',
      Medium: 'secondary',
      Low: 'outline'
    } as const;
    
    return <Badge variant={variants[priority]}>{priority}</Badge>;
  };

  // Individual task actions for mobile cards
  const handleCompleteTask = useCallback(async (task: Task) => {
    try {
      await updateTask(task.id, { 
        completedAt: task.completedAt ? undefined : Date.now() 
      });
      toast({
        title: task.completedAt ? "Task unmarked as complete" : "Task completed",
        description: `"${task.title}" has been ${task.completedAt ? 'unmarked as complete' : 'completed'}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    }
  }, [updateTask, toast]);

  const handleArchiveTask = useCallback(async (task: Task) => {
    try {
      await updateTask(task.id, { isArchived: !task.isArchived });
      toast({
        title: task.isArchived ? "Task unarchived" : "Task archived",
        description: `"${task.title}" has been ${task.isArchived ? 'unarchived' : 'archived'}.`,
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to archive task",
        variant: "destructive",
      });
    }
  }, [updateTask, toast]);

  const handleDeleteTask = useCallback((task: Task) => {
    setConfirmDialog({
      open: true,
      title: "Delete Task",
      description: `Are you sure you want to delete "${task.title}"? This action cannot be undone.`,
      action: async () => {
        try {
          await deleteTask(task.id);
          setSelectedTasks(prev => {
            const newSet = new Set(prev);
            newSet.delete(task.id);
            return newSet;
          });
          toast({
            title: "Task deleted",
            description: `"${task.title}" has been deleted.`,
          });
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to delete task",
            variant: "destructive",
          });
        }
        setConfirmDialog(null);
      }
    });
  }, [deleteTask, toast]);

  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-950 dark:to-black transition-colors duration-300",
      isResizing && "cursor-col-resize select-none"
    )}>
      {/* Resize feedback overlay */}
      {isResizing && resizingColumn && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 dark:bg-white/80 text-white dark:text-black px-3 py-1 rounded-lg text-sm font-medium shadow-lg backdrop-blur-sm">
          Resizing {columns.find(col => col.key === resizingColumn)?.label}: {columns.find(col => col.key === resizingColumn)?.width}
        </div>
      )}
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Bulk Task Management
            </h1>
            <div className="hidden sm:block text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              Ctrl+A: Select All • Del: Delete • Esc: Clear Selection
            </div>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Manage multiple tasks at once with advanced filtering and bulk operations
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1">
            <Button 
              onClick={importTasks} 
              variant="outline" 
              size="sm" 
              className="flex-1 sm:flex-none"
              disabled={isImporting}
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <FileText className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-medium">CSV Import Format</h4>
                  <p className="text-sm text-muted-foreground">
                    Upload a CSV file with the following columns:
                  </p>
                  <div className="text-xs bg-muted p-2 rounded font-mono">
                    Title, Description, Category, Priority, Duration, Created, Due Date, Status, Completed Date
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• <strong>Title</strong>: Required</li>
                    <li>• <strong>Description</strong>: Optional</li>
                    <li>• <strong>Priority</strong>: Critical, High, Medium, Low</li>
                    <li>• <strong>Duration</strong>: Minutes (e.g., 30)</li>
                    <li>• <strong>Due Date</strong>: YYYY-MM-DD HH:mm format</li>
                    <li>• <strong>Created, Status, Completed Date</strong>: Auto-generated on import</li>
                  </ul>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={exportTasks} variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                <Settings className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Columns</span>
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Column Visibility</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.filter(col => col.key !== 'select').map(column => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={column.visible}
                  onCheckedChange={() => toggleColumnVisibility(column.key)}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <Card className="backdrop-blur-sm bg-white/70 dark:bg-gray-950/70 border border-white/20 dark:border-gray-700/50 shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">
              Filters
            </span>
            {(filters.search || filters.category !== 'all' || filters.priority !== 'all' || filters.status !== 'all' || filters.createdDateRange.from || filters.createdDateRange.to || filters.completedDateRange.from || filters.completedDateRange.to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground ml-auto transition-colors duration-200"
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </CardTitle>
          {/* Filter Presets */}
          <div className="flex flex-wrap gap-2">
            {filterPresets.map(preset => (
              <Button
                key={preset.id}
                variant="outline"
                size="sm"
                onClick={() => applyFilterPreset(preset)}
                className="text-xs h-7"
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select
                value={filters.category}
                onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {taskCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select
                value={filters.priority}
                onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value: typeof filters.status) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Created Date Range Filter */}
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Created Date Range</label>
              <div className="flex items-center gap-2">
                {/* From Date */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.createdDateRange.from && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.createdDateRange.from ? format(filters.createdDateRange.from, "MMM dd, yyyy") : "From date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filters.createdDateRange.from}
                      onSelect={(date) => setFilters(prev => ({ 
                        ...prev, 
                        createdDateRange: { ...prev.createdDateRange, from: date } 
                      }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-muted-foreground">to</span>

                {/* To Date */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.createdDateRange.to && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.createdDateRange.to ? format(filters.createdDateRange.to, "MMM dd, yyyy") : "To date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filters.createdDateRange.to}
                      onSelect={(date) => setFilters(prev => ({ 
                        ...prev, 
                        createdDateRange: { ...prev.createdDateRange, to: date } 
                      }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {/* Clear Created Date Range */}
                {(filters.createdDateRange.from || filters.createdDateRange.to) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters(prev => ({ 
                      ...prev, 
                      createdDateRange: { from: undefined, to: undefined } 
                    }))}
                    className="px-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Completed Date Range Filter */}
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Completed Date Range</label>
              <div className="flex items-center gap-2">
                {/* From Date */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.completedDateRange.from && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.completedDateRange.from ? format(filters.completedDateRange.from, "MMM dd, yyyy") : "From date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filters.completedDateRange.from}
                      onSelect={(date) => setFilters(prev => ({ 
                        ...prev, 
                        completedDateRange: { ...prev.completedDateRange, from: date } 
                      }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-muted-foreground">to</span>

                {/* To Date */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.completedDateRange.to && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.completedDateRange.to ? format(filters.completedDateRange.to, "MMM dd, yyyy") : "To date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filters.completedDateRange.to}
                      onSelect={(date) => setFilters(prev => ({ 
                        ...prev, 
                        completedDateRange: { ...prev.completedDateRange, to: date } 
                      }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {/* Clear Completed Date Range */}
                {(filters.completedDateRange.from || filters.completedDateRange.to) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters(prev => ({ 
                      ...prev, 
                      completedDateRange: { from: undefined, to: undefined } 
                    }))}
                    className="px-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredAndSortedTasks.filter(t => !t.completedAt && !t.isArchived).length}
              </div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {filteredAndSortedTasks.filter(t => t.completedAt).length}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {filteredAndSortedTasks.filter(t => 
                  t.reminderAt && new Date(t.reminderAt) < new Date() && !t.completedAt
                ).length}
              </div>
              <div className="text-xs text-muted-foreground">Overdue</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {filteredAndSortedTasks.filter(t => t.priority === 'Critical' || t.priority === 'High').length}
              </div>
              <div className="text-xs text-muted-foreground">High Priority</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {filteredAndSortedTasks.filter(t => t.isArchived).length}
              </div>
              <div className="text-xs text-muted-foreground">Archived</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {selectedTasks.size}
              </div>
              <div className="text-xs text-muted-foreground">Selected</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Toolbar */}
      <AnimatePresence>
        {showBulkActions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                    <span className="text-sm font-medium whitespace-nowrap">
                      {selectedTasks.size} task{selectedTasks.size > 1 ? 's' : ''} selected
                    </span>
                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                      {bulkActions.slice(0, 4).map(action => {
                        const isActionLoading = loadingActions.has(action.id);
                        return (
                          <Button
                            key={action.id}
                            variant={action.variant || 'default'}
                            size="sm"
                            onClick={() => executeBulkAction(action.id)}
                            disabled={isActionLoading || loadingActions.size > 0}
                            className="flex items-center gap-2 flex-1 sm:flex-none"
                          >
                            {isActionLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <action.icon className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">{action.label}</span>
                          </Button>
                        );
                      })}
                      
                      {/* More actions dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                            <MoreHorizontal className="w-4 h-4" />
                            <span className="hidden sm:inline ml-2">More</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Priority Actions</DropdownMenuLabel>
                          {bulkActions.filter(action => action.id.startsWith('priority')).map(action => {
                            const isActionLoading = loadingActions.has(action.id);
                            return (
                              <DropdownMenuItem 
                                key={action.id}
                                onClick={() => executeBulkAction(action.id)}
                                disabled={loadingActions.size > 0}
                              >
                                {isActionLoading ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <action.icon className="mr-2 h-4 w-4" />
                                )}
                                {action.label}
                              </DropdownMenuItem>
                            );
                          })}
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Category Actions</DropdownMenuLabel>
                          {taskCategories.map(category => {
                            const categoryActionId = `category-${category}`;
                            const isActionLoading = loadingActions.has(categoryActionId);
                            return (
                              <DropdownMenuItem 
                                key={categoryActionId}
                                onClick={() => executeBulkAction(categoryActionId)}
                                disabled={loadingActions.size > 0}
                              >
                                {isActionLoading ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Tag className="mr-2 h-4 w-4" />
                                )}
                                Set to {category}
                              </DropdownMenuItem>
                            );
                          })}
                          <DropdownMenuSeparator />
                          {bulkActions.filter(action => !action.id.startsWith('priority')).slice(4).map(action => {
                            const isActionLoading = loadingActions.has(action.id);
                            return (
                              <DropdownMenuItem 
                                key={action.id}
                                onClick={() => executeBulkAction(action.id)}
                                disabled={loadingActions.size > 0}
                                className={action.variant === 'destructive' ? 'text-destructive' : ''}
                              >
                                {isActionLoading ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <action.icon className="mr-2 h-4 w-4" />
                                )}
                                {action.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTasks(new Set())}
                    className="self-end sm:self-auto"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Controls and Results Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing {paginatedTasks.length} of {filteredAndSortedTasks.length} tasks
            {filteredAndSortedTasks.length !== tasks.length && ` (${tasks.length} total)`}
          </span>
          {selectedTasks.size > 0 && (
            <span className="font-medium">
              • {selectedTasks.size} selected
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Items per page */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-7 px-2"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-7 px-2"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tasks Display - Responsive */}
      <Card className="backdrop-blur-sm bg-white/70 dark:bg-gray-950/70 border border-white/20 dark:border-gray-700/50 shadow-xl transition-colors duration-300">
        {/* Desktop Table View */}
        {viewMode === 'table' && (
          <div className="hidden lg:block">
            <div className="overflow-x-auto rounded-lg">
            <Table className="dark:bg-gray-900/50 w-full" style={{ tableLayout: 'fixed' }}>
              <TableHeader>
                <TableRow className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors duration-200">
                  {visibleColumns.map(column => (
                    <TableHead 
                      key={column.key} 
                      className={cn(
                        "whitespace-nowrap relative group text-gray-900 dark:text-gray-100 font-semibold bg-gradient-to-b from-gray-50/80 to-gray-100/80 dark:from-gray-800/80 dark:to-gray-900/80",
                        "transition-all duration-150 ease-out"
                      )}
                      style={{ 
                        width: column.width, 
                        minWidth: column.width,
                        maxWidth: column.width,
                        position: 'relative' 
                      }}
                    >
                      <div className="flex items-center justify-between">
                        {column.key === 'select' ? (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={isAllPageSelected}
                              ref={(el) => {
                                if (el && 'indeterminate' in el) {
                                  (el as any).indeterminate = isPageIndeterminate;
                                }
                              }}
                              onCheckedChange={handleSelectAll}
                              className="mr-2"
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => setSelectedTasks(new Set())}>
                                  <Square className="mr-2 h-4 w-4" />
                                  Select None
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={selectAllVisible}>
                                  <CheckSquare className="mr-2 h-4 w-4" />
                                  Select Page ({paginatedTasks.length})
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={selectAllFiltered}>
                                  <CheckSquare className="mr-2 h-4 w-4" />
                                  Select All ({filteredAndSortedTasks.length})
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : column.sortable ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 data-[state=open]:bg-accent"
                            onClick={() => handleSort(column.key as keyof Task)}
                          >
                            {column.label}
                            {sort.column === column.key && (
                              sort.direction === 'asc' ? (
                                <ArrowUp className="ml-2 h-4 w-4" />
                              ) : sort.direction === 'desc' ? (
                                <ArrowDown className="ml-2 h-4 w-4" />
                              ) : (
                                <ArrowUpDown className="ml-2 h-4 w-4" />
                              )
                            )}
                            {sort.column !== column.key && (
                              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                            )}
                          </Button>
                        ) : (
                          column.label
                        )}
                      </div>
                      
                      {/* Resize Handle */}
                      {column.resizable !== false && (
                        <div
                          className={cn(
                            "absolute right-0 top-0 h-full w-3 cursor-col-resize transition-all duration-300 group/resize",
                            "opacity-0 hover:opacity-100 group-hover:opacity-100",
                            resizingColumn === column.key && "opacity-100"
                          )}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleResizeStart(column.key.toString(), e);
                          }}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            // Show the resize handle on touch
                            e.currentTarget.style.opacity = '1';
                            
                            const touch = e.touches[0];
                            const mouseEvent = new MouseEvent('mousedown', {
                              clientX: touch.clientX,
                              clientY: touch.clientY,
                              bubbles: true,
                              cancelable: true
                            });
                            handleResizeStart(column.key.toString(), mouseEvent as any);
                          }}
                          title="Drag to resize column"
                        >
                          {/* Main resize line */}
                          <div className={cn(
                            "absolute right-0 top-0 h-full w-1 transition-all duration-300",
                            "bg-gradient-to-b from-blue-400 via-purple-500 to-blue-600",
                            "hover:w-2 hover:shadow-lg hover:shadow-blue-500/30",
                            "active:w-2 active:shadow-lg active:shadow-blue-500/30", // Mobile active state
                            resizingColumn === column.key 
                              ? "w-2 shadow-lg shadow-blue-500/50 animate-pulse" 
                              : "group-hover/resize:shadow-md group-hover/resize:shadow-blue-400/20"
                          )} />
                          
                          {/* Hover/Touch indicator dots */}
                          <div className={cn(
                            "absolute right-0.5 top-1/2 transform -translate-y-1/2 transition-all duration-300",
                            "opacity-0 group-hover/resize:opacity-100",
                            resizingColumn === column.key && "opacity-100"
                          )}>
                            <div className="flex flex-col space-y-1">
                              <div className="w-0.5 h-0.5 bg-white rounded-full shadow-sm" />
                              <div className="w-0.5 h-0.5 bg-white rounded-full shadow-sm" />
                              <div className="w-0.5 h-0.5 bg-white rounded-full shadow-sm" />
                            </div>
                          </div>
                          
                          {/* Mobile touch area - larger invisible touch target */}
                          <div className="absolute -right-2 -left-2 top-0 h-full md:block lg:hidden" />
                        </div>
                      )}
                    </TableHead>
                  ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTasks.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={visibleColumns.length} 
                    className="text-center py-8 text-muted-foreground"
                  >
                    {filteredAndSortedTasks.length === 0 
                      ? "No tasks found matching your filters"
                      : "No tasks on this page"
                    }
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTasks.map(task => (
                  <TableRow 
                    key={task.id}
                    className={cn(
                      "border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200",
                      selectedTasks.has(task.id) && "bg-blue-100/50 dark:bg-blue-900/30 ring-2 ring-blue-500/20"
                    )}
                  >
                    {visibleColumns.map(column => (
                      <TableCell 
                        key={`${task.id}-${column.key}`}
                        className={cn(
                          "text-gray-900 dark:text-gray-100 transition-all duration-150 ease-out",
                          column.key === 'title' && "align-top py-3 font-medium"
                        )}
                        style={{ 
                          width: column.width, 
                          minWidth: column.width,
                          maxWidth: column.width
                        }}
                      >
                        {column.key === 'select' && (
                          <Checkbox
                            checked={selectedTasks.has(task.id)}
                            onCheckedChange={(checked) => handleSelectTask(task.id, !!checked)}
                          />
                        )}
                        {column.key === 'title' && (
                          <div className="min-w-0">
                            <div className="font-medium text-wrap leading-tight" title={task.title}>
                              {task.title}
                            </div>
                            {task.description && (
                              <div className="text-sm text-muted-foreground text-wrap leading-tight mt-1 line-clamp-2" title={task.description}>
                                {task.description}
                              </div>
                            )}
                          </div>
                        )}
                        {column.key === 'category' && (
                          <Badge variant="outline">{task.category}</Badge>
                        )}
                        {column.key === 'priority' && getPriorityBadge(task.priority)}
                        {column.key === 'duration' && (
                          <span className="text-sm">{task.duration}m</span>
                        )}
                        {column.key === 'createdAt' && (
                          <span className="text-sm">
                            {format(new Date(task.createdAt), 'MMM dd, yyyy')}
                          </span>
                        )}
                        {column.key === 'reminderAt' && (
                          <span className="text-sm">
                            {task.reminderAt 
                              ? format(new Date(task.reminderAt), 'MMM dd, yyyy')
                              : '-'
                            }
                          </span>
                        )}
                        {column.key === 'completedAt' && (
                          <div className="space-y-1">
                            {getStatusBadge(task)}
                            {task.completedAt && (
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(task.completedAt), 'MMM dd, yyyy')}
                              </div>
                            )}
                          </div>
                        )}
                        {column.key === 'actions' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleSelectTask(task.id, true)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>
        )}
        
        {/* Mobile Table View - Horizontally Scrollable */}
        <div className="lg:hidden">
          <div className="mb-2 text-xs text-gray-500 dark:text-gray-400 text-center">
            💡 Tap any row to select/deselect • Scroll horizontally to see all columns
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <Table className="min-w-[800px] dark:bg-gray-900/50">
              <TableHeader>
                <TableRow className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors duration-200">
                  {visibleColumns.map(column => (
                    <TableHead 
                      key={column.key} 
                      className="whitespace-nowrap text-gray-900 dark:text-gray-100 font-semibold bg-gradient-to-b from-gray-50/80 to-gray-100/80 dark:from-gray-800/80 dark:to-gray-900/80 px-3 py-3 text-xs"
                      style={{ minWidth: column.minWidth || 100 }}
                    >
                      {column.key === 'select' ? (
                        <Checkbox
                          checked={isAllPageSelected}
                          onCheckedChange={() => {
                            if (isAllPageSelected) {
                              // Deselect all on page
                              const newSelected = new Set(selectedTasks);
                              paginatedTasks.forEach(task => newSelected.delete(task.id));
                              setSelectedTasks(newSelected);
                            } else {
                              // Select all on page
                              const newSelected = new Set(selectedTasks);
                              paginatedTasks.forEach(task => newSelected.add(task.id));
                              setSelectedTasks(newSelected);
                            }
                          }}
                          aria-label="Select all on page"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          {column.label}
                          {column.sortable && (
                            <button
                              onClick={() => handleSort(column.key as keyof Task)}
                              className="hover:bg-muted/50 p-1 rounded transition-colors"
                            >
                              {sort.column === column.key ? (
                                sort.direction === 'asc' ? 
                                <ChevronUp className="h-3 w-3" /> : 
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3 opacity-50" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTasks.length === 0 ? (
                  <TableRow>
                    <TableCell 
                      colSpan={visibleColumns.length} 
                      className="text-center py-12 text-gray-500 dark:text-gray-400"
                    >
                      {filteredAndSortedTasks.length === 0 
                        ? "No tasks found matching your filters"
                        : "No tasks on this page"
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTasks.map(task => (
                    <TableRow 
                      key={task.id}
                      className={cn(
                        "border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200 cursor-pointer select-none",
                        "active:scale-[0.99] active:bg-blue-100/70 dark:active:bg-blue-900/40 touch-manipulation",
                        selectedTasks.has(task.id) && "bg-blue-100/50 dark:bg-blue-900/30 ring-2 ring-blue-500/20 shadow-sm"
                      )}
                      onClick={(e) => {
                        // Prevent triggering row click when clicking on interactive elements
                        if (
                          e.target instanceof HTMLElement &&
                          (e.target.closest('button') || 
                           e.target.closest('[role="checkbox"]') || 
                           e.target.closest('[data-radix-collection-item]'))
                        ) {
                          return;
                        }
                        handleSelectTask(task.id, !selectedTasks.has(task.id));
                      }}
                    >
                      {visibleColumns.map(column => (
                        <TableCell 
                          key={`${task.id}-${column.key}`}
                          className="text-gray-900 dark:text-gray-100 transition-all duration-150 ease-out px-3 py-2 text-xs"
                          style={{ 
                            width: column.width, 
                            minWidth: column.width,
                            maxWidth: column.width
                          }}
                        >
                          {column.key === 'select' && (
                            <Checkbox
                              checked={selectedTasks.has(task.id)}
                              onCheckedChange={(checked) => handleSelectTask(task.id, !!checked)}
                            />
                          )}
                          {column.key === 'title' && (
                            <div className="min-w-0">
                              <div className="font-medium text-wrap leading-tight" title={task.title}>
                                {task.title}
                              </div>
                              {task.description && (
                                <div className="text-sm text-muted-foreground text-wrap leading-tight mt-1 line-clamp-2" title={task.description}>
                                  {task.description}
                                </div>
                              )}
                            </div>
                          )}
                          {column.key === 'category' && (
                            <Badge variant="outline">{task.category}</Badge>
                          )}
                          {column.key === 'priority' && getPriorityBadge(task.priority)}
                          {column.key === 'duration' && (
                            <span className="text-sm">{task.duration}m</span>
                          )}
                          {column.key === 'createdAt' && (
                            <span className="text-sm">
                              {format(new Date(task.createdAt), 'MMM dd, yyyy')}
                            </span>
                          )}
                          {column.key === 'reminderAt' && (
                            <span className="text-sm">
                              {task.reminderAt 
                                ? format(new Date(task.reminderAt), 'MMM dd, yyyy')
                                : '-'
                              }
                            </span>
                          )}
                          {column.key === 'completedAt' && (
                            <div className="space-y-1">
                              {getStatusBadge(task)}
                              {task.completedAt && (
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(task.completedAt), 'MMM dd, yyyy')}
                                </div>
                              )}
                            </div>
                          )}
                          {column.key === 'actions' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleSelectTask(task.id, true)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Desktop Card View */}
        {viewMode === 'cards' && (
          <div className="hidden lg:block">
            <CardContent className="p-6">
              <div className="space-y-4">
                {paginatedTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {filteredAndSortedTasks.length === 0 
                      ? "No tasks found matching your filters"
                      : "No tasks on this page"
                    }
                  </div>
                ) : (
                  paginatedTasks.map(task => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "border rounded-lg p-4 space-y-3 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200",
                        selectedTasks.has(task.id) && "bg-muted/30 border-primary ring-2 ring-primary/20"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <Checkbox
                            checked={selectedTasks.has(task.id)}
                            onCheckedChange={(checked) => handleSelectTask(task.id, !!checked)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleSelectTask(task.id, true)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{task.category}</Badge>
                        {getPriorityBadge(task.priority)}
                        {getStatusBadge(task)}
                        <Badge variant="secondary" className="text-xs">
                          {task.duration}m
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Created: {format(new Date(task.createdAt), 'MMM dd, yyyy')}</span>
                        {task.completedAt ? (
                          <span>Completed: {format(new Date(task.completedAt), 'MMM dd, yyyy')}</span>
                        ) : task.reminderAt ? (
                          <span>Due: {format(new Date(task.reminderAt), 'MMM dd, yyyy')}</span>
                        ) : null}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card className="backdrop-blur-sm bg-white/70 dark:bg-gray-950/70 border border-white/20 dark:border-gray-700/50 shadow-lg">
          <CardContent className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                Page {currentPage} of {totalPages} • {filteredAndSortedTasks.length} total tasks
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <AlertDialog open={confirmDialog.open} onOpenChange={() => setConfirmDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDialog.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmDialog(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDialog.action}
                className="bg-destructive hover:bg-destructive/90"
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      </div>
    </div>
  );
}
