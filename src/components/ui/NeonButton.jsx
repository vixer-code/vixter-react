import React from 'react';
import './neon-ui.css';

const NeonButton = ({ children, className = '', ...props }) => {
  return (
    <button className={`neon-button ${className}`} {...props}>
      {children}
    </button>
  );
};

export default NeonButton;


