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
    { name: 'Luchie Catalan', email: 'luchie.catalan@anjoworld.com', department: 'Belmont One', role: 'APPROVER' },
    { name: 'Purchasing Manager', email: 'purchasing@anjoworld.com', department: 'Purchasing', role: 'APPROVER' },
    { name: 'Accounting Head', email: 'accounting.head@anjoworld.com', department: 'Accounting', role: 'APPROVER' },
    { name: 'General Services Head', email: 'general.services@anjoworld.com', department: 'General Services', role: 'APPROVER' },
    { name: 'Chester Lim', email: 'clim@anjoworld.com', department: 'President', role: 'SUPER_ADMIN' },
  ];

// GET method - for initial database seeding (no auth required)
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const defaultPassword = 'anjo123';
    const hashedPassword = await hashPassword(defaultPassword);
    const specialPassword = 'anjo123';
    const specialHashedPassword = await hashPassword(specialPassword);

    const results = [];

    for (const approver of APPROVERS) {
      const existingUser = await User.findOne({ email: approver.email.toLowerCase() });

      const isChester = approver.email.toLowerCase() === 'clim@anjoworld.com';
      const isAccountingHead = approver.email.toLowerCase() === 'accounting.head@anjoworld.com';
      const isGeneralServicesHead = approver.email.toLowerCase() === 'general.services@anjoworld.com';
      const useSpecialPassword = isChester || isAccountingHead || isGeneralServicesHead;
      const passwordToUse = useSpecialPassword ? specialHashedPassword : hashedPassword;

      if (existingUser) {
        existingUser.name = approver.name;
        existingUser.role = approver.role;
        existingUser.department = approver.department;
        existingUser.isActive = true;
        existingUser.password = passwordToUse;
        await existingUser.save();
        results.push({
          email: approver.email,
          action: 'updated',
          password: useSpecialPassword ? specialPassword : defaultPassword
        });
      } else {
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
          password: useSpecialPassword ? specialPassword : defaultPassword
        });
      }
    }

    return NextResponse.json({
      message: 'Approvers initialized successfully',
      results,
      defaultPassword,
      note: 'All accounts created/updated. Chester Lim, Accounting Head, and General Services Head use password: anjo123'
    });
  } catch (error: any) {
    console.error('Init approvers error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize approvers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is super admin (optional - can be bypassed for initial setup)
    const authUser = getAuthUser(request);
    // Temporarily allow without auth for initial setup
    // if (!authUser || authUser.role !== 'SUPER_ADMIN') {
    //   return NextResponse.json(
    //     { error: 'Unauthorized - Super Admin access required' },
    //     { status: 403 }
    //   );
    // }


    await connectDB();
    const defaultPassword = 'anjo123'; // Change this in production
    const hashedPassword = await hashPassword(defaultPassword);
    const specialPassword = 'anjo123'; // Special password for Chester Lim, Accounting Head, and General Services Head
    const specialHashedPassword = await hashPassword(specialPassword);

    const results = [];

    for (const approver of APPROVERS) {
      const existingUser = await User.findOne({ email: approver.email.toLowerCase() });

      // Use special password for Chester Lim, Accounting Head, and General Services Head
      const isChester = approver.email.toLowerCase() === 'clim@anjoworld.com';
      const isAccountingHead = approver.email.toLowerCase() === 'accounting.head@anjoworld.com';
      const isGeneralServicesHead = approver.email.toLowerCase() === 'general.services@anjoworld.com';
      const useSpecialPassword = isChester || isAccountingHead || isGeneralServicesHead;
      const passwordToUse = useSpecialPassword ? specialHashedPassword : hashedPassword;

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
          password: useSpecialPassword ? specialPassword : defaultPassword
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
          password: useSpecialPassword ? specialPassword : defaultPassword
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

