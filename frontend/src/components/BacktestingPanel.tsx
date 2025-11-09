import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Box,
  Alert
} from '@mui/material';
import { tradingService } from '../services/tradingService';

interface BacktestConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  strategy: string;
  timeframe: string;
  riskPerTrade: number;
  maxPositions: number;
}

interface BacktestResult {
  id: string;
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

const BacktestingPanel: React.FC = () => {
  const [config, setConfig] = useState<BacktestConfig>({
    symbol: 'BTCUSDT',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    initialCapital: 10000,
    strategy: 'GUARANTEED_PROFIT',
    timeframe: '1h',
    riskPerTrade: 2,
    maxPositions: 5
  });

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBacktestHistory();
  }, []);

  const loadBacktestHistory = async () => {
    try {
      const response = await tradingService.getBacktestHistory();
      if (response.success) {
        setResults(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load backtest history:', error);
    }
  };

  const runBacktest = async () => {
    try {
      setIsRunning(true);
      setError(null);
      
      const response = await tradingService.runBacktest(config);
      if (response.success) {
        await loadBacktestHistory();
        setSelectedResult(response.data);
      } else {
        setError('Failed to run backtest');
      }
    } catch (error) {
      setError('Failed to run backtest');
      console.error('Backtest error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'RUNNING': return 'warning';
      case 'FAILED': return 'error';
      default: return 'default';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <Grid container spacing={3}>
      {/* Configuration Panel */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Backtest Configuration
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Symbol"
                  value={config.symbol}
                  onChange={(e) => setConfig({ ...config, symbol: e.target.value })}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Strategy</InputLabel>
                  <Select
                    value={config.strategy}
                    onChange={(e) => setConfig({ ...config, strategy: e.target.value })}
                    label="Strategy"
                  >
                    <MenuItem value="GUARANTEED_PROFIT">Guaranteed Profit</MenuItem>
                    <MenuItem value="ARBITRAGE">Arbitrage</MenuItem>
                    <MenuItem value="MEV">MEV</MenuItem>
                    <MenuItem value="FLASH_LOAN">Flash Loan</MenuItem>
                    <MenuItem value="YIELD_FARMING">Yield Farming</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={config.startDate}
                  onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={config.endDate}
                  onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Initial Capital"
                  type="number"
                  value={config.initialCapital}
                  onChange={(e) => setConfig({ ...config, initialCapital: Number(e.target.value) })}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Timeframe</InputLabel>
                  <Select
                    value={config.timeframe}
                    onChange={(e) => setConfig({ ...config, timeframe: e.target.value })}
                    label="Timeframe"
                  >
                    <MenuItem value="1m">1 Minute</MenuItem>
                    <MenuItem value="5m">5 Minutes</MenuItem>
                    <MenuItem value="15m">15 Minutes</MenuItem>
                    <MenuItem value="1h">1 Hour</MenuItem>
                    <MenuItem value="4h">4 Hours</MenuItem>
                    <MenuItem value="1d">1 Day</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Risk Per Trade (%)"
                  type="number"
                  value={config.riskPerTrade}
                  onChange={(e) => setConfig({ ...config, riskPerTrade: Number(e.target.value) })}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Max Positions"
                  type="number"
                  value={config.maxPositions}
                  onChange={(e) => setConfig({ ...config, maxPositions: Number(e.target.value) })}
                  variant="outlined"
                />
              </Grid>
            </Grid>
            
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
            
            <Button
              fullWidth
              variant="contained"
              onClick={runBacktest}
              disabled={isRunning}
              sx={{ mt: 2 }}
            >
              {isRunning ? 'Running Backtest...' : 'Run Backtest'}
            </Button>
            
            {isRunning && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress />
                <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
                  Backtest in progress...
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Results Panel */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Backtest Results
            </Typography>
            
            {selectedResult && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Latest Result
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Total Return
                    </Typography>
                    <Typography variant="h6" color={selectedResult.totalReturn >= 0 ? 'success.main' : 'error.main'}>
                      {formatCurrency(selectedResult.totalReturn)} ({formatPercent(selectedResult.totalReturnPercent)})
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Win Rate
                    </Typography>
                    <Typography variant="h6">
                      {formatPercent(selectedResult.winRate)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Total Trades
                    </Typography>
                    <Typography variant="h6">
                      {selectedResult.totalTrades}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Max Drawdown
                    </Typography>
                    <Typography variant="h6" color="error.main">
                      {formatPercent(selectedResult.maxDrawdown)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Sharpe Ratio
                    </Typography>
                    <Typography variant="h6">
                      {selectedResult.sharpeRatio.toFixed(2)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Status
                    </Typography>
                    <Chip 
                      label={selectedResult.status} 
                      color={getStatusColor(selectedResult.status) as any}
                      size="small"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
            
            <Typography variant="subtitle1" gutterBottom>
              Backtest History
            </Typography>
            
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell>Return</TableCell>
                    <TableCell>Win Rate</TableCell>
                    <TableCell>Trades</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((result) => (
                    <TableRow 
                      key={result.id}
                      hover
                      onClick={() => setSelectedResult(result)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{result.symbol}</TableCell>
                      <TableCell>
                        {new Date(result.startDate).toLocaleDateString()} - {new Date(result.endDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          color={result.totalReturnPercent >= 0 ? 'success.main' : 'error.main'}
                        >
                          {formatPercent(result.totalReturnPercent)}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatPercent(result.winRate)}</TableCell>
                      <TableCell>{result.totalTrades}</TableCell>
                      <TableCell>
                        <Chip 
                          label={result.status} 
                          color={getStatusColor(result.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(result.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default BacktestingPanel;
