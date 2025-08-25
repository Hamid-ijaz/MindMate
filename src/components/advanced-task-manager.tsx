'use client';

import React, { useState, useEffect } from 'react';
import { useTeam } from '@/contexts/team-context';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Filter, 
  Template, 
  CheckSquare, 
  MoreHorizontal, 
  Download,
  Upload,
  Trash2,
  Edit3,
  Copy,
  Users,
  Calendar,
  Clock,
  Tag,
  AlertCircle,
  Zap,
  BarChart3,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { 
  TeamTask, 
  TaskTemplate, 
  SearchResult, 
  BatchOperation, 
  Priority,
  TaskCategory 
} from '@/lib/types';

interface AdvancedTaskManagerProps {
  workspaceId?: string;
}

export default function AdvancedTaskManager({ workspaceId }: AdvancedTaskManagerProps) {
  const { user } = useAuth();
  const { currentWorkspace, teamTasks, isLoadingTasks } = useTeam();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilters, setActiveFilters] = useState<any[]>([]);
  
  // Selection state
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Templates state
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  
  // Batch operations state
  const [batchOperations, setBatchOperations] = useState<BatchOperation[]>([]);
  const [activeBatchOp, setActiveBatchOp] = useState<BatchOperation | null>(null);
  
  // UI state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'kanban'>('list');

  const effectiveWorkspaceId = workspaceId || currentWorkspace?.id;
  const tasksToShow = searchResults ? searchResults.tasks : teamTasks;

  // Load templates
  useEffect(() => {
    if (!effectiveWorkspaceId) return;

    const loadTemplates = async () => {
      try {
        setIsLoadingTemplates(true);
        const response = await fetch(`/api/templates?workspaceId=${effectiveWorkspaceId}`);
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.templates || []);
        }
      } catch (error) {
        console.error('Error loading templates:', error);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [effectiveWorkspaceId]);

  // Search functionality
  const handleSearch = async () => {
    if (!effectiveWorkspaceId || (!searchQuery.trim() && activeFilters.length === 0)) {
      setSearchResults(null);
      return;
    }

    try {
      setIsSearching(true);
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          filters: activeFilters,
          workspaceId: effectiveWorkspaceId,
          userId: user?.email,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.result);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Task selection
  const handleTaskSelect = (taskId: string, selected: boolean) => {
    const newSelected = new Set(selectedTasks);
    if (selected) {
      newSelected.add(taskId);
    } else {
      newSelected.delete(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedTasks(new Set(tasksToShow.map(task => task.id)));
    } else {
      setSelectedTasks(new Set());
    }
    setSelectAll(selected);
  };

  // Batch operations
  const executeBatchOperation = async (operationType: string, parameters: any = {}) => {
    if (selectedTasks.size === 0 || !user?.email) return;

    try {
      const response = await fetch('/api/batch-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationType,
          taskIds: Array.from(selectedTasks),
          parameters,
          executedBy: user.email,
          workspaceId: effectiveWorkspaceId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Clear selection after operation
        setSelectedTasks(new Set());
        setSelectAll(false);
        // Optionally track the operation
        console.log('Batch operation started:', data.operationId);
      }
    } catch (error) {
      console.error('Batch operation error:', error);
    }
  };

  // Apply template
  const applyTemplate = async (templateId: string) => {
    if (!effectiveWorkspaceId || !user?.email) return;

    try {
      const response = await fetch('/api/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          workspaceId: effectiveWorkspaceId,
          createdBy: user.email,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Template applied, created tasks:', data.taskIds);
        setIsTemplateOpen(false);
        setSelectedTemplate(null);
      }
    } catch (error) {
      console.error('Template application error:', error);
    }
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (task: TeamTask) => {
    if (task.completedAt) return 'bg-green-100 text-green-800';
    if (task.assignmentStatus === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (task.assigneeId) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 flex items-center space-x-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tasks, assignees, categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterOpen(true)}
                className="flex items-center space-x-1"
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFilters.length}
                  </Badge>
                )}
              </Button>

              <Dialog open={isTemplateOpen} onOpenChange={setIsTemplateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Template className="h-4 w-4 mr-1" />
                    Templates
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Task Templates</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                    {templates.map((template) => (
                      <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">{template.name}</CardTitle>
                          <p className="text-xs text-gray-500">{template.description}</p>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex justify-between items-center">
                            <div className="flex space-x-2">
                              <Badge variant="outline" className="text-xs">
                                {template.templateData.tasks.length} tasks
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {template.usageCount} uses
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => applyTemplate(template.id)}
                            >
                              Apply
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>

              <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="kanban">Kanban</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {activeFilters.map((filter, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center space-x-1"
                >
                  <span>{filter.field}: {filter.value}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => {
                      setActiveFilters(prev => prev.filter((_, i) => i !== index));
                      handleSearch(); // Re-search with updated filters
                    }}
                  >
                    ×
                  </Button>
                </Badge>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setActiveFilters([]);
                  setSearchResults(null);
                }}
              >
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Operations Bar */}
      {selectedTasks.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium">
                    {selectedTasks.size} task{selectedTasks.size > 1 ? 's' : ''} selected
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => executeBatchOperation('update', { priority: 'High' })}
                  >
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Set High Priority
                  </Button>

                  <Select
                    onValueChange={(assigneeId) => 
                      executeBatchOperation('assign', { assigneeId })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Assign to..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user1@example.com">John Doe</SelectItem>
                      <SelectItem value="user2@example.com">Jane Smith</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => executeBatchOperation('update', { completedAt: Date.now() })}
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Complete
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => executeBatchOperation('delete')}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedTasks(new Set());
                      setSelectAll(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Task List/Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <CheckSquare className="h-5 w-5" />
              <span>Tasks</span>
              {searchResults && (
                <Badge variant="secondary">
                  {searchResults.totalCount} results
                </Badge>
              )}
            </CardTitle>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm">Select All</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoadingTasks ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className={`space-y-3 ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 space-y-0' : ''}`}>
              <AnimatePresence>
                {tasksToShow.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-4 border rounded-lg hover:shadow-md transition-all ${
                      selectedTasks.has(task.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedTasks.has(task.id)}
                        onCheckedChange={(checked) => handleTaskSelect(task.id, !!checked)}
                      />

                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{task.title}</h4>
                          <div className="flex space-x-1">
                            <Badge className={getPriorityColor(task.priority)} variant="secondary">
                              {task.priority}
                            </Badge>
                            <Badge className={getStatusColor(task)} variant="secondary">
                              {task.completedAt ? 'Completed' : task.assigneeId ? 'Assigned' : 'Open'}
                            </Badge>
                          </div>
                        </div>

                        {task.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <Tag className="h-3 w-3" />
                            <span>{task.category}</span>
                            <Clock className="h-3 w-3 ml-2" />
                            <span>{task.duration}min</span>
                            {task.assigneeName && (
                              <>
                                <Users className="h-3 w-3 ml-2" />
                                <span>{task.assigneeName}</span>
                              </>
                            )}
                          </div>

                          <div className="text-xs text-gray-400">
                            {new Date(task.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {tasksToShow.length === 0 && !isLoadingTasks && (
            <div className="text-center py-12">
              <CheckSquare className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {searchQuery || activeFilters.length > 0 ? 'No tasks found' : 'No tasks yet'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || activeFilters.length > 0 
                  ? 'Try adjusting your search or filters'
                  : 'Create your first task or apply a template to get started'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results Summary */}
      {searchResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {searchResults.facets.map((facet) => (
                <div key={facet.field} className="space-y-2">
                  <h4 className="font-medium text-sm capitalize">{facet.field}</h4>
                  <div className="space-y-1">
                    {facet.values.slice(0, 5).map((value) => (
                      <div key={value.value} className="flex justify-between text-xs">
                        <span>{value.value}</span>
                        <span className="text-gray-500">{value.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {searchResults.suggestions.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-sm mb-2">Suggestions</h4>
                <div className="flex flex-wrap gap-2">
                  {searchResults.suggestions.map((suggestion, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => setSearchQuery(suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}