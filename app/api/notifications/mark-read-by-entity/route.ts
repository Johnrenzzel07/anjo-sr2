import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Notification from '@/lib/models/Notification';
import { getAuthUser } from '@/lib/auth';

// Mark notifications as read by related entity
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { relatedEntityType, relatedEntityId } = body;

    if (!relatedEntityType || !relatedEntityId) {
      return NextResponse.json(
        { error: 'relatedEntityType and relatedEntityId are required' },
        { status: 400 }
      );
    }

    const result = await Notification.updateMany(
      { 
        userId: authUser.id,
        relatedEntityType,
        relatedEntityId,
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json({
      message: 'Notifications marked as read',
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}

