import mongoose, { Document, Schema } from 'mongoose';

export interface IPortfolio extends Document {
  userId: mongoose.Types.ObjectId;
  totalValue: number;
  cash: number;
  positions: {
    symbol: string;
    amount: number;
    entryPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const PortfolioSchema = new Schema<IPortfolio>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  totalValue: {
    type: Number,
    required: true,
    default: 0
  },
  cash: {
    type: Number,
    required: true,
    default: 0
  },
  positions: [{
    symbol: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    entryPrice: {
      type: Number,
      required: true
    },
    currentPrice: {
      type: Number,
      required: true
    },
    pnl: {
      type: Number,
      default: 0
    },
    pnlPercent: {
      type: Number,
      default: 0
    }
  }]
}, {
  timestamps: true
});

export const Portfolio = mongoose.model<IPortfolio>('Portfolio', PortfolioSchema);
