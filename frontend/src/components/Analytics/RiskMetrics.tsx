import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Security,
  TrendingDown,
  Assessment,
  Warning,
} from '@mui/icons-material';

interface RiskMetricsProps {
  riskScore: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

const RiskMetrics: React.FC<RiskMetricsProps> = ({ riskScore, maxDrawdown, sharpeRatio }) => {
  // Calculate risk level based on score
  const getRiskLevel = (score: number) => {
    if (score <= 0.3) return { level: 'LOW', color: 'success' as const };
    if (score <= 0.6) return { level: 'MEDIUM', color: 'warning' as const };
    return { level: 'HIGH', color: 'error' as const };
  };

  // Calculate drawdown severity
  const getDrawdownSeverity = (drawdown: number) => {
    if (drawdown <= 0.05) return { severity: 'LOW', color: 'success' as const };
    if (drawdown <= 0.15) return { severity: 'MEDIUM', color: 'warning' as const };
    return { severity: 'HIGH', color: 'error' as const };
  };

  // Calculate Sharpe ratio quality
  const getSharpeQuality = (sharpe: number) => {
    if (sharpe >= 1.5) return { quality: 'EXCELLENT', color: 'success' as const };
    if (sharpe >= 1.0) return { quality: 'GOOD', color: 'warning' as const };
    return { quality: 'POOR', color: 'error' as const };
  };

  const riskLevel = getRiskLevel(riskScore);
  const drawdownSeverity = getDrawdownSeverity(maxDrawdown);
  const sharpeQuality = getSharpeQuality(sharpeRatio);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Security color="primary" />
          Risk Metrics
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {/* Risk Score */}
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ position: 'relative', display: 'inline-flex', mb: 1 }}>
              <CircularProgress
                variant="determinate"
                value={riskScore * 100}
                size={60}
                thickness={4}
                color={riskLevel.color}
              />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="body2" color="text.primary" fontWeight="bold">
                  {(riskScore * 100).toFixed(0)}%
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Risk Score
            </Typography>
            <Chip
              label={riskLevel.level}
              color={riskLevel.color}
              size="small"
              variant="outlined"
            />
          </Box>

          {/* Max Drawdown */}
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
              <TrendingDown color={drawdownSeverity.color} />
              <Typography variant="h5" color={drawdownSeverity.color} fontWeight="bold">
                {(maxDrawdown * 100).toFixed(2)}%
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Max Drawdown
            </Typography>
            <Chip
              label={drawdownSeverity.severity}
              color={drawdownSeverity.color}
              size="small"
              variant="outlined"
            />
          </Box>

          {/* Sharpe Ratio */}
          <Box sx={{ textAlign: 'center', gridColumn: 'span 2' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
              <Assessment color={sharpeQuality.color} />
              <Typography variant="h5" color={sharpeQuality.color} fontWeight="bold">
                {sharpeRatio.toFixed(2)}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Sharpe Ratio
            </Typography>
            <Chip
              label={sharpeQuality.quality}
              color={sharpeQuality.color}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Risk Summary */}
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Overall Risk
            </Typography>
            <Chip
              label={riskLevel.level}
              color={riskLevel.color}
              size="small"
              icon={<Warning />}
            />
          </Box>
          
          {/* Risk Bar */}
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="success.main">Low</Typography>
              <Typography variant="caption" color="warning.main">Medium</Typography>
              <Typography variant="caption" color="error.main">High</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={riskScore * 100}
              color={riskLevel.color}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RiskMetrics;
