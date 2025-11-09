import React, { useState, useEffect, useCallback } from 'react';
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
  Chip,
  Box,
  Alert,
  LinearProgress,
  Divider
} from '@mui/material';
import { tradingService } from '../services/tradingService';

interface LiquiditySource {
  id: string;
  name: string;
  type: 'CEX' | 'DEX' | 'OTC' | 'AGGREGATOR';
  isActive: boolean;
  priority: number;
  fees: {
    maker: number;
    taker: number;
    withdrawal: number;
  };
  limits: {
    minOrderSize: number;
    maxOrderSize: number;
    dailyLimit: number;
    rateLimit: number;
  };
  supportedPairs: string[];
  latency: number;
  reliability: number;
}

interface LiquiditySnapshot {
  symbol: string;
  timestamp: number;
  sources: {
    [sourceId: string]: {
      bestBid: number;
      bestAsk: number;
      bidSize: number;
      askSize: number;
      spread: number;
      midPrice: number;
      volume24h: number;
      latency: number;
      reliability: number;
    };
  };
  aggregated: {
    bestBid: number;
    bestAsk: number;
    totalBidSize: number;
    totalAskSize: number;
    weightedMidPrice: number;
    effectiveSpread: number;
    totalVolume24h: number;
    sourceCount: number;
  };
}

interface SmartRoute {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  timestamp: number;
  routes: Array<{
    source: string;
    size: number;
    price: number;
    fees: number;
    slippage: number;
    latency: number;
    priority: number;
  }>;
  totalCost: number;
  totalFees: number;
  estimatedSlippage: number;
  executionTime: number;
  confidence: number;
  riskScore: number;
}

interface LiquidityMetrics {
  symbol: string;
  timestamp: number;
  depth: {
    level1: number;
    level2: number;
    level3: number;
    level5: number;
    level10: number;
  };
  spread: {
    absolute: number;
    relative: number;
    effective: number;
  };
  volume: {
    spot24h: number;
    spot1h: number;
    futures24h: number;
    futures1h: number;
  };
  volatility: {
    price1h: number;
    price24h: number;
    volume1h: number;
    volume24h: number;
  };
  marketImpact: {
    small: number;
    medium: number;
    large: number;
  };
}

