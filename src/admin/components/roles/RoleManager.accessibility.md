# RoleManager Accessibility Audit

## Overview

The `RoleManager` component has several accessibility issues that need to be addressed to meet WCAG 2.1 AA standards and provide an inclusive experience for all users.

## Accessibility Issues Found

### 1. Missing ARIA Labels and Roles

**Issues:**
- Search input lacks proper labeling
- Action buttons have no accessible names (only icons)
- Role cards lack proper ARIA roles and labels
- Bulk actions section lacks proper labeling
- Loading skeleton lacks screen reader context

**Impact:** Screen readers cannot properly identify interactive elements or their purpose.

### 2. Keyboard Navigation Problems

**Issues:**
- Role cards are clickable divs without keyboard support
- No focus management for dynamic content
- Missing skip links for bulk actions
- No keyboard shortcuts for common actions

**Impact:** Keyboard-only users cannot navigate or interact with the interface effectively.

### 3. Heading Hierarchy Issues

**Issues:**
- Uses h1, h3 without h2 (skips heading levels)
- Empty state heading is h3 but should be h2
- No proper heading structure for role cards

**Impact:** Screen readers rely on heading hierarchy for navigation.

### 4. Form and Input Accessibility

**Issues:**
- Checkboxes lack proper labels and descriptions
- Search input missing label association
- No fieldset/legend for bulk selection

**Impact:** Form controls are not properly identified by assistive technology.

### 5. Dynamic Content Announcements

**Issues:**
- No live regions for search results updates
- Bulk action feedback not announced
- Loading states not properly communicated
- Error states lack proper ARIA attributes

**Impact:** Screen readers don't announce important state changes.

### 6. Color and Visual Indicators

**Issues:**
- Selection state relies only on visual ring
- System role badge may not have sufficient contrast
- No high contrast mode considerations

**Impact:** Users with visual impairments may not perceive important information.

## Recommended Improvements

### 1. Add Proper ARIA Labels and Roles

```tsx
// Search input
<Input
  placeholder="Search roles..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  className="pl-10"
  aria-label="Search roles by name or description"
  aria-describedby="search-results-count"
/>

// Action buttons
<Button
  variant="ghost"
  size="sm"
  onClick={(e) => {
    e.stopPropagation()
    handleEditRole(role)
  }}
  aria-label={`Edit ${role.name} role`}
>
  <Edit className="h-4 w-4" />
</Button>

// Role cards
<Card 
  key={role.id} 
  className={`cursor-pointer transition-all hover:shadow-md ${
    selectedRoles.has(role.id) ? 'ring-2 ring-blue-500' : ''
  }`}
  onClick={() => onRoleSelect?.(role)}
  role="button"
  tabIndex={0}
  aria-label={`Select ${role.name} role. ${role.description}`}
  aria-pressed={selectedRoles.has(role.id)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRoleSelect?.(role)
    }
  }}
>
```

### 2. Improve Keyboard Navigation

```tsx
// Add keyboard event handlers to role cards
const handleRoleCardKeyDown = (e: React.KeyboardEvent, role: Role) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    onRoleSelect?.(role)
  }
}

// Add focus management
const roleCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

// Focus management for dynamic content
useEffect(() => {
  if (filteredRoles.length > 0 && searchTerm) {
    // Announce search results
    const announcement = `${filteredRoles.length} role${filteredRoles.length !== 1 ? 's' : ''} found`
    // Use live region for announcement
  }
}, [filteredRoles.length, searchTerm])
```

### 3. Fix Heading Hierarchy

```tsx
// Proper heading structure
<div>
  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
    Role Management
  </h1>
  <p className="text-gray-600 dark:text-gray-400">
    Manage user roles and permissions
  </p>
</div>

// Empty state
<h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
  No roles found
</h2>

// Role cards should use h3 for role names
<h3 className="text-lg font-semibold">{role.name}</h3>
```

### 4. Add Live Regions for Dynamic Content

```tsx
// Add live region for announcements
<div 
  aria-live="polite" 
  aria-atomic="true" 
  className="sr-only"
  id="role-manager-announcements"
>
  {/* Dynamic announcements */}
</div>

// Search results count
<div 
  id="search-results-count"
  aria-live="polite"
  className="text-sm text-gray-600"
>
  {filteredRoles.length} role{filteredRoles.length !== 1 ? 's' : ''}
</div>
```

### 5. Improve Form Accessibility

```tsx
// Checkbox with proper labeling
<input
  type="checkbox"
  checked={selectedRoles.has(role.id)}
  onChange={(e) => {
    e.stopPropagation()
    handleRoleSelect(role.id)
  }}
  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
  aria-label={`Select ${role.name} role`}
  aria-describedby={`role-${role.id}-description`}
/>

// Role description for screen readers
<div id={`role-${role.id}-description`} className="sr-only">
  {role.description}. {role.permissions.length} permissions. {role.userCount} users assigned.
</div>
```

### 6. Add Loading and Error State Accessibility

```tsx
// Loading state
{isLoading && (
  <div role="status" aria-label="Loading roles">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
    <span className="sr-only">Loading roles...</span>
  </div>
)}

// Error state
{error && (
  <div role="alert" className="text-center text-red-600">
    <AlertTriangle className="h-8 w-8 mx-auto mb-2" aria-hidden="true" />
    <p>Error loading roles: {error}</p>
    <Button onClick={refreshRoles} className="mt-2">
      Retry
    </Button>
  </div>
)}
```

## Testing Recommendations

### 1. Automated Testing

```tsx
// Add to existing test file or create new one
describe('RoleManager Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<RoleManager />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<RoleManager />)
    
    // Test tab navigation
    await user.tab()
    expect(screen.getByLabelText(/search roles/i)).toHaveFocus()
    
    // Test role card keyboard interaction
    const roleCard = screen.getByRole('button', { name: /admin role/i })
    await user.click(roleCard)
    expect(roleCard).toHaveAttribute('aria-pressed', 'true')
  })

  it('should announce dynamic content changes', async () => {
    const user = userEvent.setup()
    render(<RoleManager />)
    
    const searchInput = screen.getByLabelText(/search roles/i)
    await user.type(searchInput, 'admin')
    
    expect(screen.getByLabelText(/search results/i)).toBeInTheDocument()
  })
})
```

### 2. Manual Testing Checklist

- [ ] Navigate entire interface using only keyboard
- [ ] Test with screen reader (NVDA, JAWS, VoiceOver)
- [ ] Verify all interactive elements have accessible names
- [ ] Check color contrast ratios meet WCAG AA standards
- [ ] Test with browser zoom at 200%
- [ ] Verify focus indicators are visible
- [ ] Test with high contrast mode enabled

## Implementation Priority

1. **High Priority**: ARIA labels, keyboard navigation, heading hierarchy
2. **Medium Priority**: Live regions, form accessibility, loading states
3. **Low Priority**: Advanced keyboard shortcuts, enhanced announcements

## Additional Considerations

- Consider adding keyboard shortcuts (e.g., Ctrl+N for new role)
- Implement focus trapping for modal dialogs
- Add support for reduced motion preferences
- Consider implementing virtual scrolling for large role lists
- Add support for screen reader table navigation if converting to table layout