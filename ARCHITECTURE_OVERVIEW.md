# Architecture Overview - Search & Download System

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         TEACHER PAGE                             │
│                      (teacher.html)                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SEARCH & FILTER SECTION                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐        ┌──────────────────┐              │
│  │ Teacher Name     │        │ Date Picker      │              │
│  │ Search Box       │        │                  │              │
│  │ [Autocomplete]   │        │ [Calendar]       │              │
│  └──────────────────┘        └──────────────────┘              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          FIELD SELECTION CHECKBOXES                      │  │
│  │  ☑ Teacher  ☑ Student  ☑ Date  ☑ Subject  ☑ Time ...   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │📄 PDF   │  │📊 Excel │  │📅 Weekly│  │ Clear   │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RESULTS DISPLAY                             │
│                 "Showing X of Y entries"                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Entry 1: Teacher X, Student Y, Date, Topic, etc.       │   │
│  │          [Edit] [Delete]                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Entry 2: ...                                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌──────────────┐
│  FIRESTORE   │
│   DATABASE   │
└──────┬───────┘
       │
       │ Query (last 15 days)
       ▼
┌──────────────────────────┐
│   app-firestore.js       │
│  loadRecentEntries()     │
└──────┬───────────────────┘
       │
       │ Store in cache
       ▼
┌──────────────────────────┐
│  allEntriesCache[]       │
│  (Global Variable)       │
└──────┬───────────────────┘
       │
       │ Apply filters
       ├─────────────────────────┐
       │                         │
       ▼                         ▼
┌──────────────┐        ┌──────────────┐
│ Name Filter  │        │ Date Filter  │
└──────┬───────┘        └──────┬───────┘
       │                       │
       └───────┬───────────────┘
               │
               ▼
┌──────────────────────────┐
│  Filtered Entries        │
│  filteredEntries[]       │
└──────┬───────────────────┘
       │
       │ Display
       ▼
┌──────────────────────────┐
│   DOM Update             │
│   (Instant Results)      │
└──────────────────────────┘
```

## Download Flow

```
User Action: Click Download Button
       │
       ▼
┌──────────────────────────┐
│  Get Selected Fields     │
│  getSelectedFields()     │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  Get Filtered Data       │
│  getFilteredData()       │
└──────┬───────────────────┘
       │
       ├─────────────┬─────────────┬─────────────┐
       │             │             │             │
       ▼             ▼             ▼             ▼
   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
   │  PDF   │  │ Excel  │  │ Weekly │  │ Clear  │
   │Download│  │Download│  │Download│  │Filters │
   └────┬───┘  └────┬───┘  └────┬───┘  └────┬───┘
        │           │           │           │
        ▼           ▼           ▼           ▼
   ┌────────┐  ┌────────┐  ┌────────────┐  Reset
   │jsPDF   │  │ XLSX   │  │ XLSX       │  State
   │Library │  │Library │  │Multi-Sheet │
   └────┬───┘  └────┬───┘  └─────┬──────┘
        │           │            │
        └─────┬─────┴────────────┘
              │
              ▼
       ┌────────────┐
       │  Browser   │
       │  Download  │
       └────────────┘
```

## Search Autocomplete Flow

```
User Types in Name Field
       │
       ▼
┌──────────────────────────┐
│  Event: 'input'          │
│  setupSearchListeners()  │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  getUniqueTeacherNames() │
│  Extract unique names    │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  Filter by search term   │
│  (substring match)       │
└──────┬───────────────────┘
       │
       ├─── Matches Found ───┐
       │                     │
       ▼                     ▼
   Show Dropdown        Show "No matches"
   with suggestions     message
       │
       ▼
   User clicks suggestion
       │
       ▼
┌──────────────────────────┐
│  selectTeacherName()     │
│  Fill search box         │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  loadRecentEntries()     │
│  with filter applied     │
└──────────────────────────┘
```

## Weekly Download Organization

```
┌──────────────────────────┐
│  All Entries (15 days)   │
└──────┬───────────────────┘
       │
       │ Group by week
       ▼
