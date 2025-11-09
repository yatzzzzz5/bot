import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  TrendingUp,
  Security,
  Speed,
  Warning,
  Error,
  Lock,
  Psychology,
  Analytics,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { tradingService } from '../../services/tradingService';

// Enhanced Dashboard Component
const EnhancedDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [isMicroTradingActive, setIsMicroTradingActive] = useState(false);

  // Real-time data queries
  const { data: botStatus } = useQuery(
    'botStatus',
    tradingService.getBotStatus,
    { refetchInterval: 2000 }
  );

  const { data: microTradingStatus } = useQuery(
    'microTradingStatus',
    tradingService.getMicroTradingStatus,
    { refetchInterval: 3000 }
  );

  const { data: circuitBreakerStatus } = useQuery(
    'circuitBreakerStatus',
    tradingService.getCircuitBreakerStatus,
    { refetchInterval: 5000 }
  );

  const { data: profitLockStatus } = useQuery(
    'profitLockStatus',
    tradingService.getProfitLockStatus,
    { refetchInterval: 10000 }
  );

  const { data: marketRegime } = useQuery(
    'marketRegime',
    () => tradingService.getMarketRegime('BTC'),
    { refetchInterval: 30000 }
  );

  const { data: enhancedAnalysis } = useQuery(
    'enhancedAnalysis',
    () => tradingService.getEnhancedAnalysis('BTC'),
    { refetchInterval: 15000 }
  );

  const { data: microTradingPerformance } = useQuery(
    'microTradingPerformance',
    tradingService.getMicroTradingPerformance,
    { refetchInterval: 5000 }
  );

  // Mutations
  const startMicroTradingMutation = useMutation(tradingService.startMicroTrading, {
    onSuccess: () => {
      toast.success('Micro Trading Started!');
      queryClient.invalidateQueries('microTradingStatus');
    },
    onError: (error: any) => {
      toast.error(`Failed to start micro trading: ${error.message}`);
    }
  });

  const stopMicroTradingMutation = useMutation(tradingService.stopMicroTrading, {
    onSuccess: () => {
      toast.success('Micro Trading Stopped!');
      queryClient.invalidateQueries('microTradingStatus');
    },
    onError: (error: any) => {
      toast.error(`Failed to stop micro trading: ${error.message}`);
    }
  });

  const resetCircuitBreakerMutation = useMutation(tradingService.resetCircuitBreaker, {
    onSuccess: () => {
      toast.success('Circuit Breaker Reset!');
      queryClient.invalidateQueries('circuitBreakerStatus');
    },
    onError: (error: any) => {
      toast.error(`Failed to reset circuit breaker: ${error.message}`);
    }
  });

  const unlockProfitsMutation = useMutation(tradingService.unlockProfits, {
    onSuccess: () => {
      toast.success('Profits Unlocked!');
      queryClient.invalidateQueries('profitLockStatus');
    },
    onError: (error: any) => {
      toast.error(`Failed to unlock profits: ${error.message}`);
    }
  });

  // Update local state
  useEffect(() => {
    if (microTradingStatus) {
      setIsMicroTradingActive(microTradingStatus.isActive);
    }
  }, [microTradingStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'STOPPED': return 'error';
      case 'PAUSED': return 'warning';
      default: return 'default';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'success';
      case 'MEDIUM': return 'warning';
      case 'HIGH': return 'error';
      case 'EXTREME': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          🚀 Enhanced Trading Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Refresh />}
            onClick={() => queryClient.invalidateQueries()}
          >
            Refresh All
          </Button>
        </Box>
      </Box>

      {/* System Status Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Bot Status */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Speed sx={{ mr: 1 }} />
                <Typography variant="h6">Bot Status</Typography>
              </Box>
              <Chip
                label={botStatus?.status || 'UNKNOWN'}
                color={getStatusColor(botStatus?.status)}
                sx={{ mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                {botStatus?.uptime || '0h 0m'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Micro Trading Status */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ mr: 1 }} />
                <Typography variant="h6">Micro Trading</Typography>
              </Box>
              <Chip
                label={isMicroTradingActive ? 'ACTIVE' : 'STOPPED'}
                color={isMicroTradingActive ? 'success' : 'error'}
                sx={{ mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                Trades: {microTradingPerformance?.tradesExecuted || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Circuit Breaker Status */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Security sx={{ mr: 1 }} />
                <Typography variant="h6">Circuit Breaker</Typography>
              </Box>
              <Chip
                label={circuitBreakerStatus?.isActive ? 'ACTIVE' : 'NORMAL'}
                color={circuitBreakerStatus?.isActive ? 'error' : 'success'}
                sx={{ mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                Losses: {circuitBreakerStatus?.consecutiveLosses || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Profit Lock Status */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Lock sx={{ mr: 1 }} />
                <Typography variant="h6">Profit Lock</Typography>
              </Box>
              <Chip
                label={`$${profitLockStatus?.totalLocked?.toFixed(2) || '0.00'}`}
                color="info"
                sx={{ mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                {profitLockStatus?.lockedPercentage?.toFixed(1) || '0.0'}% locked
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Market Analysis */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Market Regime */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Analytics sx={{ mr: 1 }} />
                <Typography variant="h6">Market Regime</Typography>
              </Box>
              {marketRegime ? (
                <Box>
                  <Chip
                    label={marketRegime.type}
                    color={getRiskLevelColor(marketRegime.riskLevel)}
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Confidence: {(marketRegime.confidence || 0).toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Volatility: {marketRegime.volatility || 'MEDIUM'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Strategy: {marketRegime.recommendedStrategy || 'CONSERVATIVE'}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Loading market regime...
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Enhanced Analysis */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Psychology sx={{ mr: 1 }} />
                <Typography variant="h6">AI Analysis</Typography>
              </Box>
              {enhancedAnalysis ? (
                <Box>
                  <Chip
                    label={enhancedAnalysis.recommendation}
                    color={enhancedAnalysis.recommendation === 'BULLISH' ? 'success' : 
                           enhancedAnalysis.recommendation === 'BEARISH' ? 'error' : 'default'}
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Confidence: {((enhancedAnalysis.confidence || 0) * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    News Sentiment: {((enhancedAnalysis.news?.overallSentiment || 0) * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Whale Activity: {enhancedAnalysis.whale?.overallWhaleActivity || 'NORMAL'}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Loading AI analysis...
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Micro Trading Performance */}
      {microTradingPerformance && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              📊 Micro Trading Performance
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    ${microTradingPerformance.currentBalance?.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current Balance
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    ${microTradingPerformance.dailyProfitAchieved?.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Daily Profit
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    {microTradingPerformance.tradesExecuted || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Trades Executed
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {microTradingPerformance.dailyLossesCount || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Daily Losses
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            {/* Progress towards daily target */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Daily Target Progress: ${microTradingPerformance.dailyProfitAchieved?.toFixed(2) || '0.00'} / $100.00
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, ((microTradingPerformance.dailyProfitAchieved || 0) / 100) * 100)}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Control Panel */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            🎮 Control Panel
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant={isMicroTradingActive ? "outlined" : "contained"}
                color={isMicroTradingActive ? "error" : "success"}
                startIcon={isMicroTradingActive ? <Stop /> : <PlayArrow />}
                onClick={() => {
                  if (isMicroTradingActive) {
                    stopMicroTradingMutation.mutate();
                  } else {
                    startMicroTradingMutation.mutate();
                  }
                }}
                disabled={startMicroTradingMutation.isLoading || stopMicroTradingMutation.isLoading}
              >
                {isMicroTradingActive ? 'Stop Micro Trading' : 'Start Micro Trading'}
              </Button>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                color="warning"
                startIcon={<Security />}
                onClick={() => resetCircuitBreakerMutation.mutate()}
                disabled={resetCircuitBreakerMutation.isLoading || !circuitBreakerStatus?.isActive}
              >
                Reset Circuit Breaker
              </Button>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                color="info"
                startIcon={<Lock />}
                onClick={() => unlockProfitsMutation.mutate('MANUAL')}
                disabled={unlockProfitsMutation.isLoading || !profitLockStatus?.totalLocked}
              >
                Unlock Profits
              </Button>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                color="primary"
                startIcon={<Refresh />}
                onClick={() => queryClient.invalidateQueries()}
              >
                Refresh All Data
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Alerts and Warnings */}
      {(circuitBreakerStatus?.isActive || profitLockStatus?.emergencyUnlockAvailable) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            ⚠️ System Alerts
          </Typography>
          <List dense>
            {circuitBreakerStatus?.isActive && (
              <ListItem>
                <ListItemIcon>
                  <Warning color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="Circuit Breaker Active"
                  secondary={`Reason: ${circuitBreakerStatus.reason}`}
                />
              </ListItem>
            )}
            {profitLockStatus?.emergencyUnlockAvailable && (
              <ListItem>
                <ListItemIcon>
                  <Error color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="Emergency Unlock Available"
                  secondary="Profits can be unlocked due to losses"
                />
              </ListItem>
            )}
          </List>
        </Alert>
      )}

      {/* Success Messages */}
      {microTradingPerformance?.targetAchieved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="h6">
            🎉 Daily Target Achieved!
          </Typography>
          <Typography>
            Congratulations! The micro trading system has successfully reached the daily profit target.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default EnhancedDashboard;
