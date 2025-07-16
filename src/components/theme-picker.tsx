
"use client"

import * as React from "react"
import { Moon, Sun, Palette } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

const themes = [
  { name: 'Default', value: 'theme-default' },
  { name: 'Ocean', value: 'theme-ocean' },
  { name: 'Forest', value: 'theme-forest' },
  { name: 'Sunset', value: 'theme-sunset' },
]

export function ThemePicker() {
  const { mode, setMode, theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setMode("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("system")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
         <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Palette className="mr-2 h-4 w-4" />
              <span>Theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {themes.map((t) => (
                    <DropdownMenuItem key={t.value} onClick={() => setTheme(t.value)}>
                        <div className="w-4 h-4 rounded-full mr-2" style={{
                            backgroundColor: t.value === 'theme-default' ? 'hsl(var(--primary))' :
                                             t.value === 'theme-ocean' ? 'hsl(205 90% 45%)' :
                                             t.value === 'theme-forest' ? 'hsl(140 60% 35%)' :
                                             'hsl(25 95% 55%)'
                        }}></div>
                        <span>{t.name}</span>
                    </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
