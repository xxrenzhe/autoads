# PlanManager Accessibility Audit

## Overview

The `PlanManager` component has several accessibility issues that need to be addressed to meet WCAG 2.1 AA standards and provide an inclusive experience for all users.

## Accessibility Issues Found

### 1. Missing ARIA Labels and Roles

**Issues:**
- Plan cards lack proper ARIA roles and labels
- Checkboxes in admin mode lack descriptive labels
- Action buttons have no accessible names (only icons)
- Loading skeleton lacks screen reader context
- Bulk actions section lacks proper labeling

**Impact:** Screen readers cannot properly identify interactive elements or their purpose.

### 2. Keyboard Navigation Problems

**Issues:**
- Plan cards are clickable but lack proper keyboard support
- No focus management for dynamic content
- Missing skip links for bulk actions
- No keyboard shortcuts for common actions
- Tab order may not be logical

**Impact:** Keyboard-only users cannot navigate or interact with the interface effectively.

### 3. Heading Hierarchy Issues

**Issues:**
- Uses h2, h3, h4 without proper nesting
- Plan comparison table lacks proper heading structure
- Empty state heading should be properly nested

**Impact:** Screen readers rely on heading hierarchy for navigation.

### 4. Form and Input Accessibility

**Issues:**
- Checkboxes lack proper labels and descriptions
- No fieldset/legend for bulk selection
- Price input fields (if any) lack proper labeling

**Impact:** Form controls are not properly identified by assistive technology.

### 5. Dynamic Content Announcements

**Issues:**
- Plan selection feedback not announced consistently
- Loading states not properly communicated
- Error states lack proper ARIA attributes
- Bulk action feedback not announced

**Impact:** Screen readers don't announce important state changes.

### 6. Color and Visual Indicators

**Issues:**
- Popular plan indicator relies only on visual ring
- Status indicators may not have sufficient contrast
- Plan selection state relies only on visual ring
- No high contrast mode considerations

**Impact:** Users with visual impairments may not perceive important information.

### 7. Table Accessibility

**Issues:**
- Plan comparison table lacks proper headers association
- No table caption or summary
- Column headers not properly associated with data cells

**Impact:** Screen readers cannot properly navigate table content.

## Recommended Improvements

### 1. Add Proper ARIA Labels and Roles

```tsx
// Plan cards with proper ARIA
<Card 
  key={plan.id}
  className={`relative transition-all hover:shadow-lg ${
    plan.popular ? 'ring-2 ring-blue-500 scale-105' : ''
  } ${selectedPlans.has(plan.id) ? 'ring-2 ring-green-500' : ''}`}
  role="button"
  tabIndex={0}
  aria-label={`${plan.name} plan. ${formatPrice(plan.price, plan.currency, plan.interval)}. ${plan.description}`}
  aria-pressed={adminMode ? selectedPlans.has(plan.id) : undefined}
  onKeyDown={(e) => handlePlanCardKeyDown(e, plan)}
  onClick={() => adminMode ? handlePlanSelect(plan.id) : onPlanSelect?.(plan)}
>

// Checkboxes with proper labeling
<input
  type="checkbox"
  checked={selectedPlans.has(plan.id)}
  onChange={() => handlePlanSelect(plan.id)}
  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
  aria-label={`Select ${plan.name} plan for bulk actions`}
  aria-describedby={`plan-${plan.id}-description`}
/>

// Action buttons with accessible names
<Button
  variant="outline"
  size="sm"
  onClick={() => handleEditPlan(plan)}
  className="flex-1"
  aria-label={`Edit ${plan.name} plan`}
>
  <Edit className="h-4 w-4 mr-1" aria-hidden="true" />
  Edit
</Button>
```

### 2. Improve Keyboard Navigation

```tsx
// Add keyboard event handlers
const handlePlanCardKeyDown = (event: React.KeyboardEvent, plan: SubscriptionPlan) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (adminMode) {
      handlePlanSelect(plan.id)
    } else {
      onPlanSelect?.(plan)
    }
  }
}

// Add focus management
const planCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

// Focus management for dynamic content
useEffect(() => {
  if (plans.length > 0 && !isLoading) {
    // Focus first plan card when plans load
    const firstPlan = plans[0]
    const firstPlanRef = planCardRefs.current.get(firstPlan.id)
    if (firstPlanRef) {
      firstPlanRef.focus()
    }
  }
}, [plans, isLoading])
```

### 3. Fix Heading Hierarchy

```tsx
// Proper heading structure
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
      {adminMode ? 'Plan Management' : 'Choose Your Plan'}
    </h1>
    <p className="text-gray-600 dark:text-gray-400">
      {adminMode 
        ? 'Create and manage subscription plans'
        : 'Select the perfect plan for your needs'
      }
    </p>
  </div>
</div>

// Plan comparison section
<Card>
  <CardHeader>
    <CardTitle as="h2">Plan Comparison</CardTitle>
  </CardHeader>
</Card>

// Empty state
<h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
  No plans available
</h2>
```

