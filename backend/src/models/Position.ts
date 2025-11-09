import mongoose, { Schema, Document } from 'mongoose';

export interface IPosition extends Document {
  userId: mongoose.Types.ObjectId;
  symbol: string;
  type: 'LONG' | 'SHORT';
  size: number; // Position size in base currency
  entryPrice: number;
  currentPrice: number;
  leverage: number; // 1x, 2x, 5x, 10x, 20x, 50x, 100x
  margin: number; // Initial margin amount
  marginUsed: number; // Current margin used
  liquidationPrice: number;
  pnl: number;
  pnlPercent: number;
  unrealizedPnL: number;
  realizedPnL: number;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  exchange: string;
  orderId: string;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PositionSchema = new Schema<IPosition>({
         userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  symbol: { type: String, required: true, uppercase: true }, // BTC, ETH, etc.
  type: { type: String, enum: ['LONG', 'SHORT'], required: true },
  size: { type: Number, required: true }, // Amount in base currency
  entryPrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  leverage: { type: Number, required: true, min: 1, max: 100 },
  margin: { type: Number, required: true }, // Initial margin
  marginUsed: { type: Number, required: true }, // Current margin used
  liquidationPrice: { type: Number, required: true },
  pnl: { type: Number, default: 0 },
  pnlPercent: { type: Number, default: 0 },
  unrealizedPnL: { type: Number, default: 0 },
  realizedPnL: { type: Number, default: 0 },
  status: { type: String, enum: ['OPEN', 'CLOSED', 'LIQUIDATED'], default: 'OPEN' },
  exchange: { type: String, required: true },
  orderId: { type: String, required: true },
  stopLoss: { type: Number },
  takeProfit: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance
PositionSchema.index({ userId: 1, symbol: 1, status: 1 });
PositionSchema.index({ status: 1, liquidationPrice: 1 });

export const Position = mongoose.model<IPosition>('Position', PositionSchema);
