# How to Use the Execution Feature

## 📋 Overview

The Execution feature allows you to track and manage the actual work being done on a Job Order. It tracks when work starts, milestones, and when work is completed.

---

## 🎯 When Can You Use Execution?

Execution can be started when:
- ✅ Job Order status is **APPROVED** or **BUDGET_CLEARED**
- ✅ You have **OPERATIONS** role

Execution can be completed when:
- ✅ Job Order status is **IN_PROGRESS**
- ✅ You have **OPERATIONS** role
- ✅ You've filled in the work completion notes

---

## 🚀 Step-by-Step Guide

### Method 1: Automatic Execution Start (Recommended)

**When a Purchase Order is received, execution starts automatically!**

1. **Create a Material Requisition Job Order**
   - Go to an APPROVED Service Request
   - Click "Create Job Order"
   - Select **"Material Requisition"** as the type
   - Fill in materials and submit

2. **Create Purchase Order**
   - Go to the Job Order detail page
   - Click "Create Purchase Order"
   - Fill in supplier details and items
   - Submit the PO

3. **Approve Purchase Order**
   - Finance approves the PO
   - Status changes to APPROVED

4. **Purchase and Receive**
   - Mark PO as PURCHASED
   - Mark PO as RECEIVED
   - **✨ Automatically: Job Order status changes to IN_PROGRESS!**
   - **✨ Automatically: Actual start date is set!**

5. **Work is Now in Progress**
   - You can see execution status on the Job Order page
   - Track milestones
   - Update progress

---

### Method 2: Manual Execution Start

**For Service-type Job Orders (no PO needed)**

1. **Navigate to Job Order**
   - Go to Admin Dashboard
   - Click on "Job Orders" tab
   - Find the Job Order you want to start
   - Click to open detail page

2. **Check Prerequisites**
   - Job Order must be **APPROVED** or **BUDGET_CLEARED**
   - You must be logged in as **OPERATIONS** role

3. **Start Execution**
   - Scroll down to the **"Execution Management"** panel
   - You'll see a blue button: **"Start Execution"**
   - Click the button
   - Confirm the action
   - ✅ Status changes to **IN_PROGRESS**
   - ✅ Actual start date is automatically set to today

---

## 📊 During Execution (IN_PROGRESS)

### Viewing Execution Status

On the Job Order detail page, you'll see:

1. **Execution Management Panel**
   - Current status: **IN_PROGRESS** (blue badge)
   - Started date: Shows when execution began
   - Schedule milestones: Shows all planned activities

2. **Milestone Tracking**
   - **Active milestones**: Blue background (currently in progress)
   - **Overdue milestones**: Red background (past due date)
   - **Upcoming milestones**: Gray background (not yet started)

3. **Work Completion Notes Field**
   - A text area appears for you to describe completed work
   - This is **required** before you can complete execution

---

## ✅ Completing Execution

### Step-by-Step:

1. **Navigate to Job Order**
   - Go to the Job Order detail page
   - Status should be **IN_PROGRESS**

2. **Fill Work Completion Notes**
   - Scroll to "Execution Management" panel
   - Find the "Work Completion Notes" text area
   - **Required**: Describe what work was completed
   - Include:
     - What was done
     - Any issues encountered
     - Final status/condition
     - Any follow-up needed

   Example:
   ```
   Completed network infrastructure upgrade:
   - Installed new switches in server room
   - Configured VLANs for all departments
   - Tested connectivity - all systems operational
   - Minor issue: One cable needed replacement (resolved)
   - All documentation updated
   ```

3. **Complete Execution**
   - Click the green **"Complete Execution"** button
   - Confirm the action
   - ✅ Status changes to **COMPLETED**
   - ✅ Actual completion date is automatically set
   - ✅ Work completion notes are saved

---

## 📝 Example Workflow

### Complete Example: From Start to Finish

```
1. Service Request Created
   └─> Status: SUBMITTED

2. Service Request Approved
   └─> Status: APPROVED

3. Job Order Created (Material Requisition)
   └─> Status: DRAFT
   └─> Type: MATERIAL_REQUISITION

4. Job Order Approved
   └─> Status: APPROVED

5. Purchase Order Created
   └─> Status: DRAFT

6. Purchase Order Approved
   └─> Status: APPROVED

7. Purchase Order Received
   └─> Status: RECEIVED
   └─> ✨ AUTO: Job Order → IN_PROGRESS
   └─> ✨ AUTO: Actual start date set

8. Work in Progress
   └─> Track milestones
   └─> Update progress
   └─> Status: IN_PROGRESS

9. Work Completed
   └─> Fill completion notes
   └─> Click "Complete Execution"
   └─> Status: COMPLETED
   └─> Actual completion date set

10. Job Order Closed
    └─> Status: CLOSED
    └─> Ready for payment processing
```

---

## 🎨 Visual Guide

### Execution Panel Layout