┌──────────────────────────────────────┐
│  Week Grouping Algorithm:            │
│  1. Get entry date                   │
│  2. Find Sunday of that week         │
│  3. Calculate Saturday (end of week) │
│  4. Create key: "DD/MM/YYYY - DD/MM" │
│  5. Add entry to that week's group   │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Week 1: 05/01/2026 - 11/01/2026    │
│    ├─ Entry 1                        │
│    ├─ Entry 2                        │
│    └─ Entry 3                        │
│                                       │
│  Week 2: 12/01/2026 - 18/01/2026    │
│    ├─ Entry 4                        │
│    └─ Entry 5                        │
└──────┬───────────────────────────────┘
       │
       │ Create Excel workbook
       ▼
┌──────────────────────────────────────┐
│  Excel Workbook                      │
│  ├─ Sheet: "Week 1"                  │
│  │   └─ Table with Week 1 entries    │
│  └─ Sheet: "Week 2"                  │
│      └─ Table with Week 2 entries    │
└──────┬───────────────────────────────┘
       │
       ▼
   Download File
```

## Component Interactions

```
┌─────────────────────────────────────────────────────────────┐
│                      TEACHER.HTML                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐         ┌────────────────┐             │
│  │   HTML Form    │────────▶│  Event Listeners│             │
│  │   Elements     │         │  (input, change)│             │
│  └────────────────┘         └────────┬────────┘             │
│                                      │                       │
│                                      ▼                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            APP-FIRESTORE.JS                         │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                      │   │
│  │  Core Functions:                                    │   │
│  │  • loadRecentEntries(filterOptions)                 │   │
│  │  • getUniqueTeacherNames()                          │   │
│  │  • setupSearchListeners()                           │   │
│  │  • selectTeacherName(name)                          │   │
│  │  • clearFilters()                                   │   │
│  │  • getSelectedFields()                              │   │
│  │  • getFilteredData()                                │   │
│  │  • downloadPDF()                                    │   │
│  │  • downloadExcel()                                  │   │
│  │  • downloadWeeklyData()                             │   │
│  │                                                      │   │
│  │  Global State:                                      │   │
│  │  • allEntriesCache = []                             │   │
│  │                                                      │   │
│  └──────────┬──────────────────────────────────────────┘   │
│             │                                               │
│             ▼                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            EXTERNAL LIBRARIES                        │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  • jsPDF (2.5.1)                                    │   │
│  │  • jsPDF-AutoTable (3.5.31)                         │   │
│  │  • SheetJS/XLSX (0.18.5)                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│                      FIREBASE FIRESTORE                       │
├──────────────────────────────────────────────────────────────┤
│  Collection: "entries"                                       │
│  ├─ Document 1: { teacherName, studentName, date, ... }     │
│  ├─ Document 2: { ... }                                     │
│  └─ Document N: { ... }                                     │
└──────────────────────────────────────────────────────────────┘
```

## State Management

```
┌─────────────────────────────────────────┐
│         APPLICATION STATE                │
├─────────────────────────────────────────┤
│                                          │
│  Global Variables:                      │
│  ┌────────────────────────────────────┐ │
│  │ allEntriesCache: Array             │ │
│  │   - Stores all fetched entries     │ │
│  │   - Used for instant filtering     │ │
│  │   - Updated on data load           │ │
│  └────────────────────────────────────┘ │
│                                          │
│  UI State:                              │
│  ┌────────────────────────────────────┐ │
│  │ searchTeacherName.value            │ │
│  │ searchDate.value                   │ │
│  │ downloadField[].checked            │ │
│  │ teacherNameSuggestions.show        │ │
│  └────────────────────────────────────┘ │
│                                          │
│  User Session:                          │
│  ┌────────────────────────────────────┐ │
│  │ localStorage:                      │ │
│  │   - teacherEmail                   │ │
│  │   - teacherName                    │ │
│  │   - role (teacher/admin)           │ │
│  └────────────────────────────────────┘ │
│                                          │
└─────────────────────────────────────────┘
```

## Event Binding

```
Page Load (DOMContentLoaded)
       │
       ▼
┌──────────────────────────┐
│ setupSearchListeners()   │
└──────┬───────────────────┘
       │
       ├─────────────────────────────────────┐
       │                                     │
       ▼                                     ▼
