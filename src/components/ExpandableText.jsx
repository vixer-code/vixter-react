import React, { useState, useRef, useEffect } from 'react';
import './ExpandableText.css';

const ExpandableText = ({
  text,
  maxLines = 3,
  className = '',
  showMoreText = 'Ver mais',
  showLessText = 'Ver menos'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpansion, setNeedsExpansion] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    if (textRef.current && text) {
      const { scrollHeight, clientHeight } = textRef.current;
      setNeedsExpansion(scrollHeight > clientHeight + 5);
    }
  }, [text]);

  if (!text) {
    return null;
  }
  
  return (
    <div className={`expandable-text ${className}`}>
      <p
        ref={textRef}
        className={`text-content ${isExpanded ? 'expanded' : ''}`}
        style={{
          display: '-webkit-box',
          WebkitLineClamp: isExpanded ? 'unset' : maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {text}
      </p>
      {needsExpansion && (
        <button
          className="expand-toggle-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          {isExpanded ? showLessText : showMoreText}
        </button>
      )}
    </div>
  );
};

export default ExpandableText;
