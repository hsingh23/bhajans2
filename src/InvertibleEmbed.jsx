import React, { useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';

const InvertibleEmbed = ({ src, style, ...props }) => {
  const { isDarkMode } = useTheme();
  const embedRef = useRef(null);

  useEffect(() => {
    const embed = embedRef.current;
    if (!embed) return;

    if (isDarkMode) {
      embed.style.filter = 'invert(1) hue-rotate(180deg)';
      embed.style.backgroundColor = 'white';
    } else {
      embed.style.filter = 'none';
      embed.style.backgroundColor = 'transparent';
    }
  }, [isDarkMode]);

  return (
    <div 
      style={{ 
        backgroundColor: isDarkMode ? '#1a1a1a' : 'transparent',
        ...style 
      }}
    >
      <embed
        ref={embedRef}
        src={src}
        style={{
          ...style,
          display: 'block',
        }}
        {...props}
      />
    </div>
  );
};

export default InvertibleEmbed;