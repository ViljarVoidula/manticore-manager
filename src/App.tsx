import {
  Refine,
  ErrorComponent,
} from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import { Toaster } from "react-hot-toast";

import { BrowserRouter, Route, Routes } from "react-router";
import routerBindings, {
  UnsavedChangesNotifier,
  DocumentTitleHandler,
} from "@refinedev/react-router";

import ManticoreDataProvider from "./providers/manticore-data-provider";
import { Layout } from "./components/layout/Layout";
import { TablesPage } from "./pages/tables";
import { SqlPage } from "./pages/sql";
import { Dashboard } from "./pages/dashboard";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./App.css";

function App() {
  // Use environment-based configuration - no hardcoded URL
  const manticoreDataProvider = new ManticoreDataProvider();

  return (
    <ThemeProvider>
      <BrowserRouter>
        <RefineKbarProvider>
            <Refine
              dataProvider={manticoreDataProvider}
              routerProvider={routerBindings}
              resources={[
                {
                  name: "tables",
                  list: "/tables",
                  show: "/tables/:id",
                  create: "/tables/create",
                  edit: "/tables/:id/edit",
                  meta: {
                    label: "Tables",
                    icon: "🗂️",
                    canDelete: true,
                  },
                },
                {
                  name: "sql",
                  list: "/sql",
                  meta: {
                    label: "SQL Editor",
                    icon: "💾",
                },
              },
            ]}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              useNewQueryKeys: true,
              projectId: "lLeTW2-vmY43T-MWbzks",
            }}
          >
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="/tables" element={<TablesPage />} />
                <Route path="/tables/:tableId" element={<TablesPage />} />
                <Route path="/tables/:tableId/edit" element={<TablesPage />} />
                <Route path="/sql" element={<SqlPage />} />
                <Route path="*" element={<ErrorComponent />} />
              </Route>
            </Routes>
            <RefineKbar />
            <UnsavedChangesNotifier />
            <DocumentTitleHandler />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--toast-bg)',
                  color: 'var(--toast-color)',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#4ade80',
                    secondary: 'var(--toast-color)',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: 'var(--toast-color)',
                  },
                },
              }}
            />
          </Refine>
        </RefineKbarProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
