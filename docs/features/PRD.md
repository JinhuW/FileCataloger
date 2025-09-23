# Product Requirements Document (PRD)
## File Naming Builder - File Cataloger Application

### Document Information
- **Product Name:** File Naming Builder
- **Version:** 1.0
- **Date:** January 2025
- **Author:** Product Manager
- **Target Implementation:** Claude AI Assistant

---

## 1. Executive Summary

### 1.1 Purpose
This PRD defines the requirements for a File Naming Builder feature to be implemented as part of the File Cataloger application. The feature enables users to batch rename files using customizable naming patterns through an intuitive drag-and-drop interface.

### 1.2 Target Users
- **Primary:** Casual users who need to organize files but lack technical expertise
- **Secondary:** Professional users managing large file collections (photographers, designers, researchers)

### 1.3 Success Metrics
- User can complete file renaming task in under 3 minutes
- 85% task completion rate for first-time users
- Less than 10% error rate in pattern creation
- User satisfaction score > 4.2/5

---

## 2. Problem Statement

### 2.1 User Pain Points
1. **Inconsistent Naming:** Users struggle with maintaining consistent file naming across projects
2. **Manual Effort:** Renaming multiple files individually is time-consuming
3. **Complex Tools:** Existing batch rename tools are too technical for casual users
4. **Pattern Memory:** Users can't remember or reuse their naming conventions

### 2.2 Business Opportunity
- Differentiate from competitors with superior UX
- Increase user retention through essential functionality
- Expand market to non-technical users
- Enable upsell to premium features (cloud sync, advanced patterns)

---

## 3. Product Goals & Objectives

### 3.1 Primary Goals
1. **Simplify Batch Renaming:** Make file renaming accessible to non-technical users
2. **Ensure Consistency:** Help users maintain organized file structures
3. **Save Time:** Reduce file management time by 80%
4. **Prevent Errors:** Provide preview and undo capabilities

### 3.2 Success Criteria
- Feature adoption rate > 60% within first month
- Average time to complete rename task < 3 minutes
- Support for 95% of common naming patterns
- Zero data loss incidents

---

## 4. User Stories & Requirements

### 4.1 Core User Stories

#### Story 1: File Selection
**As a** user  
**I want to** easily select multiple files for renaming  
**So that** I can process them in batch

**Acceptance Criteria:**
- Support drag-and-drop file selection
- Display file count and total size
- Allow individual file removal
- Show file type icons for recognition
- Support selecting 1-1000 files

#### Story 2: Pattern Creation
**As a** user  
**I want to** create naming patterns visually  
**So that** I don't need to learn syntax

**Acceptance Criteria:**
- Drag-and-drop pattern components
- Visual preview of pattern
- Click to add components
- Reorder components by dragging
- Remove components easily

#### Story 3: Component Configuration
**As a** user  
**I want to** customize each naming component  
**So that** I can create precise patterns

**Acceptance Criteria:**
- Settings modal for each component
- Date format options (YYYY-MM-DD, etc.)
- Counter configuration (start, digits)
- Text case options
- Custom text input

#### Story 4: Preview Results
**As a** user  
**I want to** preview rename results before applying  
**So that** I can verify correctness

**Acceptance Criteria:**
- Show before/after comparison
- Highlight changes visually
- Display all files in scrollable list
- Update preview when pattern changes

#### Story 5: Template Management
**As a** user  
**I want to** save and reuse naming patterns  
**So that** I can maintain consistency

**Acceptance Criteria:**
- Pre-built template library
- Save custom templates
- Template preview
- One-click template application

---

## 5. Functional Requirements

### 5.1 File Selection Module

#### 5.1.1 File Input Methods
- **Drag & Drop:** Primary method for file selection
- **Browse Button:** Alternative file picker
- **Folder Selection:** Select entire directories (future)

#### 5.1.2 File Display
- Show filename, size, type icon
- Support for all common file types
- Individual file removal
- Clear all files option
- File count indicator

#### 5.1.3 Limitations
- Maximum 1000 files per batch
- Maximum 500MB total size
- Exclude system files
- Warn for duplicate names

### 5.2 Pattern Builder Module

#### 5.2.1 Available Components
| Component | Description | Configuration Options |
|-----------|-------------|----------------------|
| Date | Current or file date | Format: YYYY-MM-DD, DD/MM/YYYY, etc. |
| Time | Current or file time | Format: HH:MM:SS, 24h/12h |
| Counter | Sequential numbers | Start value, padding zeros |
| Text | Custom static text | Case options, value |
| Project | Project selection | Dropdown list, custom input |
| Version | Version numbering | Format: v1.0, 1.0.0, etc. |
| Metadata | File properties | Type, size, dimensions, author |

