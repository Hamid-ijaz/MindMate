'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Filter,
  X,
  Calendar as CalendarIcon,
  Users,
  Tag,
  AlertCircle,
  CheckSquare,
  Clock,
  Search,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import type { Priority, TaskCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SearchFilter {
  field: string;
  operator: string;
  value: string | string[];
  label?: string;
}

interface TaskSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: SearchFilter[]) => void;
  currentFilters: SearchFilter[];
  workspaceMembers?: { id: string; name: string; email: string }[];
}

const filterFields = [
  { value: 'assignee', label: 'Assignee', icon: Users, type: 'select' },
  { value: 'priority', label: 'Priority', icon: AlertCircle, type: 'select' },
  { value: 'category', label: 'Category', icon: Tag, type: 'select' },
  { value: 'status', label: 'Status', icon: CheckSquare, type: 'select' },
  { value: 'createdAt', label: 'Created Date', icon: CalendarIcon, type: 'date' },
  { value: 'dueDate', label: 'Due Date', icon: Clock, type: 'date' },
  { value: 'duration', label: 'Duration', icon: Clock, type: 'number' },
  { value: 'title', label: 'Title Contains', icon: Search, type: 'text' },
];

const priorityOptions = ['Low', 'Medium', 'High', 'Critical'];
const statusOptions = ['Open', 'In Progress', 'Completed', 'Pending', 'Blocked'];
const categoryOptions = ['Work', 'Personal', 'Meeting', 'Development', 'Design', 'Marketing', 'Admin'];