const LiquidityAggregationPanel: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [sources, setSources] = useState<LiquiditySource[]>([]);
  const [snapshot, setSnapshot] = useState<LiquiditySnapshot | null>(null);
  const [metrics, setMetrics] = useState<LiquidityMetrics | null>(null);
  const [smartRoute, setSmartRoute] = useState<SmartRoute | null>(null);
  const [routeConfig, setRouteConfig] = useState({
    side: 'BUY' as 'BUY' | 'SELL',
    size: 1000
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];

  const loadLiquiditySources = async () => {
    try {
      const response = await tradingService.getAllLiquiditySources();
      if (response.success) {
        setSources(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load liquidity sources:', error);
    }
  };

  const loadLiquidityData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [snapshotResponse, metricsResponse] = await Promise.all([
        tradingService.getLiquiditySnapshot(selectedSymbol),
        tradingService.getLiquidityMetrics(selectedSymbol)
      ]);

      if (snapshotResponse.success) {
        setSnapshot(snapshotResponse.data);
      }

      if (metricsResponse.success) {
        setMetrics(metricsResponse.data);
      }
    } catch (error) {
      setError('Failed to load liquidity data');
      console.error('Liquidity data error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    loadLiquiditySources();
    loadLiquidityData();
  }, [selectedSymbol, loadLiquidityData]);

  const generateSmartRoute = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await tradingService.generateSmartRoute(
        selectedSymbol,
        routeConfig.side,
        routeConfig.size
      );

      if (response.success) {
        setSmartRoute(response.data);
      } else {
        setError('Failed to generate smart route');
      }
    } catch (error) {
      setError('Failed to generate smart route');
      console.error('Smart route error:', error);
    } finally {
      setLoading(false);
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

  const getSourceTypeColor = (type: string) => {
    switch (type) {
      case 'CEX': return 'primary';
      case 'DEX': return 'secondary';
      case 'OTC': return 'success';
      case 'AGGREGATOR': return 'warning';
      default: return 'default';
    }
  };

  const getReliabilityColor = (reliability: number) => {
    if (reliability >= 0.95) return 'success';
    if (reliability >= 0.90) return 'warning';
    return 'error';
  };

  return (
    <Grid container spacing={3}>
      {/* Configuration Panel */}
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Liquidity Configuration
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Symbol</InputLabel>
                  <Select
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    label="Symbol"
                  >
                    {symbols.map((symbol) => (
                      <MenuItem key={symbol} value={symbol}>
                        {symbol}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Side</InputLabel>
                  <Select
                    value={routeConfig.side}
                    onChange={(e) => setRouteConfig({ ...routeConfig, side: e.target.value as 'BUY' | 'SELL' })}
                    label="Side"
                  >
                    <MenuItem value="BUY">Buy</MenuItem>
                    <MenuItem value="SELL">Sell</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Order Size"
                  type="number"
                  value={routeConfig.size}
                  onChange={(e) => setRouteConfig({ ...routeConfig, size: Number(e.target.value) })}
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
              onClick={generateSmartRoute}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Generating Route...' : 'Generate Smart Route'}
            </Button>
            
            <Button
              fullWidth
              variant="outlined"
              onClick={loadLiquidityData}
              disabled={loading}
              sx={{ mt: 1 }}
            >
              Refresh Data
            </Button>
            
            {loading && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Liquidity Sources */}
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Liquidity Sources
            </Typography>
            
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Source</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Reliability</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell>{source.name}</TableCell>
                      <TableCell>
                        <Chip 
                          label={source.type} 
                          color={getSourceTypeColor(source.type) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={source.isActive ? 'Active' : 'Inactive'} 
                          color={source.isActive ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={formatPercent(source.reliability * 100)} 
                          color={getReliabilityColor(source.reliability) as any}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Liquidity Snapshot */}
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Liquidity Snapshot - {selectedSymbol}
            </Typography>
            
            {snapshot && (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Best Bid
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(snapshot.aggregated.bestBid)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Best Ask
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(snapshot.aggregated.bestAsk)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Spread
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(snapshot.aggregated.effectiveSpread)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Mid Price
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(snapshot.aggregated.weightedMidPrice)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Total Bid Size
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(snapshot.aggregated.totalBidSize)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Total Ask Size
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(snapshot.aggregated.totalAskSize)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Volume 24h
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(snapshot.aggregated.totalVolume24h)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Sources
                    </Typography>
                    <Typography variant="h6">
                      {snapshot.aggregated.sourceCount}
                    </Typography>
                  </Grid>
                </Grid>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle1" gutterBottom>
                  Source Details
                </Typography>
                
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Source</TableCell>
                        <TableCell>Bid</TableCell>
                        <TableCell>Ask</TableCell>
                        <TableCell>Spread</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(snapshot.sources).map(([sourceId, sourceData]) => (
                        <TableRow key={sourceId}>
                          <TableCell>{sourceId}</TableCell>
                          <TableCell>{formatCurrency(sourceData.bestBid)}</TableCell>
                          <TableCell>{formatCurrency(sourceData.bestAsk)}</TableCell>
                          <TableCell>{formatPercent(sourceData.spread)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Smart Route & Metrics */}
      <Grid item xs={12} md={4}>
        {/* Smart Route */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Smart Route
            </Typography>
            
            {smartRoute && (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Total Cost
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(smartRoute.totalCost)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Total Fees
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(smartRoute.totalFees)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Slippage
                    </Typography>
                    <Typography variant="h6">
                      {formatPercent(smartRoute.estimatedSlippage * 100)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Execution Time
                    </Typography>
                    <Typography variant="h6">
                      {smartRoute.executionTime}ms
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Confidence
                    </Typography>
                    <Typography variant="h6">
                      {formatPercent(smartRoute.confidence * 100)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Risk Score
                    </Typography>
                    <Typography variant="h6">
                      {formatPercent(smartRoute.riskScore * 100)}
                    </Typography>
                  </Grid>
                </Grid>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle1" gutterBottom>
                  Route Segments
                </Typography>
                
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Source</TableCell>
                        <TableCell>Size</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Fees</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {smartRoute.routes.map((route, index) => (
                        <TableRow key={index}>
                          <TableCell>{route.source}</TableCell>
                          <TableCell>{route.size.toFixed(2)}</TableCell>
                          <TableCell>{formatCurrency(route.price)}</TableCell>
                          <TableCell>{formatCurrency(route.fees)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Liquidity Metrics */}
        {metrics && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Liquidity Metrics
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Spread (Abs)
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(metrics.spread.absolute)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Spread (Rel)
                  </Typography>
                  <Typography variant="h6">
                    {formatPercent(metrics.spread.relative)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Volume 24h
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(metrics.volume.spot24h)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Volatility 24h
                  </Typography>
                  <Typography variant="h6">
                    {formatPercent(metrics.volatility.price24h)}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Impact (Small)
                  </Typography>
                  <Typography variant="h6">
                    {formatPercent(metrics.marketImpact.small)}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Impact (Medium)
                  </Typography>
                  <Typography variant="h6">
                    {formatPercent(metrics.marketImpact.medium)}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Impact (Large)
                  </Typography>
                  <Typography variant="h6">
                    {formatPercent(metrics.marketImpact.large)}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}
      </Grid>
    </Grid>
  );
};

export default LiquidityAggregationPanel;
