import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useStdout } from 'ink';

export interface TerminalSize {
  columns: number;
  rows: number;
}

const TerminalSizeContext = createContext<TerminalSize>({ columns: 80, rows: 24 });

export const TerminalSizeProvider = ({ children }: { children: ReactNode }) => {
  const { stdout } = useStdout();

  // Some streams (e.g. ink-testing-library) report no rows/columns — fall back
  // to a sane default so layout math never becomes NaN.
  const read = (): TerminalSize => ({
    columns: stdout.columns || 80,
    rows: stdout.rows || 24,
  });

  const [size, setSize] = useState<TerminalSize>(read);

  useEffect(() => {
    const handler = () => setSize(read());
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