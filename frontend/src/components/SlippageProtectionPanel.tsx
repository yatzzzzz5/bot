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
  Box,
  Alert,
  LinearProgress,
  Divider,
  Slider,
  Switch,
  FormControlLabel
} from '@mui/material';
import { tradingService } from '../services/tradingService';

interface SlippageConfig {
  maxSlippage: number;
  maxMarketImpact: number;
  maxOrderSize: number;
  timeDecay: number;
  volatilityAdjustment: number;
  liquidityThreshold: number;
  emergencyStop: boolean;
}

interface SlippageAnalysis {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  timestamp: number;
  currentPrice: number;
  expectedPrice: number;
  slippage: {
    absolute: number;
    relative: number;
    expected: number;
    actual: number;
    maxAllowed: number;
  };
  marketImpact: {
    immediate: number;
    permanent: number;
    temporary: number;
    total: number;
  };
  liquidity: {
    available: number;
    utilization: number;
    depth: number;
    spread: number;
  };
  risk: {
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    score: number;
    factors: string[];
  };
  recommendations: {
    action: 'PROCEED' | 'REDUCE_SIZE' | 'SPLIT_ORDER' | 'DELAY' | 'CANCEL';
    reason: string;
    suggestedSize?: number;
    suggestedDelay?: number;
    alternativeRoutes?: string[];
  };
}

interface SlippageProtection {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  timestamp: number;
  config: SlippageConfig;
  analysis: SlippageAnalysis;
  status: 'ACTIVE' | 'TRIGGERED' | 'EXPIRED' | 'CANCELLED';
  actions: Array<{
    id: string;
    type: 'ALERT' | 'REDUCE_SIZE' | 'SPLIT_ORDER' | 'DELAY' | 'CANCEL' | 'EMERGENCY_STOP';
    timestamp: number;
    reason: string;
    details: any;
    executed: boolean;
  }>;
}

