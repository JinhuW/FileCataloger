import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusableList } from '@renderer/hooks/useKeyboardNavigation';

export interface ScrollableTabContainerProps {
  children: React.ReactNode;
  className?: string;
  onScroll?: (direction: 'left' | 'right') => void;
}

export const ScrollableTabContainer = React.memo<ScrollableTabContainerProps>(
  ({ children, className, onScroll }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

    const checkScrollButtons = useCallback(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setShowLeftArrow(scrollLeft > 0);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
      }
    }, []);

    useEffect(() => {
      checkScrollButtons();
      window.addEventListener('resize', checkScrollButtons);
      return () => window.removeEventListener('resize', checkScrollButtons);
    }, [checkScrollButtons]);

    const handleScroll = useCallback(
      (direction: 'left' | 'right') => {
        if (scrollRef.current) {
          const scrollAmount = 200;
          const currentScroll = scrollRef.current.scrollLeft;
          const newScroll =
            direction === 'left'
              ? Math.max(0, currentScroll - scrollAmount)
              : currentScroll + scrollAmount;

          scrollRef.current.scrollTo({
            left: newScroll,
            behavior: 'smooth',
          });

          onScroll?.(direction);
        }
      },
      [onScroll]
    );

    const childCount = React.Children.count(children);
    const { containerRef, handleKeyNavigation } = useFocusableList<HTMLDivElement>(childCount, {
      orientation: 'horizontal',
      loop: true,
    });

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        // Let the focus navigation handle arrow keys
        handleKeyNavigation(e);

        // Handle page-level scrolling
        if (e.key === 'PageUp') {
          handleScroll('left');
        } else if (e.key === 'PageDown') {
          handleScroll('right');
        }
      },
      [handleKeyNavigation, handleScroll]
    );

    return (
      <div
        className={className}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <AnimatePresence>
          {showLeftArrow && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => handleScroll('left')}
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                background: 'rgba(30, 30, 30, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                padding: '6px',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '14px',
                backdropFilter: 'blur(10px)',
                width: '24px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Scroll tabs left"
            >
              ‹
            </motion.button>
          )}
        </AnimatePresence>

        <div
          ref={el => {
            scrollRef.current = el;
            (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }}
          className="scrollable-tab-container-inner"
          role="tablist"
          aria-label="Pattern tabs"
          style={
            {
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollBehavior: 'smooth',
              flex: 1,
              paddingLeft: showLeftArrow ? '28px' : '0',
              paddingRight: showRightArrow ? '28px' : '0',
              transition: 'padding 0.2s',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitScrollbar: { display: 'none' },
            } as React.CSSProperties
          }
          onScroll={checkScrollButtons}
        >
          {children}
        </div>

        <AnimatePresence>
          {showRightArrow && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => handleScroll('right')}
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                background: 'rgba(30, 30, 30, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                padding: '6px',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '14px',
                backdropFilter: 'blur(10px)',
                width: '24px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Scroll tabs right"
            >
              ›
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

ScrollableTabContainer.displayName = 'ScrollableTabContainer';
