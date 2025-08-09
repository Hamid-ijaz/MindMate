"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface MobileSettingsNavProps {
  selectedView: string;
  onSettingSelect: (settingId: string) => void;
  settings: any;
}

export function MobileSettingsNav({ selectedView, onSettingSelect, settings }: MobileSettingsNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSettingClick = (settingId: string) => {
    onSettingSelect(settingId);
    setIsOpen(false);
  };

  return (
    <div className="lg:hidden mb-6">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-full">
            <Menu className="h-4 w-4 mr-2" />
            Settings Navigation
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Menu className="h-5 w-5 text-blue-600" />
              </div>
              <span>Settings</span>
            </SheetTitle>
          </SheetHeader>
          
          <div className="px-6 pb-6 space-y-2">
            {/* Overview Button */}
            <Button
              variant={selectedView === 'overview' ? 'default' : 'ghost'}
              className="w-full justify-start h-auto p-3"
              onClick={() => handleSettingClick('overview')}
            >
              <div className="text-left">
                <div className="font-medium">Overview</div>
                <div className="text-xs text-muted-foreground">
                  Quick settings summary
                </div>
              </div>
            </Button>

            <Separator className="my-4" />

            {/* Category Sections */}
            {Object.entries(settings).map(([key, category]: [string, any]) => (
              <div key={key} className="space-y-1">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {category.title}
                </div>
                {category.settings.map((setting: any) => {
                  const SettingIcon = setting.icon;
                  const isActive = selectedView === setting.id;
                  return (
                    <Button
                      key={setting.id}
                      variant={isActive ? 'default' : 'ghost'}
                      className="w-full justify-start h-auto p-3"
                      onClick={() => handleSettingClick(setting.id)}
                    >
                      <SettingIcon className="h-4 w-4 mr-3" />
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{setting.label}</span>
                          {setting.badge && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {setting.badge}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {setting.description}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
