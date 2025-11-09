import mongoose, { Schema, Document } from 'mongoose';

export interface IMarginAccount extends Document {
  userId: mongoose.Types.ObjectId;
  totalBalance: number; // Total account balance
  availableBalance: number; // Available for new positions
  marginBalance: number; // Total margin balance
  marginUsed: number; // Currently used margin
  marginFree: number; // Free margin (marginBalance - marginUsed)
  marginRatio: number; // marginUsed / marginBalance
  liquidationThreshold: number; // When liquidation happens (e.g., 0.8 = 80%)
  maxLeverage: number; // Maximum allowed leverage
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  dailyPnL: number;
  totalPnL: number;
  maxDrawdown: number;
  openPositions: number;
  totalPositions: number;
  winRate: number;
  createdAt: Date;
  updatedAt: Date;
}

const MarginAccountSchema = new Schema<IMarginAccount>({
         userId: { type: Schema.Types.ObjectId, ref: 'User', required: false, unique: false },
  totalBalance: { type: Number, required: true, default: 0 },
  availableBalance: { type: Number, required: true, default: 0 },
  marginBalance: { type: Number, required: true, default: 0 },
  marginUsed: { type: Number, required: true, default: 0 },
  marginFree: { type: Number, required: true, default: 0 },
  marginRatio: { type: Number, required: true, default: 0 },
  liquidationThreshold: { type: Number, required: true, default: 0.8 },
  maxLeverage: { type: Number, required: true, default: 100 },
  riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'], default: 'MEDIUM' },
  dailyPnL: { type: Number, default: 0 },
  totalPnL: { type: Number, default: 0 },
  maxDrawdown: { type: Number, default: 0 },
  openPositions: { type: Number, default: 0 },
  totalPositions: { type: Number, default: 0 },
  winRate: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save middleware to calculate derived fields
MarginAccountSchema.pre('save', function(next) {
  this.marginFree = this.marginBalance - this.marginUsed;
  this.marginRatio = this.marginBalance > 0 ? this.marginUsed / this.marginBalance : 0;
  
  // Update risk level based on margin ratio
  if (this.marginRatio <= 0.3) {
    this.riskLevel = 'LOW';
  } else if (this.marginRatio <= 0.6) {
    this.riskLevel = 'MEDIUM';
  } else if (this.marginRatio <= 0.8) {
    this.riskLevel = 'HIGH';
  } else {
    this.riskLevel = 'EXTREME';
  }
  
  next();
});

// Indexes
MarginAccountSchema.index({ userId: 1 });
MarginAccountSchema.index({ riskLevel: 1 });

export const MarginAccount = mongoose.model<IMarginAccount>('MarginAccount', MarginAccountSchema);
