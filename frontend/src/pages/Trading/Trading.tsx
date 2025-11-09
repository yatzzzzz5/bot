import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Add,
  Close,
  Edit,
  Warning,
  AccountBalance,
  ShowChart,
  Security,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { tradingService } from '../../services/tradingService';

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

const LeverageTrading: React.FC = () => {
  const [openPositionDialog, setOpenPositionDialog] = useState(false);
  const [closePositionDialog, setClosePositionDialog] = useState<string | null>(null);
  
  // Form state for new position
  const [newPosition, setNewPosition] = useState({
    symbol: 'BTC',
    type: 'LONG',
    size: '',
    leverage: 10,
    stopLoss: '',
    takeProfit: '',
  });

  const queryClient = useQueryClient();

  // Real API queries
  const { data: positionsData, isLoading: positionsLoading } = useQuery(
    'leveragePositions',
    async () => {
      const response = await authenticatedFetch('http://localhost:5000/api/leverage/positions');
      if (!response.ok) throw new globalThis.Error('Failed to fetch positions');
      return response.json();
    },
    { refetchInterval: 5000 }
  );

  const { data: marginAccount, isLoading: marginLoading } = useQuery(
    'marginAccount',
    async () => {
      const response = await authenticatedFetch('http://localhost:5000/api/leverage/margin-account');
      if (!response.ok) throw new globalThis.Error('Failed to fetch margin account');
      return response.json();
    },
    { refetchInterval: 2000 } // Update every 2 seconds for real-time data
  );

  // AI Trading Signals
  const { data: aiSignals, isLoading: signalsLoading } = useQuery(
    'aiSignals',
    async () => {
      const response = await authenticatedFetch('http://localhost:5000/api/ai/signals');
      if (!response.ok) throw new globalThis.Error('Failed to fetch AI signals');
      return response.json();
    },
    { refetchInterval: 30000 } // Update every 30 seconds
  );

  // Open position mutation
  const openPositionMutation = useMutation(
    async (positionData: any) => {
      const response = await authenticatedFetch('http://localhost:5000/api/leverage/open-position', {
        method: 'POST',
        body: JSON.stringify(positionData)
      });
      if (!response.ok) throw new globalThis.Error('Failed to open position');
      return response.json();
    },
    {
      onSuccess: () => {
        toast.success('Position opened successfully!');
        queryClient.invalidateQueries('leveragePositions');
        queryClient.invalidateQueries('marginAccount');
        setOpenPositionDialog(false);
        setNewPosition({
          symbol: 'BTC',
          type: 'LONG',
          size: '',
          leverage: 10,
          stopLoss: '',
          takeProfit: '',
        });
      },
      onError: (error: any) => {
        toast.error(error?.message || 'Failed to open position');
      }
    }
  );

  // Close position mutation
  const closePositionMutation = useMutation(
    async ({ positionId, exitPrice }: { positionId: string; exitPrice: number }) => {
      const response = await authenticatedFetch(`http://localhost:5000/api/leverage/close-position/${positionId}`, {
        method: 'POST',
        body: JSON.stringify({ exitPrice })
      });
      if (!response.ok) throw new globalThis.Error('Failed to close position');
      return response.json();
    },
    {
      onSuccess: () => {
        toast.success('Position closed successfully!');
        queryClient.invalidateQueries('leveragePositions');
        queryClient.invalidateQueries('marginAccount');
        setClosePositionDialog(null);
      },
      onError: (error: any) => {
        toast.error(error?.message || 'Failed to close position');
      }
    }
  );

  const positions = positionsData?.positions || [];
  

  
  const totalPnL = positions.reduce((sum: number, pos: any) => sum + (pos.pnl || 0), 0);
  const totalPnLPercent = positions.length > 0 ? 
    positions.reduce((sum: number, pos: any) => sum + (pos.pnlPercent || 0), 0) / positions.length : 0;

  const handleOpenPosition = () => {
    setOpenPositionDialog(true);
  };

  const handleClosePosition = (positionId: string) => {
    setClosePositionDialog(positionId);
  };

  const handleEditPosition = (positionId: string) => {
    // Edit position functionality can be implemented here
    console.log('Edit position:', positionId);
  };

  const handleSubmitPosition = () => {
    // Validate form
    if (!newPosition.size || parseFloat(newPosition.size) <= 0) {
      toast.error('Please enter a valid position size');
      return;
    }

    // Submit position
    openPositionMutation.mutate({
      symbol: newPosition.symbol,
      type: newPosition.type,
      size: parseFloat(newPosition.size),
      leverage: newPosition.leverage,
      stopLoss: newPosition.stopLoss ? parseFloat(newPosition.stopLoss) : undefined,
      takeProfit: newPosition.takeProfit ? parseFloat(newPosition.takeProfit) : undefined
    });
  };

  const handleClosePositionConfirm = (positionId: string) => {
    const position = positions.find((p: any) => p.id === positionId);
    if (position) {
      closePositionMutation.mutate({
        positionId,
        exitPrice: position.currentPrice
      });
    }
  };

  const getPositionTypeColor = (type: string) => {
    return type === 'LONG' ? 'success' : 'error';
  };

  const getPnLColor = (pnl: number) => {
    return pnl >= 0 ? 'success' : 'error';
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'success';
      case 'MEDIUM': return 'warning';
      case 'HIGH': return 'error';
      case 'EXTREME': return 'error';
      default: return 'warning';
    }
  };

  if (marginLoading || positionsLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <LinearProgress sx={{ width: '50%' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          🚀 Leverage Trading
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={handleOpenPosition}
          sx={{ minWidth: 150 }}
        >
          Open Position
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Margin Account Summary */}
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AccountBalance color="primary" />
                <Typography variant="h6">Margin Account</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Balance
                </Typography>
                <Typography variant="h5" color="primary" fontWeight="bold">
                  ${marginAccount?.totalBalance?.toLocaleString() || '0'}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Margin Balance
                </Typography>
                <Typography variant="h6" color="success.main" fontWeight="bold">
                  ${marginAccount?.marginBalance?.toLocaleString() || '0'}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Margin Used
                </Typography>
                <Typography variant="h6" color="warning.main" fontWeight="bold">
                  ${marginAccount?.marginUsed?.toLocaleString() || '0'}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Free Margin
                </Typography>
                <Typography variant="h6" color="success.main" fontWeight="bold">
                  ${marginAccount?.marginFree?.toLocaleString() || '0'}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Margin Ratio
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(marginAccount?.marginRatio || 0) * 100}
                    color={getRiskLevelColor(marginAccount?.riskLevel || 'MEDIUM')}
                    sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body2" fontWeight="bold">
                    {((marginAccount?.marginRatio || 0) * 100).toFixed(2)}%
                  </Typography>
                </Box>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Risk Level
                </Typography>
                <Chip
                  label={marginAccount?.riskLevel || 'MEDIUM'}
                  color={getRiskLevelColor(marginAccount?.riskLevel || 'MEDIUM')}
                  variant="filled"
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Portfolio Summary */}
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ShowChart color="primary" />
                <Typography variant="h6">Portfolio Summary</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Open Positions
                </Typography>
                <Typography variant="h5" color="primary" fontWeight="bold">
                  {positions.filter((p: any) => p.status === 'OPEN').length}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Total P&L
                </Typography>
                <Typography 
                  variant="h5" 
                  color={getPnLColor(totalPnL)} 
                  fontWeight="bold"
                >
                  ${totalPnL.toLocaleString()}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Avg P&L %
                </Typography>
                <Typography 
                  variant="h6" 
                  color={getPnLColor(totalPnLPercent)} 
                  fontWeight="bold"
                >
                  {totalPnLPercent.toFixed(2)}%
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Max Leverage
                </Typography>
                <Typography variant="h6" color="warning.main" fontWeight="bold">
                  {marginAccount?.maxLeverage || 100}x
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

                 {/* Risk Management */}
         <Grid item xs={12} md={4}>
           <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
             <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                 <Security color="primary" />
                 <Typography variant="h6">Risk Management</Typography>
               </Box>
               
               <Alert severity="info" sx={{ mb: 2 }}>
                 <Typography variant="body2">
                   <strong>Liquidation Threshold:</strong> 80%
                 </Typography>
                 <Typography variant="body2">
                   <strong>Max Daily Loss:</strong> 20%
                 </Typography>
               </Alert>
 
               <Alert severity="warning" sx={{ mb: 2 }}>
                 <Typography variant="body2">
                   <strong>⚠️ High Leverage Warning:</strong>
                 </Typography>
                 <Typography variant="body2">
                   Leverage trading involves significant risk. 
                   You can lose more than your initial investment.
                 </Typography>
               </Alert>
 
               <Box sx={{ display: 'flex', gap: 1 }}>
                 <Button
                   variant="outlined"
                   color="primary"
                   size="small"
                   startIcon={<Edit />}
                 >
                   Risk Settings
                 </Button>
                 <Button
                   variant="outlined"
                   color="warning"
                   size="small"
                   startIcon={<Warning />}
                 >
                   Emergency Stop
                 </Button>
               </Box>
             </CardContent>
           </Card>
         </Grid>

         {/* AI Trading Signals */}
         <Grid item xs={12}>
           <Card sx={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
             <CardContent>
               <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                 <TrendingUp color="primary" />
                 <Typography variant="h6">🤖 AI Trading Signals</Typography>
               </Box>
               
               {signalsLoading ? (
                 <Box sx={{ textAlign: 'center', py: 2 }}>
                   <LinearProgress sx={{ width: '50%', mx: 'auto' }} />
                 </Box>
               ) : aiSignals?.signals?.length > 0 ? (
                 <Grid container spacing={2}>
                   {aiSignals.signals.map((signal: any) => (
                     <Grid item xs={12} sm={6} md={4} key={signal.symbol}>
                       <Card sx={{ 
                         background: signal.type === 'LONG' ? 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)' :
                                   signal.type === 'SHORT' ? 'linear-gradient(135deg, #c62828 0%, #d32f2f 100%)' :
                                   'linear-gradient(135deg, #424242 0%, #616161 100%)',
                         color: 'white'
                       }}>
                         <CardContent sx={{ p: 2 }}>
                           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                             <Typography variant="h6" fontWeight="bold">
                               {signal.symbol}
                             </Typography>
                             <Chip
                               label={signal.type}
                               color={signal.type === 'LONG' ? 'success' : signal.type === 'SHORT' ? 'error' : 'default'}
                               size="small"
                               sx={{ color: 'white', fontWeight: 'bold' }}
                             />
                           </Box>
                           
                           <Typography variant="body2" sx={{ mb: 1 }}>
                             <strong>Strength:</strong> {signal.strength}
                           </Typography>
                           
                           <Typography variant="body2" sx={{ mb: 1 }}>
                             <strong>Confidence:</strong> {(signal.confidence * 100).toFixed(1)}%
                           </Typography>
                           
                           <Typography variant="body2" sx={{ mb: 1, fontSize: '0.8rem' }}>
                             {signal.reason}
                           </Typography>
                           
                           <Box sx={{ mt: 2, p: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
                             <Typography variant="caption" display="block">
                               <strong>Entry:</strong> ${signal.entryPrice?.toFixed(2)}
                             </Typography>
                             <Typography variant="caption" display="block">
                               <strong>Stop Loss:</strong> ${signal.stopLoss?.toFixed(2)}
                             </Typography>
                             <Typography variant="caption" display="block">
                               <strong>Take Profit:</strong> ${signal.takeProfit?.toFixed(2)}
                             </Typography>
                             <Typography variant="caption" display="block">
                               <strong>Leverage:</strong> {signal.recommendedLeverage}x
                             </Typography>
                           </Box>
                           
                           <Button
                             variant="contained"
                             size="small"
                             fullWidth
                             sx={{ mt: 1 }}
                             onClick={() => {
                               setNewPosition({
                                 ...newPosition,
                                 symbol: signal.symbol,
                                 type: signal.type,
                                 leverage: signal.recommendedLeverage
                               });
                               setOpenPositionDialog(true);
                             }}
                           >
                             Follow Signal
                           </Button>
                         </CardContent>
                       </Card>
                     </Grid>
                   ))}
                 </Grid>
               ) : (
                 <Box sx={{ textAlign: 'center', py: 4 }}>
                   <Typography variant="body1" color="text.secondary">
                     No AI signals available. The bot is analyzing the market...
                   </Typography>
                 </Box>
               )}
             </CardContent>
           </Card>
         </Grid>

        {/* Open Positions Table */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Open Positions ({positions.filter((p: any) => p.status === 'OPEN').length})
              </Typography>
              
              
              
              {positions.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No open positions. Open your first position to get started!
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ backgroundColor: 'transparent' }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Symbol</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Size</TableCell>
                        <TableCell>Entry Price</TableCell>
                        <TableCell>Current Price</TableCell>
                        <TableCell>Leverage</TableCell>
                        <TableCell>Margin</TableCell>
                        <TableCell>P&L</TableCell>
                        <TableCell>Liquidation</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                                         <TableBody>
                       {positions.filter((p: any) => p.status === 'OPEN').map((position: any) => (
                         <TableRow key={position.id}>
                           <TableCell>
                             <Typography variant="body2" fontWeight="bold">
                               {position.symbol}
                             </Typography>
                           </TableCell>
                           <TableCell>
                             <Chip
                               icon={position.type === 'LONG' ? <TrendingUp /> : <TrendingDown />}
                               label={position.type}
                               color={getPositionTypeColor(position.type)}
                               size="small"
                             />
                           </TableCell>
                           <TableCell>{position.size}</TableCell>
                           <TableCell>${position.entryPrice?.toLocaleString() || '0'}</TableCell>
                           <TableCell>${position.currentPrice?.toLocaleString() || '0'}</TableCell>
                           <TableCell>
                             <Chip label={`${position.leverage}x`} size="small" />
                           </TableCell>
                           <TableCell>${position.margin?.toLocaleString() || '0'}</TableCell>
                           <TableCell>
                             <Typography
                               color={getPnLColor(position.pnl || 0)}
                               fontWeight="bold"
                             >
                               ${(position.pnl || 0).toLocaleString()}
                             </Typography>
                             <Typography
                               variant="caption"
                               color={getPnLColor(position.pnlPercent || 0)}
                             >
                               {(position.pnlPercent || 0).toFixed(2)}%
                             </Typography>
                           </TableCell>
                           <TableCell>
                             <Typography variant="body2" color="error.main">
                               ${position.liquidationPrice?.toLocaleString() || '0'}
                             </Typography>
                           </TableCell>
                           <TableCell>
                             <Box sx={{ display: 'flex', gap: 0.5 }}>
                               <Tooltip title="Edit Position">
                                 <IconButton
                                   size="small"
                                   color="primary"
                                   onClick={() => handleEditPosition(position.id)}
                                 >
                                   <Edit />
                                 </IconButton>
                               </Tooltip>
                               <Tooltip title="Close Position">
                                 <IconButton
                                   size="small"
                                   color="error"
                                   onClick={() => handleClosePosition(position.id)}
                                 >
                                   <Close />
                                 </IconButton>
                               </Tooltip>
                             </Box>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Open Position Dialog */}
      <Dialog open={openPositionDialog} onClose={() => setOpenPositionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Open New Position</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Symbol</InputLabel>
                <Select
                  value={newPosition.symbol}
                  onChange={(e) => setNewPosition({...newPosition, symbol: e.target.value})}
                  label="Symbol"
                >
                  <MenuItem value="BTC">BTC</MenuItem>
                  <MenuItem value="ETH">ETH</MenuItem>
                  <MenuItem value="ADA">ADA</MenuItem>
                  <MenuItem value="SOL">SOL</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={newPosition.type}
                  onChange={(e) => setNewPosition({...newPosition, type: e.target.value as 'LONG' | 'SHORT'})}
                  label="Type"
                >
                  <MenuItem value="LONG">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrendingUp color="success" />
                      LONG
                    </Box>
                  </MenuItem>
                  <MenuItem value="SHORT">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrendingDown color="error" />
                      SHORT
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Size"
                type="number"
                value={newPosition.size}
                onChange={(e) => setNewPosition({...newPosition, size: e.target.value})}
                placeholder="0.00"
                InputProps={{
                  endAdornment: <Typography variant="caption">{newPosition.symbol}</Typography>
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Leverage</InputLabel>
                <Select
                  value={newPosition.leverage}
                  onChange={(e) => setNewPosition({...newPosition, leverage: e.target.value as number})}
                  label="Leverage"
                >
                  <MenuItem value={1}>1x</MenuItem>
                  <MenuItem value={2}>2x</MenuItem>
                  <MenuItem value={5}>5x</MenuItem>
                  <MenuItem value={10}>10x</MenuItem>
                  <MenuItem value={20}>20x</MenuItem>
                  <MenuItem value={50}>50x</MenuItem>
                  <MenuItem value={100}>100x</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Stop Loss"
                type="number"
                value={newPosition.stopLoss}
                onChange={(e) => setNewPosition({...newPosition, stopLoss: e.target.value})}
                placeholder="0.00"
                InputProps={{
                  endAdornment: <Typography variant="caption">USD</Typography>
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Take Profit"
                type="number"
                value={newPosition.takeProfit}
                onChange={(e) => setNewPosition({...newPosition, takeProfit: e.target.value})}
                placeholder="0.00"
                InputProps={{
                  endAdornment: <Typography variant="caption">USD</Typography>
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPositionDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmitPosition} 
            variant="contained" 
            color="primary"
            disabled={openPositionMutation.isLoading}
          >
            {openPositionMutation.isLoading ? 'Opening...' : 'Open Position'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close Position Dialog */}
      <Dialog open={!!closePositionDialog} onClose={() => setClosePositionDialog(null)}>
        <DialogTitle>Close Position</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to close this position? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClosePositionDialog(null)}>Cancel</Button>
          <Button 
            onClick={() => closePositionDialog && handleClosePositionConfirm(closePositionDialog)} 
            variant="contained" 
            color="error"
            disabled={closePositionMutation.isLoading}
          >
            {closePositionMutation.isLoading ? 'Closing...' : 'Close Position'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* TCA and Execution RL Panel */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            📊 TCA & Execution RL
          </Typography>
          <TCAAndRLPanel />
        </CardContent>
      </Card>
    </Box>
  );
};

// TCA and RL Panel Component
const TCAAndRLPanel: React.FC = () => {
  const [tcaStats, setTcaStats] = useState<any>(null);
  const [venuePerformance, setVenuePerformance] = useState<any>(null);
  const [rlStats, setRlStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tca, venues, rl] = await Promise.all([
        tradingService.getTCAStats(),
        tradingService.getVenuePerformance(),
        tradingService.getRLStats()
      ]);
      setTcaStats(tca);
      setVenuePerformance(venues);
      setRlStats(rl);
    } catch (error) {
      console.error('Failed to fetch TCA/RL data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Grid container spacing={2}>
      {/* TCA Statistics */}
      <Grid item xs={12} md={4}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>TCA Statistics</Typography>
        <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="caption" display="block">
            Total Transactions: {tcaStats?.totalTransactions || 0}
          </Typography>
          <Typography variant="caption" display="block">
            Avg Cost: {((tcaStats?.avgCost || 0) * 100).toFixed(3)}%
          </Typography>
          <Typography variant="caption" display="block">
            Best Venue: {tcaStats?.bestVenue || 'N/A'}
          </Typography>
          <Typography variant="caption" display="block">
            Worst Venue: {tcaStats?.worstVenue || 'N/A'}
          </Typography>
        </Box>
      </Grid>

      {/* Venue Performance */}
      <Grid item xs={12} md={4}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Venue Performance</Typography>
        <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
          {(venuePerformance?.venues || []).slice(0, 5).map((venue: any, idx: number) => (
            <Box key={idx} sx={{ mb: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="caption" display="block">
                {venue.venue} - {venue.symbol}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Trades: {venue.totalTrades} | Success: {(venue.successRate * 100).toFixed(1)}% | Cost: {venue.costEfficiency.toFixed(4)}
              </Typography>
            </Box>
          ))}
          {!(venuePerformance?.venues || []).length && (
            <Typography variant="body2" color="text.secondary">No venue data yet</Typography>
          )}
        </Box>
      </Grid>

      {/* RL Statistics */}
      <Grid item xs={12} md={4}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Reinforcement Learning</Typography>
        <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="caption" display="block">
            Total States: {rlStats?.qTable?.totalStates || 0}
          </Typography>
          <Typography variant="caption" display="block">
            Avg Q-Value: {(rlStats?.qTable?.avgQValue || 0).toFixed(3)}
          </Typography>
          <Typography variant="caption" display="block">
            Exploration Rate: {((rlStats?.qTable?.explorationRate || 0) * 100).toFixed(1)}%
          </Typography>
          <Typography variant="caption" display="block">
            Phase: {rlStats?.learning?.explorationPhase || 'LOW'}
          </Typography>
        </Box>
      </Grid>

      {/* TCA Execution Test */}
      <Grid item xs={12}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>TCA Execution Test</Typography>
        <TCAExecutionTest />
      </Grid>
    </Grid>
  );
};

// TCA Execution Test Component
const TCAExecutionTest: React.FC = () => {
  const [testParams, setTestParams] = useState({
    symbol: 'BTC',
    side: 'BUY' as 'BUY' | 'SELL',
    size: 1000,
    urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH'
  });
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleExecute = async () => {
    try {
      setExecuting(true);
      const result = await tradingService.executeWithTCA(testParams);
      setResult(result);
      toast.success('TCA execution completed');
    } catch (error) {
      toast.error('TCA execution failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={2}>
          <TextField
            fullWidth
            label="Symbol"
            value={testParams.symbol}
            onChange={(e) => setTestParams({...testParams, symbol: e.target.value})}
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Side</InputLabel>
            <Select
              value={testParams.side}
              onChange={(e) => setTestParams({...testParams, side: e.target.value as 'BUY' | 'SELL'})}
            >
              <MenuItem value="BUY">BUY</MenuItem>
              <MenuItem value="SELL">SELL</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={2}>
          <TextField
            fullWidth
            label="Size"
            type="number"
            value={testParams.size}
            onChange={(e) => setTestParams({...testParams, size: Number(e.target.value)})}
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Urgency</InputLabel>
            <Select
              value={testParams.urgency}
              onChange={(e) => setTestParams({...testParams, urgency: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH'})}
            >
              <MenuItem value="LOW">LOW</MenuItem>
              <MenuItem value="MEDIUM">MEDIUM</MenuItem>
              <MenuItem value="HIGH">HIGH</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={2}>
          <Button
            variant="contained"
            onClick={handleExecute}
            disabled={executing}
            fullWidth
          >
            {executing ? 'Executing...' : 'Test TCA'}
          </Button>
        </Grid>
      </Grid>
      
      {result && (
        <Box sx={{ mt: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="caption" display="block">
            Result: {result.status} | Mode: {result.executionMode} | Venue: {result.venue} | Cost: {result.cost?.toFixed(4)}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default LeverageTrading;
