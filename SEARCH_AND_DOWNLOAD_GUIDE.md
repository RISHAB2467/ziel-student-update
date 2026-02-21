# Advanced Search and Download Features Guide

## Overview
This guide explains the new advanced search, filtering, and download features added to the Teacher Panel.

## Features Implemented

### 1. Advanced Search Bar

#### Search by Teacher Name
- **Location**: Teachers Page, above the Recent Entries section
- **Features**:
  - Real-time autocomplete suggestions
  - Shows matching names as you type
  - Instant filtering without page reload
  - Highlights matched characters in suggestions
  - Click to select from dropdown

#### Search by Date
- **Features**:
  - Date picker for easy selection
  - Automatic filtering when date is selected
  - Shows only records for the selected date

#### Combined Search
- **Features**:
  - Search by both name and date simultaneously
  - Results show only entries matching both criteria
  - Flexible - either field is optional

#### User Experience
- **No Mandatory Fields**: All search fields are optional
- **Instant Results**: Filtering happens in real-time without page reload
- **Clear Feedback**: 
  - Shows "No records found" when no matches exist
  - Displays count: "Showing X of Y entries"
  - "Clear Filters" button to reset search

### 2. Custom Download Options

#### Field Selection
Before downloading, select which fields to include:
- ☑ Teacher Name
- ☑ Student Name
- ☑ Date
- ☑ Subject/Topic
- ☑ Time
- ☑ Class Count
- ☑ Sheet Made
- ☑ Homework Given
- ☑ Remarks

**Default**: All fields are selected

#### Download Formats

##### PDF Download
- **Button**: 📄 Download as PDF
- **Features**:
  - Professional formatted PDF report
  - Includes header with generation date
  - Auto-sized table with selected fields
  - Color-coded headers (gold theme)
  - Filename: `Teacher_Report_YYYY-MM-DD.pdf`

##### Excel Download
- **Button**: 📊 Download as Excel
- **Features**:
  - XLSX format (compatible with Excel, Google Sheets, etc.)
  - Single sheet with all selected data
  - Headers are properly formatted
  - Filename: `Teacher_Report_YYYY-MM-DD.xlsx`

##### Weekly Data Download
- **Button**: 📅 Download Weekly Data
- **Features**:
  - Automatically organizes data by week
  - Each week gets its own sheet in Excel
  - Week ranges shown clearly (e.g., "01/01/2026 - 07/01/2026")
  - Includes all data from last 15 days organized week-wise
  - Filename: `Weekly_Teacher_Data_YYYY-MM-DD.xlsx`

### 3. Smart Filtering

#### How It Works
1. **Initial Load**: Shows all entries from last 15 days
2. **Type Teacher Name**: 
   - Dropdown appears with suggestions
   - Results filter automatically
   - Select from dropdown or keep typing
3. **Select Date**:
   - Choose a date from picker
   - Results filter to that date only
4. **Combined**:
   - Both filters apply together
   - Only entries matching both criteria shown

#### Clear Filters
- **Button**: "Clear Filters" (gray button)
- **Action**: Removes all search criteria and shows all entries again

## Usage Instructions

### Basic Search

#### Search by Teacher Name Only
1. Click on "Search by Teacher Name" field
2. Start typing teacher's name
3. Select from autocomplete suggestions (or keep typing)
4. Results appear instantly

#### Search by Date Only
1. Click on "Search by Date" field
2. Select a date from calendar picker
3. Results filter to show only that date

#### Combined Search
1. Enter teacher name
2. Select date
3. See only entries matching both criteria

### Downloading Data

#### To Download Current View as PDF:
1. (Optional) Apply filters to narrow down data
2. Select fields you want in the PDF
3. Click "📄 Download as PDF"
4. File downloads automatically

#### To Download Current View as Excel:
1. (Optional) Apply filters to narrow down data
2. Select fields you want in the Excel
3. Click "📊 Download as Excel"
4. File downloads automatically

#### To Download Weekly Organized Data:
1. Select fields you want to include
2. Click "📅 Download Weekly Data"
3. Excel file downloads with separate sheets per week
4. Each sheet contains that week's data

## Technical Details

### Libraries Used
- **jsPDF**: PDF generation
- **jsPDF-AutoTable**: Table formatting in PDFs
- **SheetJS (XLSX)**: Excel file generation

### Data Scope
- Teacher users: See only their own entries
- Admin users: See all entries
- Time range: Last 15 days

### Performance
- Search and filtering happen client-side (no server calls)
- Instant results with no page reload
- Efficient caching of data for quick filtering

### File Naming Convention
- PDF: `Teacher_Report_YYYY-MM-DD.pdf`
- Excel: `Teacher_Report_YYYY-MM-DD.xlsx`
- Weekly: `Weekly_Teacher_Data_YYYY-MM-DD.xlsx`

## Responsive Design

### Mobile Devices
- Search fields stack vertically on small screens
- Download buttons expand to full width
- Autocomplete dropdown adjusts to screen size
- Touch-friendly interface

### Tablets
- Two-column layout maintained
- Optimized spacing for touch input

### Desktop
- Full layout with all features visible
- Hover effects on buttons

## Troubleshooting

### "No records found" Message
- Check if you have any entries in the last 15 days
- Try clearing filters
- Verify date range is correct

### Downloads Not Working
- Ensure you've selected at least one field
- Check if there's data to download (apply/clear filters)
- Verify browser allows downloads from the site

### Autocomplete Not Showing
- Make sure there are entries with teacher names
- Type at least one character
- Check if you're clicking in the correct field

### Weekly Download Shows Empty Sheets
- Verify you have data across multiple weeks
- Check the 15-day data range
- Ensure entries have valid dates

## Best Practices

### For Teachers
1. Use search to quickly find your specific entries
2. Download PDF for sharing reports
3. Download Excel for further analysis
4. Use weekly download at end of each week

### For Admins
1. Search by teacher name to review individual performance
2. Search by date to see all activity on specific days
3. Use weekly download for comprehensive reporting
4. Download with all fields selected for complete records

## Security Notes

- Teachers can only see and download their own data
- Admins can see and download all data
- Downloads include only filtered/visible data
- No sensitive authentication data is included in downloads

## Future Enhancements (Planned)
- Date range selection (instead of single date)
- Multiple teacher selection
- Export to Google Sheets
- Scheduled automatic weekly emails
- Custom report templates

## Support

For issues or questions:
1. Check this guide first
2. Verify your role (Teacher vs Admin)
3. Check browser console for error messages
4. Contact system administrator

---

**Last Updated**: January 2026
**Version**: 1.0