### 4. Add Live Regions for Dynamic Content

```tsx
// Add live region for announcements
<div 
  aria-live="polite" 
  aria-atomic="true" 
  className="sr-only"
  id="plan-manager-announcements"
>
  {announcement}
</div>

// Loading state announcement
{isLoading && (
  <div role="status" aria-label="Loading subscription plans">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
    <span className="sr-only">Loading subscription plans...</span>
  </div>
)}
```

### 5. Improve Table Accessibility

```tsx
// Plan comparison table with proper accessibility
<table className="w-full text-sm" role="table">
  <caption className="sr-only">
    Comparison of subscription plan features and pricing
  </caption>
  <thead>
    <tr className="border-b">
      <th 
        className="text-left py-2"
        scope="col"
        id="feature-header"
      >
        Feature
      </th>
      {plans.filter(p => p.active).map(plan => (
        <th 
          key={plan.id} 
          className="text-center py-2 min-w-[120px]"
          scope="col"
          id={`plan-${plan.id}-header`}
        >
          {plan.name}
        </th>
      ))}
    </tr>
  </thead>
  <tbody>
    <tr className="border-b">
      <th 
        className="py-2 font-medium text-left"
        scope="row"
        headers="feature-header"
      >
        Price
      </th>
      {plans.filter(p => p.active).map(plan => (
        <td 
          key={plan.id} 
          className="text-center py-2"
          headers={`feature-header plan-${plan.id}-header`}
        >
          {formatPrice(plan.price, plan.currency, plan.interval)}
        </td>
      ))}
    </tr>
  </tbody>
</table>
```

### 6. Add Loading and Error State Accessibility

```tsx
// Error state with proper ARIA
{error && (
  <Card>
    <CardContent className="p-6">
      <div 
        className="text-center text-red-600"
        role="alert"
        aria-live="assertive"
      >
        <p>Error loading subscription plans: {error}</p>
      </div>
    </CardContent>
  </Card>
)}

// Loading skeleton with screen reader context
{isLoading && (
  <div role="status" aria-label="Loading subscription plans">
    {Array.from({ length: 3 }).map((_, index) => (
      <Card key={index} className="animate-pulse" aria-hidden="true">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-6 bg-gray-300 rounded w-3/4"></div>
            <div className="h-8 bg-gray-300 rounded w-1/2"></div>
            <div className="h-4 bg-gray-300 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    ))}
    <span className="sr-only">Loading subscription plans...</span>
  </div>
)}
```

### 7. Improve Color and Contrast

```tsx
// Popular plan indicator with multiple cues
{plan.popular && (
  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
    <Badge 
      className="bg-blue-600 text-white px-3 py-1"
      aria-label="Most popular plan"
    >
      <Star className="h-3 w-3 mr-1" aria-hidden="true" />
      Most Popular
    </Badge>
  </div>
)}

// Plan selection with multiple indicators
<Card 
  className={`relative transition-all hover:shadow-lg ${
    plan.popular ? 'ring-2 ring-blue-500 scale-105' : ''
  } ${selectedPlans.has(plan.id) ? 'ring-2 ring-green-500 bg-green-50' : ''}`}
  aria-selected={selectedPlans.has(plan.id)}
>
```

## Testing Recommendations

### 1. Automated Testing

```tsx
// Add to existing test file or create new one
describe('PlanManager Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<PlanManager />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<PlanManager adminMode={true} />)
    
    // Test tab navigation
    await user.tab()
    expect(screen.getByRole('button', { name: /create plan/i })).toHaveFocus()
    
    // Test plan card keyboard interaction
    const planCard = screen.getByRole('button', { name: /basic plan/i })
    await user.click(planCard)
    expect(planCard).toHaveAttribute('aria-pressed', 'true')
  })

  it('should announce dynamic content changes', async () => {
    const user = userEvent.setup()
    render(<PlanManager adminMode={true} />)
    
    const planCard = screen.getByRole('button', { name: /basic plan/i })
    await user.click(planCard)
    
    expect(screen.getByLabelText(/announcements/i)).toHaveTextContent(/selected/)
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
2. **Medium Priority**: Live regions, table accessibility, loading states
3. **Low Priority**: Advanced keyboard shortcuts, enhanced announcements

## Additional Considerations

- Consider adding keyboard shortcuts (e.g., Ctrl+N for new plan)
- Implement focus trapping for modal dialogs
- Add support for reduced motion preferences
- Consider implementing virtual scrolling for large plan lists
- Add support for screen reader table navigation
- Consider adding plan comparison mode toggle for better accessibility