```
┌─────────────────────────────────────────┐
│   Execution Management                  │
├─────────────────────────────────────────┤
│                                         │
│ Current Status: [IN_PROGRESS]           │
│ Started: Jan 15, 2025, 10:30 AM        │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Schedule Milestones                 │ │
│ ├─────────────────────────────────────┤ │
│ │ [Active] Install Equipment          │ │
│ │   Jan 15 - Jan 20                  │ │
│ │                                     │ │
│ │ [Upcoming] Testing                  │ │
│ │   Jan 21 - Jan 25                  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Work Completion Notes *                │
│ ┌─────────────────────────────────────┐ │
│ │ Describe completed work...          │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Complete Execution]                    │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔍 Where to Find Execution Features

### 1. Job Order Detail Page
- URL: `/job-orders/[id]`
- Contains: Full execution panel with all controls

### 2. Admin Dashboard
- URL: `/dashboard/admin`
- Shows: Job Orders with execution status
- Filter: Can filter by status (IN_PROGRESS, COMPLETED)

### 3. Job Order Cards
- Shows: Execution status badges
- Displays: Start/completion dates if available

---

## ⚠️ Common Issues & Solutions

### Issue: "Start Execution" button not visible

**Possible causes:**
1. Job Order not APPROVED or BUDGET_CLEARED
   - **Solution**: Complete approval workflow first

2. Not logged in as OPERATIONS role
   - **Solution**: Login with OPERATIONS account

3. Already IN_PROGRESS or COMPLETED
   - **Solution**: Execution already started/completed

### Issue: "Complete Execution" button disabled

**Possible causes:**
1. Work completion notes are empty
   - **Solution**: Fill in the notes field (required)

2. Status not IN_PROGRESS
   - **Solution**: Start execution first

3. Not logged in as OPERATIONS
   - **Solution**: Login with OPERATIONS account

### Issue: Execution didn't start automatically when PO was received

**Check:**
1. PO status is actually RECEIVED (not just PURCHASED)
2. Job Order is linked to the PO
3. Job Order type is MATERIAL_REQUISITION
4. Refresh the page to see updated status

---

## 💡 Tips & Best Practices

### 1. **Always Fill Completion Notes**
- Be detailed and specific
- Include what was done, issues, and outcomes
- Helps with future reference and payment processing

### 2. **Track Milestones Regularly**
- Check milestone dates
- Update if dates change
- Mark overdue items

### 3. **Use Automatic Start When Possible**
- For Material Requisitions, let PO receipt trigger execution
- Ensures accurate start dates
- Reduces manual work

### 4. **Monitor Execution Status**
- Check dashboard regularly
- Filter by IN_PROGRESS to see active work
- Follow up on overdue milestones

### 5. **Complete Execution Promptly**
- Don't leave work in IN_PROGRESS after completion
- Fill notes immediately after work is done
- Helps with accurate reporting

---

## 📊 Understanding Status Badges

### Execution Status Colors

- **IN_PROGRESS**: Blue badge
  - Work is currently being done
  - Can track milestones
  - Can complete execution

- **COMPLETED**: Green badge
  - Work is finished
  - Completion notes filled
  - Ready for acceptance/closure

- **APPROVED**: Green badge (before execution)
  - Ready to start execution
  - Can click "Start Execution"

---

## 🔄 Status Transitions

### Execution-Related Transitions

```
APPROVED
  ↓ (Start Execution)
IN_PROGRESS
  ↓ (Complete Execution)
COMPLETED
  ↓ (Close)
CLOSED
```

**Note**: You can also go directly from:
- BUDGET_CLEARED → IN_PROGRESS (if approved by management)

---

## 📱 Quick Actions

### From Job Order Detail Page:

1. **Start Execution**
   - Scroll to Execution Panel
   - Click "Start Execution"
   - Confirm

2. **Complete Execution**
   - Fill completion notes
   - Click "Complete Execution"
   - Confirm

3. **View Milestones**
   - Check Execution Panel
   - See all scheduled activities
   - Check dates and status

---

## 🎓 Practice Exercise

Try this complete flow:

1. **Create a test Service Request**
   - Login as Requester
   - Create new SR
   - Submit it

2. **Approve the SR**
   - Login as Approver/Admin
   - Approve the SR

3. **Create Job Order (Service type)**
   - Create JO from approved SR
   - Select "Service" type
   - Add materials and schedule

4. **Approve Job Order**
   - Go through approval workflow
   - Get to APPROVED status

5. **Start Execution**
   - Go to JO detail page
   - Click "Start Execution"
   - See status change to IN_PROGRESS

6. **Complete Execution**
   - Fill completion notes
   - Click "Complete Execution"
   - See status change to COMPLETED

---

## ❓ FAQ

**Q: Can I start execution without a Purchase Order?**
A: Yes! For Service-type Job Orders, you can manually start execution once the JO is APPROVED.

**Q: What if I need to update milestones during execution?**
A: You can update the schedule through the Job Order edit functionality. The Execution Panel will show updated dates.

**Q: Can I undo "Complete Execution"?**
A: Currently, once completed, you'd need to manually change status back to IN_PROGRESS through the status update API. This is intentional to maintain data integrity.

**Q: Who can see execution status?**
A: All users with access to the Job Order can see execution status, but only OPERATIONS role can start/complete execution.

**Q: What happens to execution if I close the Job Order?**
A: You should complete execution first, then close. Closing a Job Order typically happens after acceptance and before payment.

---

## 🎯 Summary

**To Start Execution:**
1. Ensure JO is APPROVED or BUDGET_CLEARED
2. Login as OPERATIONS
3. Click "Start Execution" OR receive PO (auto-start)

**To Complete Execution:**
1. Ensure JO is IN_PROGRESS
2. Fill work completion notes
3. Click "Complete Execution"

**Automatic Execution:**
- When PO status = RECEIVED
- JO automatically becomes IN_PROGRESS
- Start date is automatically set

---

**Need Help?** Check the Execution Panel on any Job Order detail page for real-time status and available actions!

