import React from 'react';
import { useQuery } from 'react-query';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  ShowChart,
  TrendingUp,
  Assessment,
  Timeline
} from '@mui/icons-material';
import { tradingService } from '../../services/tradingService';

const Analytics: React.FC = () => {
  const { data: tradingHistory, isLoading: historyLoading } = useQuery(
    'tradingHistory',
    tradingService.getTradingHistory,
    { refetchInterval: 10000 }
  );

  const { data: portfolioPnL, isLoading: pnlLoading } = useQuery(
    'portfolioPnL',
    tradingService.getPortfolioPnL,
    { refetchInterval: 5000 }
  );

  const { data: tcaStats } = useQuery(
    'tcaStats',
    tradingService.getTCAStats,
    { refetchInterval: 15000 }
  );

  if (historyLoading || pnlLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const stats = portfolioPnL || {};
  const avgWin = stats.averageWin || 0;
  const avgLoss = stats.averageLoss || 0;
  const profitFactor = stats.profitFactor || 0;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        📊 Analytics
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Key Metrics */}
        <Grid item xs={12} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TrendingUp color="success" />
                <Typography variant="h6">Win Rate</Typography>
              </Box>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                {((stats.winRate || 0) * 100).toFixed(2)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Assessment color="primary" />
                <Typography variant="h6">Profit Factor</Typography>
              </Box>
              <Typography variant="h4" color="primary" fontWeight="bold">
                {profitFactor.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ShowChart color="warning" />
                <Typography variant="h6">Avg Win</Typography>
              </Box>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                ${avgWin.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Timeline color="error" />
                <Typography variant="h6">Avg Loss</Typography>
              </Box>
              <Typography variant="h4" color="error.main" fontWeight="bold">
                ${avgLoss.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Chart */}
        <Grid item xs={12}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Overview
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Daily P&L
                    </Typography>
                    <Typography variant="h5" color={stats.dailyPnL >= 0 ? 'success.main' : 'error.main'}>
                      ${(stats.dailyPnL || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Weekly P&L
                    </Typography>
                    <Typography variant="h5" color={stats.weeklyPnL >= 0 ? 'success.main' : 'error.main'}>
                      ${(stats.weeklyPnL || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Monthly P&L
                    </Typography>
                    <Typography variant="h5" color={stats.monthlyPnL >= 0 ? 'success.main' : 'error.main'}>
                      ${(stats.monthlyPnL || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Risk Metrics */}
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Risk Metrics
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Sharpe Ratio
                  </Typography>
                  <Typography variant="h6">
                    {(stats.sharpeRatio || 0).toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Max Drawdown
                  </Typography>
                  <Typography variant="h6" color="error.main">
                    {((stats.maxDrawdown || 0) * 100).toFixed(2)}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* TCA Stats */}
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Execution Quality (TCA)
              </Typography>
              {tcaStats ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Average Slippage: {(tcaStats.avgSlippage || 0).toFixed(4)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Total Orders: {tcaStats.totalOrders || 0}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Loading execution statistics...
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Trading History */}
        <Grid item xs={12}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Trading Activity
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Symbol</TableCell>
                      <TableCell>Side</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>P&L</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tradingHistory && Array.isArray(tradingHistory) && tradingHistory.length > 0 ? (
                      tradingHistory.slice(0, 10).map((trade: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{new Date(trade.timestamp || trade.date).toLocaleString()}</TableCell>
                          <TableCell>
                            <Chip label={trade.symbol || 'N/A'} size="small" color="primary" />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={trade.side || 'BUY'} 
                              size="small" 
                              color={trade.side === 'BUY' ? 'success' : 'error'}
                            />
                          </TableCell>
                          <TableCell>${(trade.amount || trade.size || 0).toFixed(2)}</TableCell>
                          <TableCell>${(trade.price || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            <Typography color={trade.pnl >= 0 ? 'success.main' : 'error.main'}>
                              ${(trade.pnl || 0).toFixed(2)}
      </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography color="text.secondary">No trading history available</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics;
