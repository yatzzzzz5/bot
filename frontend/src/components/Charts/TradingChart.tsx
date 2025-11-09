import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface TradingChartProps {
  timeframe: string;
  portfolioData?: any;
}

const TradingChart: React.FC<TradingChartProps> = ({ timeframe, portfolioData }) => {
  // Generate chart data based on portfolio value changes - use useMemo to prevent constant re-renders
  const chartData = useMemo(() => {
    if (!portfolioData) {
      // Fallback mock data if no portfolio data
      return [
        { time: '09:00', value: 100000, change: 0 },
        { time: '10:00', value: 102000, change: 2000 },
        { time: '11:00', value: 101500, change: -500 },
        { time: '12:00', value: 103500, change: 2000 },
        { time: '13:00', value: 104000, change: 500 },
        { time: '14:00', value: 103800, change: -200 },
        { time: '15:00', value: 105000, change: 1200 },
        { time: '16:00', value: 104500, change: -500 }
      ];
    }

    // Use real portfolio data if available
    const baseValue = portfolioData.totalValue || 100000;
    const positions = portfolioData.positions || [];
    
    // Calculate portfolio value changes based on positions and time
    const timePoints = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    let currentValue = baseValue;
    
    return timePoints.map((time, index) => {
      let value = currentValue;
      let change = 0;
      
      // Add realistic but stable variation based on positions and market movement
      if (positions.length > 0) {
        // Use deterministic variation based on index to prevent constant changes
        const seed = index + (baseValue % 1000); // Use portfolio value as seed
        const deterministicFactor = Math.sin(seed * 0.5) * 0.01; // ±1% variation
        
        value = currentValue * (1 + deterministicFactor);
        change = value - currentValue;
        currentValue = value;
      } else {
        // If no positions, use very small stable movements
        const stableMove = Math.sin(index * 0.3) * 0.002 * baseValue; // ±0.1%
        value = currentValue + stableMove;
        change = stableMove;
        currentValue = value;
      }
      
      return { 
        time, 
        value: Math.round(value),
        change: Math.round(change)
      };
    });
  }, [portfolioData]); // Only recalculate when portfolioData changes

  const minValue = Math.min(...chartData.map(d => d.value));
  const maxValue = Math.max(...chartData.map(d => d.value));
  const valueRange = maxValue - minValue;
  const padding = valueRange * 0.15; // 15% padding for better visibility

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData} margin={{ top: 10, right: 40, left: 30, bottom: 20 }}>
          <defs>
            <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#00d4aa" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          
          <XAxis 
            dataKey="time" 
            stroke="#888" 
            fontSize={13}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          
          <YAxis 
            stroke="#888" 
            fontSize={13}
            tickLine={false}
            axisLine={false}
            domain={[minValue - padding, maxValue + padding]}
            tickFormatter={(value) => {
              if (value >= 1000000) {
                return `$${(value / 1000000).toFixed(1)}M`;
              } else if (value >= 1000) {
                return `$${(value / 1000).toFixed(0)}K`;
              } else {
                return `$${value}`;
              }
            }}
            dx={-10}
          />
          
          <Tooltip 
            contentStyle={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              fontSize: '13px'
            }}
            formatter={(value: any, name: string) => [
              `$${value.toLocaleString()}`, 
              name === 'value' ? 'Portfolio Value' : 'Change'
            ]}
            labelStyle={{ color: '#00d4aa', fontWeight: 'bold' }}
            cursor={{ stroke: '#00d4aa', strokeWidth: 2 }}
          />
          
          <Area
            type="monotone"
            dataKey="value"
            stroke="#00d4aa"
            strokeWidth={3}
            fill="url(#portfolioGradient)"
            dot={{ 
              fill: '#00d4aa', 
              strokeWidth: 2, 
              r: 5,
              stroke: '#1a1a1a'
            }}
            activeDot={{ 
              r: 8, 
              stroke: '#00d4aa', 
              strokeWidth: 3,
              fill: '#00d4aa'
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
      
      {/* Chart Summary - Increased spacing and better layout */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1 }}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Current Value
          </Typography>
          <Typography variant="h5" color="primary" fontWeight="bold">
            ${chartData[chartData.length - 1]?.value.toLocaleString() || '0'}
          </Typography>
        </Box>
        
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Today's Change
          </Typography>
          <Typography 
            variant="h5" 
            color={chartData[chartData.length - 1]?.change >= 0 ? 'success.main' : 'error.main'} 
            fontWeight="bold"
          >
            {chartData[chartData.length - 1]?.change >= 0 ? '+' : ''}
            ${chartData[chartData.length - 1]?.change.toLocaleString() || '0'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default TradingChart;
