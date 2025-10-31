import React from 'react';
import './neon-ui.css';

const ScrollPanel = ({ width = '70%', maxWidth = 800, height = '60%', maxHeight = 500, children, className = '' }) => {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
    height: typeof height === 'number' ? `${height}px` : height,
    maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
  };
  return (
    <div className={`neon-scroll-panel ${className}`} style={style}>
      {children}
    </div>
  );
};

export default ScrollPanel;


