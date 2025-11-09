import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PerformanceChartProps {
  data?: Array<{ date: string; value: number }>;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data = [
    { date: '2024-01', value: 10000 },
    { date: '2024-02', value: 10500 },
    { date: '2024-03', value: 11000 },
    { date: '2024-04', value: 10800 },
    { date: '2024-05', value: 11500 },
    { date: '2024-06', value: 12000 },
  ]
}) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Portfolio Performance
        </Typography>
        
        <Box sx={{ height: 300, mt: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#1976d2" 
                strokeWidth={2}
                dot={{ fill: '#1976d2', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PerformanceChart;
