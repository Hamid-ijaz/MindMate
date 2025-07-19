import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { useEffect, useState } from 'react';

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get the current theme color based on the selected theme
  const getThemeColor = () => {
    if (!mounted) return 'text-primary'; // Default fallback
    
    switch (theme) {
      case 'theme-ocean':
        return 'text-blue-600 dark:text-blue-400';
      case 'theme-forest':
        return 'text-green-600 dark:text-green-400';
      case 'theme-sunset':
        return 'text-orange-600 dark:text-orange-400';
      default: // theme-default
        return 'text-primary';
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Brain Circuit Icon */}
      <svg 
        className={cn("h-6 w-6 transition-colors duration-200", getThemeColor())}
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        suppressHydrationWarning
      >
        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
        <path d="M9 13a4.5 4.5 0 0 0 3-4"/>
        <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
        <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
        <path d="M6 18a4 4 0 0 1-1.967-.516"/>
        <path d="M12 13h4"/>
        <path d="M12 18h6a2 2 0 0 1 2 2v1"/>
        <path d="M12 8h8"/>
        <path d="M16 8V5a2 2 0 0 1 2-2"/>
        <circle cx="16" cy="13" r=".5"/>
        <circle cx="18" cy="3" r=".5"/>
        <circle cx="20" cy="21" r=".5"/>
        <circle cx="20" cy="8" r=".5"/>
      </svg>
      <span className="text-xl font-bold tracking-tight">MindMate</span>
    </div>
  );
}
