import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import JobOrder from '@/lib/models/JobOrder';
import { getAuthUser } from '@/lib/auth';

// POST: Purchasing Department submits canvass/pricing for materials
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id } = await params;
        const authUser = getAuthUser(request);

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is from Purchasing Department
        const userDept = (authUser.department || '').toLowerCase().replace(/\s+department$/, '');
        const isPurchasing = userDept === 'purchasing' ||
            authUser.role === 'SUPER_ADMIN' ||
            authUser.role === 'ADMIN';

        if (!isPurchasing) {
            return NextResponse.json(
                { error: 'Only Purchasing Department can submit canvass pricing' },
                { status: 403 }
            );
        }

        const jobOrder = await JobOrder.findById(id).populate('srId', 'contactEmail');
        if (!jobOrder) {
            return NextResponse.json({ error: 'Job Order not found' }, { status: 404 });
        }

        // Check if JO is in PENDING_CANVASS status
        if (jobOrder.status !== 'PENDING_CANVASS') {
            return NextResponse.json(
                { error: 'Job Order is not pending canvass. Current status: ' + jobOrder.status },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { materials, comments } = body;

        // Update materials with pricing
        if (materials && Array.isArray(materials)) {
            jobOrder.materials = materials.map((mat: any) => ({
                id: mat.id,
                item: mat.item,
                description: mat.description,
                quantity: mat.quantity,
                unit: mat.unit,
                size: mat.size || '',
                color: mat.color || '',
                estimatedCost: mat.estimatedCost || 0,
                unitPrice: mat.unitPrice || 0,
                source: mat.source || 'PURCHASE',
            }));

            // Calculate total estimated cost from materials
            const totalEstimatedCost = materials.reduce((sum: number, mat: any) => {
                return sum + (mat.estimatedCost || 0);
            }, 0);

            jobOrder.budget = {
                ...jobOrder.budget,
                estimatedTotalCost: totalEstimatedCost,
            };
        }

        // Add approval record for canvass completion
        const approval = {
            role: 'PURCHASING',
            userId: authUser.id,
            userName: authUser.name,
            action: 'CANVASS_COMPLETED',
            timestamp: new Date().toISOString(),
            comments: comments || 'Canvassing and pricing completed',
        };

        if (!jobOrder.approvals) {
            jobOrder.approvals = [];
        }
        jobOrder.approvals.push(approval);

        // Update status to DRAFT - ready for Finance budget approval
        jobOrder.status = 'DRAFT';
        jobOrder.updatedAt = new Date().toISOString();

        await jobOrder.save();

        // Notify Finance that canvassing is complete and budget approval is needed
        const { notifyJobOrderNeedsApproval } = await import('@/lib/utils/notifications');
        await notifyJobOrderNeedsApproval(
            jobOrder._id.toString(),
            jobOrder.joNumber,
            'FINANCE',
            'MATERIAL_REQUISITION',
            authUser.name
        );

        return NextResponse.json({
            success: true,
            message: 'Canvass pricing submitted successfully. Job Order forwarded for budget approval.',
            jobOrder,
        });
    } catch (error: any) {
        console.error('Error submitting canvass:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to submit canvass' },
            { status: 500 }
        );
    }
}
