import mongoose, { Schema, models, model } from 'mongoose';

export type UserRole = 'REQUESTER' | 'ADMIN' | 'APPROVER' | 'SUPER_ADMIN';
export type Department = 
  | 'Maintenance'
  | 'IT Department'
  | 'IT' // legacy / alternate spelling
  | 'Belmont One'
  | 'Operations' 
  | 'HR' 
  | 'Sales' 
  | 'Finance' 
  | 'Marketing' 
  | 'Purchasing'
  | 'President'
  | 'Other';

export interface IUser {
  _id?: string;
  id?: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  department?: Department;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['REQUESTER', 'ADMIN', 'APPROVER', 'SUPER_ADMIN'],
    required: true,
    default: 'REQUESTER',
  },
  department: {
    type: String,
    enum: ['Maintenance', 'IT Department', 'IT', 'Belmont One', 'Operations', 'HR', 'Sales', 'Finance', 'Marketing', 'Purchasing', 'President', 'Other'],
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: String,
    default: () => new Date().toISOString(),
  },
  updatedAt: {
    type: String,
    default: () => new Date().toISOString(),
  },
}, {
  timestamps: false,
});

UserSchema.pre('save', function() {
  this.updatedAt = new Date().toISOString();
});

// Only create model if it doesn't exist
const User = (models.User as mongoose.Model<IUser>) || model<IUser>('User', UserSchema);

export default User;

