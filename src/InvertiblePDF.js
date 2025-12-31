import React, { useRef, useEffect } from 'react';
import PDF from 'react-pdf-js';
import { useTheme } from './ThemeContext';

const InvertiblePDF = ({ file, onDocumentComplete, onPageComplete, page, scale, style, ...props }) => {
  const { isDarkMode } = useTheme();
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const applyInversion = () => {
      // Apply inversion to all canvas elements within the container
      const canvases = container.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        if (isDarkMode) {
          canvas.style.filter = 'invert(1) hue-rotate(180deg)';
          canvas.style.backgroundColor = 'white';
        } else {
          canvas.style.filter = 'none';
          canvas.style.backgroundColor = 'transparent';
        }
      });

      // Also apply to any direct image elements
      const images = container.querySelectorAll('img');
      images.forEach(img => {
        if (isDarkMode) {
          img.style.filter = 'invert(1) hue-rotate(180deg)';
        } else {
          img.style.filter = 'none';
        }
      });
    };

    // Apply inversion immediately
    applyInversion();

    // Set up a MutationObserver to apply inversion when new elements are added
    const observer = new MutationObserver((mutations) => {
      let shouldApply = false;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'CANVAS' || node.tagName === 'IMG' || 
                (node.querySelector && (node.querySelector('canvas') || node.querySelector('img')))) {
              shouldApply = true;
            }
          }
        });
      });
      if (shouldApply) {
        setTimeout(applyInversion, 100);
      }
    });

    observer.observe(container, { 
      childList: true, 
      subtree: true 
    });

    return () => observer.disconnect();
  }, [isDarkMode]);

  const handleDocumentComplete = (pages) => {
    // Small delay to ensure canvas is rendered
    setTimeout(() => {
      const container = containerRef.current;
      if (container && isDarkMode) {
        const canvases = container.querySelectorAll('canvas');
        canvases.forEach(canvas => {
          canvas.style.filter = 'invert(1) hue-rotate(180deg)';
          canvas.style.backgroundColor = 'white';
        });
      }
    }, 100);
    
    if (onDocumentComplete) {
      onDocumentComplete(pages);
    }
  };

  const handlePageComplete = (pageNum) => {
    // Small delay to ensure canvas is rendered
    setTimeout(() => {
      const container = containerRef.current;
      if (container && isDarkMode) {
        const canvases = container.querySelectorAll('canvas');
        canvases.forEach(canvas => {
          canvas.style.filter = 'invert(1) hue-rotate(180deg)';
          canvas.style.backgroundColor = 'white';
        });
      }
    }, 100);
    
    if (onPageComplete) {
      onPageComplete(pageNum);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="invertible-pdf-container"
      style={{
        backgroundColor: isDarkMode ? '#1a1a1a' : 'transparent',
      }}
    >
      <PDF
        file={file}
        onDocumentComplete={handleDocumentComplete}
        onPageComplete={handlePageComplete}
        page={page}
        scale={scale}
        style={style}
        {...props}
      />
    </div>
  );
};

export default InvertiblePDF;