┌──────────────────┐              ┌──────────────────┐
│ Name Search      │              │ Date Search      │
│ Input Event      │              │ Change Event     │
└──────┬───────────┘              └──────┬───────────┘
       │                                 │
       │ On every keystroke              │ On date select
       ▼                                 ▼
   Filter + Show                     Filter entries
   Autocomplete                      
       │                                 │
       └────────┬────────────────────────┘
                │
                ▼
┌──────────────────────────────────────┐
│  loadRecentEntries(filterOptions)   │
│  • Apply name filter                │
│  • Apply date filter                │
│  • Update display                   │
│  • Update counter                   │
└─────────────────────────────────────┘

Download Buttons Click Events
       │
       ├─────────────┬─────────────┬─────────────┐
       │             │             │             │
       ▼             ▼             ▼             ▼
   PDF Click    Excel Click  Weekly Click   Clear Click
       │             │             │             │
       ▼             ▼             ▼             ▼
  downloadPDF() downloadExcel() downloadWeekly() clearFilters()
```

## Error Handling Flow

```
Function Call
       │
       ▼
┌──────────────────────────┐
│  Try Block               │
│  • Validate inputs       │
│  • Process data          │
│  • Generate output       │
└──────┬───────────────────┘
       │
       ├───── Success ────┐
       │                  │
       │                  ▼
       │          ┌────────────────┐
       │          │ Success Alert  │
       │          │ Download File  │
       │          └────────────────┘
       │
       └───── Error ─────┐
                         │
                         ▼
                 ┌────────────────┐
                 │ Catch Block    │
                 │ • Log error    │
                 │ • Show alert   │
                 │ • Recover      │
                 └────────────────┘
```

## Responsive Design Breakpoints

```
┌─────────────────────────────────────────────────────────┐
│                    SCREEN SIZES                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Mobile (< 768px)                                       │
│  ┌────────────────────────────────────────────────┐    │
│  │  Stack vertically:                             │    │
│  │  • Search fields (1 column)                    │    │
│  │  • Download buttons (full width)               │    │
│  │  • Field checkboxes (adjusted grid)            │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  Tablet (768px - 1024px)                                │
│  ┌────────────────────────────────────────────────┐    │
│  │  Two-column layout:                            │    │
│  │  • Search fields side-by-side                  │    │
│  │  • Download buttons in row                     │    │
│  │  • Field checkboxes in grid                    │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  Desktop (> 1024px)                                     │
│  ┌────────────────────────────────────────────────┐    │
│  │  Full layout:                                  │    │
│  │  • All features visible                        │    │
│  │  • Hover effects enabled                       │    │
│  │  • Optimal spacing                             │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Performance Optimization

```
┌─────────────────────────────────────────────────────────┐
│              PERFORMANCE STRATEGIES                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Data Caching                                        │
│     ┌──────────────────────────────────────┐           │
│     │ Fetch once → Store in cache         │           │
│     │ Filter from cache (no re-fetch)     │           │
│     └──────────────────────────────────────┘           │
│                                                          │
│  2. Client-Side Filtering                               │
│     ┌──────────────────────────────────────┐           │
│     │ No server calls for filter           │           │
│     │ Instant results                      │           │
│     └──────────────────────────────────────┘           │
│                                                          │
│  3. Efficient Autocomplete                              │
│     ┌──────────────────────────────────────┐           │
│     │ Extract unique names once            │           │
│     │ Filter with substring match          │           │
│     │ Limit dropdown items (if needed)     │           │
│     └──────────────────────────────────────┘           │
│                                                          │
│  4. Lazy Loading (if needed for future)                │
│     ┌──────────────────────────────────────┐           │
│     │ Load only visible entries            │           │
│     │ Infinite scroll for large datasets   │           │
│     └──────────────────────────────────────┘           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Modular Design**: Each feature is self-contained and can be maintained independently
2. **Performance First**: Client-side filtering with caching for instant results
3. **User-Centric**: Flexible search rules, clear feedback, responsive design
4. **Scalable**: Can handle growing data without architectural changes
5. **Well-Documented**: Comprehensive docs for users and developers

---

*This architecture supports the current requirements and is extensible for future enhancements.*
