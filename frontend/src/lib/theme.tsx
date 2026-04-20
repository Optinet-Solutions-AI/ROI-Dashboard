import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'dark', toggleTheme: () => {} });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('roi-theme') as Theme) || 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('roi-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

/** Recharts-ready colour tokens that react to theme */
export const useChartColors = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return {
    isDark,
    axisColor:  isDark ? '#b0cce0' : '#000000',
    axisStroke: isDark ? '#1e293b' : '#e2e8f0',
    gridStroke: isDark ? '#1e293b' : '#e2e8f0',
    tooltipStyle: isDark
      ? { backgroundColor: '#0d1628', borderColor: '#1e293b', color: '#e9eef5', borderRadius: 8, fontSize: 12 }
      : { backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#111827', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
  };
};
