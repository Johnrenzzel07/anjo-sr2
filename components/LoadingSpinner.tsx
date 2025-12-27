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
  const [NewtonsCradle, setNewtonsCradle] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Dynamically import to avoid SSR issues
      import('ldrs/react').then((ldrs) => {
        // Check if register method exists
        if (ldrs.NewtonsCradle && typeof ldrs.NewtonsCradle.register === 'function') {
          ldrs.NewtonsCradle.register();
        }
        setNewtonsCradle(() => ldrs.NewtonsCradle);
      });
      
      // Import CSS
      import('ldrs/react/NewtonsCradle.css');
    }
  }, []);

  if (!NewtonsCradle) {
    // Fallback spinner while loading
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <NewtonsCradle
        size={size}
        speed={speed}
        color={color}
      />
    </div>
  );
}

