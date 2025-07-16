
"use client"

import * as React from "react"

type Mode = "dark" | "light" | "system"
type Theme = string;

type ThemeProviderState = {
  mode: Mode
  setMode: (mode: Mode) => void
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  mode: "system",
  setMode: () => null,
  theme: "theme-default",
  setTheme: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

interface ThemeProviderProps {
  children: React.ReactNode
  defaultMode?: Mode
  defaultTheme?: Theme
  modeStorageKey?: string
  themeStorageKey?: string
  enableSystem?: boolean
  attribute?: string
}

const THEME_CLASSES = ['theme-default', 'theme-ocean', 'theme-forest', 'theme-sunset'];

export function ThemeProvider({
  children,
  defaultMode = "system",
  defaultTheme = "theme-default",
  modeStorageKey = "vite-ui-mode",
  themeStorageKey = "vite-ui-theme",
  enableSystem = true,
  ...props
}: ThemeProviderProps) {
  const [mode, setMode] = React.useState<Mode>(() => {
    if (typeof window === "undefined") return defaultMode;
    return (localStorage.getItem(modeStorageKey) as Mode) || defaultMode
  })

  const [theme, setTheme] = React.useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    return (localStorage.getItem(themeStorageKey) as Theme) || defaultTheme
  })

  React.useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    if (mode === "system") {
      const systemMode = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemMode)
    } else {
        root.classList.add(mode)
    }
    
  }, [mode])

  React.useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove all possible theme classes
    root.classList.remove(...THEME_CLASSES);

    if (theme) {
      root.classList.add(theme);
    }

  }, [theme]);

  const value = {
    mode,
    setMode: (newMode: Mode) => {
      localStorage.setItem(modeStorageKey, newMode)
      setMode(newMode)
    },
    theme,
    setTheme: (newTheme: Theme) => {
        localStorage.setItem(themeStorageKey, newTheme)
        setTheme(newTheme)
    }
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
