import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  role: 'user' | 'admin';
  apiKeys: {
    exchange: string;
    apiKey: string;
    secretKey: string;
    passphrase?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  apiKeys: [{
    exchange: {
      type: String,
      required: true
    },
    apiKey: {
      type: String,
      required: true
    },
    secretKey: {
      type: String,
      required: true
    },
    passphrase: String
  }]
}, {
  timestamps: true
});

export const User = mongoose.model<IUser>('User', UserSchema);