#### 5.2.2 Pattern Rules
- Minimum 1 component required
- Maximum 10 components
- Auto-add separators between components
- Validate for invalid characters
- Preserve file extensions

#### 5.2.3 Interaction Methods
- Drag components to builder area
- Click components to add
- Drag to reorder in builder
- Click settings icon to configure
- Click X to remove

### 5.3 Preview Module

#### 5.3.1 Display Requirements
- Two-column layout: Original → New
- File type icons
- Highlight naming conflicts
- Scrollable for many files
- Update in real-time

#### 5.3.2 Validation
- Check for duplicate names
- Warn for overlong names (>255 chars)
- Flag invalid characters
- Show error count

### 5.4 Template System

#### 5.4.1 Pre-built Templates
1. **Document Version:** YYYY-MM-DD_Name_v1.0
2. **Photo Archive:** IMG_YYYYMMDD_HHMMSS
3. **Project Files:** Client_Project_Type
4. **Sequential:** Name_001

#### 5.4.2 Custom Templates
- Save current pattern as template
- Name and icon selection
- Category assignment
- Share templates (future)

---

## 6. User Interface Specifications

### 6.1 Layout Structure
```
┌─────────────────────────────────────────────────┐
│                  Header Bar                      │
├───────────────┬─────────────────────────────────┤
│               │                                 │
│   Sidebar     │        Main Content Area        │
│               │                                 │
│  - File       │    ┌─────────────────────┐     │
│    Naming     │    │   Step Indicator    │     │
│  - Template   │    └─────────────────────┘     │
│  - Components │                                 │
│               │    ┌─────────────────────┐     │
│               │    │   Content Cards     │     │
│               │    └─────────────────────┘     │
│               │                                 │
└───────────────┴─────────────────────────────────┘
│                 Action Bar                      │
└─────────────────────────────────────────────────┘
```

### 6.2 Visual Design Guidelines

#### 6.2.1 Color Palette
- **Primary:** #28a745 (Green)
- **Secondary:** #6c757d (Gray)
- **Background:** #ffffff, #f8f9fa
- **Borders:** #e1e4e8
- **Text:** #24292e (primary), #586069 (secondary)

#### 6.2.2 Typography
- **Font Family:** -apple-system, BlinkMacSystemFont, 'Segoe UI'
- **Headers:** 24px (h1), 18px (h2), 16px (h3)
- **Body:** 14px
- **Small Text:** 12px

#### 6.2.3 Spacing
- **Base Unit:** 8px
- **Component Padding:** 16px
- **Card Padding:** 24px
- **Section Margins:** 32px

### 6.3 Component Specifications

#### 6.3.1 Buttons
- **Primary:** Green background, white text
- **Secondary:** Gray border, dark text
- **Hover States:** Darken 10%
- **Disabled:** 50% opacity
- **Min Width:** 80px
- **Padding:** 8px 16px

#### 6.3.2 Cards
- **Background:** White
- **Border Radius:** 6px
- **Shadow:** 0 1px 2px rgba(0,0,0,0.04)
- **Padding:** 24px

#### 6.3.3 Form Elements
- **Input Height:** 36px
- **Border:** 1px solid #e1e4e8
- **Focus:** Green border + glow
- **Border Radius:** 6px

---

## 7. Technical Specifications

### 7.1 Platform Requirements
- **Web Browser:** Chrome 90+, Safari 14+, Firefox 88+, Edge 90+
- **Screen Resolution:** Minimum 1280x720
- **JavaScript:** ES6+ support required
- **Local Storage:** For template saving

### 7.2 Performance Requirements
- **Initial Load:** < 2 seconds
- **Pattern Update:** < 100ms response
- **File Processing:** < 1s per 100 files
- **Preview Generation:** < 500ms

### 7.3 Accessibility Requirements
- **WCAG 2.1 AA Compliance**
- **Keyboard Navigation:** All features accessible
- **Screen Reader:** Proper ARIA labels
- **Focus Indicators:** Visible focus states
- **Color Contrast:** 4.5:1 minimum

### 7.4 Browser APIs Used
- **File API:** For file selection
- **Drag and Drop API:** For file and component dragging
- **Local Storage:** For saving templates
- **Clipboard API:** For copying patterns (future)

