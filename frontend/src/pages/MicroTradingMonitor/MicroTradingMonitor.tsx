import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  TrendingUp,
  AccountBalance,
  ShowChart,
  Analytics,
  Timeline,
  AttachMoney,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { tradingService } from '../../services/tradingService';

interface MicroTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  size: number;
  profitLoss: number;
  profitLossPercent: number;
  openTime: string;
  status: 'OPEN' | 'CLOSED';
  tradeType: string;
}

const MicroTradingMonitor: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedTrade, setSelectedTrade] = useState<MicroTrade | null>(null);
  const [openTradeDialog, setOpenTradeDialog] = useState(false);

  // Real-time data queries
  const { data: microTradingStatus } = useQuery(
    'microTradingStatus',
    tradingService.getMicroTradingStatus,
    { refetchInterval: 2000 }
  );

  const { data: microTradingPerformance } = useQuery(
    'microTradingPerformance',
    tradingService.getMicroTradingPerformance,
    { refetchInterval: 3000 }
  );

  const { data: circuitBreakerStatus } = useQuery(
    'circuitBreakerStatus',
    tradingService.getCircuitBreakerStatus,
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

  const handleTradeClick = (trade: MicroTrade) => {
    setSelectedTrade(trade);
    setOpenTradeDialog(true);
  };

  const getProfitLossColor = (profitLoss: number) => {
    if (profitLoss > 0) return 'success.main';
    if (profitLoss < 0) return 'error.main';
    return 'text.secondary';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'success';
      case 'CLOSED': return 'default';
      default: return 'default';
    }
  };

  const getSideColor = (side: string) => {
    return side === 'BUY' ? 'success' : 'error';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          🎯 Micro Trading Monitor
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Chip
            label={microTradingStatus?.isActive ? 'ACTIVE' : 'STOPPED'}
            color={microTradingStatus?.isActive ? 'success' : 'error'}
            variant="outlined"
          />
          <Button
            variant="contained"
            color="primary"
            startIcon={<Refresh />}
            onClick={() => queryClient.invalidateQueries()}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Performance Overview */}
      {microTradingPerformance && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AccountBalance sx={{ mr: 1 }} />
                  <Typography variant="h6">Current Balance</Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  ${microTradingPerformance.currentBalance?.toFixed(2) || '0.00'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Starting: $100.00
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TrendingUp sx={{ mr: 1 }} />
                  <Typography variant="h6">Daily Profit</Typography>
                </Box>
                <Typography variant="h4" color="success.main">
                  ${microTradingPerformance.dailyProfitAchieved?.toFixed(2) || '0.00'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Target: $100.00
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Timeline sx={{ mr: 1 }} />
                  <Typography variant="h6">Trades Executed</Typography>
                </Box>
                <Typography variant="h4" color="info.main">
                  {microTradingPerformance.tradesExecuted || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Max: 100 per day
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AttachMoney sx={{ mr: 1 }} />
                  <Typography variant="h6">Win Rate</Typography>
                </Box>
                <Typography variant="h4" color="warning.main">
                  {(microTradingPerformance.winRate * 100)?.toFixed(1) || '0.0'}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Target: 60%+
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Daily Target Progress */}
      {microTradingPerformance && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              📊 Daily Target Progress
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">
                Progress: ${microTradingPerformance.dailyProfitAchieved?.toFixed(2) || '0.00'} / $100.00
              </Typography>
              <Typography variant="body2">
                {((microTradingPerformance.dailyProfitAchieved || 0) / 100 * 100).toFixed(1)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, ((microTradingPerformance.dailyProfitAchieved || 0) / 100) * 100)}
              sx={{ height: 12, borderRadius: 6 }}
            />
            {microTradingPerformance.targetAchieved && (
              <Alert severity="success" sx={{ mt: 2 }}>
                🎉 Daily target achieved! Micro trading will continue with profit protection.
              </Alert>
            )}
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
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant={microTradingStatus?.isActive ? "outlined" : "contained"}
                color={microTradingStatus?.isActive ? "error" : "success"}
                startIcon={microTradingStatus?.isActive ? <Stop /> : <PlayArrow />}
                onClick={() => {
                  if (microTradingStatus?.isActive) {
                    stopMicroTradingMutation.mutate();
                  } else {
                    startMicroTradingMutation.mutate();
                  }
                }}
                disabled={startMicroTradingMutation.isLoading || stopMicroTradingMutation.isLoading}
              >
                {microTradingStatus?.isActive ? 'Stop Micro Trading' : 'Start Micro Trading'}
              </Button>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="outlined"
                color="primary"
                startIcon={<Refresh />}
                onClick={() => queryClient.invalidateQueries()}
              >
                Refresh Data
              </Button>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="outlined"
                color="info"
                startIcon={<Analytics />}
                onClick={() => {/* Navigate to analytics */}}
              >
                View Analytics
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Circuit Breaker Status */}
      {circuitBreakerStatus?.isActive && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            ⚠️ Circuit Breaker Active
          </Typography>
          <Typography>
            Reason: {circuitBreakerStatus.reason}
          </Typography>
          <Typography>
            Consecutive Losses: {circuitBreakerStatus.consecutiveLosses}
          </Typography>
          <Typography>
            Position Size Multiplier: {(circuitBreakerStatus.positionSizeMultiplier * 100).toFixed(1)}%
          </Typography>
        </Alert>
      )}

      {/* Active Trades Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            📈 Active Micro Trades
          </Typography>
          {microTradingPerformance?.microTrades && microTradingPerformance.microTrades.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Side</TableCell>
                    <TableCell>Entry Price</TableCell>
                    <TableCell>Current Price</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>P&L</TableCell>
                    <TableCell>P&L %</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {microTradingPerformance.microTrades.map((trade: MicroTrade) => (
                    <TableRow key={trade.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {trade.symbol}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={trade.side}
                          color={getSideColor(trade.side)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          ${trade.entryPrice?.toFixed(4)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          ${trade.currentPrice?.toFixed(4)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {trade.size?.toFixed(4)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={getProfitLossColor(trade.profitLoss)}
                          fontWeight="bold"
                        >
                          ${trade.profitLoss?.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={getProfitLossColor(trade.profitLoss)}
                          fontWeight="bold"
                        >
                          {trade.profitLossPercent?.toFixed(2)}%
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={trade.status}
                          color={getStatusColor(trade.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {trade.tradeType}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleTradeClick(trade)}
                          >
                            <ShowChart />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">
              No active micro trades at the moment.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Trade Details Dialog */}
      <Dialog
        open={openTradeDialog}
        onClose={() => setOpenTradeDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Trade Details - {selectedTrade?.symbol}
        </DialogTitle>
        <DialogContent>
          {selectedTrade && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Trade Information
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="Symbol"
                        secondary={selectedTrade.symbol}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Side"
                        secondary={selectedTrade.side}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Entry Price"
                        secondary={`$${selectedTrade.entryPrice?.toFixed(4)}`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Current Price"
                        secondary={`$${selectedTrade.currentPrice?.toFixed(4)}`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Size"
                        secondary={selectedTrade.size?.toFixed(4)}
                      />
                    </ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Performance
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="P&L"
                        secondary={`$${selectedTrade.profitLoss?.toFixed(2)}`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="P&L %"
                        secondary={`${selectedTrade.profitLossPercent?.toFixed(2)}%`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Status"
                        secondary={selectedTrade.status}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Trade Type"
                        secondary={selectedTrade.tradeType}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Open Time"
                        secondary={new Date(selectedTrade.openTime).toLocaleString()}
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTradeDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MicroTradingMonitor;
