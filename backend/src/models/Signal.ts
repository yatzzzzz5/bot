import mongoose, { Document, Schema } from 'mongoose';

export interface ISignal extends Document {
  symbol: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: 'WEAK' | 'MEDIUM' | 'STRONG';
  confidence: number;
  reason: string;
  source: string;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SignalSchema = new Schema<ISignal>({
  symbol: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['BUY', 'SELL', 'HOLD'],
    required: true
  },
  strength: {
    type: String,
    enum: ['WEAK', 'MEDIUM', 'STRONG'],
    required: true
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  reason: {
    type: String,
    required: true
  },
  source: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

export const Signal = mongoose.model<ISignal>('Signal', SignalSchema);
