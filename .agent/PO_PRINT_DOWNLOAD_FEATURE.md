# Purchase Order Print & Download Feature

## Overview
Added comprehensive print and PDF download functionality to the Purchase Order details page with **optimized single-page A4 layout**.

## Features Added

### 1. **Print Functionality** 🖨️
- Click the "Print" button to open the browser's print dialog
- Automatically hides UI elements (buttons, navigation, actions section)
- Optimized print layout with proper page breaks
- Professional formatting for physical documents

### 2. **PDF Download - Single Page A4 Optimized** 📄
- Click the "Download PDF" button to generate and download a PDF
- **Optimized to fit on a single A4 page** with compact formatting
- Includes:
  - Company header (ANJO WORLD)
  - PO number, date, and status (single line)
  - **Two-column layout** for PO details (Job Order, Department, Requester, Priority, Delivery dates)
  - Compact items table (removed Color/Size columns for space efficiency)
  - Subtotal, Tax, and Total Amount
  - Approval history (compact format, if space available)
  - Delivery notes (compact format, if space available)
  - Generation timestamp footer
- **Compact formatting features:**
  - Smaller fonts (7-10pt vs 9-14pt)
  - Reduced margins (10mm vs 14mm)
  - Minimal spacing between sections
  - Condensed table with 6 columns instead of 8
  - Two-column detail layout
  - Smart space management for approvals/notes
- File naming: `PO_{PO_NUMBER}_{DATE}.pdf`

## Technical Implementation

### Libraries Used
- **jsPDF**: PDF generation library
- **jspdf-autotable**: Table generation for PDF

### Key Optimizations for Single Page

#### Compact Header
- Reduced header size from 30mm to 19mm
- Combined PO info on single line

#### Two-Column Layout
- Details displayed in 2 columns instead of stacked
- Saves ~30mm of vertical space

#### Optimized Table
- Removed Color and Size columns
- Reduced from 8 to 6 columns
- Smaller fonts (7pt body, 8pt headers)
- Minimal cell padding (1.5mm vs 3mm)

#### Smart Content Management
- Approvals and delivery notes only show if space available
- Automatic truncation to fit page boundaries
- No page breaks - everything on one page

### Print Styles
```css
@media print {
  .no-print { display: none !important; }
  /* Optimized print layout */
}
```

#### Elements Hidden During Print
- Print/Download buttons
- Back to Dashboard link
- Actions section
- Navigation elements

## User Experience

### Print Button
- Gray button with printer icon
- Opens browser print dialog
- Ctrl+P keyboard shortcut also works
- Clean, professional print output

### Download PDF Button
- Blue button with download icon
- Generates compact single-page PDF instantly
- Downloads automatically
- Filename includes PO number and date
- **Perfect for A4 paper printing**

## Responsive Design
- Buttons show icons on mobile, text on desktop
- Maintains functionality across all screen sizes
- Print layout optimized for A4/Letter paper

## PDF Layout Specifications
- **Page Size**: A4 (210mm x 297mm)
- **Margins**: 10mm all sides
- **Header**: 19mm
- **Content Area**: ~268mm height
- **Font Sizes**: 7-16pt (adaptive)
- **Table**: Compact 6-column layout
- **Footer**: 5mm from bottom

## Future Enhancements (Optional)
- [ ] Add company logo image to PDF
- [ ] Email PDF functionality
- [ ] Batch download multiple POs
- [ ] Custom PDF templates
- [ ] Digital signature support
- [ ] Multi-page support for very long POs
