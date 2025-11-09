import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Security,
  Warning,
  CheckCircle,
  Error,
  Refresh,
  Settings,
  TrendingUp,
  AccountBalance,
  Lock,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { tradingService } from '../../services/tradingService';

const ProtectionSystemsDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [openSettingsDialog, setOpenSettingsDialog] = useState(false);

  // Real-time data queries
  const { data: circuitBreakerStatus } = useQuery(
    'circuitBreakerStatus',
    tradingService.getCircuitBreakerStatus,
    { refetchInterval: 3000 }
  );

  const { data: profitLockStatus } = useQuery(
    'profitLockStatus',
    tradingService.getProfitLockStatus,
    { refetchInterval: 5000 }
  );

  const { data: microTradingStatus } = useQuery(
    'microTradingStatus',
    tradingService.getMicroTradingStatus,
    { refetchInterval: 2000 }
  );

  // Mutations
  const resetCircuitBreakerMutation = useMutation(tradingService.resetCircuitBreaker, {
    onSuccess: () => {
      toast.success('Circuit Breaker Reset!');
      queryClient.invalidateQueries('circuitBreakerStatus');
    },
    onError: (error: any) => {
      toast.error(`Failed to reset circuit breaker: ${error.message}`);
    }
  });

  const unlockProfitsMutation = useMutation(tradingService.unlockProfits, {
    onSuccess: () => {
      toast.success('Profits Unlocked!');
      queryClient.invalidateQueries('profitLockStatus');
    },
    onError: (error: any) => {
      toast.error(`Failed to unlock profits: ${error.message}`);
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'error';
      case 'NORMAL': return 'success';
      case 'EMERGENCY': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          🛡️ Protection Systems Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Settings />}
            onClick={() => setOpenSettingsDialog(true)}
          >
            Settings
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Refresh />}
            onClick={() => queryClient.invalidateQueries()}
          >
            Refresh All
          </Button>
        </Box>
      </Box>

      {/* System Status Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Circuit Breaker Status */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Security sx={{ mr: 1 }} />
                <Typography variant="h6">Circuit Breaker</Typography>
              </Box>
              <Chip
                label={circuitBreakerStatus?.isActive ? 'ACTIVE' : 'NORMAL'}
                color={getStatusColor(circuitBreakerStatus?.isActive ? 'ACTIVE' : 'NORMAL')}
                sx={{ mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                Consecutive Losses: {circuitBreakerStatus?.consecutiveLosses || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Position Size: {(circuitBreakerStatus?.positionSizeMultiplier * 100)?.toFixed(1) || '100.0'}%
              </Typography>
              {circuitBreakerStatus?.isActive && (
                <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                  Reason: {circuitBreakerStatus.reason}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Profit Lock Status */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Lock sx={{ mr: 1 }} />
                <Typography variant="h6">Profit Lock</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                ${profitLockStatus?.totalLocked?.toFixed(2) || '0.00'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {profitLockStatus?.lockedPercentage?.toFixed(1) || '0.0'}% of portfolio locked
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Available: ${profitLockStatus?.availableForTrading?.toFixed(2) || '0.00'}
              </Typography>
              {profitLockStatus?.emergencyUnlockAvailable && (
                <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                  Emergency unlock available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Overall Protection Status */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Security sx={{ mr: 1 }} />
                <Typography variant="h6">Overall Status</Typography>
              </Box>
              <Chip
                label={circuitBreakerStatus?.isActive ? 'PROTECTED' : 'NORMAL'}
                color={circuitBreakerStatus?.isActive ? 'warning' : 'success'}
                sx={{ mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                Protection Level: {circuitBreakerStatus?.isActive ? 'HIGH' : 'NORMAL'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Risk Level: {microTradingStatus?.riskLevel || 'MEDIUM'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Circuit Breaker Details */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            🔄 Circuit Breaker System
          </Typography>
          {circuitBreakerStatus ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Current Status
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      {circuitBreakerStatus.isActive ? <Error color="error" /> : <CheckCircle color="success" />}
                    </ListItemIcon>
                    <ListItemText
                      primary="Status"
                      secondary={circuitBreakerStatus.isActive ? 'ACTIVE' : 'NORMAL'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Warning />
                    </ListItemIcon>
                    <ListItemText
                      primary="Consecutive Losses"
                      secondary={circuitBreakerStatus.consecutiveLosses}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <AccountBalance />
                    </ListItemIcon>
                    <ListItemText
                      primary="Position Size Multiplier"
                      secondary={`${(circuitBreakerStatus.positionSizeMultiplier * 100).toFixed(1)}%`}
                    />
                  </ListItem>
                </List>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Actions
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<Security />}
                    onClick={() => resetCircuitBreakerMutation.mutate()}
                    disabled={resetCircuitBreakerMutation.isLoading || !circuitBreakerStatus.isActive}
                    fullWidth
                  >
                    Reset Circuit Breaker
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<Refresh />}
                    onClick={() => queryClient.invalidateQueries('circuitBreakerStatus')}
                    fullWidth
                  >
                    Refresh Status
                  </Button>
                </Box>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Loading circuit breaker status...
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Profit Lock Details */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            🔒 Profit Lock System
          </Typography>
          {profitLockStatus ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Lock Status
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <Lock />
                    </ListItemIcon>
                    <ListItemText
                      primary="Total Locked"
                      secondary={`$${profitLockStatus.totalLocked?.toFixed(2)}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <AccountBalance />
                    </ListItemIcon>
                    <ListItemText
                      primary="Available for Trading"
                      secondary={`$${profitLockStatus.availableForTrading?.toFixed(2)}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <TrendingUp />
                    </ListItemIcon>
                    <ListItemText
                      primary="Locked Percentage"
                      secondary={`${profitLockStatus.lockedPercentage?.toFixed(1)}%`}
                    />
                  </ListItem>
                </List>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Actions
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    variant="outlined"
                    color="info"
                    startIcon={<Lock />}
                    onClick={() => unlockProfitsMutation.mutate('MANUAL')}
                    disabled={unlockProfitsMutation.isLoading || !profitLockStatus.totalLocked}
                    fullWidth
                  >
                    Unlock Profits
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<Refresh />}
                    onClick={() => queryClient.invalidateQueries('profitLockStatus')}
                    fullWidth
                  >
                    Refresh Status
                  </Button>
                </Box>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Loading profit lock status...
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Active Locks */}
      {profitLockStatus?.locks && profitLockStatus.locks.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              🔒 Active Profit Locks
            </Typography>
            <List>
              {profitLockStatus.locks.map((lock: any, index: number) => (
                <React.Fragment key={lock.id}>
                  <ListItem>
                    <ListItemIcon>
                      <Lock />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Lock #${index + 1}`}
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            Amount: ${lock.amount?.toFixed(2)}
                          </Typography>
                          <Typography variant="body2">
                            Threshold: {(lock.threshold * 100).toFixed(0)}% profit
                          </Typography>
                          <Typography variant="body2">
                            Locked: {new Date(lock.lockedAt).toLocaleString()}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < profitLockStatus.locks.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Alerts and Warnings */}
      {(circuitBreakerStatus?.isActive || profitLockStatus?.emergencyUnlockAvailable) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            ⚠️ System Alerts
          </Typography>
          <List dense>
            {circuitBreakerStatus?.isActive && (
              <ListItem>
                <ListItemIcon>
                  <Warning color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="Circuit Breaker Active"
                  secondary={`Reason: ${circuitBreakerStatus.reason}`}
                />
              </ListItem>
            )}
            {profitLockStatus?.emergencyUnlockAvailable && (
              <ListItem>
                <ListItemIcon>
                  <Error color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="Emergency Unlock Available"
                  secondary="Profits can be unlocked due to losses"
                />
              </ListItem>
            )}
          </List>
        </Alert>
      )}

      {/* Settings Dialog */}
      <Dialog
        open={openSettingsDialog}
        onClose={() => setOpenSettingsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Protection Systems Settings
        </DialogTitle>
        <DialogContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Circuit Breaker Settings
          </Typography>
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Enable Circuit Breaker"
          />
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Enable Emergency Stop"
          />
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="h6" sx={{ mb: 2 }}>
            Profit Lock Settings
          </Typography>
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Enable Automatic Profit Locking"
          />
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Enable Emergency Unlock"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSettingsDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => setOpenSettingsDialog(false)}>
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProtectionSystemsDashboard;
