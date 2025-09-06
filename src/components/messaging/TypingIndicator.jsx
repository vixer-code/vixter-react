import React from 'react';
import './TypingIndicator.css';

const TypingIndicator = ({ typingUsers = [] }) => {
  if (!typingUsers.length) return null;

  const formatTypingMessage = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].name} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
    } else {
      return `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing...`;
    }
  };

  return (
    <div className="typing-indicator">
      <div className="typing-indicator-content">
        <div className="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span className="typing-text">{formatTypingMessage()}</span>
      </div>
    </div>
  );
};

export default TypingIndicator;
