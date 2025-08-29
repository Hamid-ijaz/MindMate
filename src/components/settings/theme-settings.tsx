"use client";

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemePicker } from '@/components/theme-picker';
import { Palette } from 'lucide-react';

export function ThemeSettings() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Color Theme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Theme Selector</p>
              <p className="text-xs text-muted-foreground">
                Choose your preferred theme
              </p>
            </div>
            <ThemePicker />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}