const SlippageProtectionPanel: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [analysisConfig, setAnalysisConfig] = useState({
    side: 'BUY' as 'BUY' | 'SELL',
    size: 1000
  });
  const [protectionConfig, setProtectionConfig] = useState<SlippageConfig>({
    maxSlippage: 0.5,
    maxMarketImpact: 0.3,
    maxOrderSize: 0.1,
    timeDecay: 0.1,
    volatilityAdjustment: 0.2,
    liquidityThreshold: 10000,
    emergencyStop: true
  });
  const [analysis, setAnalysis] = useState<SlippageAnalysis | null>(null);
  const [protections, setProtections] = useState<SlippageProtection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];

  useEffect(() => {
    loadSlippageProtections();
  }, []);

  const loadSlippageProtections = async () => {
    try {
      const response = await tradingService.getAllSlippageProtections();
      if (response.success) {
        setProtections(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load slippage protections:', error);
    }
  };

  const analyzeSlippage = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await tradingService.analyzeSlippage(
        selectedSymbol,
        analysisConfig.side,
        analysisConfig.size
      );

      if (response.success) {
        setAnalysis(response.data);
      } else {
        setError('Failed to analyze slippage');
      }
    } catch (error) {
      setError('Failed to analyze slippage');
      console.error('Slippage analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProtection = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await tradingService.createSlippageProtection(
        selectedSymbol,
        analysisConfig.side,
        analysisConfig.size,
        protectionConfig
      );

      if (response.success) {
        await loadSlippageProtections();
        setError(null);
      } else {
        setError('Failed to create slippage protection');
      }
    } catch (error) {
      setError('Failed to create slippage protection');
      console.error('Protection creation error:', error);
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

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'success';
      case 'MEDIUM': return 'warning';
      case 'HIGH': return 'error';
      case 'CRITICAL': return 'error';
      default: return 'default';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'PROCEED': return 'success';
      case 'REDUCE_SIZE': return 'warning';
      case 'SPLIT_ORDER': return 'info';
      case 'DELAY': return 'warning';
      case 'CANCEL': return 'error';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'TRIGGERED': return 'warning';
      case 'EXPIRED': return 'default';
      case 'CANCELLED': return 'error';
      default: return 'default';
    }
  };

  return (
    <Grid container spacing={3}>
      {/* Configuration Panel */}
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Slippage Analysis
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
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Side</InputLabel>
                  <Select
                    value={analysisConfig.side}
                    onChange={(e) => setAnalysisConfig({ ...analysisConfig, side: e.target.value as 'BUY' | 'SELL' })}
                    label="Side"
                  >
                    <MenuItem value="BUY">Buy</MenuItem>
                    <MenuItem value="SELL">Sell</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Order Size"
                  type="number"
                  value={analysisConfig.size}
                  onChange={(e) => setAnalysisConfig({ ...analysisConfig, size: Number(e.target.value) })}
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
              onClick={analyzeSlippage}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Analyzing...' : 'Analyze Slippage'}
            </Button>
            
            {loading && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Protection Configuration */}
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Protection Configuration
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="body2" gutterBottom>
                  Max Slippage: {formatPercent(protectionConfig.maxSlippage)}
                </Typography>
                <Slider
                  value={protectionConfig.maxSlippage}
                  onChange={(_, value) => setProtectionConfig({ ...protectionConfig, maxSlippage: value as number })}
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  marks={[
                    { value: 0.1, label: '0.1%' },
                    { value: 0.5, label: '0.5%' },
                    { value: 1.0, label: '1.0%' },
                    { value: 2.0, label: '2.0%' }
                  ]}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" gutterBottom>
                  Max Market Impact: {formatPercent(protectionConfig.maxMarketImpact)}
                </Typography>
                <Slider
                  value={protectionConfig.maxMarketImpact}
                  onChange={(_, value) => setProtectionConfig({ ...protectionConfig, maxMarketImpact: value as number })}
                  min={0.1}
                  max={1.0}
                  step={0.1}
                  marks={[
                    { value: 0.1, label: '0.1%' },
                    { value: 0.3, label: '0.3%' },
                    { value: 0.5, label: '0.5%' },
                    { value: 1.0, label: '1.0%' }
                  ]}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" gutterBottom>
                  Max Order Size: {formatPercent(protectionConfig.maxOrderSize * 100)}
                </Typography>
                <Slider
                  value={protectionConfig.maxOrderSize}
                  onChange={(_, value) => setProtectionConfig({ ...protectionConfig, maxOrderSize: value as number })}
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  marks={[
                    { value: 0.01, label: '1%' },
                    { value: 0.1, label: '10%' },
                    { value: 0.25, label: '25%' },
                    { value: 0.5, label: '50%' }
                  ]}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" gutterBottom>
                  Liquidity Threshold: {formatCurrency(protectionConfig.liquidityThreshold)}
                </Typography>
                <Slider
                  value={protectionConfig.liquidityThreshold}
                  onChange={(_, value) => setProtectionConfig({ ...protectionConfig, liquidityThreshold: value as number })}
                  min={1000}
                  max={100000}
                  step={1000}
                  marks={[
                    { value: 1000, label: '$1K' },
                    { value: 10000, label: '$10K' },
                    { value: 50000, label: '$50K' },
                    { value: 100000, label: '$100K' }
                  ]}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={protectionConfig.emergencyStop}
                      onChange={(e) => setProtectionConfig({ ...protectionConfig, emergencyStop: e.target.checked })}
                    />
                  }
                  label="Emergency Stop"
                />
              </Grid>
            </Grid>
            
            <Button
              fullWidth
              variant="outlined"
              onClick={createProtection}
              disabled={loading || !analysis}
              sx={{ mt: 2 }}
            >
              Create Protection
            </Button>
          </CardContent>
        </Card>
      </Grid>

      {/* Analysis Results */}
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Slippage Analysis Results
            </Typography>
            
            {analysis && (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Current Price
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(analysis.currentPrice)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Expected Price
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(analysis.expectedPrice)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Slippage
                    </Typography>
                    <Typography variant="h6" color={analysis.slippage.relative > analysis.slippage.maxAllowed ? 'error.main' : 'success.main'}>
                      {formatPercent(analysis.slippage.relative)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Market Impact
                    </Typography>
                    <Typography variant="h6">
                      {formatPercent(analysis.marketImpact.total)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Liquidity Utilization
                    </Typography>
                    <Typography variant="h6">
                      {formatPercent(analysis.liquidity.utilization)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Risk Level
                    </Typography>
                    <Chip 
                      label={analysis.risk.level} 
                      color={getRiskColor(analysis.risk.level) as any}
                      size="small"
                    />
                  </Grid>
                </Grid>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle1" gutterBottom>
                  Risk Factors
                </Typography>
                <Box sx={{ mb: 2 }}>
                  {analysis.risk.factors.map((factor, index) => (
                    <Chip 
                      key={index}
                      label={factor} 
                      color="warning"
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
                
                <Typography variant="subtitle1" gutterBottom>
                  Recommendation
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Chip 
                    label={analysis.recommendations.action} 
                    color={getActionColor(analysis.recommendations.action) as any}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Typography variant="body2" color="textSecondary">
                    {analysis.recommendations.reason}
                  </Typography>
                </Box>
                
                {analysis.recommendations.suggestedSize && (
                  <Typography variant="body2" color="textSecondary">
                    Suggested Size: {analysis.recommendations.suggestedSize.toFixed(2)}
                  </Typography>
                )}
                
                {analysis.recommendations.suggestedDelay && (
                  <Typography variant="body2" color="textSecondary">
                    Suggested Delay: {analysis.recommendations.suggestedDelay} seconds
                  </Typography>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Active Protections */}
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Active Protections
            </Typography>
            
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Side</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {protections.map((protection) => (
                    <TableRow key={protection.id}>
                      <TableCell>{protection.symbol}</TableCell>
                      <TableCell>{protection.side}</TableCell>
                      <TableCell>{protection.size.toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip 
                          label={protection.status} 
                          color={getStatusColor(protection.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {protection.actions.length} actions
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {protections.length === 0 && (
              <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                No active protections
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default SlippageProtectionPanel;
