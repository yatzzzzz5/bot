import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { Box, CircularProgress } from '@mui/material';

// Styles
import './App.css';

// Components
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import Trading from './pages/Trading/Trading';
import Portfolio from './pages/Portfolio/Portfolio';
import Analytics from './pages/Analytics/Analytics';
import Settings from './pages/Settings/Settings';
import Login from './pages/Auth/Login';
import GuaranteedProfit from './pages/GuaranteedProfit/GuaranteedProfit';
import BotDashboard from './pages/BotDashboard';

// Enhanced Components
import EnhancedDashboard from './pages/EnhancedDashboard/EnhancedDashboard';
import MicroTradingMonitor from './pages/MicroTradingMonitor/MicroTradingMonitor';
import ProtectionSystemsDashboard from './pages/ProtectionSystemsDashboard/ProtectionSystemsDashboard';

// Contexts
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TradingProvider } from './contexts/TradingContext';
import { PortfolioProvider } from './contexts/PortfolioContext';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
};

// Create theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00d4aa',
      light: '#4dffdb',
      dark: '#00a37c',
    },
    secondary: {
      main: '#ff6b35',
      light: '#ff9d6b',
      dark: '#cc5500',
    },
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
    },
    success: {
      main: '#00d4aa',
    },
    error: {
      main: '#ff4757',
    },
    warning: {
      main: '#ffa502',
    },
    info: {
      main: '#3742fa',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h4: {
      fontWeight: 500,
      fontSize: '1.25rem',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.125rem',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1rem',
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
  },
});

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <TradingProvider>
            <PortfolioProvider>
              <Router>
                <div className="App">
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <Layout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<EnhancedDashboard />} />
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="enhanced-dashboard" element={<EnhancedDashboard />} />
                      <Route path="micro-trading" element={<MicroTradingMonitor />} />
                      <Route path="protection-systems" element={<ProtectionSystemsDashboard />} />
                      <Route path="trading" element={<Trading />} />
                      <Route path="portfolio" element={<Portfolio />} />
                      <Route path="analytics" element={<Analytics />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="guaranteed-profit" element={<GuaranteedProfit />} />
                      <Route path="bot-dashboard" element={<BotDashboard />} />
                    </Route>
                  </Routes>
                  <Toaster
                    position="top-right"
                    toastOptions={{
                      duration: 4000,
                      style: {
                        background: '#1a1a1a',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      },
                      success: {
                        iconTheme: {
                          primary: '#00d4aa',
                          secondary: '#ffffff',
                        },
                      },
                      error: {
                        iconTheme: {
                          primary: '#ff4757',
                          secondary: '#ffffff',
                        },
                      },
                    }}
                  />
                </div>
              </Router>
            </PortfolioProvider>
          </TradingProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
