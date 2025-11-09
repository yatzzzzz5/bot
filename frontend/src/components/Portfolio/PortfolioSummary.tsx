import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Skeleton,
  Chip
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

interface Portfolio {
  totalValue: number;
  cash: number;
  positions: Array<{
    symbol: string;
    amount: number;
    value: number;
    pnl: number;
    pnlPercent: number;
  }>;
}

interface PortfolioSummaryProps {
  portfolio?: Portfolio;
  isLoading?: boolean;
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  portfolio,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant="text" width="60%" height={32} />
          <Skeleton variant="text" width="40%" height={24} />
          <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
        </CardContent>
      </Card>
    );
  }

  const mockPortfolio: Portfolio = {
    totalValue: 125000,
    cash: 25000,
    positions: [
      { symbol: 'BTC', amount: 1.5, value: 67500, pnl: 2500, pnlPercent: 3.85 },
      { symbol: 'ETH', amount: 10, value: 25000, pnl: -500, pnlPercent: -1.96 },
      { symbol: 'ADA', amount: 5000, value: 7500, pnl: 1000, pnlPercent: 15.38 }
    ]
  };

  const data = portfolio || mockPortfolio;
  const totalPnL = (data.positions || []).reduce((sum, pos) => sum + (pos.pnl || 0), 0);
  const totalPnLPercent = (data.positions || []).length > 0 ? (totalPnL / (data.totalValue - totalPnL)) * 100 : 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Portfolio Summary
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" fontWeight="bold">
            ${data.totalValue.toLocaleString()}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {totalPnL >= 0 ? (
              <TrendingUp color="success" fontSize="small" />
            ) : (
              <TrendingDown color="error" fontSize="small" />
            )}
            <Typography
              variant="body2"
              color={totalPnL >= 0 ? 'success.main' : 'error.main'}
            >
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString()} ({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Cash: ${data.cash.toLocaleString()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Positions: {data.positions.length}
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Top Positions
          </Typography>
          {data.positions.slice(0, 3).map((position) => (
            <Box key={position.symbol} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">
                {position.symbol}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">
                  ${position.value.toLocaleString()}
                </Typography>
                <Chip
                  label={`${position.pnlPercent >= 0 ? '+' : ''}${position.pnlPercent.toFixed(1)}%`}
                  size="small"
                  color={position.pnlPercent >= 0 ? 'success' : 'error'}
                  variant="outlined"
                />
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default PortfolioSummary;
