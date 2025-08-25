import { NextRequest, NextResponse } from 'next/server';
import { teamTaskService } from '@/lib/firestore';
import type { SearchQuery, SearchResult, TeamTask } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, filters, sortBy, workspaceId, userId } = body;
    
    if (!query && (!filters || filters.length === 0)) {
      return NextResponse.json({ error: 'Query or filters are required' }, { status: 400 });
    }
    
    // Get all tasks from workspace
    let tasks: TeamTask[] = [];
    if (workspaceId) {
      tasks = await teamTaskService.getWorkspaceTasks(workspaceId);
    }
    
    // Apply search and filters
    let filteredTasks = tasks;
    
    // Text search
    if (query && query.trim()) {
      const searchTerm = query.toLowerCase();
      filteredTasks = filteredTasks.filter(task => 
        task.title.toLowerCase().includes(searchTerm) ||
        task.description?.toLowerCase().includes(searchTerm) ||
        task.category.toLowerCase().includes(searchTerm) ||
        task.assigneeName?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply filters
    if (filters && Array.isArray(filters)) {
      for (const filter of filters) {
        filteredTasks = applyFilter(filteredTasks, filter);
      }
    }
    
    // Apply sorting
    if (sortBy && Array.isArray(sortBy) && sortBy.length > 0) {
      filteredTasks = applySorting(filteredTasks, sortBy);
    }
    
    // Generate facets (aggregated filter options)
    const facets = generateFacets(tasks);
    
    // Generate search suggestions based on existing data
    const suggestions = generateSuggestions(tasks, query);
    
    const result: SearchResult = {
      tasks: filteredTasks,
      totalCount: filteredTasks.length,
      facets,
      suggestions,
      executionTime: Date.now(), // This would be actual execution time
      hasMore: false, // For pagination
    };
    
    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error executing search:', error);
    return NextResponse.json({ error: 'Search execution failed' }, { status: 500 });
  }
}

function applyFilter(tasks: TeamTask[], filter: any): TeamTask[] {
  const { field, operator, value } = filter;
  
  return tasks.filter(task => {
    const fieldValue = getFieldValue(task, field);
    
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
      case 'startsWith':
        return String(fieldValue).toLowerCase().startsWith(String(value).toLowerCase());
      case 'endsWith':
        return String(fieldValue).toLowerCase().endsWith(String(value).toLowerCase());
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue);
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'between':
        return Array.isArray(value) && 
               Number(fieldValue) >= Number(value[0]) && 
               Number(fieldValue) <= Number(value[1]);
      case 'is_empty':
        return !fieldValue || fieldValue === '';
      case 'is_not_empty':
        return fieldValue && fieldValue !== '';
      default:
        return true;
    }
  });
}

function applySorting(tasks: TeamTask[], sortOptions: any[]): TeamTask[] {
  return tasks.sort((a, b) => {
    for (const sort of sortOptions) {
      const { field, direction } = sort;
      const aValue = getFieldValue(a, field);
      const bValue = getFieldValue(b, field);
      
      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      else if (aValue > bValue) comparison = 1;
      
      if (direction === 'desc') comparison *= -1;
      
      if (comparison !== 0) return comparison;
    }
    return 0;
  });
}

function getFieldValue(task: TeamTask, field: string): any {
  switch (field) {
    case 'title':
      return task.title;
    case 'description':
      return task.description || '';
    case 'category':
      return task.category;
    case 'priority':
      return task.priority;
    case 'assignee':
      return task.assigneeName || task.assigneeId || '';
    case 'status':
      return task.completedAt ? 'completed' : 'active';
    case 'createdAt':
      return task.createdAt;
    case 'completedAt':
      return task.completedAt || 0;
    case 'duration':
      return task.duration;
    case 'timeOfDay':
      return task.timeOfDay;
    default:
      return '';
  }
}

function generateFacets(tasks: TeamTask[]): any[] {
  const facets = [];
  
  // Category facet
  const categories = new Map();
  tasks.forEach(task => {
    const count = categories.get(task.category) || 0;
    categories.set(task.category, count + 1);
  });
  
  facets.push({
    field: 'category',
    values: Array.from(categories.entries()).map(([value, count]) => ({
      value,
      count,
      selected: false,
    })),
  });
  
  // Priority facet
  const priorities = new Map();
  tasks.forEach(task => {
    const count = priorities.get(task.priority) || 0;
    priorities.set(task.priority, count + 1);
  });
  
  facets.push({
    field: 'priority',
    values: Array.from(priorities.entries()).map(([value, count]) => ({
      value,
      count,
      selected: false,
    })),
  });
  
  // Status facet
  const statuses = new Map();
  tasks.forEach(task => {
    const status = task.completedAt ? 'completed' : 'active';
    const count = statuses.get(status) || 0;
    statuses.set(status, count + 1);
  });
  
  facets.push({
    field: 'status',
    values: Array.from(statuses.entries()).map(([value, count]) => ({
      value,
      count,
      selected: false,
    })),
  });
  
  return facets;
}

function generateSuggestions(tasks: TeamTask[], query?: string): string[] {
  const suggestions = new Set<string>();
  
  // Add unique task titles that match the query
  tasks.forEach(task => {
    if (!query || task.title.toLowerCase().includes(query.toLowerCase())) {
      suggestions.add(task.title);
    }
    
    // Add category suggestions
    if (!query || task.category.toLowerCase().includes(query.toLowerCase())) {
      suggestions.add(task.category);
    }
    
    // Add assignee suggestions
    if (task.assigneeName && (!query || task.assigneeName.toLowerCase().includes(query.toLowerCase()))) {
      suggestions.add(task.assigneeName);
    }
  });
  
  return Array.from(suggestions).slice(0, 10); // Limit to 10 suggestions
}