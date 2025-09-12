# ConfigList Accessibility Audit

## Overview

The `ConfigList` component has several accessibility issues that need to be addressed to meet WCAG 2.1 AA standards and provide an inclusive experience for all users.

## Accessibility Issues Found

### 1. Missing ARIA Labels and Roles

**Issues:**
- Search input lacks proper labeling
- Action buttons have no accessible names (only icons)
- Configuration table lacks proper ARIA roles and labels
- Bulk actions section lacks proper labeling
- Loading skeleton lacks screen reader context
- Select dropdowns lack proper labels

**Impact:** Screen readers cannot properly identify interactive elements or their purpose.

### 2. Keyboard Navigation Problems

**Issues:**
- Table rows are clickable divs without keyboard support
- No focus management for dynamic content
- Missing skip links for bulk actions
- No keyboard shortcuts for common actions
- Select dropdowns may not be properly focusable

**Impact:** Keyboard-only users cannot navigate or interact with the interface effectively.

### 3. Heading Hierarchy Issues

**Issues:**
- Uses h1 without proper document structure context
- No proper heading structure for table sections
- Missing section headings for filters and bulk actions

**Impact:** Screen readers rely on heading hierarchy for navigation.

### 4. Form and Input Accessibility

**Issues:**
- Checkboxes lack proper labels and descriptions
- Search input missing label association
- Select dropdowns lack proper labeling
- No fieldset/legend for filter controls
- "Show Secrets" checkbox needs better labeling

**Impact:** Form controls are not properly identified by assistive technology.

### 5. Dynamic Content Announcements

**Issues:**
- No live regions for search results updates
- Bulk action feedback not announced
- Loading states not properly communicated
- Error states lack proper ARIA attributes
- Configuration count changes not announced

**Impact:** Screen readers don't announce important state changes.