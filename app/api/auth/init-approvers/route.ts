import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User, { Department, UserRole } from '@/lib/models/User';
import { hashPassword, getAuthUser } from '@/lib/auth';

const APPROVERS: Array<{
  name: string;
  email: string;
  department: Department;
  role: UserRole;
}> = [
  { name: 'Tony Badayos', email: 'tony.badayos@anjoworld.com', department: 'Maintenance', role: 'APPROVER' },
  { name: 'Jonathan Mabini', email: 'jonathan.mabini@anjoworld.com', department: 'IT Department', role: 'APPROVER' },
  { name: 'Ina Guipo', email: 'ina.guipo@anjoworld.com', department: 'Operations', role: 'APPROVER' },
  { name: 'Kenneth Loreto', email: 'kenneth.loreto@anjoworld.com', department: 'HR', role: 'APPROVER' },
  { name: 'Mitch Alforque', email: 'mitch.alforque@anjoworld.com', department: 'Sales', role: 'APPROVER' },
  { name: 'Stella Ong', email: 'stella.ong@anjoworld.com', department: 'Finance', role: 'APPROVER' },
  { name: 'Nelson Judaya', email: 'nelson.judaya@anjoworld.com', department: 'Marketing', role: 'APPROVER' },
  { name: 'Chester Lim', email: 'clim@anjoworld.com', department: 'President', role: 'SUPER_ADMIN' },
];

export async function POST(request: NextRequest) {
  try {
    // Check if user is super admin
    const authUser = getAuthUser(request);
    if (!authUser || authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Super Admin access required' },
        { status: 403 }
      );
    }
    

    await connectDB();
    const defaultPassword = 'Password123!'; // Change this in production
    const hashedPassword = await hashPassword(defaultPassword);
    const chesterPassword = 'anjo123'; // Special password for Chester Lim
    const chesterHashedPassword = await hashPassword(chesterPassword);

    const results = [];

    for (const approver of APPROVERS) {
      const existingUser = await User.findOne({ email: approver.email.toLowerCase() });
      
      // Use special password for Chester Lim, default for others
      const isChester = approver.email.toLowerCase() === 'clim@anjoworld.com';
      const passwordToUse = isChester ? chesterHashedPassword : hashedPassword;
      
      if (existingUser) {
        // Update existing user
        existingUser.name = approver.name;
        existingUser.role = approver.role;
        existingUser.department = approver.department;
        existingUser.isActive = true;
        existingUser.password = passwordToUse; // Update password
        await existingUser.save();
        results.push({ 
          email: approver.email, 
          action: 'updated',
          password: isChester ? chesterPassword : defaultPassword
        });
      } else {
        // Create new user
        const user = new User({
          email: approver.email.toLowerCase(),
          password: passwordToUse,
          name: approver.name,
          role: approver.role,
          department: approver.department,
          isActive: true,
        });
        await user.save();
        results.push({ 
          email: approver.email, 
          action: 'created',
          password: isChester ? chesterPassword : defaultPassword
        });
      }
    }

    return NextResponse.json({
      message: 'Approvers initialized successfully',
      results,
      defaultPassword,
    });
  } catch (error: any) {
    console.error('Init approvers error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize approvers' },
      { status: 500 }
    );
  }
}

