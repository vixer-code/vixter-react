import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const Portal = ({ children, containerId = 'portal-root' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    // Create or get the portal container
    let container = document.getElementById(containerId);
    
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);
    }
    
    containerRef.current = container;
    
    // Cleanup function
    return () => {
      // Only remove if it's empty and we created it
      if (container && container.children.length === 0 && container.id === containerId) {
        document.body.removeChild(container);
      }
    };
  }, [containerId]);

  // Don't render until we have a container
  if (!containerRef.current) {
    return null;
  }

  return createPortal(children, containerRef.current);
};

export default Portal;
