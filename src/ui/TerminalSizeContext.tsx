import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useStdout } from 'ink';

export interface TerminalSize {
  columns: number;
  rows: number;
}

const TerminalSizeContext = createContext<TerminalSize>({ columns: 80, rows: 24 });

export const TerminalSizeProvider = ({ children }: { children: ReactNode }) => {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>({
    columns: stdout.columns,
    rows: stdout.rows,
  });

  useEffect(() => {
    const handler = () => setSize({ columns: stdout.columns, rows: stdout.rows });
    stdout.on('resize', handler);
    return () => { stdout.off('resize', handler); };
  }, [stdout]);

  return (
    <TerminalSizeContext.Provider value={size}>
      {children}
    </TerminalSizeContext.Provider>
  );
};

export const useTerminalSize = () => useContext(TerminalSizeContext);