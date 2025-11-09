import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';

interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

interface OrderBookProps {
  bids?: OrderBookEntry[];
  asks?: OrderBookEntry[];
}

const OrderBook: React.FC<OrderBookProps> = ({
  bids = [
    { price: 45000, amount: 0.5, total: 22500 },
    { price: 44950, amount: 1.2, total: 53940 },
    { price: 44900, amount: 0.8, total: 35920 },
  ],
  asks = [
    { price: 45050, amount: 0.3, total: 13515 },
    { price: 45100, amount: 0.7, total: 31570 },
    { price: 45150, amount: 1.1, total: 49665 },
  ]
}) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Order Book
        </Typography>
        
        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Price</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {asks.slice().reverse().map((ask, index) => (
                <TableRow key={`ask-${index}`} sx={{ backgroundColor: 'error.light' }}>
                  <TableCell sx={{ color: 'error.main' }}>{ask.price}</TableCell>
                  <TableCell>{ask.amount}</TableCell>
                  <TableCell>{ask.total}</TableCell>
                </TableRow>
              ))}
              {bids.map((bid, index) => (
                <TableRow key={`bid-${index}`} sx={{ backgroundColor: 'success.light' }}>
                  <TableCell sx={{ color: 'success.main' }}>{bid.price}</TableCell>
                  <TableCell>{bid.amount}</TableCell>
                  <TableCell>{bid.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default OrderBook;
