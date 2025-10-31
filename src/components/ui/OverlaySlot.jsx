import React from 'react';
import './neon-ui.css';

/*
  Centers children absolutely over a background (e.g., SVG). Width/height can be
  controlled via props for responsive slots like video or scroll panels.
*/
const OverlaySlot = ({ style = {}, className = '', children }) => {
  return (
    <div className={`neon-overlay-slot ${className}`} style={style}>
      {children}
    </div>
  );
};

export default OverlaySlot;


