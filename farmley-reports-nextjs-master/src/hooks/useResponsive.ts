'use client'

import { useState, useEffect } from 'react';

// Synchronously check if we're on mobile - works on first render
function checkIsMobile(): boolean {
  if (typeof window === 'undefined') return false;

  // Use matchMedia for instant, accurate detection
  if (window.matchMedia) {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  // Fallback to window.innerWidth
  return window.innerWidth <= 768;
}

function checkIsTablet(): boolean {
  if (typeof window === 'undefined') return false;

  if (window.matchMedia) {
    return window.matchMedia('(min-width: 769px) and (max-width: 1024px)').matches;
  }

  const width = window.innerWidth;
  return width > 768 && width <= 1024;
}

export const useResponsive = () => {
  // Use lazy initialization to get correct value immediately on client
  const [isMobile, setIsMobile] = useState(() => {
    // During SSR, return false to match server render
    if (typeof window === 'undefined') return false;
    // On client, immediately check actual screen size
    return checkIsMobile();
  });

  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === 'undefined') return false;
    return checkIsTablet();
  });

  useEffect(() => {
    // Double-check on mount in case lazy init didn't run
    setIsMobile(checkIsMobile());
    setIsTablet(checkIsTablet());

    // Listen for resize events
    const handleResize = () => {
      setIsMobile(checkIsMobile());
      setIsTablet(checkIsTablet());
    };

    window.addEventListener('resize', handleResize);

    // Also listen to matchMedia changes for more responsive behavior
    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const tabletQuery = window.matchMedia('(min-width: 769px) and (max-width: 1024px)');

    const handleMobileChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const handleTabletChange = (e: MediaQueryListEvent) => setIsTablet(e.matches);

    // Modern browsers
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', handleMobileChange);
      tabletQuery.addEventListener('change', handleTabletChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mobileQuery.removeEventListener) {
        mobileQuery.removeEventListener('change', handleMobileChange);
        tabletQuery.removeEventListener('change', handleTabletChange);
      }
    };
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    styles: {
      // Conditionally apply mobile or desktop styles
      conditional: (desktop: any, mobile: any) => isMobile ? mobile : desktop,

      // Common responsive patterns
      gridCols: (desktop: string, mobile: string) => ({
        gridTemplateColumns: isMobile ? mobile : desktop
      }),

      flexDirection: (desktop: 'row' | 'column', mobile: 'row' | 'column') => ({
        flexDirection: isMobile ? mobile : desktop
      }),

      padding: (desktop: string, mobile: string) => ({
        padding: isMobile ? mobile : desktop
      }),

      fontSize: (desktop: string, mobile: string) => ({
        fontSize: isMobile ? mobile : desktop
      }),

      gap: (desktop: string, mobile: string) => ({
        gap: isMobile ? mobile : desktop
      }),

      display: (desktop: string, mobile: string) => ({
        display: isMobile ? mobile : desktop
      }),

      overflow: (desktop: string, mobile: string) => ({
        overflowX: isMobile ? mobile : desktop
      }),

      width: (desktop: string | number, mobile: string | number) => ({
        width: isMobile ? mobile : desktop
      }),

      height: (desktop: string | number, mobile: string | number) => ({
        height: isMobile ? mobile : desktop
      }),

      margin: (desktop: string, mobile: string) => ({
        margin: isMobile ? mobile : desktop
      }),

      maxWidth: (desktop: string, mobile: string) => ({
        maxWidth: isMobile ? mobile : desktop
      }),

      minHeight: (desktop: string, mobile: string) => ({
        minHeight: isMobile ? mobile : desktop
      }),

      // Helper for responsive grid layouts
      gridTemplate: (desktopCols: number, mobileCols: number = 1) => ({
        display: 'grid',
        gridTemplateColumns: `repeat(${isMobile ? mobileCols : desktopCols}, minmax(0, 1fr))`,
        gap: isMobile ? '12px' : '20px'
      }),

      // Helper for responsive flex containers
      flexContainer: (desktopDirection: 'row' | 'column' = 'row') => ({
        display: 'flex',
        flexDirection: isMobile ? 'column' : desktopDirection,
        gap: isMobile ? '12px' : '16px'
      }),

      // Helper for card layouts
      cardPadding: () => ({
        padding: isMobile ? '12px' : '20px'
      }),

      // Helper for text sizing
      heading: (desktopSize: string, mobileSize?: string) => ({
        fontSize: isMobile ? (mobileSize || '18px') : desktopSize,
        fontWeight: '600'
      }),

      text: (desktopSize: string, mobileSize?: string) => ({
        fontSize: isMobile ? (mobileSize || '14px') : desktopSize
      })
    }
  };
};