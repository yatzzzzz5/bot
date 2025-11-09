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
  AccountBalance,
  TrendingUp,
  ShowChart
} from '@mui/icons-material';
import { portfolioService } from '../../services/portfolioService';
import { tradingService } from '../../services/tradingService';

const Portfolio: React.FC = () => {
  const { data: portfolio, isLoading: portfolioLoading } = useQuery(
    'portfolio',
    portfolioService.getPortfolio,
    { refetchInterval: 5000 }
  );

  const { data: positions, isLoading: positionsLoading } = useQuery(
    'portfolioPositions',
    portfolioService.getPositions,
    { refetchInterval: 5000 }
  );

  const { data: portfolioPnL } = useQuery(
    'portfolioPnL',
    tradingService.getPortfolioPnL,
    { refetchInterval: 3000 }
  );

  if (portfolioLoading || positionsLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Use real portfolio totalValue (from Binance balance) or portfolio P&L
  const totalValue = portfolio?.totalValue || (portfolioPnL?.totalPnL ? portfolioPnL.totalPnL : 0);
  const dailyPnL = portfolioPnL?.dailyPnL || 0;
  const totalPnL = portfolioPnL?.totalPnL || 0;
  const winRate = portfolioPnL?.winRate || 0;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        💼 Portfolio
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Portfolio Overview */}
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AccountBalance color="primary" />
                <Typography variant="h6">Total Value</Typography>
              </Box>
              <Typography variant="h4" color="primary" fontWeight="bold">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TrendingUp color={dailyPnL >= 0 ? 'success' : 'error'} />
                <Typography variant="h6">Daily P&L</Typography>
              </Box>
              <Typography 
                variant="h4" 
                color={dailyPnL >= 0 ? 'success.main' : 'error.main'} 
                fontWeight="bold"
              >
                ${dailyPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ShowChart color="primary" />
                <Typography variant="h6">Total P&L</Typography>
              </Box>
              <Typography 
                variant="h4" 
                color={totalPnL >= 0 ? 'success.main' : 'error.main'} 
                fontWeight="bold"
              >
                ${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Win Rate: {(winRate * 100).toFixed(2)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Metrics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Weekly P&L
                    </Typography>
                    <Typography variant="h6" color={portfolioPnL?.weeklyPnL >= 0 ? 'success.main' : 'error.main'}>
                      ${(portfolioPnL?.weeklyPnL || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Monthly P&L
                    </Typography>
                    <Typography variant="h6" color={portfolioPnL?.monthlyPnL >= 0 ? 'success.main' : 'error.main'}>
                      ${(portfolioPnL?.monthlyPnL || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Sharpe Ratio
                    </Typography>
                    <Typography variant="h6">
                      {(portfolioPnL?.sharpeRatio || 0).toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Max Drawdown
                    </Typography>
                    <Typography variant="h6" color="error.main">
                      {((portfolioPnL?.maxDrawdown || 0) * 100).toFixed(2)}%
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Positions Table */}
        <Grid item xs={12}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Positions
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Symbol</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Entry Price</TableCell>
                      <TableCell>Current Price</TableCell>
                      <TableCell>P&L</TableCell>
                      <TableCell>P&L %</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {positions && positions.length > 0 ? (
                      positions.map((position: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Chip label={position.symbol} size="small" color="primary" />
                          </TableCell>
                          <TableCell>{position.amount || position.size || 'N/A'}</TableCell>
                          <TableCell>${position.entryPrice?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>${position.currentPrice?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>
                            <Typography color={position.pnl >= 0 ? 'success.main' : 'error.main'}>
                              ${(position.pnl || 0).toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography color={position.pnlPercent >= 0 ? 'success.main' : 'error.main'}>
                              {(position.pnlPercent || 0).toFixed(2)}%
      </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={position.status || 'OPEN'} 
                              size="small" 
                              color={position.status === 'OPEN' ? 'success' : 'default'}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Typography color="text.secondary">No active positions</Typography>
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

export default Portfolio;
