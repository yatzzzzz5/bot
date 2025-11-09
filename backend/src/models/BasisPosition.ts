import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBasisPosition extends Document {
  symbol: string;
  spotExchange: string;
  perpExchange: string;
  notionalUSD: number;
  openedAt: Date;
  closedAt?: Date;
  pnlUSD?: number;
  status: 'OPEN' | 'CLOSED';
}

const BasisPositionSchema = new Schema<IBasisPosition>({
  symbol: { type: String, required: true },
  spotExchange: { type: String, required: true },
  perpExchange: { type: String, required: true },
  notionalUSD: { type: Number, required: true },
  openedAt: { type: Date, default: () => new Date() },
  closedAt: { type: Date },
  pnlUSD: { type: Number, default: 0 },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' }
}, { timestamps: true });

export const BasisPosition: Model<IBasisPosition> =
  (mongoose.models.BasisPosition as Model<IBasisPosition>) ||
  mongoose.model<IBasisPosition>('BasisPosition', BasisPositionSchema);


