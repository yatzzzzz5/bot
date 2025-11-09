import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Divider,
  Paper
} from '@mui/material';
import {
  Security,
  Speed,
  Warning
} from '@mui/icons-material';

interface BotStatus {
  momentumBot: {
    isActive: boolean;
    dailyPnL: number;
    totalTrades: number;
    currentBalance: number;
  };
  profitGuarantee: {
    protections: number;
    hedgePositions: number;
    profitLocks: number;
    riskLevel: string;
  };
  riskManagement: {
    currentDrawdown: number;
    maxDrawdown: number;
    emergencyStop: boolean;
  };
}

const BotDashboard: React.FC = () => {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to make authenticated fetch requests
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('authToken');
    const headers = new Headers(options.headers);
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    headers.set('Content-Type', 'application/json');
    
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
    
    if (response.status === 401) {
      localStorage.removeItem('authToken');
    }
    
    return response;
  };

  const fetchStatus = React.useCallback(async () => {
    try {
      const response = await authenticatedFetch('http://localhost:5000/api/status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.data);
        setError(null);
      } else {
        setError('Failed to fetch bot status');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Her 5 saniyede güncelle
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const startBot = async () => {
    try {
      const response = await authenticatedFetch('http://localhost:5000/api/trading/start', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        fetchStatus(); // Status'u güncelle
      } else {
        setError('Failed to start bot');
      }
    } catch (err) {
      setError('Failed to start bot');
    }
  };

  const stopBot = async () => {
    try {
      const response = await authenticatedFetch('http://localhost:5000/api/trading/stop', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        fetchStatus(); // Status'u güncelle
      } else {
        setError('Failed to stop bot');
      }
    } catch (err) {
      setError('Failed to stop bot');
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'success';
      case 'MEDIUM': return 'warning';
      case 'HIGH': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading bot status...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        🤖 Crypto Bot Dashboard
      </Typography>

      {status && (
        <Grid container spacing={3}>
          {/* Bot Status */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Speed sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Bot Status
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={status.momentumBot.isActive ? 'ACTIVE' : 'INACTIVE'}
                    color={status.momentumBot.isActive ? 'success' : 'default'}
                    sx={{ mb: 2 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={startBot}
                    disabled={status.momentumBot.isActive}
                  >
                    Start Bot
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={stopBot}
                    disabled={!status.momentumBot.isActive}
                  >
                    Stop Bot
                  </Button>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Daily P&L: <strong>${status.momentumBot.dailyPnL.toFixed(2)}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Trades: <strong>{status.momentumBot.totalTrades}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Balance: <strong>${status.momentumBot.currentBalance.toFixed(2)}</strong>
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Profit Guarantee */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Security sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Profit Guarantee
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={status.profitGuarantee.riskLevel}
                    color={getRiskColor(status.profitGuarantee.riskLevel) as any}
                    sx={{ mb: 2 }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Protections: <strong>{status.profitGuarantee.protections}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Hedge Positions: <strong>{status.profitGuarantee.hedgePositions}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Profit Locks: <strong>{status.profitGuarantee.profitLocks}</strong>
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Risk Management */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Warning sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Risk Management
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {status.riskManagement.currentDrawdown.toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Current Drawdown
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4" color="secondary">
                        {status.riskManagement.maxDrawdown.toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Max Drawdown
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4" color={status.riskManagement.emergencyStop ? 'error' : 'success'}>
                        {status.riskManagement.emergencyStop ? 'STOP' : 'OK'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Emergency Status
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    onClick={() => authenticatedFetch('http://localhost:5000/api/emergency/status')}
                  >
                    Security Overview
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => authenticatedFetch('http://localhost:5000/api/circuit-breaker/status')}
                  >
                    Risk Status
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => authenticatedFetch('http://localhost:5000/api/profit-lock/status')}
                  >
                    Profit Protections
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default BotDashboard;
