import React, { createContext, useContext, useEffect } from "react";

const ThemeContext = createContext({
  isDark: false,
});

export function ThemeProvider({ children }) {
  useEffect(() => {
    // Pure light theme enforcement across the application
    const root = document.documentElement;
    root.classList.remove("dark");
    localStorage.removeItem("repledger_theme");
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark: false }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
