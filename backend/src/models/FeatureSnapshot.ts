import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFeatureSnapshot extends Document {
  symbol: string;
  ts: Date;
  features: Record<string, any>;
}

const FeatureSnapshotSchema = new Schema<IFeatureSnapshot>({
  symbol: { type: String, required: true, index: true },
  ts: { type: Date, required: true, index: true },
  features: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true });

export const FeatureSnapshot: Model<IFeatureSnapshot> =
  (mongoose.models.FeatureSnapshot as Model<IFeatureSnapshot>) ||
  mongoose.model<IFeatureSnapshot>('FeatureSnapshot', FeatureSnapshotSchema);