---

## 8. User Flow Diagrams

### 8.1 Primary Flow: Rename Files
```
Start → Select Files → Choose/Create Pattern → Preview Results → Apply Rename → Success
         ↓                    ↓                      ↓
    (File Picker)    (Template or Custom)    (Validation Check)
                              ↓                      ↓
                        (Configure Components)  (Fix Errors)
```

### 8.2 Template Flow
```
Browse Templates → Select Template → Customize (Optional) → Apply to Files
                        ↓
                  (Preview Pattern)
```

---

## 9. Error Handling

### 9.1 Error Types & Messages

| Error Type | User Message | Recovery Action |
|------------|--------------|-----------------|
| No Files Selected | "Please select files to rename" | Return to Step 1 |
| No Pattern | "Please create a naming pattern" | Highlight pattern builder |
| Duplicate Names | "X files will have duplicate names" | Show conflicts, suggest fix |
| Invalid Characters | "Pattern contains invalid characters: X" | Highlight invalid parts |
| Too Long | "Filename exceeds 255 characters" | Truncate option |

### 9.2 Prevention Strategies
- Disable actions until requirements met
- Real-time validation
- Clear empty states
- Contextual help tooltips
- Undo functionality

---

## 10. Future Enhancements

### 10.1 Phase 2 Features
1. **Cloud Integration:** Sync templates across devices
2. **Advanced Patterns:** Regular expressions, conditionals
3. **Folder Support:** Rename folders and contents
4. **Metadata Extraction:** Read EXIF, ID3, document properties
5. **Batch Operations:** Apply different patterns to file groups

### 10.2 Phase 3 Features
1. **AI Suggestions:** Smart pattern recommendations
2. **Version Control:** Track rename history
3. **Team Templates:** Share within organizations
4. **API Access:** Integrate with other tools
5. **Scheduled Renames:** Automatic organization

---

## 11. Implementation Notes for Claude

### 11.1 Code Structure
```
/src
  /components
    - FileUpload.js
    - PatternBuilder.js
    - ComponentLibrary.js
    - Preview.js
    - Templates.js
  /utils
    - fileHelpers.js
    - patternGenerator.js
    - validation.js
  /styles
    - main.css
    - components.css
```

### 11.2 State Management
- **Global State:** Current step, selected files, pattern array
- **Component State:** UI interactions, temp values
- **Persistence:** Templates in localStorage

### 11.3 Key Implementation Points
1. Use native drag-and-drop APIs
2. Implement debouncing for preview updates
3. Validate on every pattern change
4. Maintain undo history (last 10 actions)
5. Handle edge cases gracefully

### 11.4 Testing Scenarios
1. Empty states (no files, no pattern)
2. Maximum limits (1000 files)
3. Special characters in filenames
4. Very long filenames
5. Rapid pattern changes
6. Browser compatibility

---

## 12. Success Metrics & Analytics

### 12.1 Track Events
- Feature usage frequency
- Average files per batch
- Most used components
- Template adoption rate
- Error frequency
- Time to complete task

### 12.2 User Feedback
- In-app satisfaction survey
- Feature request tracking
- Bug report system
- Usage analytics dashboard

---

## 13. Launch Strategy

### 13.1 Rollout Plan
1. **Internal Testing:** 2 weeks
2. **Beta Users:** 10% rollout, 2 weeks
3. **Full Launch:** 100% availability
4. **Marketing:** Blog post, email campaign

### 13.2 Documentation
- User guide with screenshots
- Video tutorial (2-3 minutes)
- FAQ section
- Template gallery

---

## Appendix: Component Configuration Details

### A.1 Date Component
```javascript
{
  type: 'date',
  formats: [
    'YYYY-MM-DD',
    'DD-MM-YYYY', 
    'MM-DD-YYYY',
    'YYYYMMDD',
    'YYYY_MM_DD'
  ],
  source: 'current' | 'file_created' | 'file_modified'
}
```

### A.2 Counter Component
```javascript
{
  type: 'counter',
  start: 1,
  increment: 1,
  digits: 3, // Pad with zeros
  reset: 'never' | 'daily' | 'per_folder'
}
```

### A.3 Text Component
```javascript
{
  type: 'text',
  value: 'CustomText',
  case: 'original' | 'lower' | 'UPPER' | 'Title'
}
```

---

*This PRD serves as the complete specification for implementing the File Naming Builder feature. All user-facing decisions should align with these requirements while maintaining flexibility for technical implementation details.*