export function TaskSearchDialog({
  open,
  onOpenChange,
  onApplyFilters,
  currentFilters,
  workspaceMembers = []
}: TaskSearchDialogProps) {
  const [filters, setFilters] = useState<SearchFilter[]>(currentFilters);
  const [newFilterField, setNewFilterField] = useState('');
  const [newFilterOperator, setNewFilterOperator] = useState('equals');
  const [newFilterValue, setNewFilterValue] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const addFilter = () => {
    if (!newFilterField || !newFilterValue) return;

    const fieldConfig = filterFields.find(f => f.value === newFilterField);
    const newFilter: SearchFilter = {
      field: newFilterField,
      operator: newFilterOperator,
      value: newFilterValue,
      label: `${fieldConfig?.label}: ${newFilterValue}`
    };

    setFilters([...filters, newFilter]);
    setNewFilterField('');
    setNewFilterValue('');
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onOpenChange(false);
  };

  const clearAllFilters = () => {
    setFilters([]);
    setDateRange({});
  };

  const getFieldOptions = (field: string) => {
    switch (field) {
      case 'assignee':
        return workspaceMembers.map(m => ({ label: m.name || m.email, value: m.id }));
      case 'priority':
        return priorityOptions.map(p => ({ label: p, value: p }));
      case 'status':
        return statusOptions.map(s => ({ label: s, value: s }));
      case 'category':
        return categoryOptions.map(c => ({ label: c, value: c }));
      default:
        return [];
    }
  };

  const renderFilterValue = (field: string) => {
    const fieldConfig = filterFields.find(f => f.value === field);
    
    if (!fieldConfig) return null;

    switch (fieldConfig.type) {
      case 'select':
        const options = getFieldOptions(field);
        return (
          <Select value={newFilterValue} onValueChange={setNewFilterValue}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={`Select ${fieldConfig.label}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-48 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? format(dateRange.from, 'PPP') : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.from}
                onSelect={(date) => {
                  setDateRange({ ...dateRange, from: date });
                  setNewFilterValue(date ? date.toISOString() : '');
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case 'number':
        return (
          <div className="flex items-center gap-2">
            <Select value={newFilterOperator} onValueChange={setNewFilterOperator}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">=</SelectItem>
                <SelectItem value="greater">></SelectItem>
                <SelectItem value="less"><</SelectItem>
                <SelectItem value="greaterEqual">≥</SelectItem>
                <SelectItem value="lessEqual">≤</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Value"
              value={newFilterValue}
              onChange={(e) => setNewFilterValue(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        );

      case 'text':
        return (
          <div className="flex items-center gap-2">
            <Select value={newFilterOperator} onValueChange={setNewFilterOperator}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="startsWith">Starts with</SelectItem>
                <SelectItem value="endsWith">Ends with</SelectItem>
                <SelectItem value="equals">Equals</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Enter text"
              value={newFilterValue}
              onChange={(e) => setNewFilterValue(e.target.value)}
              className="w-48"
            />
          </div>
        );

      default:
        return (
          <Input
            placeholder="Enter value"
            value={newFilterValue}
            onChange={(e) => setNewFilterValue(e.target.value)}
            className="w-48"
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Search & Filters
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Create powerful filters to find exactly what you're looking for
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Filters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium">Quick Filters</h3>
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'My Tasks', field: 'assignee', value: 'me' },
                { label: 'High Priority', field: 'priority', value: 'High' },
                { label: 'Due Today', field: 'dueDate', value: 'today' },
                { label: 'Overdue', field: 'dueDate', value: 'overdue' },
                { label: 'Unassigned', field: 'assignee', value: 'none' },
                { label: 'Completed', field: 'status', value: 'Completed' },
                { label: 'In Progress', field: 'status', value: 'In Progress' },
                { label: 'Blocked', field: 'status', value: 'Blocked' },
              ].map((quickFilter) => (
                <Button
                  key={`${quickFilter.field}-${quickFilter.value}`}
                  variant="outline"
                  size="sm"
                  className="justify-start h-auto py-2"
                  onClick={() => {
                    const existing = filters.find(f => 
                      f.field === quickFilter.field && f.value === quickFilter.value
                    );
                    if (!existing) {
                      setFilters([...filters, {
                        field: quickFilter.field,
                        operator: 'equals',
                        value: quickFilter.value,
                        label: quickFilter.label
                      }]);
                    }
                  }}
                >
                  {quickFilter.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom Filter Builder */}
          <div className="space-y-4">
            <h3 className="text-base font-medium">Custom Filters</h3>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Add Filter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-3">
                  <div className="space-y-2">
                    <Label>Field</Label>
                    <Select value={newFilterField} onValueChange={setNewFilterField}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {filterFields.map((field) => {
                          const Icon = field.icon;
                          return (
                            <SelectItem key={field.value} value={field.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {field.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Value</Label>
                    {newFilterField ? renderFilterValue(newFilterField) : (
                      <div className="w-48 h-10 bg-muted/50 border border-border rounded-md flex items-center justify-center">
                        <span className="text-sm text-muted-foreground">Select field first</span>
                      </div>
                    )}
                  </div>

                  <Button onClick={addFilter} disabled={!newFilterField || !newFilterValue}>
                    Add Filter
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Filters */}
          {filters.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-medium">Active Filters ({filters.length})</h3>
              <div className="flex flex-wrap gap-2">
                {filters.map((filter, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <Badge
                      variant="secondary"
                      className="pl-3 pr-2 py-1 flex items-center gap-2 max-w-xs"
                    >
                      <span className="truncate">{filter.label || `${filter.field}: ${filter.value}`}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFilter(index)}
                        className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-3">
            <h3 className="text-base font-medium">Filter Summary</h3>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">
                  {filters.length === 0 ? (
                    'No filters applied - all tasks will be shown'
                  ) : (
                    <>
                      Show tasks where <span className="font-medium">all</span> of the following conditions are met:
                      <ul className="mt-2 space-y-1 list-disc list-inside">
                        {filters.map((filter, index) => (
                          <li key={index} className="text-xs">
                            <span className="font-medium">{filter.field}</span> {filter.operator} <span className="font-medium">{filter.value}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply}>
              <Search className="h-4 w-4 mr-2" />
              Apply Filters ({filters.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}