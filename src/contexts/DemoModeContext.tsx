import React, { createContext, useContext, useState, useEffect } from "react";

const DemoModeContext = createContext({
  demoMode: false,
  startDemo: () => {},
  endDemo: () => {},
  demoTimeLeft: 0,
});

export function useDemoMode() {
  return useContext(DemoModeContext);
}

export function DemoModeProvider({ children }) {
  const [demoMode, setDemoMode] = useState(false);
  const [demoTimeLeft, setDemoTimeLeft] = useState(900); // 15 min

  const startDemo = () => setDemoMode(true);

  const endDemo = () => {
    setDemoMode(false);
    setDemoTimeLeft(900);
  };

  useEffect(() => {
    if (!demoMode) return;
    if (demoTimeLeft <= 0) {
      endDemo();
      return;
    }
    const interval = setInterval(() => setDemoTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [demoMode, demoTimeLeft]);

  return (
    <DemoModeContext.Provider value={{ demoMode, startDemo, endDemo, demoTimeLeft }}>
      {children}
    </DemoModeContext.Provider>
  );
}
