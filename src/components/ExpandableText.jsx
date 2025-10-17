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
  
  if (!text) {
    return null;
  }
  
  // Normalizar o texto removendo espaços em branco excessivos
  const normalizeText = (str) => {
    return str
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduz múltiplas quebras de linha para máximo 2
      .replace(/[ \t]+/g, ' ') // Reduz múltiplos espaços/tabs para 1 espaço
      .trim(); // Remove espaços do início e fim
  };
  
  const normalizedText = normalizeText(text);
  
  // Se o texto normalizado é menor que o limite, não precisa de expansão
  if (normalizedText.length <= maxLength) {
    return <p className={`expandable-text ${className}`}>{text}</p>;
  }
  
  // Para truncar, vamos procurar um ponto de quebra natural próximo ao limite
  const findBreakPoint = (str, maxLen) => {
    // Se o texto é menor que o limite, retorna tudo
    if (str.length <= maxLen) return str.length;
    
    // Procura por pontos de quebra naturais (espaços, pontuação, quebras de linha)
    const breakPoints = [];
    for (let i = maxLen; i >= Math.max(0, maxLen - 50); i--) {
      const char = str[i];
      if (char === ' ' || char === '\n' || char === '.' || char === '!' || char === '?' || char === ',') {
        breakPoints.push(i + 1);
      }
    }
    
    // Se encontrou um ponto de quebra, usa o mais próximo ao limite
    if (breakPoints.length > 0) {
      return breakPoints[breakPoints.length - 1];
    }
    
    // Caso contrário, trunca no limite
    return maxLen;
  };
  
  const breakPoint = findBreakPoint(normalizedText, maxLength);
  const truncatedText = normalizedText.substring(0, breakPoint);
  const displayText = isExpanded ? text : truncatedText;
  const needsExpansion = normalizedText.length > maxLength;
  
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
