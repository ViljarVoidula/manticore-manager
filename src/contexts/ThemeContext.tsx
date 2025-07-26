import React, { createContext, useEffect, useState } from 'react';
import { 
  Theme, 
  getInitialTheme, 
  saveTheme, 
  applyTheme,
  createSystemThemeListener 
} from '../utils/theme';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    // Apply theme to document and save to localStorage
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  // Optional: Listen for system theme changes and update if user hasn't set a preference
  useEffect(() => {
    const cleanup = createSystemThemeListener((systemTheme) => {
      // Only auto-update if user hasn't explicitly set a preference recently
      // This could be enhanced with a timestamp check if needed
      console.log('System theme changed to:', systemTheme);
    });

    return cleanup;
  }, []);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
