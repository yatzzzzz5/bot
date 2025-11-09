import React, { useState, useEffect } from 'react';
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
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Slider,
  Divider
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  PlayArrow,
  Refresh,
  Info,
  AutoMode,
  Speed,
  Security,
  AccountBalance,
  FlashOn,
  SwapHoriz,
  Psychology
} from '@mui/icons-material';
import { useQuery, useMutation } from 'react-query';
import { toast } from 'react-hot-toast';

// Services
import { guaranteedProfitService } from '../../services/guaranteedProfitService';
import { tradingService } from '../../services/tradingService';

// Components
import BacktestingPanel from '../../components/BacktestingPanel';
import LiquidityAggregationPanel from '../../components/LiquidityAggregationPanel';
import SlippageProtectionPanel from '../../components/SlippageProtectionPanel';

// Types
interface GuaranteedSignal {
  symbol: string;
  action: 'LONG' | 'SHORT' | 'CLOSE' | 'ARBITRAGE' | 'FLASH_LOAN' | 'MEV' | 'YIELD_FARM';
  confidence: number;
  expectedProfit: number;
  riskLevel: 'ZERO' | 'MINIMAL' | 'LOW' | 'MEDIUM';
  timeframe: string;
  reason: string;
  stopLoss?: number;
  takeProfit?: number;
  entryPrice?: number;
  exitPrice?: number;
  arbitrageExchanges?: string[];
  flashLoanAmount?: number;
  mevOpportunity?: string;
  yieldProtocol?: string;
}

interface TradingSettings {
  autoTrading: boolean;
  maxInvestment: number;
  riskLevel: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  minConfidence: number;
  maxPositions: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  arbitrageEnabled: boolean;
  flashLoanEnabled: boolean;
  mevEnabled: boolean;
  yieldFarmingEnabled: boolean;
}

