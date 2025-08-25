'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText,
  Plus,
  Download,
  Upload,
  Star,
  Copy,
  Edit,
  Trash2,
  Eye,
  Users,
  Clock,
  CheckSquare,
  Tag,
  Zap,
  Grid3X3,
  List,
  Search,
  Filter,
  TrendingUp,
  Calendar
} from 'lucide-react';
import type { TaskTemplate, ProjectTemplate } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TemplateGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTemplates: TaskTemplate[];
  projectTemplates: ProjectTemplate[];
  onApplyTemplate: (templateId: string, type: 'task' | 'project') => Promise<void>;
  onCreateTemplate?: (type: 'task' | 'project') => void;
  onEditTemplate?: (template: TaskTemplate | ProjectTemplate, type: 'task' | 'project') => void;
  onDeleteTemplate?: (templateId: string, type: 'task' | 'project') => Promise<void>;
  isLoading?: boolean;
}

interface TemplateCardProps {
  template: TaskTemplate | ProjectTemplate;
  type: 'task' | 'project';
  onApply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  onPreview?: () => void;
  isApplying?: boolean;
}

function TemplateCard({ 
  template, 
  type, 
  onApply, 
  onEdit, 
  onDelete, 
  onToggleFavorite,
  onPreview,
  isApplying = false 
}: TemplateCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const taskCount = type === 'task' ? 1 : 
    'templateData' in template ? template.templateData.tasks?.length || 0 : 0;
  
  const categoryColor = {
    'Development': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    'Marketing': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    'Design': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
    'Product': 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
    'HR': 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-300',
    'Admin': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -2 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="h-full"
    >
      <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/20 group relative overflow-hidden">
        {/* Favorite indicator */}
        {template.isFavorite && (
          <div className="absolute top-3 right-3 z-10">
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
          </div>
        )}

        {/* Usage trend indicator */}
        <div className="absolute top-3 left-3 z-10">
          <Badge variant="secondary" className="text-xs">
            <TrendingUp className="h-3 w-3 mr-1" />
            {template.usageCount || 0}
          </Badge>
        </div>

        <CardHeader className="pb-3 pt-12">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              {type === 'task' ? (
                <CheckSquare className="h-5 w-5 text-primary" />
              ) : (
                <FileText className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
                {template.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {template.description}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Template stats */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <CheckSquare className="h-3 w-3 text-muted-foreground" />
                <span>{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
              </div>
              {'estimatedDuration' in template && template.estimatedDuration && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>{template.estimatedDuration}min</span>
                </div>
              )}
            </div>
            <div className="text-muted-foreground">
              {new Date(template.createdAt).toLocaleDateString()}
            </div>
          </div>

          {/* Category and tags */}
          <div className="flex flex-wrap gap-1">
            <Badge 
              variant="secondary" 
              className={cn("text-xs", categoryColor[template.category as keyof typeof categoryColor] || categoryColor.Admin)}
            >
              {template.category}
            </Badge>
            {template.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                <Tag className="h-2 w-2 mr-1" />
                {tag}
              </Badge>
            ))}
            {template.tags && template.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{template.tags.length - 2} more
              </Badge>
            )}
          </div>

          {/* Author info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>by {template.createdBy}</span>
            {template.isShared && (
              <Badge variant="outline" className="text-xs ml-auto">
                Shared
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Button 
              size="sm" 
              onClick={onApply}
              disabled={isApplying}
              className="flex-1"
            >
              {isApplying ? (
                <>
                  <Zap className="h-3 w-3 mr-1 animate-pulse" />
                  Applying...
                </>
              ) : (
                <>
                  <Zap className="h-3 w-3 mr-1" />
                  Apply
                </>
              )}
            </Button>
            
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-1"
                >
                  <Button size="sm" variant="outline" onClick={onPreview}>
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={onEdit}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={onDelete}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function TemplateGallery({
  open,
  onOpenChange,
  taskTemplates,
  projectTemplates,
  onApplyTemplate,
  onCreateTemplate,
  onEditTemplate,
  onDeleteTemplate,
  isLoading = false
}: TemplateGalleryProps) {
  const [activeTab, setActiveTab] = useState<'task' | 'project'>('task');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'recent'>('recent');
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);

  const templates = activeTab === 'task' ? taskTemplates : projectTemplates;
  
  // Filter and sort templates
  const filteredTemplates = templates
    .filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          template.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || template.category === filterCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'usage':
          return (b.usageCount || 0) - (a.usageCount || 0);
        case 'recent':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const handleApplyTemplate = async (templateId: string) => {
    try {
      setApplyingTemplateId(templateId);
      await onApplyTemplate(templateId, activeTab);
    } finally {
      setApplyingTemplateId(null);
    }
  };

  const categories = ['all', 'Development', 'Marketing', 'Design', 'Product', 'HR', 'Admin'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Template Gallery
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Apply pre-built templates to quickly create tasks and projects
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'task' | 'project')}>
              <TabsList>
                <TabsTrigger value="task" className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Task Templates ({taskTemplates.length})
                </TabsTrigger>
                <TabsTrigger value="project" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Project Templates ({projectTemplates.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => onCreateTemplate?.(activeTab)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
              <div className="flex items-center gap-1 border rounded-md">
                <Button
                  size="sm"
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('grid')}
                  className="h-8 w-8 p-0"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('list')}
                  className="h-8 w-8 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'name' | 'usage' | 'recent')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recent</SelectItem>
                  <SelectItem value="usage">Popular</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Templates Grid/List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-foreground">
                  {searchQuery || filterCategory !== 'all' ? 'No templates found' : 'No templates yet'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery || filterCategory !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : `Create your first ${activeTab} template to get started`
                  }
                </p>
                {(!searchQuery && filterCategory === 'all') && (
                  <Button className="mt-4" onClick={() => onCreateTemplate?.(activeTab)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                )}
              </div>
            ) : (
              <div className={cn(
                viewMode === 'grid' 
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                  : 'space-y-3'
              )}>
                <AnimatePresence>
                  {filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      type={activeTab}
                      onApply={() => handleApplyTemplate(template.id)}
                      onEdit={() => onEditTemplate?.(template, activeTab)}
                      onDelete={() => onDeleteTemplate?.(template.id, activeTab)}
                      isApplying={applyingTemplateId === template.id}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Footer Stats */}
          {filteredTemplates.length > 0 && (
            <div className="flex justify-between items-center text-sm text-muted-foreground pt-4 border-t">
              <span>
                Showing {filteredTemplates.length} of {templates.length} templates
              </span>
              <div className="flex items-center gap-4">
                <span>Most popular: {templates.find(t => t.usageCount === Math.max(...templates.map(t => t.usageCount || 0)))?.name}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}