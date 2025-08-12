import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { useAuthStore } from './store/authStore';
// Header removed as requested
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NodeLibrary from './pages/NodeLibrary';
import FlowBuilder from './pages/FlowBuilder';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0f0f13',
      paper: '#1a1a25',
    },
    primary: {
      main: '#7b68ee',
      light: '#9d8df2',
      dark: '#5a4cba',
    },
    secondary: {
      main: '#4cc9f0',
      light: '#73d5f3',
      dark: '#3aa0c1',
    },
    success: {
      main: '#4ade80',
      light: '#6de599',
      dark: '#3aad66',
    },
    warning: {
      main: '#fbbf24',
      light: '#fccc4d',
      dark: '#c8991d',
    },
    error: {
      main: '#f87171',
      light: '#f98e8e',
      dark: '#c65a5a',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
      disabled: 'rgba(255, 255, 255, 0.5)',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 500,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
        },
      },
    },
  },
});

const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        {/* Header removed as requested */}
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />
            }
          />
          <Route
            path="/dashboard"
            element={
              isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/nodes"
            element={
              isAuthenticated ? <NodeLibrary /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/flow/:flowId"
            element={
              isAuthenticated ? <FlowBuilder /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/"
            element={
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;