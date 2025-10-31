import React from 'react';
import './neon-ui.css';

const NeonModal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="neon-overlay" onClick={onClose}>
      <div className="neon-surface" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

export default NeonModal;


