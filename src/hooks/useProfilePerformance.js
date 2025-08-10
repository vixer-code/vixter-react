import { useCallback, useRef, useEffect, useMemo } from 'react';

/**
 * Custom hook to optimize profile performance and reduce INP issues
 */
export const useProfilePerformance = () => {
  const performanceRef = useRef({
    tabSwitchStart: 0,
    lastInteraction: 0,
    interactionCount: 0,
    tabSwitchTimes: [],
    averageTabSwitchTime: 0
  });

  const debounceRef = useRef(null);
  const intersectionObserverRef = useRef(null);

  // Debounced function to prevent rapid successive calls
  const debounce = useCallback((func, delay) => {
    return (...args) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => func(...args), delay);
    };
  }, []);

  // Performance monitoring for tab switches with detailed metrics
  const measureTabSwitch = useCallback((tabName) => {
    const start = performance.now();
    performanceRef.current.tabSwitchStart = start;
    
    // Use requestAnimationFrame to measure the next paint
    requestAnimationFrame(() => {
      const end = performance.now();
      const duration = end - start;
      
      // Store tab switch times for performance analysis
      performanceRef.current.tabSwitchTimes.push(duration);
      
      // Keep only last 10 measurements to prevent memory issues
      if (performanceRef.current.tabSwitchTimes.length > 10) {
        performanceRef.current.tabSwitchTimes.shift();
      }
      
      // Calculate average tab switch time
      const sum = performanceRef.current.tabSwitchTimes.reduce((a, b) => a + b, 0);
      performanceRef.current.averageTabSwitchTime = sum / performanceRef.current.tabSwitchTimes.length;
      
      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Tab switch to "${tabName}" took ${duration.toFixed(2)}ms`);
        console.log(`Average tab switch time: ${performanceRef.current.averageTabSwitchTime.toFixed(2)}ms`);
        
        // Warn if tab switch is too slow
        if (duration > 16.67) { // 60fps threshold
          console.warn(`Tab switch performance warning: ${duration.toFixed(2)}ms (target: <16.67ms)`);
        }
        
        // Critical performance warning
        if (duration > 50) {
          console.error(`Critical tab switch performance issue: ${duration.toFixed(2)}ms`);
        }
      }
    });
  }, []);

  // Optimized tab click handler with performance monitoring and throttling
  const createOptimizedTabHandler = useCallback((setActiveTab) => {
    let lastClickTime = 0;
    const throttleDelay = 100; // 100ms throttle for better performance
    
    return (tabName) => {
      const now = performance.now();
      
      // Throttle rapid clicks to prevent performance issues
      if (now - lastClickTime < throttleDelay) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Tab click throttled for performance');
        }
        return;
      }
      
      lastClickTime = now;
      
      if (tabName) {
        measureTabSwitch(tabName);
        setActiveTab(tabName);
      }
    };
  }, [measureTabSwitch]);

  // Track interaction performance with detailed metrics
  const trackInteraction = useCallback(() => {
    const now = performance.now();
    performanceRef.current.lastInteraction = now;
    performanceRef.current.interactionCount++;
    
    // Monitor for performance issues
    if (performanceRef.current.interactionCount > 100) {
      // Reset counter to prevent memory issues
      performanceRef.current.interactionCount = 0;
    }
    
    // Log interaction performance in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Interaction tracked: ${performanceRef.current.interactionCount} total interactions`);
    }
  }, []);

  // Enhanced intersection observer for lazy loading
  const createIntersectionObserver = useCallback((callback, options = {}) => {
    if (!('IntersectionObserver' in window)) {
      return null;
    }

    const defaultOptions = {
      root: null,
      rootMargin: '50px',
      threshold: 0.1,
      ...options
    };

    return new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry);
        }
      });
    }, defaultOptions);
  }, []);

  // Memoized performance metrics
  const performanceMetrics = useMemo(() => ({
    lastInteraction: performanceRef.current.lastInteraction,
    interactionCount: performanceRef.current.interactionCount,
    tabSwitchStart: performanceRef.current.tabSwitchStart,
    averageTabSwitchTime: performanceRef.current.averageTabSwitchTime,
    tabSwitchCount: performanceRef.current.tabSwitchTimes.length
  }), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect();
      }
    };
  }, []);

  // Performance optimization utilities
  const optimizeImageLoading = useCallback((imageElement) => {
    if (imageElement && 'loading' in HTMLImageElement.prototype) {
      imageElement.loading = 'lazy';
    }
    
    // Use enhanced Intersection Observer for better performance
    const observer = createIntersectionObserver((entry) => {
      const img = entry.target;
      if (img.dataset.src) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
    
    if (observer) {
      observer.observe(imageElement);
      return () => observer.unobserve(imageElement);
    }
  }, [createIntersectionObserver]);

  // Optimize DOM updates with better batching
  const batchDOMUpdates = useCallback((updates) => {
    // Use requestAnimationFrame to batch DOM updates
    requestAnimationFrame(() => {
      updates.forEach(update => {
        if (typeof update === 'function') {
          try {
            update();
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Error in batched DOM update:', error);
            }
          }
        }
      });
    });
  }, []);

  // Preload critical resources with priority hints
  const preloadCriticalResources = useCallback(() => {
    // Preload critical CSS and images with priority hints
    const criticalResources = [
      // Add paths to critical resources here
    ];
    
    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource;
      link.as = resource.endsWith('.css') ? 'style' : 'image';
      
      // Add priority hints for better performance
      if (resource.includes('critical')) {
        link.setAttribute('importance', 'high');
      }
      
      document.head.appendChild(link);
    });
  }, []);

  // Monitor scroll performance with passive listeners
  const optimizeScrollPerformance = useCallback((element) => {
    if (!element) return;
    
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // Handle scroll updates here
          ticking = false;
        });
        ticking = true;
      }
    };
    
    // Use passive listeners for better scroll performance
    element.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Reduce layout thrashing with transform optimizations
  const preventLayoutThrashing = useCallback((element) => {
    if (!element) return;
    
    // Use transform instead of changing layout properties
    const originalStyle = element.style.cssText;
    
    return {
      updateTransform: (x, y) => {
        // Use transform3d for hardware acceleration
        element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      },
      reset: () => {
        element.style.cssText = originalStyle;
      }
    };
  }, []);

  // Monitor and optimize tab content rendering
  const optimizeTabContentRendering = useCallback((tabContent) => {
    if (!tabContent) return;
    
    // Use requestIdleCallback for non-critical optimizations
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // Optimize images and other non-critical elements
        const images = tabContent.querySelectorAll('img[data-src]');
        images.forEach(img => optimizeImageLoading(img));
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        const images = tabContent.querySelectorAll('img[data-src]');
        images.forEach(img => optimizeImageLoading(img));
      }, 100);
    }
  }, [optimizeImageLoading]);

  return {
    createOptimizedTabHandler,
    trackInteraction,
    performanceMetrics,
    optimizeImageLoading,
    batchDOMUpdates,
    preloadCriticalResources,
    optimizeScrollPerformance,
    preventLayoutThrashing,
    optimizeTabContentRendering,
    createIntersectionObserver,
    debounce
  };
};

export default useProfilePerformance;
