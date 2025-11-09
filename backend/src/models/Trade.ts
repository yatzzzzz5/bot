import mongoose, { Document, Schema } from 'mongoose';

export interface ITrade extends Document {
  userId: mongoose.Types.ObjectId;
  symbol: string;
  type: 'BUY' | 'SELL';
  amount: number;
  price: number;
  total: number;
  fee: number;
  exchange: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  orderId: string;
  createdAt: Date;
  updatedAt: Date;
}

const TradeSchema = new Schema<ITrade>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  symbol: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['BUY', 'SELL'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  fee: {
    type: Number,
    default: 0
  },
  exchange: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'CANCELLED', 'FAILED'],
    default: 'PENDING'
  },
  orderId: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

export const Trade = mongoose.model<ITrade>('Trade', TradeSchema);
