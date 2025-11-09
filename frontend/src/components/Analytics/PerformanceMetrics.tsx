import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  ShowChart,
  Timer,
  Assessment,
  Warning,
} from '@mui/icons-material';

interface PerformanceMetricsProps {
  performance: any;
  isLoading: boolean;
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ performance, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Performance Metrics
          </Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  // Use real data from API
  const totalTrades = performance?.totalTrades || 0;
  const winRate = performance?.winRate || 0;
  const totalPnL = performance?.totalPnL || 0;
  const avgDuration = performance?.avgTradeDuration || 0;
  const sharpeRatio = performance?.sharpeRatio || 0;
  const maxDrawdown = performance?.maxDrawdown || 0;

  // Calculate PnL color and icon
  const isPnLPositive = totalPnL >= 0;
  const pnlColor = isPnLPositive ? 'success.main' : 'error.main';
  const pnlIcon = isPnLPositive ? <TrendingUp /> : <TrendingDown />;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShowChart color="primary" />
          Performance Metrics
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {/* Total Trades */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary" fontWeight="bold">
              {totalTrades}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Trades
            </Typography>
          </Box>

          {/* Win Rate */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="success.main" fontWeight="bold">
              {(winRate * 100).toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Win Rate
            </Typography>
          </Box>

          {/* Total P&L */}
          <Box sx={{ textAlign: 'center', gridColumn: 'span 2' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
              {pnlIcon}
              <Typography variant="h5" color={pnlColor} fontWeight="bold">
                ${totalPnL.toLocaleString()}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Total P&L
            </Typography>
          </Box>

          {/* Average Duration */}
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
              <Timer color="info" />
              <Typography variant="h6" color="info.main" fontWeight="bold">
                {avgDuration}h
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Avg Duration
            </Typography>
          </Box>

          {/* Sharpe Ratio */}
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
              <Assessment color="warning" />
              <Typography variant="h6" color="warning.main" fontWeight="bold">
                {sharpeRatio.toFixed(2)}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Sharpe Ratio
            </Typography>
          </Box>

          {/* Max Drawdown */}
          <Box sx={{ textAlign: 'center', gridColumn: 'span 2' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
              <Warning color="error" />
              <Typography variant="h6" color="error.main" fontWeight="bold">
                {(maxDrawdown * 100).toFixed(1)}%
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Max Drawdown
            </Typography>
          </Box>
        </Box>

        {/* Performance Summary */}
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Performance
            </Typography>
            <Chip
              label={isPnLPositive ? 'Profitable' : 'Loss'}
              color={isPnLPositive ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PerformanceMetrics;