const GuaranteedProfit: React.FC = () => {
  const [isAutoTrading, setIsAutoTrading] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [tradingSettings, setTradingSettings] = useState<TradingSettings>({
    autoTrading: false,
    maxInvestment: 1000,
    riskLevel: 'MODERATE',
    minConfidence: 85,
    maxPositions: 5,
    stopLossPercentage: 2,
    takeProfitPercentage: 5,
    arbitrageEnabled: true,
    flashLoanEnabled: true,
    mevEnabled: true,
    yieldFarmingEnabled: true
  });

  // Real-time signals
  const { data: signals, isLoading: signalsLoading, error: signalsError } = useQuery<GuaranteedSignal[]>(
    'guaranteedSignals',
    guaranteedProfitService.getActiveSignals,
    {
      refetchInterval: 3000,
      retry: 3,
      onError: (error) => console.error('Signals fetch error:', error)
    }
  );

  const [oppSymbol, setOppSymbol] = useState<string>('BTC');
  const [spotExchange, setSpotExchange] = useState<string>('Binance');
  const [perpExchange, setPerpExchange] = useState<string>('Binance');
  const [basisNotional, setBasisNotional] = useState<number>(100);
  const [execMode, setExecMode] = useState<'DIRECT' | 'TWAP' | 'ICEBERG'>('DIRECT');
  const [twapSlices, setTwapSlices] = useState<number>(3);
  const [twapIntervalMs, setTwapIntervalMs] = useState<number>(200);
  const [icebergPeak, setIcebergPeak] = useState<number>(50);
  const [limitPrice, setLimitPrice] = useState<number | undefined>(undefined);
  const { data: oppData } = useQuery<any>(
    ['gpOpp', oppSymbol],
    () => guaranteedProfitService.getOpportunities(oppSymbol),
    { refetchInterval: 10000, retry: 3 }
  );

  // Portfolio data
  const { data: portfolio, isLoading: portfolioLoading } = useQuery<any>(
    'portfolio',
    guaranteedProfitService.getPortfolio,
    {
      refetchInterval: 5000,
      retry: 3
    }
  );

  // Performance data
  const { data: performance, isLoading: performanceLoading } = useQuery<any>(
    'performance',
    guaranteedProfitService.getPerformance,
    {
      refetchInterval: 10000,
      retry: 3
    }
  );

  // System status (guards & sizing)
  const { data: systemStatus, isLoading: statusLoading } = useQuery<any>(
    'gpSystemStatus',
    guaranteedProfitService.getSystemStatus,
    {
      refetchInterval: 5000,
      retry: 3
    }
  );
  const { data: monitoringData } = useQuery<any>(
    'gpMonitoring',
    guaranteedProfitService.getMonitoring,
    { refetchInterval: 7000, retry: 3 }
  );
  const { data: alertsData } = useQuery<any>(
    'gpAlerts',
    guaranteedProfitService.getAlerts,
    { refetchInterval: 8000, retry: 3 }
  );
  const { data: basisList } = useQuery<any[]>(
    'gpBasisList',
    guaranteedProfitService.getBasisList,
    { refetchInterval: 10000, retry: 3 }
  );
  const { data: healthDeep } = useQuery<any>(
    'gpHealthDeep',
    guaranteedProfitService.getHealthDeep,
    { refetchInterval: 15000, retry: 3 }
  );

  // Speed Mode local state + toggle
  const [speedModeEnabled, setSpeedModeEnabled] = useState<boolean>(false);
  useEffect(() => {
    if (systemStatus?.speedMode) {
      setSpeedModeEnabled(!!systemStatus.speedMode.enabled);
    }
  }, [systemStatus]);
  const toggleSpeedModeMutation = useMutation(
    (enabled: boolean) => guaranteedProfitService.toggleSpeedMode(enabled),
    {
      onSuccess: (data: any) => {
        setSpeedModeEnabled(!!data.enabled);
        toast.success(data.enabled ? 'Speed Mode: AKTİF' : 'Speed Mode: PASİF');
      },
      onError: (error) => {
        toast.error(`Speed Mode hata: ${error}`);
      }
    }
  );

  // Mutations
  const executeSignalMutation = useMutation(
    guaranteedProfitService.executeSignal,
    {
      onSuccess: (data: any) => {
        toast.success(`İşlem başarılı! ${data.profit} USD kazanç`);
      },
      onError: (error) => {
        toast.error(`İşlem hatası: ${error}`);
      }
    }
  );

  const toggleAutoTradingMutation = useMutation(
    guaranteedProfitService.toggleAutoTrading,
    {
      onSuccess: (data: any) => {
        setIsAutoTrading(data.autoTrading);
        toast.success(data.autoTrading ? 'Otomatik işlemler başlatıldı' : 'Otomatik işlemler durduruldu');
      },
      onError: (error) => {
        toast.error(`Otomatik işlem hatası: ${error}`);
      }
    }
  );

  const updateSettingsMutation = useMutation(
    guaranteedProfitService.updateSettings,
    {
      onSuccess: () => {
        toast.success('Ayarlar güncellendi');
        setSettingsDialogOpen(false);
      },
      onError: (error) => {
        toast.error(`Ayar güncelleme hatası: ${error}`);
      }
    }
  );

  // Preset & Basis mutations
  const setPresetMutation = useMutation<{ activePreset: string }, unknown, 'MICRO_SAFE' | 'SPEED'>(
    ['setPreset'],
    (key) => guaranteedProfitService.setPreset(key),
    {
      onSuccess: (data) => { toast.success(`Preset aktif: ${data.activePreset}`); },
      onError: (error) => { toast.error(`Preset hatası: ${error}`); }
    }
  );

  const openBasisMutation = useMutation(
    ['openBasis'],
    () => guaranteedProfitService.openBasis({ symbol: oppSymbol, spotExchange, perpExchange, notionalUSD: basisNotional }),
    { onSuccess: () => { toast.success('Basis açıldı'); }, onError: (e) => { toast.error(`Basis açma hatası: ${e}`); } }
  );
  const closeBasisMutation = useMutation(
    ['closeBasis'],
    () => guaranteedProfitService.closeBasis({ symbol: oppSymbol, spotExchange, perpExchange }),
    { onSuccess: () => { toast.success('Basis kapatıldı'); }, onError: (e) => { toast.error(`Basis kapatma hatası: ${e}`); } }
  );
  const rolloverBasisMutation = useMutation(
    ['rolloverBasis'],
    () => guaranteedProfitService.rolloverBasis({ symbol: oppSymbol, perpExchange }),
    { onSuccess: () => { toast.success('Basis rollover yapıldı'); }, onError: (e) => { toast.error(`Basis rollover hatası: ${e}`); } }
  );

  // Auto-trading status
  useEffect(() => {
    if (signals && signals.length > 0) {
      const highConfidenceSignals = signals.filter(
        (signal: GuaranteedSignal) => 
          signal.confidence >= tradingSettings.minConfidence && 
          signal.expectedProfit >= 2
      );

      if (highConfidenceSignals.length > 0 && isAutoTrading) {
        // Otomatik işlem yap
        highConfidenceSignals.forEach((signal: GuaranteedSignal) => {
          executeSignalMutation.mutate({
            signal,
            amount: tradingSettings.maxInvestment / highConfidenceSignals.length,
            auto: true,
            options: { maxSlippagePct: 0.15, minLiquidityUSD: 10000 }
          });
        });
      }
    }
  }, [signals, isAutoTrading, tradingSettings, executeSignalMutation]);

  const handleExecuteSignal = (signal: GuaranteedSignal) => {
    executeSignalMutation.mutate({
      signal,
      amount: tradingSettings.maxInvestment,
      auto: false,
      options: { postOnly: true, maxSlippagePct: 0.15, minLiquidityUSD: 10000 }
    });
  };

  const handleToggleAutoTrading = () => {
    toggleAutoTradingMutation.mutate({
      enabled: !isAutoTrading,
      settings: tradingSettings
    });
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'ZERO': return 'success';
      case 'MINIMAL': return 'warning';
      case 'LOW': return 'info';
      case 'MEDIUM': return 'error';
      default: return 'default';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'LONG': return <TrendingUp color="success" />;
      case 'SHORT': return <TrendingDown color="error" />;
      case 'ARBITRAGE': return <SwapHoriz color="primary" />;
      case 'FLASH_LOAN': return <FlashOn color="warning" />;
      case 'MEV': return <Speed color="info" />;
      case 'YIELD_FARM': return <AccountBalance color="success" />;
      default: return <Info />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'LONG': return 'success';
      case 'SHORT': return 'error';
      case 'ARBITRAGE': return 'primary';
      case 'FLASH_LOAN': return 'warning';
      case 'MEV': return 'info';
      case 'YIELD_FARM': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
          🚀 Garanti Kazanç Sistemi
        </Typography>
        <Typography variant="body1" color="text.secondary">
          %100 garanti kazanç fırsatları ve otomatik işlem sistemi
        </Typography>
      </Box>

      {/* Status Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AutoMode color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Otomatik İşlem</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h4" color={isAutoTrading ? 'success.main' : 'error.main'}>
                  {isAutoTrading ? 'AKTİF' : 'PASİF'}
                </Typography>
                <Switch
                  checked={isAutoTrading}
                  onChange={handleToggleAutoTrading}
                  color="primary"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Günlük Kazanç</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {performance?.dailyProfit ? `$${performance.dailyProfit.toFixed(2)}` : '$0.00'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {performance?.dailyProfitPercentage ? `%${performance.dailyProfitPercentage.toFixed(2)}` : '%0.00'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Security color="info" sx={{ mr: 1 }} />
                <Typography variant="h6">Aktif Sinyaller</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                {signals?.length || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Yüksek güvenilirlik
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountBalance color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">Toplam Portföy</Typography>
              </Box>
              <Typography variant="h4" color="warning.main">
                {portfolio?.totalValue ? `$${portfolio.totalValue.toFixed(2)}` : '$0.00'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {portfolio?.totalProfit ? `+$${portfolio.totalProfit.toFixed(2)}` : '+$0.00'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Control Panel */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Kontrol Paneli</Typography>
            <Box>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => window.location.reload()}
                sx={{ mr: 1 }}
              >
                Yenile
              </Button>
              <Button
                variant="outlined"
                color="success"
                onClick={() => guaranteedProfitService.setPreset('MICRO_SAFE').then(r=>toast.success(`Preset: ${r.activePreset}`)).catch(e=>toast.error(`${e}`))}
                sx={{ mr: 1 }}
              >
                MICRO_SAFE
              </Button>
              <Button
                variant="outlined"
                color="warning"
                onClick={() => guaranteedProfitService.setPreset('SPEED').then(r=>toast.success(`Preset: ${r.activePreset}`)).catch(e=>toast.error(`${e}`))}
                sx={{ mr: 1 }}
              >
                SPEED
              </Button>
              <Button
                variant={speedModeEnabled ? 'contained' : 'outlined'}
                color={speedModeEnabled ? 'success' : 'warning'}
                onClick={() => toggleSpeedModeMutation.mutate(!speedModeEnabled)}
                sx={{ mr: 1 }}
              >
                {speedModeEnabled ? 'Speed Mode: ON' : 'Speed Mode: OFF'}
              </Button>
              <Button
                variant="contained"
                startIcon={<Psychology />}
                onClick={() => setSettingsDialogOpen(true)}
              >
                Ayarlar
              </Button>
            </Box>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Otomatik İşlem:</strong> {isAutoTrading ? 'Aktif' : 'Pasif'}
                </Typography>
                <Typography variant="body2">
                  <strong>Min Güven:</strong> %{tradingSettings.minConfidence}
                </Typography>
                <Typography variant="body2">
                  <strong>Maks Yatırım:</strong> ${tradingSettings.maxInvestment}
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 140, mr: 1 }}>
                    <InputLabel>execMode</InputLabel>
                    <Select label="execMode" value={execMode} onChange={(e)=>setExecMode(e.target.value as any)}>
                      <MenuItem value="DIRECT">DIRECT</MenuItem>
                      <MenuItem value="TWAP">TWAP</MenuItem>
                      <MenuItem value="ICEBERG">ICEBERG</MenuItem>
                    </Select>
                  </FormControl>
                  {execMode === 'TWAP' && (
                    <>
                      <TextField size="small" type="number" label="slices" value={twapSlices} onChange={(e)=>setTwapSlices(Number(e.target.value))} sx={{ mr: 1, width: 90 }} />
                      <TextField size="small" type="number" label="interval ms" value={twapIntervalMs} onChange={(e)=>setTwapIntervalMs(Number(e.target.value))} sx={{ mr: 1, width: 120 }} />
                    </>
                  )}
                  {execMode === 'ICEBERG' && (
                    <>
                      <TextField size="small" type="number" label="peak" value={icebergPeak} onChange={(e)=>setIcebergPeak(Number(e.target.value))} sx={{ mr: 1, width: 90 }} />
                      <TextField size="small" type="number" label="limit" value={limitPrice ?? ''} onChange={(e)=>setLimitPrice(Number(e.target.value))} sx={{ mr: 1, width: 120 }} />
                    </>
                  )}
                </Box>
              </Alert>
            </Grid>

            <Grid item xs={12} md={6}>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Arbitraj:</strong> {tradingSettings.arbitrageEnabled ? 'Aktif' : 'Pasif'}
                </Typography>
                <Typography variant="body2">
                  <strong>Flash Loan:</strong> {tradingSettings.flashLoanEnabled ? 'Aktif' : 'Pasif'}
                </Typography>
                <Typography variant="body2">
                  <strong>MEV:</strong> {tradingSettings.mevEnabled ? 'Aktif' : 'Pasif'}
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Basis Positions */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            📒 Basis Pozisyonları
          </Typography>
          {!basisList ? (
            <LinearProgress />
          ) : basisList.length === 0 ? (
            <Alert severity="info">Kayıtlı basis pozisyonu yok</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Spot</TableCell>
                    <TableCell>Perp</TableCell>
                    <TableCell>Notional</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Açılış</TableCell>
                    <TableCell>İşlem</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {basisList.map((bp: any, i: number) => (
                    <TableRow key={i} hover>
                      <TableCell>{bp.symbol}</TableCell>
                      <TableCell>{bp.spotExchange}</TableCell>
                      <TableCell>{bp.perpExchange}</TableCell>
                      <TableCell>${bp.notionalUSD}</TableCell>
                      <TableCell>{bp.status}</TableCell>
                      <TableCell>{new Date(bp.openedAt).toLocaleString()}</TableCell>
                      <TableCell>
                        {bp.status === 'OPEN' ? (
                          <>
                            <Button size="small" variant="outlined" sx={{ mr: 1 }} onClick={()=> guaranteedProfitService.closeBasis({ symbol: bp.symbol, spotExchange: bp.spotExchange, perpExchange: bp.perpExchange }).then(()=>toast.success('Closed')).catch(e=>toast.error(`${e}`))}>Close</Button>
                            <Button size="small" variant="outlined" onClick={()=> guaranteedProfitService.rolloverBasis({ symbol: bp.symbol, perpExchange: bp.perpExchange }).then(()=>toast.success('Rolled')).catch(e=>toast.error(`${e}`))}>Rollover</Button>
                          </>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Active Signals */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            🚨 Aktif Garanti Kazanç Sinyalleri
          </Typography>

          {signalsLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <LinearProgress sx={{ flexGrow: 1, mr: 2 }} />
              <Typography>Sinyaller yükleniyor...</Typography>
            </Box>
          ) : signalsError ? (
            <Alert severity="error">Sinyaller yüklenemedi</Alert>
          ) : signals && signals.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Sembol</TableCell>
                    <TableCell>İşlem</TableCell>
                    <TableCell>Güven</TableCell>
                    <TableCell>Beklenen Kazanç</TableCell>
                    <TableCell>Risk</TableCell>
                    <TableCell>Süre</TableCell>
                    <TableCell>İşlemler</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {signals.map((signal: GuaranteedSignal, index: number) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="h6" sx={{ mr: 1 }}>
                            {signal.symbol}
                          </Typography>
                          {getActionIcon(signal.action)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={signal.action}
                          color={getActionColor(signal.action) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ mr: 1 }}>
                            %{signal.confidence}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={signal.confidence}
                            sx={{ width: 50, height: 6 }}
                            color={signal.confidence >= 95 ? 'success' : signal.confidence >= 85 ? 'warning' : 'error'}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="success.main" fontWeight="bold">
                          %{signal.expectedProfit.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={signal.riskLevel}
                          color={getRiskColor(signal.riskLevel) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {signal.timeframe}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<PlayArrow />}
                          onClick={() => handleExecuteSignal({ ...signal, execOptions: { execMode, twapSlices, twapIntervalMs, icebergPeak, limitPrice } } as any)}
                          disabled={executeSignalMutation.isLoading}
                          sx={{ mr: 1 }}
                        >
                          İşlem Yap
                        </Button>
                        <Tooltip title={signal.reason}>
                          <IconButton size="small">
                            <Info />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">Şu anda aktif sinyal bulunmuyor</Alert>
          )}
        </CardContent>
      </Card>

      {/* Opportunities Snapshot (symbol selectable) */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            🎯 Fırsatlar (anlık)
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Symbol</InputLabel>
              <Select
                label="Symbol"
                value={oppSymbol}
                onChange={(e) => setOppSymbol(e.target.value as string)}
              >
                {['BTC','ETH','ADA','DOT','LINK','UNI','AAVE','COMP'].map(sym => (
                  <MenuItem key={sym} value={sym}>{sym}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField size="small" label="Spot" value={spotExchange} onChange={(e)=>setSpotExchange(e.target.value)} sx={{ ml: 2, width: 130 }} />
            <TextField size="small" label="Perp" value={perpExchange} onChange={(e)=>setPerpExchange(e.target.value)} sx={{ ml: 1, width: 130 }} />
            <TextField size="small" type="number" label="Notional ($)" value={basisNotional} onChange={(e)=>setBasisNotional(Number(e.target.value))} sx={{ ml: 1, width: 140 }} />
            <Button size="small" variant="outlined" sx={{ ml: 1 }} onClick={()=>setPresetMutation.mutate('MICRO_SAFE')}>Preset: Safe</Button>
            <Button size="small" variant="outlined" sx={{ ml: 1 }} color="warning" onClick={()=>setPresetMutation.mutate('SPEED')}>Preset: Speed</Button>
            <Button size="small" variant="contained" sx={{ ml: 2 }} onClick={()=>openBasisMutation.mutate()} disabled={openBasisMutation.isLoading}>Basis Open</Button>
            <Button size="small" variant="outlined" sx={{ ml: 1 }} onClick={()=>closeBasisMutation.mutate()} disabled={closeBasisMutation.isLoading}>Basis Close</Button>
            <Button size="small" variant="outlined" sx={{ ml: 1 }} onClick={()=>rolloverBasisMutation.mutate()} disabled={rolloverBasisMutation.isLoading}>Rollover</Button>
          </Box>
          {!oppData ? (
            <LinearProgress />
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Arbitraj</Typography>
                <Typography variant="body2">{oppData.arbitrage?.length || 0} fırsat</Typography>
                {oppData.arbitrage?.slice(0,3)?.map((o: any, i: number) => (
                  <Typography key={i} variant="caption" color="text.secondary" display="block">
                    {o.buyExchange}→{o.sellExchange} • net %{(o.netProfit ?? o.profit ?? 0).toFixed?.(2) ?? o.netProfit}
                  </Typography>
                ))}
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Liquidation</Typography>
                <Typography variant="body2">{oppData.liquidation?.length || 0} fırsat</Typography>
                {oppData.liquidation?.slice(0,3)?.map((l: any, i: number) => (
                  <Typography key={i} variant="caption" color="text.secondary" display="block">
                    {l.side} • edge %{(l.expectedEdgePct ?? 0).toFixed?.(2) ?? l.expectedEdgePct} • heat {l.heatScore}
                  </Typography>
                ))}
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Options Vol-Arb</Typography>
                <Typography variant="body2">{oppData.optionsVolArb?.length || 0} fırsat</Typography>
                {oppData.optionsVolArb?.slice(0,3)?.map((v: any, i: number) => (
                  <Typography key={i} variant="caption" color="text.secondary" display="block">
                    {v.strategy} • ivEdge %{(v.ivEdgePct ?? 0).toFixed?.(2) ?? v.ivEdgePct}
                  </Typography>
                ))}
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">MEV / Flash / Yield</Typography>
                <Typography variant="body2">
                  {oppData.mev?.length || 0} / {oppData.flashLoan?.length || 0} / {oppData.yield?.length || 0}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Funding & Borrow</Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Funding next: %{oppData.funding?.nextFundingRatePct?.toFixed?.(3) ?? '-'} in ~{oppData.funding?.timeToFundingMin ?? '-'}m (conf {oppData.funding?.confidence ?? '-'})
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Best borrow: {oppData.borrowBest?.venue ?? '-'} {oppData.borrowBest ? `(${oppData.borrowBest.base} ${oppData.borrowBest.borrowApyPct}% APY)` : ''}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Options (Skew/Surface)</Typography>
                <Typography variant="body2">{oppData.options?.length || 0} fırsat</Typography>
                {oppData.options?.slice(0,3)?.map((o: any, i: number) => (
                  <Typography key={i} variant="caption" color="text.secondary" display="block">
                    {o.type} • edge %{(o.edgePct ?? 0).toFixed?.(2) ?? o.edgePct}
                  </Typography>
                ))}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2">News & Entities</Typography>
                {oppData.news?.slice(0,3)?.map((n: any, i: number) => (
                  <Typography key={i} variant="caption" color="text.secondary" display="block">
                    {new Date(n.ts).toLocaleTimeString()} • {n.headline} (s={n.sentiment})
                  </Typography>
                ))}
                {oppData.entities?.slice(0,3)?.map((e: any, i: number) => (
                  <Typography key={i} variant="caption" color="text.secondary" display="block">
                    {e.entity}: {e.score} ({e.count})
                  </Typography>
                ))}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2">Flow & Anomalies</Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Flow dir conf: {oppData.flow?.directionalConfidence ?? '-'} • WhaleNet ${oppData.flow?.whaleNetUSD ?? '-'} • CEX In ${oppData.flow?.cexInflowUSD ?? '-'} Out ${oppData.flow?.cexOutflowUSD ?? '-'}
                </Typography>
                {oppData.anomalies?.slice(0,3)?.map((a: any, i: number) => (
                  <Typography key={i} variant="caption" color="text.secondary" display="block">
                    {a.type} (sev={a.severity})
                  </Typography>
                ))}
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                📊 Performans Metrikleri
              </Typography>
              
              {performanceLoading ? (
                <LinearProgress />
              ) : performance ? (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Toplam Kazanç</Typography>
                    <Typography variant="body2" color="success.main" fontWeight="bold">
                      ${performance.totalProfit?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Başarı Oranı</Typography>
                    <Typography variant="body2" color="success.main" fontWeight="bold">
                      %{performance.successRate?.toFixed(1) || '0.0'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Toplam İşlem</Typography>
                    <Typography variant="body2">
                      {performance.totalTrades || 0}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Ortalama Kazanç</Typography>
                    <Typography variant="body2" color="success.main" fontWeight="bold">
                      %{performance.averageProfit?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Performans verisi yüklenemedi
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                💰 Portföy Durumu
              </Typography>
              
              {portfolioLoading ? (
                <LinearProgress />
              ) : portfolio ? (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Toplam Değer</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      ${portfolio.totalValue?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Nakit</Typography>
                    <Typography variant="body2">
                      ${portfolio.cash?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Aktif Pozisyonlar</Typography>
                    <Typography variant="body2">
                      {portfolio.activePositions || 0}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Risk Seviyesi</Typography>
                    <Typography variant="body2" color="warning.main">
                      {portfolio.riskLevel || 'Orta'}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Portföy verisi yüklenemedi
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Guards & Sizing Status */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            🛡️ Guard / Sizing Durumu
          </Typography>
          {statusLoading ? (
            <LinearProgress />
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Koruma Pencereleri</Typography>
                <Typography variant="body2">
                  Rejim: {systemStatus?.regime || 'UNKNOWN'}
                </Typography>
                <Typography variant="body2">
                  Circuit Breaker: {systemStatus?.circuitBreakerUntil ? new Date(systemStatus.circuitBreakerUntil).toLocaleString() : 'Pasif'}
                </Typography>
                <Typography variant="body2">
                  Spike Freeze: {systemStatus?.spikeActiveUntil ? new Date(systemStatus.spikeActiveUntil).toLocaleString() : 'Pasif'}
                </Typography>
                <Typography variant="body2">
                  News Freeze: {systemStatus?.newsActiveUntil ? new Date(systemStatus.newsActiveUntil).toLocaleString() : 'Pasif'}
                </Typography>
                <Typography variant="body2">
                  Günlük PnL (USD): {systemStatus?.dailyLossUSD ?? 0}
                </Typography>
                <Typography variant="body2">
                  Art arda Zarar: {systemStatus?.consecutiveLosses ?? 0}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Sembol CB: {(systemStatus?.symbolCircuitBreakers?.length || 0)}
                  </Typography>
                  {systemStatus?.symbolCircuitBreakers?.slice(0,4)?.map((it: any, i: number) => (
                    <Typography key={i} variant="caption" color="text.secondary" display="block">
                      {it[0]} → {new Date(it[1]).toLocaleTimeString()}
                    </Typography>
                  ))}
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Strateji CB: {(systemStatus?.strategyCircuitBreakers?.length || 0)}
                  </Typography>
                  {systemStatus?.strategyCircuitBreakers?.slice(0,4)?.map((it: any, i: number) => (
                    <Typography key={i} variant="caption" color="text.secondary" display="block">
                      {it[0]} → {new Date(it[1]).toLocaleTimeString()}
                    </Typography>
                  ))}
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    L2 Likidite (ipucu): BTC ${systemStatus?.marketData?.l2?.topLiquidityHint?.BTC ?? '-'} | ETH ${systemStatus?.marketData?.l2?.topLiquidityHint?.ETH ?? '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Latency: {systemStatus?.latency?.lastLatencyMs ?? '-'} ms | Clock skew: {systemStatus?.latency?.clockSkewMs ?? '-'} ms
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Sizing Parametreleri</Typography>
                <Typography variant="body2">
                  Kelly Cap: %{((systemStatus?.sizing?.kellyFractionCap ?? 0) * 100).toFixed(1)}
                </Typography>
                <Typography variant="body2">
                  Hedef Volatilite: %{(systemStatus?.sizing?.volatilityTargetPct ?? 0).toFixed(2)}
                </Typography>
                <Typography variant="body2">
                  Maks Kaldıraç: {systemStatus?.sizing?.leverageMax ?? 1}
                </Typography>
                <Typography variant="body2">
                  Slipaj Tavanı: %{(systemStatus?.preset?.maxSlippagePct ?? systemStatus?.maxSlippagePct ?? 0.15).toFixed(2)}
                </Typography>
                <Typography variant="body2">
                  Min Likidite: ${systemStatus?.preset?.minLiquidityUSD ?? systemStatus?.minLiquidityUSD ?? 10000}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>A/B Preset</Typography>
                <Typography variant="body2">
                  Aktif Preset: {systemStatus?.abTesting?.activePresetKey || 'MICRO_SAFE'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Presetler: {(systemStatus?.abTesting?.presets || []).join(', ')}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Monitoring</Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Üretilen: {systemStatus?.monitoring?.signalsGenerated ?? 0} | Elenen(edge): {systemStatus?.monitoring?.signalsFilteredEdge ?? 0} | Throttle: {systemStatus?.monitoring?.signalsThrottled ?? 0}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Regime-Aware Allocation</Typography>
                <Typography variant="body2">
                  Mevcut Regime: {systemStatus?.regimeAllocation?.currentRegime || 'UNKNOWN'}
                </Typography>
                <Typography variant="body2">
                  Aktif Preset: {systemStatus?.regimeAllocation?.activePreset || 'MICRO_SAFE'}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={async () => {
                    try {
                      const result = await tradingService.selectOptimalPreset();
                      toast.success(`Optimal preset selected: ${result.selectedPreset}`);
                      // Refresh system status
                      window.location.reload();
                    } catch (error) {
                      toast.error('Failed to select optimal preset');
                    }
                  }}
                  sx={{ mt: 1 }}
                >
                  Select Optimal Preset
                </Button>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Regime Performance & Bandit Weights */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            🎯 Regime Performance & Bandit Learning
          </Typography>
          {!systemStatus ? (
            <LinearProgress />
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Regime Performance</Typography>
                <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                  {(systemStatus?.regimeAllocation?.regimePerformance || []).map((perf: any, idx: number) => (
                    <Box key={idx} sx={{ mb: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" display="block">
                        {perf.regime} - {perf.preset}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Trades: {perf.totalTrades} | Win Rate: {(perf.winRate * 100).toFixed(1)}% | Sharpe: {perf.sharpeRatio.toFixed(2)}
                      </Typography>
                    </Box>
                  ))}
                  {!(systemStatus?.regimeAllocation?.regimePerformance || []).length && (
                    <Typography variant="body2" color="text.secondary">No performance data yet</Typography>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Bandit Weights</Typography>
                <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                  {Object.entries(systemStatus?.regimeAllocation?.banditWeights || {}).map(([key, weight]: [string, any]) => (
                    <Box key={key} sx={{ mb: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" display="block">
                        {key}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Weight: {weight.toFixed(3)}
                      </Typography>
                    </Box>
                  ))}
                  {!Object.keys(systemStatus?.regimeAllocation?.banditWeights || {}).length && (
                    <Typography variant="body2" color="text.secondary">No bandit weights yet</Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Monitoring & Alerts */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            📡 Monitoring & Alerts
          </Typography>
          {!monitoringData ? (
            <LinearProgress />
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2">Sistem İzleme</Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Latency: {monitoringData?.latency?.lastLatencyMs ?? '-'} ms | Clock skew: {monitoringData?.latency?.clockSkewMs ?? '-'} ms
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Signals: gen {monitoringData?.monitoring?.signalsGenerated ?? 0} / edge-filter {monitoringData?.monitoring?.signalsFilteredEdge ?? 0} / throttle {monitoringData?.monitoring?.signalsThrottled ?? 0}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Deep Health: cfg ok {healthDeep?.ok ? '✓' : '×'} | wsDown {healthDeep?.ws?.down ? 'YES' : 'NO'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Config missing: {(healthDeep?.config?.missing || []).join(', ') || '-'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2">Uyarılar</Typography>
                {(!alertsData || alertsData.length === 0) ? (
                  <Typography variant="caption" color="text.secondary">Aktif uyarı yok</Typography>
                ) : alertsData.map((a: any, i: number) => (
                  <Typography key={i} variant="caption" color={a.level === 'WARN' ? 'warning.main' : 'text.secondary'} display="block">
                    [{a.level}] {a.type}: {a.message}
                  </Typography>
                ))}
                <Box sx={{ mt: 1 }}>
                  <Button size="small" variant="outlined" sx={{ mr: 1 }} onClick={()=>guaranteedProfitService.chaosLatency(120).then(()=>toast.success('Latency set')).catch(e=>toast.error(`${e}`))}>Chaos Latency</Button>
                  <Button size="small" variant="outlined" sx={{ mr: 1 }} onClick={()=>guaranteedProfitService.chaosSlippage(2).then(()=>toast.success('Slippage x2')).catch(e=>toast.error(`${e}`))}>Chaos Slippage</Button>
                  <Button size="small" variant="outlined" sx={{ mr: 1 }} onClick={()=>guaranteedProfitService.chaosWsDown().then(()=>toast.success('WS down')).catch(e=>toast.error(`${e}`))}>Chaos WS Down</Button>
                  <Button size="small" variant="outlined" color="success" onClick={()=>guaranteedProfitService.chaosReset().then(()=>toast.success('Chaos reset')).catch(e=>toast.error(`${e}`))}>Chaos Reset</Button>
                </Box>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Psychology sx={{ mr: 1 }} />
            Garanti Kazanç Ayarları
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 2 }}>Genel Ayarlar</Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={tradingSettings.autoTrading}
                    onChange={(e) => setTradingSettings({
                      ...tradingSettings,
                      autoTrading: e.target.checked
                    })}
                  />
                }
                label="Otomatik İşlem"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Maksimum Yatırım (USD)"
                type="number"
                value={tradingSettings.maxInvestment}
                onChange={(e) => setTradingSettings({
                  ...tradingSettings,
                  maxInvestment: Number(e.target.value)
                })}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Risk Seviyesi</InputLabel>
                <Select
                  value={tradingSettings.riskLevel}
                  onChange={(e) => setTradingSettings({
                    ...tradingSettings,
                    riskLevel: e.target.value as any
                  })}
                >
                  <MenuItem value="CONSERVATIVE">Muhafazakar</MenuItem>
                  <MenuItem value="MODERATE">Orta</MenuItem>
                  <MenuItem value="AGGRESSIVE">Agresif</MenuItem>
                </Select>
              </FormControl>

              <Typography variant="body2" sx={{ mb: 1 }}>
                Minimum Güven: %{tradingSettings.minConfidence}
              </Typography>
              <Slider
                value={tradingSettings.minConfidence}
                onChange={(e, value) => setTradingSettings({
                  ...tradingSettings,
                  minConfidence: value as number
                })}
                min={70}
                max={100}
                marks={[
                  { value: 70, label: '70%' },
                  { value: 85, label: '85%' },
                  { value: 100, label: '100%' }
                ]}
                sx={{ mb: 2 }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 2 }}>Strateji Ayarları</Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={tradingSettings.arbitrageEnabled}
                    onChange={(e) => setTradingSettings({
                      ...tradingSettings,
                      arbitrageEnabled: e.target.checked
                    })}
                  />
                }
                label="Arbitraj İşlemleri"
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={tradingSettings.flashLoanEnabled}
                    onChange={(e) => setTradingSettings({
                      ...tradingSettings,
                      flashLoanEnabled: e.target.checked
                    })}
                  />
                }
                label="Flash Loan Arbitraj"
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={tradingSettings.mevEnabled}
                    onChange={(e) => setTradingSettings({
                      ...tradingSettings,
                      mevEnabled: e.target.checked
                    })}
                  />
                }
                label="MEV Bot"
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={tradingSettings.yieldFarmingEnabled}
                    onChange={(e) => setTradingSettings({
                      ...tradingSettings,
                      yieldFarmingEnabled: e.target.checked
                    })}
                  />
                }
                label="Yield Farming"
                sx={{ mb: 2 }}
              />

              <Divider sx={{ my: 2 }} />

              <TextField
                fullWidth
                label="Stop Loss (%)"
                type="number"
                value={tradingSettings.stopLossPercentage}
                onChange={(e) => setTradingSettings({
                  ...tradingSettings,
                  stopLossPercentage: Number(e.target.value)
                })}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Take Profit (%)"
                type="number"
                value={tradingSettings.takeProfitPercentage}
                onChange={(e) => setTradingSettings({
                  ...tradingSettings,
                  takeProfitPercentage: Number(e.target.value)
                })}
                sx={{ mb: 2 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>
            İptal
          </Button>
          <Button
            variant="contained"
            onClick={() => updateSettingsMutation.mutate(tradingSettings)}
            disabled={updateSettingsMutation.isLoading}
          >
            Kaydet
          </Button>
        </DialogActions>
      </Dialog>

      {/* Emergency Controls & Market Validation Panel */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            🚨 Emergency Controls & Market Validation
          </Typography>
          <EmergencyAndValidationPanel />
        </CardContent>
      </Card>

      {/* Dynamic Position Sizing & P&L Tracking Panel */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            📊 Dynamic Position Sizing & P&L Tracking
          </Typography>
          <PositionSizingAndPnLPanel />
        </CardContent>
      </Card>
    </Box>
  );
};

// Emergency Controls & Market Validation Panel Component
const EmergencyAndValidationPanel: React.FC = () => {
  const [emergencyStatus, setEmergencyStatus] = useState<any>(null);
  const [marketValidation, setMarketValidation] = useState<any>(null);
  const [validationSymbol, setValidationSymbol] = useState('BTC');
  const [emergencyParams, setEmergencyParams] = useState({
    type: 'SYSTEM' as 'SYSTEM' | 'SYMBOL' | 'EXCHANGE' | 'STRATEGY',
    reason: '',
    scope: ['ALL'],
    severity: 'HIGH' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    initiatedBy: 'USER'
  });

  // Fetch emergency status
  const { data: emergencyData, refetch: refetchEmergency } = useQuery(
    'emergencyStatus',
    tradingService.getEmergencyStatus,
    { refetchInterval: 5000 }
  );

  // Fetch market validation
  const validateMarketMutation = useMutation(
    (symbol: string) => tradingService.validateMarketData(symbol),
    {
      onSuccess: (data) => {
        setMarketValidation(data);
        toast.success('Market validation completed');
      },
      onError: (error) => {
        toast.error('Market validation failed');
      }
    }
  );

  // Trigger emergency stop
  const emergencyStopMutation = useMutation(
    (params: any) => tradingService.triggerEmergencyStop(params),
    {
      onSuccess: (data) => {
        toast.success(`Emergency stop triggered: ${data.stopId}`);
        refetchEmergency();
      },
      onError: (error) => {
        toast.error('Failed to trigger emergency stop');
      }
    }
  );

  useEffect(() => {
    if (emergencyData) {
      setEmergencyStatus(emergencyData);
    }
  }, [emergencyData]);

  const handleValidateMarket = () => {
    validateMarketMutation.mutate(validationSymbol);
  };

  const handleEmergencyStop = () => {
    if (!emergencyParams.reason.trim()) {
      toast.error('Please provide a reason for emergency stop');
      return;
    }
    emergencyStopMutation.mutate(emergencyParams);
  };

  return (
    <Grid container spacing={2}>
      {/* Emergency Status */}
      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Emergency Status</Typography>
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {emergencyStatus ? (
            <>
              <Typography variant="caption" display="block">
                System Status: <Chip 
                  label={emergencyStatus.systemStatus} 
                  color={emergencyStatus.systemStatus === 'NORMAL' ? 'success' : 'error'}
                  size="small"
                />
              </Typography>
              <Typography variant="caption" display="block">
                Trading Enabled: <Chip 
                  label={emergencyStatus.tradingEnabled ? 'YES' : 'NO'} 
                  color={emergencyStatus.tradingEnabled ? 'success' : 'error'}
                  size="small"
                />
              </Typography>
              <Typography variant="caption" display="block">
                Active Stops: {emergencyStatus.activeStops}
              </Typography>
              {emergencyStatus.lastStop && (
                <Typography variant="caption" display="block">
                  Last Stop: {new Date(emergencyStatus.lastStop.timestamp).toLocaleString()}
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">Loading...</Typography>
          )}
        </Box>
      </Grid>

      {/* Market Validation */}
      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Market Validation</Typography>
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small"
              label="Symbol"
              value={validationSymbol}
              onChange={(e) => setValidationSymbol(e.target.value.toUpperCase())}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="outlined"
              onClick={handleValidateMarket}
              disabled={validateMarketMutation.isLoading}
              size="small"
            >
              Validate
            </Button>
          </Box>
          
          {marketValidation && (
            <Box>
              <Typography variant="caption" display="block">
                Validation Score: <Chip 
                  label={marketValidation.validationScore?.toFixed(3) || 'N/A'} 
                  color={marketValidation.validationScore > 0.8 ? 'success' : marketValidation.validationScore > 0.6 ? 'warning' : 'error'}
                  size="small"
                />
              </Typography>
              <Typography variant="caption" display="block">
                Consensus Price: ${marketValidation.consensusPrice?.toFixed(2) || 'N/A'}
              </Typography>
              <Typography variant="caption" display="block">
                Price Range: ${marketValidation.priceRange?.min?.toFixed(2) || 'N/A'} - ${marketValidation.priceRange?.max?.toFixed(2) || 'N/A'}
              </Typography>
              {marketValidation.outlierExchanges?.length > 0 && (
                <Typography variant="caption" display="block" color="warning.main">
                  Outliers: {marketValidation.outlierExchanges.join(', ')}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Grid>

      {/* Emergency Stop Controls */}
      <Grid item xs={12}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Emergency Stop Controls</Typography>
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={emergencyParams.type}
                  onChange={(e) => setEmergencyParams({...emergencyParams, type: e.target.value as any})}
                >
                  <MenuItem value="SYSTEM">System</MenuItem>
                  <MenuItem value="SYMBOL">Symbol</MenuItem>
                  <MenuItem value="EXCHANGE">Exchange</MenuItem>
                  <MenuItem value="STRATEGY">Strategy</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Severity</InputLabel>
                <Select
                  value={emergencyParams.severity}
                  onChange={(e) => setEmergencyParams({...emergencyParams, severity: e.target.value as any})}
                >
                  <MenuItem value="LOW">Low</MenuItem>
                  <MenuItem value="MEDIUM">Medium</MenuItem>
                  <MenuItem value="HIGH">High</MenuItem>
                  <MenuItem value="CRITICAL">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Reason"
                value={emergencyParams.reason}
                onChange={(e) => setEmergencyParams({...emergencyParams, reason: e.target.value})}
                placeholder="Enter emergency reason..."
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                fullWidth
                variant="contained"
                color="error"
                onClick={handleEmergencyStop}
                disabled={emergencyStopMutation.isLoading}
                size="small"
              >
                🚨 STOP
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Grid>
    </Grid>
  );
};

// Dynamic Position Sizing & P&L Tracking Panel Component
const PositionSizingAndPnLPanel: React.FC = () => {
  const [positionSizingParams, setPositionSizingParams] = useState({
    symbol: 'BTC',
    accountBalance: 10000,
    riskPerTrade: 2,
    entryPrice: 50000,
    stopLossPrice: 48000,
    takeProfitPrice: 52000,
    volatility: 0.3,
    marketRegime: 'TRENDING' as 'TRENDING' | 'RANGING' | 'EVENT_DRIVEN' | 'UNKNOWN',
    confidence: 85,
    liquidity: 1000000,
    maxPositionSize: 5000,
    correlationRisk: 0.2
  });

  const [positionSizingResult, setPositionSizingResult] = useState<any>(null);
  const [portfolioPnL, setPortfolioPnL] = useState<any>(null);
  const [positionStats, setPositionStats] = useState<any>(null);

  // Calculate position size
  const calculatePositionSizeMutation = useMutation(
    (params: any) => tradingService.calculatePositionSize(params),
    {
      onSuccess: (data) => {
        setPositionSizingResult(data);
        toast.success('Position size calculated successfully');
      },
      onError: (error) => {
        toast.error('Failed to calculate position size');
      }
    }
  );

  // Fetch portfolio P&L
  const { data: portfolioData } = useQuery(
    'portfolioPnL',
    tradingService.getPortfolioPnL,
    { refetchInterval: 5000 }
  );

  // Fetch position stats
  const { data: statsData } = useQuery(
    'positionStats',
    tradingService.getPositionStats,
    { refetchInterval: 10000 }
  );

  useEffect(() => {
    if (portfolioData) {
      setPortfolioPnL(portfolioData);
    }
  }, [portfolioData]);

  useEffect(() => {
    if (statsData) {
      setPositionStats(statsData);
    }
  }, [statsData]);

  const handleCalculatePositionSize = () => {
    calculatePositionSizeMutation.mutate(positionSizingParams);
  };

  return (
    <Grid container spacing={2}>
      {/* Position Sizing Calculator */}
      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Position Size Calculator</Typography>
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Symbol"
                value={positionSizingParams.symbol}
                onChange={(e) => setPositionSizingParams({...positionSizingParams, symbol: e.target.value.toUpperCase()})}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Account Balance"
                type="number"
                value={positionSizingParams.accountBalance}
                onChange={(e) => setPositionSizingParams({...positionSizingParams, accountBalance: Number(e.target.value)})}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Risk Per Trade (%)"
                type="number"
                value={positionSizingParams.riskPerTrade}
                onChange={(e) => setPositionSizingParams({...positionSizingParams, riskPerTrade: Number(e.target.value)})}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Entry Price"
                type="number"
                value={positionSizingParams.entryPrice}
                onChange={(e) => setPositionSizingParams({...positionSizingParams, entryPrice: Number(e.target.value)})}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Stop Loss"
                type="number"
                value={positionSizingParams.stopLossPrice}
                onChange={(e) => setPositionSizingParams({...positionSizingParams, stopLossPrice: Number(e.target.value)})}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Take Profit"
                type="number"
                value={positionSizingParams.takeProfitPrice}
                onChange={(e) => setPositionSizingParams({...positionSizingParams, takeProfitPrice: Number(e.target.value)})}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Market Regime</InputLabel>
                <Select
                  value={positionSizingParams.marketRegime}
                  onChange={(e) => setPositionSizingParams({...positionSizingParams, marketRegime: e.target.value as any})}
                >
                  <MenuItem value="TRENDING">Trending</MenuItem>
                  <MenuItem value="RANGING">Ranging</MenuItem>
                  <MenuItem value="EVENT_DRIVEN">Event Driven</MenuItem>
                  <MenuItem value="UNKNOWN">Unknown</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Confidence (%)"
                type="number"
                value={positionSizingParams.confidence}
                onChange={(e) => setPositionSizingParams({...positionSizingParams, confidence: Number(e.target.value)})}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleCalculatePositionSize}
                disabled={calculatePositionSizeMutation.isLoading}
              >
                Calculate Position Size
              </Button>
            </Grid>
          </Grid>

          {positionSizingResult && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Position Sizing Result</Typography>
              <Typography variant="caption" display="block">
                Recommended Size: {positionSizingResult.recommendedSizeUSD?.toFixed(2)} USD
              </Typography>
              <Typography variant="caption" display="block">
                Risk Amount: {positionSizingResult.riskAmount?.toFixed(2)} USD
              </Typography>
              <Typography variant="caption" display="block">
                Leverage: {positionSizingResult.leverage?.toFixed(2)}x
              </Typography>
              <Typography variant="caption" display="block">
                Method: {positionSizingResult.sizingMethod}
              </Typography>
              <Typography variant="caption" display="block">
                Confidence: {positionSizingResult.confidence?.toFixed(1)}%
              </Typography>
              {positionSizingResult.warnings?.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  {positionSizingResult.warnings.map((warning: string, index: number) => (
                    <Chip key={index} label={warning} color="warning" size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Grid>

      {/* Portfolio P&L Overview */}
      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Portfolio P&L Overview</Typography>
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {portfolioPnL ? (
            <>
              <Typography variant="caption" display="block">
                Total P&L: <Chip 
                  label={`${portfolioPnL.totalPnL?.toFixed(2)} USD (${portfolioPnL.totalPnLPercent?.toFixed(2)}%)`}
                  color={portfolioPnL.totalPnL >= 0 ? 'success' : 'error'}
                  size="small"
                />
              </Typography>
              <Typography variant="caption" display="block">
                Unrealized P&L: {portfolioPnL.totalUnrealizedPnL?.toFixed(2)} USD
              </Typography>
              <Typography variant="caption" display="block">
                Realized P&L: {portfolioPnL.totalRealizedPnL?.toFixed(2)} USD
              </Typography>
              <Typography variant="caption" display="block">
                Daily P&L: {portfolioPnL.dailyPnL?.toFixed(2)} USD
              </Typography>
              <Typography variant="caption" display="block">
                Win Rate: {(portfolioPnL.winRate * 100)?.toFixed(1)}%
              </Typography>
              <Typography variant="caption" display="block">
                Sharpe Ratio: {portfolioPnL.sharpeRatio?.toFixed(2)}
              </Typography>
              <Typography variant="caption" display="block">
                Max Drawdown: {(portfolioPnL.maxDrawdown * 100)?.toFixed(2)}%
              </Typography>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">Loading...</Typography>
          )}
        </Box>
      </Grid>

      {/* Position Statistics */}
      <Grid item xs={12}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Position Statistics</Typography>
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {positionStats ? (
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" display="block">Total Positions</Typography>
                <Typography variant="h6">{positionStats.totalPositions}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" display="block">Open Positions</Typography>
                <Typography variant="h6">{positionStats.openPositions}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" display="block">Closed Positions</Typography>
                <Typography variant="h6">{positionStats.closedPositions}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" display="block">Win Rate</Typography>
                <Typography variant="h6">{(positionStats.winRate * 100)?.toFixed(1)}%</Typography>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary">Loading...</Typography>
          )}
        </Box>
      </Grid>

      {/* Backtesting Panel */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📊 Backtesting & Paper Trading
            </Typography>
            <BacktestingPanel />
          </CardContent>
        </Card>
      </Grid>

      {/* Liquidity Aggregation Panel */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🌊 Liquidity Aggregation & Smart Routing
            </Typography>
            <LiquidityAggregationPanel />
          </CardContent>
        </Card>
      </Grid>

      {/* Slippage Protection Panel */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🛡️ Slippage Protection & Market Impact Analysis
            </Typography>
            <SlippageProtectionPanel />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default GuaranteedProfit;
