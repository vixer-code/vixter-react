import React, { useState } from 'react';
import './ExpandableText.css';

const ExpandableText = ({ 
  text, 
  maxLength = 200, 
  className = '', 
  showMoreText = 'Ver mais', 
  showLessText = 'Ver menos' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Se o texto é menor que o limite, não precisa de expansão
  if (!text || text.length <= maxLength) {
    return <p className={`expandable-text ${className}`}>{text}</p>;
  }
  
  const truncatedText = text.substring(0, maxLength);
  const displayText = isExpanded ? text : truncatedText;
  const needsExpansion = text.length > maxLength;
  
  return (
    <p className={`expandable-text ${className}`}>
      {displayText}
      {needsExpansion && (
        <>
          {!isExpanded && '... '}
          <button 
            className="expand-toggle-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            type="button"
          >
            {isExpanded ? showLessText : showMoreText}
          </button>
        </>
      )}
    </p>
  );
};

export default ExpandableText;
