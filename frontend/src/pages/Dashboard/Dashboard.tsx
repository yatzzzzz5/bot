import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  TrendingUp,
  AccountBalance,
  ShowChart,
  Security,
  Speed,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { toast } from 'react-hot-toast';

// Components
import TradingChart from '../../components/Charts/TradingChart';
import SignalList from '../../components/Trading/SignalList';
import PortfolioSummary from '../../components/Portfolio/PortfolioSummary';
import RiskMetrics from '../../components/Analytics/RiskMetrics';
import PerformanceMetrics from '../../components/Analytics/PerformanceMetrics';

// Services
import { tradingService } from '../../services/tradingService';
import { portfolioService } from '../../services/portfolioService';


const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1H');
  const [intelSymbol, setIntelSymbol] = useState('BTC');

  // Fetch bot status
  const { data: botStatus } = useQuery(
    'botStatus',
    tradingService.getBotStatus,
    { 
      refetchInterval: 3000,
      retry: 3,
      onError: (error) => console.error('Bot status fetch error:', error)
    }
  );

  // Update local state when bot status changes
  React.useEffect(() => {
    if (botStatus) {
      setIsBotRunning(botStatus.status === 'ACTIVE' || botStatus.status === 'STARTED');
    }
  }, [botStatus]);

  // Fetch real-time data with error handling
  const { data: portfolio, isLoading: portfolioLoading } = useQuery(
    'portfolio',
    portfolioService.getPortfolio,
    { 
      refetchInterval: 5000,
      retry: 3,
      onError: (error) => console.error('Portfolio fetch error:', error)
    }
  );

  const { data: performance, isLoading: performanceLoading } = useQuery(
    'performance',
    portfolioService.getPerformance,
    { 
      refetchInterval: 10000,
      retry: 3,
      onError: (error) => console.error('Performance fetch error:', error)
    }
  );

  const { data: activeSignals, isLoading: signalsLoading } = useQuery(
    'activeSignals',
    tradingService.getActiveSignals,
    { 
      refetchInterval: 3000,
      retry: 3,
      onError: (error) => console.error('Signals fetch error:', error)
    }
  );

  // Intel queries
  const { data: intelNews } = useQuery(
    ['intelNews', intelSymbol],
    () => tradingService.getIntelNews(intelSymbol),
    { refetchInterval: 60000 }
  );
  const { data: intelSentiment } = useQuery(
    ['intelSentiment', intelSymbol],
    () => tradingService.getIntelSentiment(intelSymbol),
    { refetchInterval: 300000 }
  );
  const { data: intelFlow } = useQuery(
    ['intelFlow', intelSymbol],
    () => tradingService.getIntelFlowNowcast(intelSymbol),
    { refetchInterval: 180000 }
  );
  const { data: intelAnomalies } = useQuery(
    ['intelAnomalies', intelSymbol],
    () => tradingService.getIntelAnomalies({ volumeZ: 0, newsCount: intelNews?.news?.length || 0 }),
    { refetchInterval: 60000, enabled: !!intelNews }
  );

  const { data: riskMetrics } = useQuery(
    'riskMetrics',
    portfolioService.getRiskMetrics,
    { 
      refetchInterval: 15000,
      retry: 3,
      onError: (error) => console.error('Risk metrics fetch error:', error)
    }
  );

  // Start/Stop bot
  const handleStartBot = async () => {
    try {
      await tradingService.startBot();
      setIsBotRunning(true);
      toast.success('Trading bot started successfully!');
    } catch (error) {
      toast.error('Failed to start trading bot');
    }
  };

  const handleStopBot = async () => {
    try {
      await tradingService.stopBot();
      setIsBotRunning(false);
      toast.success('Trading bot stopped successfully!');
    } catch (error) {
      toast.error('Failed to stop trading bot');
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  // Navigation handlers
  const handleNavigateToAnalytics = () => {
    navigate('/analytics');
  };

  const handleNavigateToPortfolio = () => {
    navigate('/portfolio');
  };

  const handleNavigateToRiskManagement = () => {
    navigate('/trading'); // Risk management is in trading page
  };

  const handleNavigateToTrading = () => {
    navigate('/trading');
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          🚀 Enterprise Crypto Bot Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color={isBotRunning ? 'error' : 'success'}
            startIcon={isBotRunning ? <Stop /> : <PlayArrow />}
            onClick={isBotRunning ? handleStopBot : handleStartBot}
            sx={{ minWidth: 120 }}
          >
            {isBotRunning ? 'Stop Bot' : 'Start Bot'}
          </Button>
          <Tooltip title="Refresh Dashboard">
            <IconButton onClick={handleRefresh} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Bot Status */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={isBotRunning ? 'RUNNING' : 'STOPPED'}
              color={isBotRunning ? 'success' : 'error'}
              variant="filled"
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              {isBotRunning ? 'Bot is actively trading' : 'Bot is stopped'}
            </Typography>
            {isBotRunning && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                <Speed sx={{ fontSize: 16, color: 'success.main' }} />
                <Typography variant="body2" color="success.main">
                  Active
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Portfolio Summary */}
        <Grid item xs={12} md={4}>
          <PortfolioSummary
            portfolio={portfolio}
            isLoading={portfolioLoading}
          />
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12} md={4}>
          <PerformanceMetrics
            performance={performance}
            isLoading={performanceLoading}
          />
        </Grid>

        {/* Risk Metrics */}
        <Grid item xs={12} md={4}>
          <RiskMetrics
            riskScore={riskMetrics?.score || 0.5}
            maxDrawdown={riskMetrics?.maxDrawdown || 0.15}
            sharpeRatio={riskMetrics?.sharpeRatio || 1.2}
          />
        </Grid>

        {/* Trading Chart */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: 500 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Live Trading Chart</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {['1H', '4H', '1D', '1W'].map((timeframe) => (
                    <Chip
                      key={timeframe}
                      label={timeframe}
                      variant={selectedTimeframe === timeframe ? 'filled' : 'outlined'}
                      color={selectedTimeframe === timeframe ? 'primary' : 'default'}
                      size="small"
                      onClick={() => setSelectedTimeframe(timeframe)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>
              <TradingChart timeframe={selectedTimeframe} portfolioData={portfolio} />
            </CardContent>
          </Card>
        </Grid>

        {/* Active Signals */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Active Trading Signals
              </Typography>
              <SignalList
                signals={activeSignals || []}
                isLoading={signalsLoading}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Event & Flow Intelligence */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Event & Flow Intelligence</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {['BTC', 'ETH', 'SOL', 'BNB'].map((sym) => (
                    <Chip
                      key={sym}
                      label={sym}
                      variant={intelSymbol === sym ? 'filled' : 'outlined'}
                      color={intelSymbol === sym ? 'primary' : 'default'}
                      size="small"
                      onClick={() => setIntelSymbol(sym)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" gutterBottom>News</Typography>
                  <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
                    {(intelNews?.news || []).slice(0, 8).map((n: any, idx: number) => (
                      <Typography key={idx} variant="body2" sx={{ mb: 1 }}>
                        • {n.headline}
                      </Typography>
                    ))}
                    {!(intelNews?.news || []).length && (
                      <Typography variant="body2" color="text.secondary">No recent headlines</Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" gutterBottom>Sentiment</Typography>
                  <Typography variant="body2">Score: {(intelSentiment?.overall?.score ?? 0).toFixed(3)}</Typography>
                  <Typography variant="body2">Confidence: {(intelSentiment?.overall?.confidence ?? 0).toFixed(2)}</Typography>
                  <Box sx={{ mt: 1 }}>
                    {(intelSentiment?.entities || []).slice(0, 6).map((e: any) => (
                      <Chip key={e.entity} label={`${e.entity}: ${e.score.toFixed(2)}`} size="small" sx={{ mr: 1, mb: 1 }} />
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" gutterBottom>On-Chain Flow</Typography>
                  <Typography variant="body2">CEX Inflow: ${intelFlow?.cexInflowUSD?.toLocaleString?.() || 0}</Typography>
                  <Typography variant="body2">CEX Outflow: ${intelFlow?.cexOutflowUSD?.toLocaleString?.() || 0}</Typography>
                  <Typography variant="body2">DEX Vol: ${intelFlow?.dexVolumeUSD?.toLocaleString?.() || 0}</Typography>
                  <Typography variant="body2">Whale Net: ${intelFlow?.whaleNetUSD?.toLocaleString?.() || 0}</Typography>
                  <Typography variant="body2">Directional Confidence: {((intelFlow?.directionalConfidence ?? 0)*100).toFixed(1)}%</Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>Anomalies</Typography>
                    <Box sx={{ maxHeight: 120, overflowY: 'auto' }}>
                      {(intelAnomalies?.anomalies || []).map((a: any, idx: number) => (
                        <Chip key={idx} label={`${a.type} (${(a.severity*100).toFixed(0)}%)`} size="small" sx={{ mr: 1, mb: 1 }} />
                      ))}
                      {!(intelAnomalies?.anomalies || []).length && (
                        <Typography variant="body2" color="text.secondary">No anomalies</Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<ShowChart />}
                    onClick={handleNavigateToAnalytics}
                  >
                    View Analytics
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<AccountBalance />}
                    onClick={handleNavigateToPortfolio}
                  >
                    Portfolio
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<Security />}
                    onClick={handleNavigateToRiskManagement}
                  >
                    Risk Management
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<TrendingUp />}
                    onClick={handleNavigateToTrading}
                  >
                    Trading
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
