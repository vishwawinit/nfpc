export const getResponsiveStyles = () => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return {
    // Grid layouts
    gridCols: (desktop: string, mobile: string) => ({
      gridTemplateColumns: isMobile ? mobile : desktop
    }),

    // Flex direction
    flexDirection: (desktop: any, mobile: any) => ({
      flexDirection: isMobile ? mobile : desktop
    }),

    // Gap spacing
    gap: (desktop: string, mobile: string) => ({
      gap: isMobile ? mobile : desktop
    }),

    // Padding
    padding: (desktop: string, mobile: string) => ({
      padding: isMobile ? mobile : desktop
    }),

    // Font sizes
    fontSize: (desktop: string, mobile: string) => ({
      fontSize: isMobile ? mobile : desktop
    }),

    // Display
    display: (desktop: string, mobile: string) => ({
      display: isMobile ? mobile : desktop
    }),

    // Width
    width: (desktop: string, mobile: string) => ({
      width: isMobile ? mobile : desktop
    }),

    // Height
    height: (desktop: string | number, mobile: string | number) => ({
      height: isMobile ? mobile : desktop
    }),

    // Margin
    margin: (desktop: string, mobile: string) => ({
      margin: isMobile ? mobile : desktop
    }),

    // Custom style object
    custom: (desktop: any, mobile: any) => {
      return isMobile ? mobile : desktop;
    }
  };
};

// Hook to detect mobile
export const useIsMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768;
};