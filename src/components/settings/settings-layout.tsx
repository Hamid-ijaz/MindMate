"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Settings, Search, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { settingsConfig, getSettingById, getCategoryById, searchSettings, type SettingItem } from '@/lib/settings-config';
import { cn } from '@/lib/utils';

interface SettingsLayoutProps {
  children: React.ReactNode;
  currentSetting?: string;
}

export function SettingsLayout({ children, currentSetting = 'overview' }: SettingsLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SettingItem[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Handle search
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchSettings(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSettingSelect = (settingId: string) => {
    router.push(`/settings?section=${settingId}`);
    setIsMobileMenuOpen(false);
    setSearchQuery('');
  };

  const handleCategorySelect = (categoryId: string) => {
    const category = getCategoryById(categoryId);
    if (category && category.settings.length > 0) {
      handleSettingSelect(category.settings[0].id);
    }
  };

  const currentSettingItem = getSettingById(currentSetting);
  const currentCategory = currentSettingItem ? 
    Object.values(settingsConfig).find(cat => 
      cat.settings.some(setting => setting.id === currentSetting)
    ) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl">
        <div className="flex h-screen">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex lg:w-80 lg:flex-col lg:border-r">
            <div className="flex h-16 items-center justify-between px-6 border-b">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Settings className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-lg font-semibold">Settings</h1>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <SettingsSidebar 
                currentSetting={currentSetting}
                onSettingSelect={handleSettingSelect}
                onCategorySelect={handleCategorySelect}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchResults={searchResults}
              />
            </div>
          </aside>

          {/* Mobile Header */}
          <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b">
            <div className="flex h-16 items-center justify-between px-4">
              <div className="flex items-center space-x-2">
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 p-0">
                    <SheetHeader className="p-6 pb-4">
                      <SheetTitle className="flex items-center space-x-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Settings className="h-5 w-5 text-primary" />
                        </div>
                        <span>Settings</span>
                      </SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-auto">
                      <SettingsSidebar 
                        currentSetting={currentSetting}
                        onSettingSelect={handleSettingSelect}
                        onCategorySelect={handleCategorySelect}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        searchResults={searchResults}
                        isMobile
                      />
                    </div>
                  </SheetContent>
                </Sheet>
                <h1 className="text-lg font-semibold">Settings</h1>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 flex flex-col lg:pt-0 pt-16">
            {/* Breadcrumb */}
            <div className="flex h-16 items-center px-6 border-b bg-muted/30">
              <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Home className="h-4 w-4" />
                <ChevronRight className="h-4 w-4" />
                <span>Settings</span>
                {currentCategory && (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    <span>{currentCategory.title}</span>
                  </>
                )}
                {currentSettingItem && (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    <span className="text-foreground font-medium">{currentSettingItem.label}</span>
                  </>
                )}
              </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

interface SettingsSidebarProps {
  currentSetting: string;
  onSettingSelect: (settingId: string) => void;
  onCategorySelect: (categoryId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: SettingItem[];
  isMobile?: boolean;
}

function SettingsSidebar({ 
  currentSetting, 
  onSettingSelect, 
  onCategorySelect,
  searchQuery, 
  onSearchChange, 
  searchResults,
  isMobile = false 
}: SettingsSidebarProps) {
  return (
    <div className="space-y-4 p-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search settings..." 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Search Results */}
      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-3">
              <h3 className="text-sm font-medium mb-2">Search Results</h3>
              <div className="space-y-1">
                {searchResults.map((setting) => {
                  const Icon = setting.icon;
                  return (
                    <Button
                      key={setting.id}
                      variant="ghost"
                      className="w-full justify-start h-auto p-2"
                      onClick={() => onSettingSelect(setting.id)}
                    >
                      <Icon className="h-4 w-4 mr-2 shrink-0" />
                      <div className="text-left">
                        <div className="text-sm font-medium">{setting.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {setting.description}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overview */}
      {!searchQuery && (
        <Button
          variant={currentSetting === 'overview' ? 'default' : 'ghost'}
          className="w-full justify-start h-auto p-3"
          onClick={() => onSettingSelect('overview')}
        >
          <div className="text-left">
            <div className="font-medium">Overview</div>
            <div className="text-xs text-muted-foreground">
              Quick settings summary
            </div>
          </div>
        </Button>
      )}

      {!searchQuery && <Separator />}

      {/* Categories and Settings */}
      {!searchQuery && Object.values(settingsConfig).map((category) => {
        const CategoryIcon = category.icon;
        const hasActiveSetting = category.settings.some(setting => setting.id === currentSetting);
        
        return (
          <motion.div 
            key={category.id} 
            className="space-y-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Category Header */}
            <Button
              variant="ghost"
              className="w-full justify-start p-2 h-auto text-xs font-semibold text-muted-foreground hover:text-foreground"
              onClick={() => onCategorySelect(category.id)}
            >
              <CategoryIcon className="h-4 w-4 mr-2" />
              <span className="uppercase tracking-wider">{category.title}</span>
            </Button>

            {/* Category Settings */}
            <div className="ml-2 space-y-1">
              {category.settings.map((setting) => {
                const SettingIcon = setting.icon;
                const isActive = currentSetting === setting.id;
                
                return (
                  <Button
                    key={setting.id}
                    variant={isActive ? 'default' : 'ghost'}
                    className={cn(
                      "w-full justify-start h-auto p-3 relative",
                      isActive && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => onSettingSelect(setting.id)}
                  >
                    <SettingIcon className="h-4 w-4 mr-3 shrink-0" />
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{setting.label}</span>
                        {setting.badge && (
                          <Badge 
                            variant={isActive ? "secondary" : "default"} 
                            className="ml-2 text-xs"
                          >
                            {setting.badge}
                          </Badge>
                        )}
                      </div>
                      <div className={cn(
                        "text-xs",
                        isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {setting.description}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
