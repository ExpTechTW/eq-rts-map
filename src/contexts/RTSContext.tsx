'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { RTSWorkerManager } from '@/lib/rts-worker';
import { type ProcessedStationData } from '@/lib/rts';

interface RTSContextType {
  data: ProcessedStationData | null;
  isLoading: boolean;
  error: Error | null;
}

const RTSContext = createContext<RTSContextType | undefined>(undefined);

export function RTSProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<ProcessedStationData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const workerManagerRef = useRef<RTSWorkerManager | null>(null);

  useEffect(() => {
    workerManagerRef.current = new RTSWorkerManager();

    const fetchData = async () => {
      if (!workerManagerRef.current) return;

      try {
        const newData = await workerManagerRef.current.fetchAndProcessStationData();
        setData(newData);
        setError(null);
      } catch (err) {
        if (err instanceof Error && !err.message.includes('Data is older than existing data')) {
          setError(err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    
    const interval = setInterval(fetchData, 1000);

    return () => {
      clearInterval(interval);
      if (workerManagerRef.current) {
        workerManagerRef.current.destroy();
        workerManagerRef.current = null;
      }
    };
  }, []);

  return (
    <RTSContext.Provider value={{ data, isLoading, error }}>
      {children}
    </RTSContext.Provider>
  );
}

export function useRTS() {
  const context = useContext(RTSContext);
  if (context === undefined) {
    throw new Error('useRTS must be used within a RTSProvider');
  }
  return context;
}
