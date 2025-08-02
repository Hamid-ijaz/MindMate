"use client"

import * as React from "react"
import { Moon, Sun, Monitor, Palette } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const themes = [
  { name: 'Default', value: 'theme-default', color: 'hsl(var(--primary))' },
  { name: 'Ocean', value: 'theme-ocean', color: 'hsl(205 90% 45%)' },
  { name: 'Forest', value: 'theme-forest', color: 'hsl(140 60% 35%)' },
  { name: 'Sunset', value: 'theme-sunset', color: 'hsl(25 95% 55%)' },
]

const modes = [
  { name: 'Light', value: 'light', icon: Sun },
  { name: 'Dark', value: 'dark', icon: Moon },
  { name: 'System', value: 'system', icon: Monitor },
]

interface ThemePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ThemePickerDialog({ open, onOpenChange }: ThemePickerDialogProps) {
  const { mode, setMode, theme, setTheme } = useTheme()

  const handleModeChange = (newMode: string) => {
    setMode(newMode as any)
    onOpenChange(false)
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme & Appearance
          </DialogTitle>
          <DialogDescription>
            Choose your preferred theme mode and color scheme.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Mode Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Theme Mode</h4>
            <div className="grid grid-cols-3 gap-2">
              {modes.map((modeOption) => {
                const Icon = modeOption.icon
                return (
                  <Button
                    key={modeOption.value}
                    variant={mode === modeOption.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleModeChange(modeOption.value)}
                    className="flex flex-col gap-1 h-auto py-3"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{modeOption.name}</span>
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Theme Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Color Theme</h4>
            <div className="grid grid-cols-2 gap-2">
              {themes.map((themeOption) => (
                <Button
                  key={themeOption.value}
                  variant={theme === themeOption.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemeChange(themeOption.value)}
                  className="flex items-center justify-start gap-2 h-auto py-3"
                >
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: themeOption.color }}
                  />
                  <span className="text-xs">{themeOption.name}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
