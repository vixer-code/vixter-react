import React from 'react';
import './PurpleSpinner.css';

const PurpleSpinner = ({ size = 'medium', text = null, className = '' }) => {
  const sizeClass = size === 'small' ? 'small' : size === 'large' ? 'large' : 'medium';
  
  return (
    <div className={`purple-spinner-container ${className}`}>
      <div className={`purple-spinner ${sizeClass}`}>
        <div className="spinner-dot dot-1"></div>
        <div className="spinner-dot dot-2"></div>
        <div className="spinner-dot dot-3"></div>
        <div className="spinner-dot dot-4"></div>
        <div className="spinner-dot dot-5"></div>
        <div className="spinner-dot dot-6"></div>
        <div className="spinner-dot dot-7"></div>
        <div className="spinner-dot dot-8"></div>
      </div>
      {text && <div className="spinner-text">{text}</div>}
    </div>
  );
};

export default PurpleSpinner;
