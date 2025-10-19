'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface ReactScanContextType {
  isEnabled: boolean;
  toggleReactScan: () => void;
}

const ReactScanContext = createContext<ReactScanContextType | undefined>(undefined);

declare global {
  interface Window {
    reactScanEnabled?: boolean;
  }
}

export function ReactScanProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(false);

  useEffect(() => {
    const checkDevtools = () => {
      const threshold = 160;
      
      const checkInterval = setInterval(() => {
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        
        if (widthThreshold || heightThreshold) {
          if (!window.reactScanEnabled) {
            console.log('🔧 DevTools detected - Type "window.reactScanEnabled = true" in console to enable React Scan');
          }
        }
      }, 500);

      return () => clearInterval(checkInterval);
    };

    const cleanup = checkDevtools();
    return cleanup;
  }, []);

  useEffect(() => {
    const checkReactScanMode = () => {
      if (window.reactScanEnabled && !isEnabled) {
        setIsEnabled(true);
        console.log('🔍 React Scan enabled!');
      } else if (!window.reactScanEnabled && isEnabled) {
        setIsEnabled(false);
        console.log('🔍 React Scan disabled');
      }
    };

    const interval = setInterval(checkReactScanMode, 100);
    return () => clearInterval(interval);
  }, [isEnabled]);

  useEffect(() => {
    if (isEnabled && !scriptLoaded) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/react-scan/dist/auto.global.js';
      script.async = true;
      script.onload = () => {
        setScriptLoaded(true);
        console.log('🔍 React Scan loaded');
      };
      script.onerror = () => {
        console.error('❌ Failed to load React Scan');
        setIsEnabled(false);
      };
      document.head.appendChild(script);
    } else if (!isEnabled && scriptLoaded) {
      const script = document.querySelector('script[src*="react-scan"]');
      if (script) {
        script.remove();
        setScriptLoaded(false);
        console.log('🔍 React Scan removed');
      }
    }
  }, [isEnabled, scriptLoaded]);

  const toggleReactScan = () => {
    setIsEnabled(prev => !prev);
    console.log(`🔍 React Scan ${!isEnabled ? 'enabled' : 'disabled'}`);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        window.reactScanEnabled = !window.reactScanEnabled;
        console.log(`🔍 React Scan ${window.reactScanEnabled ? 'enabled' : 'disabled'} via Ctrl+Shift+R`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ReactScanContext.Provider value={{ isEnabled, toggleReactScan }}>
      {children}
    </ReactScanContext.Provider>
  );
}

export function useReactScan() {
  const context = useContext(ReactScanContext);
  if (context === undefined) {
    throw new Error('useReactScan must be used within a ReactScanProvider');
  }
  return context;
}
