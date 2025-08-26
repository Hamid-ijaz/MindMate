"use client";

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PWASettings as PWASettingsComponent } from '@/components/pwa-settings';
import { Smartphone } from 'lucide-react';

export function PWASettings() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            App Installation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PWASettingsComponent />
        </CardContent>
      </Card>
    </motion.div>
  );
}