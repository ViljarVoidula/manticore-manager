import React from "react";
import { Outlet, Link, useLocation } from "react-router";
import { useMenu, useNavigation } from "@refinedev/core";
import { useTheme } from "../../hooks/useTheme";

export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { menuItems } = useMenu();
  const { push } = useNavigation();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: (
        <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v3H8V5z" />
        </svg>
      )
    },
    {
      name: "Tables",
      href: "/tables",
      icon: (
        <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      name: "SQL Editor",
      href: "/sql",
      icon: (
        <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Side Navigation */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg">
        <div className="flex h-16 items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4">
          <Link to="/" className="flex items-center">
            <span className="text-2xl mr-2">🔍</span>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Manticore Manager
            </h1>
          </Link>
          
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
        </div>
        
        <nav className="mt-5 px-2">
          <div className="space-y-1">
            {/* Main Navigation */}
            <div className="mb-4">
              <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Navigation
              </h3>
              <div className="mt-2 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8 px-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => push("/tables?create=true")}
                  className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  ➕ Create Table
                </button>
                <Link
                  to="/sql"
                  className="block px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  💾 Execute SQL
                </Link>
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="mt-8 px-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Shortcuts
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Command Palette</span>
                  <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded text-xs">⌘K</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Execute SQL</span>
                  <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded text-xs">Ctrl+⏎</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Go to Dashboard</span>
                  <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded text-xs">⌘H</kbd>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
            Manticore Manager v1.0
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        <main className="flex-1 min-h-screen">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};
