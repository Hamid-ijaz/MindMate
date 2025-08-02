"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  refreshThreshold?: number;
  maxPullDistance?: number;
  className?: string;
}

export function PullToRefresh({
  onRefresh,
  children,
  refreshThreshold = 80,
  maxPullDistance = 120,
  className = '',
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const pullStarted = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only start pull-to-refresh if we're at the top of the page
    if (window.scrollY === 0 && containerRef.current) {
      touchStartY.current = e.touches[0].clientY;
      pullStarted.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullStarted.current || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    if (deltaY > 0 && window.scrollY === 0) {
      // Prevent default scroll behavior
      e.preventDefault();
      
      // Calculate pull distance with elastic effect
      const distance = Math.min(deltaY * 0.5, maxPullDistance);
      setPullDistance(distance);
      setCanRefresh(distance >= refreshThreshold);
    }
  }, [isRefreshing, refreshThreshold, maxPullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullStarted.current || isRefreshing) return;

    pullStarted.current = false;

    if (canRefresh && pullDistance >= refreshThreshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    }

    setPullDistance(0);
    setCanRefresh(false);
  }, [canRefresh, pullDistance, refreshThreshold, onRefresh, isRefreshing]);

  // Auto-hide pull distance after refresh
  useEffect(() => {
    if (!isRefreshing && pullDistance > 0) {
      const timer = setTimeout(() => {
        setPullDistance(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isRefreshing, pullDistance]);

  const getRefreshIconRotation = () => {
    if (isRefreshing) return 360;
    return (pullDistance / refreshThreshold) * 180;
  };

  const getRefreshOpacity = () => {
    return Math.min(pullDistance / (refreshThreshold * 0.5), 1);
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isRefreshing || pullDistance === 0 ? 'transform 0.3s ease-out' : 'none',
      }}
    >
      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: getRefreshOpacity(),
              scale: canRefresh ? 1.1 : 1,
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full"
            style={{
              marginTop: `-${Math.min(pullDistance, 60)}px`,
            }}
          >
            <div className={`
              flex items-center justify-center w-12 h-12 rounded-full shadow-lg
              ${canRefresh ? 'bg-blue-500 text-white' : 'bg-background border-2 border-muted'}
              transition-colors duration-200
            `}>
              <RefreshCw 
                className={`h-5 w-5 transition-transform duration-200 ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
                style={{
                  transform: `rotate(${getRefreshIconRotation()}deg)`,
                }}
              />
            </div>
            
            {/* Status text */}
            <motion.div
              className="text-center mt-2 text-sm text-muted-foreground"
              animate={{ opacity: pullDistance > 30 ? 1 : 0 }}
            >
              {isRefreshing 
                ? 'Refreshing...' 
                : canRefresh 
                  ? 'Release to refresh' 
                  : 'Pull to refresh'
              }
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </div>
  );
}
