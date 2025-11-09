import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  Container, 
  Tabs, 
  Tab,
  IconButton
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../contexts/AuthContext';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  
  const getTabValue = () => {
    const path = location.pathname;
    if (path === '/' || path === '/enhanced-dashboard') return 0;
    if (path === '/dashboard') return 1;
    if (path === '/micro-trading') return 2;
    if (path === '/protection-systems') return 3;
    if (path === '/trading') return 4;
    if (path === '/portfolio') return 5;
    if (path === '/analytics') return 6;
    if (path === '/guaranteed-profit') return 7;
    if (path === '/bot-dashboard') return 8;
    if (path === '/settings') return 9;
    return 0;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            🤖 Crypto Trading Bot
          </Typography>
          <IconButton
            color="inherit"
            onClick={handleLogout}
            sx={{ ml: 2 }}
            title="Logout"
          >
            <LogoutIcon />
          </IconButton>
        </Toolbar>
        <Tabs 
          value={getTabValue()} 
          variant="scrollable" 
          scrollButtons="auto"
          sx={{ 
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            '& .MuiTab-root': { 
              color: 'rgba(255, 255, 255, 0.7)',
              '&.Mui-selected': { color: '#00d4aa' }
            }
          }}
        >
          <Tab label="🚀 Enhanced Dashboard" component={Link} to="/" />
          <Tab label="📊 Dashboard" component={Link} to="/dashboard" />
          <Tab label="🎯 Micro Trading" component={Link} to="/micro-trading" />
          <Tab label="🛡️ Protection" component={Link} to="/protection-systems" />
          <Tab label="📈 Trading" component={Link} to="/trading" />
          <Tab label="💼 Portfolio" component={Link} to="/portfolio" />
          <Tab label="📊 Analytics" component={Link} to="/analytics" />
          <Tab label="💰 Guaranteed Profit" component={Link} to="/guaranteed-profit" />
          <Tab label="🤖 Bot Dashboard" component={Link} to="/bot-dashboard" />
          <Tab label="⚙️ Settings" component={Link} to="/settings" />
        </Tabs>
      </AppBar>
      <Container component="main" sx={{ flexGrow: 1, py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
};

export default Layout;
