'use client';

import { useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  size?: string;
  speed?: string;
  color?: string;
  className?: string;
}

export default function LoadingSpinner({ 
  size = '78', 
  speed = '1.4', 
  color = 'black',
  className = ''
}: LoadingSpinnerProps) {
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Dynamically import to avoid SSR issues
      import('ldrs').then((ldrs) => {
        ldrs.newtonsCradle.register();
        setIsRegistered(true);
      });
    }
  }, []);

  if (!isRegistered) {
    // Fallback spinner while loading
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <l-newtons-cradle
        size={size}
        speed={speed}
        color={color}
      />
    </div>
  );
}

