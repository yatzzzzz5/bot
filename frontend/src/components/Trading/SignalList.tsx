import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Box,
  Typography,
  Skeleton
} from '@mui/material';
import { TrendingUp, TrendingDown, Remove } from '@mui/icons-material';

interface Signal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: 'WEAK' | 'MEDIUM' | 'STRONG';
  confidence: number;
  reason: string;
  timestamp: string;
}

interface SignalListProps {
  signals: Signal[];
  isLoading?: boolean;
}

const SignalList: React.FC<SignalListProps> = ({ signals = [], isLoading = false }) => {
  if (isLoading) {
    return (
      <Box>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1 }} />
        ))}
      </Box>
    );
  }

  // Ensure signals is always an array
  const signalArray = Array.isArray(signals) ? signals : [];

  if (signalArray.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No active signals
        </Typography>
      </Box>
    );
  }

  const getSignalIcon = (type: string) => {
    switch (type) {
      case 'BUY':
        return <TrendingUp color="success" />;
      case 'SELL':
        return <TrendingDown color="error" />;
      default:
        return <Remove color="disabled" />;
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'STRONG':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      case 'WEAK':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <List>
      {signalArray.map((signal) => (
        <ListItem key={signal.id} divider>
          <ListItemIcon>
            {getSignalIcon(signal.type)}
          </ListItemIcon>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2">
                  {signal.symbol}
                </Typography>
                <Chip
                  label={signal.type}
                  size="small"
                  color={signal.type === 'BUY' ? 'success' : 'error'}
                  variant="outlined"
                />
                <Chip
                  label={signal.strength}
                  size="small"
                  color={getStrengthColor(signal.strength) as any}
                />
              </Box>
            }
            secondary={
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {signal.reason}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Confidence: {(signal.confidence * 100).toFixed(1)}%
                </Typography>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );
};

export default SignalList;
