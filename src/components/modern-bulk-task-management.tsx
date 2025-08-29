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
  Grid3X3,
  Smartphone,
  Monitor
} from 'lucide-react';
import { useTasks } from '@/contexts/task-context';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Task, Priority } from '@/types/task';
import { cn } from '@/lib/utils';

// Import the original component logic but with modern UI
import BulkTaskManagement from './bulk-task-management';

interface ModernBulkTaskManagementProps {
  className?: string;
}

const ModernBulkTaskManagement: React.FC<ModernBulkTaskManagementProps> = ({ className }) => {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && viewMode === 'table') {
        setViewMode('cards');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [viewMode]);

  return (
    <div className={cn("min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900", className)}>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* View Toggle for Desktop */}
        {!isMobile && (
          <div className="flex justify-end mb-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-lg border shadow-sm p-1">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-8"
              >
                <TableIcon className="h-4 w-4 mr-2" />
                Table
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
                className="h-8"
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Cards
              </Button>
            </div>
          </div>
        )}

        {/* Render the appropriate view */}
        {viewMode === 'table' ? (
          <BulkTaskManagement />
        ) : (
          <ModernCardView />
        )}
      </div>
    </div>
  );
};

// Modern Card View Component
const ModernCardView: React.FC = () => {
  const { tasks } = useTasks();
  const { toast } = useToast();

  // Simplified state management for demo
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    priority: 'all',
    status: 'all'
  });

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.category !== 'all' && task.category !== filters.category) {
        return false;
      }
      if (filters.priority !== 'all' && task.priority !== filters.priority) {
        return false;
      }
      if (filters.status !== 'all') {
        if (filters.status === 'completed' && !task.completedAt) return false;
        if (filters.status === 'pending' && task.completedAt) return false;
      }
      return true;
    });
  }, [tasks, filters]);

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (task: Task) => {
    if (task.completedAt) return 'bg-green-100 text-green-800 border-green-200';
    if (task.isArchived) return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getStatusText = (task: Task) => {
    if (task.completedAt) return 'Completed';
    if (task.isArchived) return 'Archived';
    return 'Pending';
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl ring-1 ring-black/5">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                  <LayoutGrid className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    Task Management
                  </h1>
                  <p className="text-gray-600 dark:text-gray-300">
                    Organize and manage your tasks with modern card view
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              {/* Stats */}
              <div className="flex gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{filteredTasks.length}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Showing</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">{tasks.length}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                </div>
                {selectedTasks.size > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedTasks.size}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Selected</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters Card */}
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl ring-1 ring-black/5">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Filters</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search tasks..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10 shadow-sm"
                  />
                </div>
              </div>

              {/* Priority Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
                  <SelectTrigger className="shadow-sm">
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

              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                  <SelectTrigger className="shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 opacity-0">Action</label>
                <Button
                  variant="outline"
                  onClick={() => setFilters({ search: '', category: 'all', priority: 'all', status: 'all' })}
                  className="w-full shadow-sm"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filteredTasks.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg ring-1 ring-black/5 hover:shadow-xl transition-all duration-200 group">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Header with checkbox and priority */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedTasks.has(task.id)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedTasks);
                            if (checked) {
                              newSelected.add(task.id);
                            } else {
                              newSelected.delete(task.id);
                            }
                            setSelectedTasks(newSelected);
                          }}
                        />
                        <Badge className={cn("text-xs font-medium border", getPriorityColor(task.priority))}>
                          {task.priority}
                        </Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Complete
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Task Title */}
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 text-lg">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>

                    {/* Task Meta */}
                    <div className="flex flex-wrap gap-2">
                      <Badge className={cn("text-xs font-medium border", getStatusColor(task))}>
                        {getStatusText(task)}
                      </Badge>
                      {task.category && (
                        <Badge variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {task.category}
                        </Badge>
                      )}
                      {task.estimatedDuration && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {task.estimatedDuration}m
                        </Badge>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Created: {format(new Date(task.createdAt), 'MMM dd, yyyy')}
                      </div>
                      {task.reminderAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Due: {format(new Date(task.reminderAt), 'MMM dd, yyyy HH:mm')}
                        </div>
                      )}
                      {task.completedAt && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Completed: {format(new Date(task.completedAt), 'MMM dd, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredTasks.length === 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl ring-1 ring-black/5">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No tasks found</h3>
                <p className="text-gray-600 dark:text-gray-300">Try adjusting your filters to see more tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions Bar */}
      {selectedTasks.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
        >
          <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl ring-1 ring-black/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">
                  {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete
                  </Button>
                  <Button size="sm" variant="outline">
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedTasks(new Set())}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default ModernBulkTaskManagement;
