import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';

const TradingPanel: React.FC = () => {
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [amount, setAmount] = useState('');
  const [orderType, setOrderType] = useState('market');

  const handleBuy = () => {
    console.log('Buy order:', { symbol, amount, orderType });
  };

  const handleSell = () => {
    console.log('Sell order:', { symbol, amount, orderType });
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Trading Panel
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              variant="outlined"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              variant="outlined"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Order Type</InputLabel>
              <Select
                value={orderType}
                label="Order Type"
                onChange={(e) => setOrderType(e.target.value)}
              >
                <MenuItem value="market">Market</MenuItem>
                <MenuItem value="limit">Limit</MenuItem>
                <MenuItem value="stop">Stop</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={6}>
            <Button
              fullWidth
              variant="contained"
              color="success"
              onClick={handleBuy}
              sx={{ height: 48 }}
            >
              BUY
            </Button>
          </Grid>
          
          <Grid item xs={6}>
            <Button
              fullWidth
              variant="contained"
              color="error"
              onClick={handleSell}
              sx={{ height: 48 }}
            >
              SELL
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default TradingPanel;
