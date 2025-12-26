# Service Request System - Job Order Management

A comprehensive Service Request System with Job Order workflow management built with Next.js, TypeScript, and Tailwind CSS.

## System Flow

```
Service Request (Approved) → Job Order (JO) → MR → PO → Execution → Acceptance → Payment
```

## Features

### Authentication & User Management

- **User Roles**:
  - **REQUESTER**: Can create and track their own service requests
  - **APPROVER**: Can approve/reject service requests from their department
  - **ADMIN**: Full access to manage all requests and job orders
  - **SUPER_ADMIN**: Full access plus ability to initialize approvers

- **Pre-configured Approvers**:
  - President = Chester Lim (Super Admin)
  - Operations = Ina Guipo
  - HR = Kenneth Loreto
  - Sales = Mitch Alforque
  - Finance = Stella Ong
  - Marketing = Nelson Judaya
  - IT = Jonathan Mabini
  - Maintenance = Tony Badayos
  - Belmont One = Luchie Catalan

- **Dashboards**:
  - **Requester Dashboard**: Track personal service requests with status overview
  - **Admin Dashboard**: Manage all requests, approve/reject, view job orders

### Job Order (JO) Management (MVP)

- **Auto-generation** from approved Service Requests
- **Complete Job Order Template** with all required sections:
  - Job Order Header (read-only from SR)
  - Job Description (editable scope)
  - Materials & Services Required
  - Manpower / Responsibility
  - Schedule & Milestones
  - Budget Information
  - Acceptance & Completion
  - Approvals & Signatures

### Workflow & Status Management

- **Status Timeline**: Draft → Endorsed → Budget Cleared → Approved → In Progress → Completed → Closed
- **Role-based Approvals**:
  - Operations: Prepare
  - Department Head: Review & Endorse
  - Finance: Note Budget
  - Management: Approve

### Control Rules (System-Enforced)

- ✅ JO can only be created from APPROVED SR
- 🚫 No MR / PO without JO
- 🔄 JO is mandatory reference for execution
- 🔒 JO must be CLOSED before payment release

## Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB (local installation or MongoDB Atlas account)
- npm, yarn, pnpm, or bun

### Installation

1. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

2. Set up MongoDB:

   - **Local MongoDB**: Make sure MongoDB is running on `localhost:27017`
   - **MongoDB Atlas**: Get your connection string from MongoDB Atlas

3. Create `.env.local` file in the root directory:

```env
MONGODB_URI=mongodb://localhost:27017/service-request-system
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database-name

# JWT Secret for authentication (change in production)
JWT_SECRET=your-secret-key-change-in-production
```

4. Initialize Approvers (Optional):

   - Login as Super Admin (Chester Lim)
   - Go to Admin Dashboard
   - Click "Init Approvers" button to create all approver accounts
   - Default password for approvers: `Password123!` (change after first login)

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── service-requests/     # SR API endpoints
│   │   └── job-orders/           # JO API endpoints
│   ├── job-orders/
│   │   └── [id]/                 # Job Order detail page
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Main dashboard
│   └── globals.css                # Global styles
├── components/
│   ├── JobOrderCard.tsx          # JO card component
│   ├── JobOrderDetail.tsx        # JO detail view
│   ├── JobOrderForm.tsx          # JO creation form
│   ├── ServiceRequestCard.tsx    # SR card component
│   └── StatusBadge.tsx           # Status badge component
├── lib/
│   └── store.ts                  # Data store (in-memory)
├── types/
│   └── index.ts                  # TypeScript types
└── package.json
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login user
- `POST /api/auth/signup` - Register new requester
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/init-approvers` - Initialize approvers (Super Admin only)

### Service Requests

- `GET /api/service-requests` - Get all service requests (filtered by role)
- `GET /api/service-requests/approved` - Get approved service requests
- `GET /api/service-requests/[id]` - Get service request by ID
- `POST /api/service-requests` - Create new service request
- `PATCH /api/service-requests/[id]` - Update service request (approve/reject)

### Job Orders

- `GET /api/job-orders` - Get all job orders
- `POST /api/job-orders` - Create new job order
- `GET /api/job-orders/[id]` - Get job order by ID
- `PATCH /api/job-orders/[id]` - Update job order
- `POST /api/job-orders/[id]/approve` - Add approval
- `PATCH /api/job-orders/[id]/status` - Update status

## User Roles & Permissions

### Requester
- Create service requests
- View and track own service requests
- Access requester dashboard

### Approver
- View service requests from their department
- Approve/reject service requests from their department
- Access admin dashboard
- Approve job orders (based on role in JO workflow)

### Admin
- Full access to all service requests
- Approve/reject any service request
- View all job orders
- Access admin dashboard

### Super Admin
- All Admin permissions
- Initialize approver accounts
- Full system access

## Sample Data

The system comes pre-loaded with sample approved Service Requests for testing:
- SR-2024-0001: IT Department - Network infrastructure upgrade
- SR-2024-0002: Facilities - Office renovation

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: MongoDB with Mongoose ODM

## Next Steps

To enhance the system:

1. **Database Integration**: Replace in-memory store with PostgreSQL/MongoDB
2. **Authentication**: Add user authentication and session management
3. **Material Request (MR)**: Implement MR creation from JO materials
4. **Purchase Order (PO)**: Implement PO workflow
5. **Payment Processing**: Add payment release workflow
6. **Notifications**: Add email/notification system for approvals
7. **Reporting**: Add reports and analytics dashboard
8. **File Attachments**: Support document uploads

## License

This project is private and proprietary.
