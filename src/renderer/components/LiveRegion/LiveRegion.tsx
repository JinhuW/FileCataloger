import React, { useEffect, useState } from 'react';

export interface LiveRegionProps {
  message: string;
  politeness?: 'polite' | 'assertive';
  clearDelay?: number;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  politeness = 'polite',
  clearDelay = 1000,
}) => {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    setAnnouncement(message);

    if (message && clearDelay > 0) {
      const timer = setTimeout(() => {
        setAnnouncement('');
      }, clearDelay);

      return () => clearTimeout(timer);
    }
  }, [message, clearDelay]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      {announcement}
    </div>
  );
};

// Hook for using live regions
export const useLiveRegion = (initialMessage = '') => {
  const [message, setMessage] = useState(initialMessage);

  const announce = (newMessage: string) => {
    setMessage('');
    setTimeout(() => setMessage(newMessage), 100);
  };

  return {
    message,
    announce,
  };
};
