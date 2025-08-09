"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, X, ChevronDown, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SettingsSearchProps {
  onSettingSelect: (settingId: string) => void;
  currentSetting: string;
  settings: any;
}

export function SettingsSearch({ onSettingSelect, currentSetting, settings }: SettingsSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Flatten all settings for search
  const allSettings = Object.entries(settings).flatMap(([categoryKey, category]: [string, any]) =>
    category.settings.map((setting: any) => ({
      ...setting,
      categoryKey,
      categoryTitle: category.title,
      categoryColor: category.color
    }))
  );

  // Filter settings based on search and category
  const filteredSettings = allSettings.filter(setting => {
    const matchesSearch = searchQuery === '' || 
      setting.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      setting.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      setting.categoryTitle.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === null || setting.categoryKey === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleSettingClick = (settingId: string) => {
    onSettingSelect(settingId);
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
  };

  return (
    <div className="relative mb-6">
      <Card className="border-dashed border-2 border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search settings, features, or preferences..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                className="pl-10 pr-4 h-12 bg-white/80 backdrop-blur-sm border-white/50 focus:border-blue-300 focus:ring-blue-200"
              />
            </div>

            {/* Category Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-12 px-4 bg-white/80 backdrop-blur-sm border-white/50">
                  <Filter className="h-4 w-4 mr-2" />
                  {selectedCategory ? 
                    Object.values(settings).find((cat: any, index) => Object.keys(settings)[index] === selectedCategory)?.title || 'Category'
                    : 'All Categories'
                  }
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedCategory(null)}>
                  All Categories
                </DropdownMenuItem>
                {Object.entries(settings).map(([key, category]: [string, any]) => (
                  <DropdownMenuItem key={key} onClick={() => setSelectedCategory(key)}>
                    <div className={`w-2 h-2 rounded-full bg-${category.color}-500 mr-2`} />
                    {category.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear Filters */}
            {(searchQuery || selectedCategory) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-12 px-3 text-gray-600 hover:text-gray-900"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Quick Access Suggestions */}
          {!searchQuery && !isSearchFocused && (
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="flex items-center space-x-2 text-xs text-gray-600 mb-2">
                <Sparkles className="h-3 w-3" />
                <span>Quick access:</span>
              </div>
              {['profile', 'notifications', 'appearance', 'calendar'].map((quickSetting) => {
                const setting = allSettings.find(s => s.id === quickSetting);
                if (!setting) return null;
                return (
                  <Button
                    key={quickSetting}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSettingClick(quickSetting)}
                    className="h-6 px-2 text-xs bg-white/60 border-white/70 hover:bg-white"
                  >
                    {setting.label}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Search Results */}
          <AnimatePresence>
            {(searchQuery || selectedCategory) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 space-y-2"
              >
                <Separator />
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      {filteredSettings.length} result{filteredSettings.length !== 1 ? 's' : ''} found
                    </span>
                    {filteredSettings.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {searchQuery && `"${searchQuery}"`}
                        {selectedCategory && Object.values(settings).find((cat: any, index) => Object.keys(settings)[index] === selectedCategory)?.title}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {filteredSettings.map((setting) => {
                      const IconComponent = setting.icon;
                      const isActive = currentSetting === setting.id;
                      return (
                        <motion.button
                          key={setting.id}
                          onClick={() => handleSettingClick(setting.id)}
                          className={`p-3 rounded-lg text-left transition-all duration-200 border ${
                            isActive
                              ? 'bg-blue-100 border-blue-200 shadow-sm'
                              : 'bg-white/60 border-white/70 hover:bg-white hover:border-gray-200'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`p-1.5 rounded-md bg-${setting.categoryColor}-100 flex-shrink-0`}>
                              <IconComponent className={`h-3.5 w-3.5 text-${setting.categoryColor}-600`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm text-gray-900 truncate">
                                  {setting.label}
                                </p>
                                {setting.badge && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    {setting.badge}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                                {setting.description}
                              </p>
                              <div className="flex items-center mt-2">
                                <div className={`w-2 h-2 rounded-full bg-${setting.categoryColor}-400 mr-1.5`} />
                                <span className="text-xs text-gray-500">{setting.categoryTitle}</span>
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {filteredSettings.length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-2">
                        <Search className="h-8 w-8 mx-auto" />
                      </div>
                      <p className="text-sm text-gray-600">No settings found</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Try adjusting your search terms or filters
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
