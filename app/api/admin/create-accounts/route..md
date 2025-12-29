import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User, { Department, UserRole } from '@/lib/models/User';
import { hashPassword, getAuthUser } from '@/lib/auth';

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

    console.log('Starting account creation...');
    await connectDB();
    console.log('Database connected');
    
    const password = 'anjo123';
    const hashedPassword = await hashPassword(password);
    console.log('Password hashed');

    const accounts: Array<{
      name: string;
      email: string;
      department: Department;
      role: UserRole;
    }> = [
      {
        name: 'Accounting Head',
        email: 'accounting.head@anjoworld.com',
        department: 'Accounting' as Department,
        role: 'APPROVER',
      },
      {
        name: 'General Services Head',
        email: 'general.services@anjoworld.com',
        department: 'General Services' as Department,
        role: 'APPROVER',
      },
    ];

    const results = [];

    for (const account of accounts) {
      try {
        const existingUser = await User.findOne({ email: account.email.toLowerCase() });

        if (existingUser) {
          // Update existing user
          existingUser.name = account.name;
          existingUser.role = account.role;
          existingUser.department = account.department;
          existingUser.isActive = true;
          existingUser.password = hashedPassword;
          await existingUser.save();
          
          // Verify it was saved
          const verifyUser = await User.findOne({ email: account.email.toLowerCase() });
          if (!verifyUser) {
            throw new Error(`Failed to verify save for ${account.email}`);
          }
          
          results.push({ 
            email: account.email, 
            action: 'updated',
            password: password
          });
          console.log(`✓ Updated: ${account.email}`);
        } else {
          // Create new user
          const user = new User({
            email: account.email.toLowerCase(),
            password: hashedPassword,
            name: account.name,
            role: account.role,
            department: account.department,
            isActive: true,
          });
          
          const savedUser = await user.save();
          
          // Verify it was saved
          const verifyUser = await User.findById(savedUser._id);
          if (!verifyUser) {
            throw new Error(`Failed to verify save for ${account.email}`);
          }
          
          results.push({ 
            email: account.email, 
            action: 'created',
            password: password,
            userId: savedUser._id.toString()
          });
          console.log(`✓ Created: ${account.email} (ID: ${savedUser._id})`);
        }
      } catch (accountError: any) {
        console.error(`Error processing ${account.email}:`, accountError);
        results.push({
          email: account.email,
          action: 'error',
          error: accountError.message
        });
      }
    }

    console.log('Account creation completed. Results:', results);
    
    return NextResponse.json({
      message: 'Accounts created/updated successfully',
      results,
      password: 'anjo123',
      totalCreated: results.filter(r => r.action === 'created').length,
      totalUpdated: results.filter(r => r.action === 'updated').length,
    });
  } catch (error: any) {
    console.error('Error creating accounts:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create accounts',
        details: error.stack 
      },
      { status: 500 }
    );
  }
}

//create accounts script

// fetch('/api/admin/create-accounts', { method: 'POST' })
//   .then(r => r.json())
//   .then(data => {
//     console.log('Response:', data);
//     if (data.error) {
//       alert('Error: ' + data.error);
//     } else {
//       alert('Success! Check console for details.\n\nCreated: ' + data.totalCreated + '\nUpdated: ' + data.totalUpdated);
//     }
//   })
//   .catch(e => {
//     console.error('Error:', e);
//     alert('Failed: ' + e.message);
//   });