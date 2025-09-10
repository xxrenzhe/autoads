# Input Component Accessibility Guide

## Overview

The Input component is designed with accessibility as a first-class concern, following WCAG 2.1 AA guidelines and React accessibility best practices.

## Accessibility Features

### 1. Keyboard Navigation
- **Tab Navigation**: Input is focusable via Tab key
- **Focus Management**: Proper focus indicators with enhanced visibility
- **Focus Trapping**: Works correctly within form contexts and modal dialogs

### 2. Screen Reader Support
- **Semantic HTML**: Uses native `<input>` element for maximum compatibility
- **ARIA Labels**: Supports `aria-label` and `aria-labelledby` for custom labeling
- **ARIA Descriptions**: Automatic `aria-describedby` management for error and helper text
- **ARIA Invalid**: Automatic `aria-invalid` state management for error conditions
- **Live Regions**: Error messages use `role="alert"` and `aria-live="polite"`

### 3. Visual Accessibility
- **High Contrast**: Enhanced border styles for high contrast mode
- **Focus Indicators**: Clear, visible focus rings that meet contrast requirements
- **Error States**: Distinct visual styling for error conditions
- **Size Variants**: Multiple sizes for different use cases and visual hierarchies

### 4. Form Integration
- **Label Association**: Works with `<label>` elements via `htmlFor`/`id` association
- **Form Validation**: Supports HTML5 validation attributes
- **Error Handling**: Integrated error message display with proper ARIA announcements

## Usage Examples

### Basic Usage with Label
```tsx
<div>
  <label htmlFor="email-input">Email Address</label>
  <Input
    id="email-input"
    type="email"
    placeholder="Enter your email"
    required
  />
</div>
```

### With Error State
```tsx
<Input
  id="password-input"
  type="password"
  variant="error"
  error="Password must be at least 8 characters"
  aria-label="Password"
/>
```

### With Helper Text
```tsx
<Input
  id="username-input"
  type="text"
  helperText="Username must be 3-20 characters, letters and numbers only"
  aria-label="Username"
/>
```

### With ARIA Descriptions
```tsx
<div>
  <label htmlFor="phone-input">Phone Number</label>
  <Input
    id="phone-input"
    type="tel"
    aria-describedby="phone-format"
  />
  <div id="phone-format">Format: (555) 123-4567</div>
</div>
```

## Accessibility Testing Checklist

### Automated Testing
- [ ] Component passes axe-core accessibility tests
- [ ] No accessibility violations in jest-axe tests
- [ ] Proper ARIA attributes are applied
- [ ] Focus management works correctly

### Manual Testing
- [ ] Can navigate to input using Tab key
- [ ] Focus indicator is clearly visible
- [ ] Screen reader announces label and description
- [ ] Error messages are announced when they appear
- [ ] Works with keyboard-only navigation
- [ ] High contrast mode displays properly

### Screen Reader Testing
Test with multiple screen readers:
- [ ] NVDA (Windows)
- [ ] JAWS (Windows)
- [ ] VoiceOver (macOS/iOS)
- [ ] TalkBack (Android)

## Common Accessibility Patterns

### Required Fields
```tsx
<div>
  <label htmlFor="required-field">
    Name <span aria-label="required">*</span>
  </label>
  <Input
    id="required-field"
    required
    aria-required="true"
  />
</div>
```

### Search Input
```tsx
<div role="search">
  <label htmlFor="search-input" className="sr-only">
    Search
  </label>
  <Input
    id="search-input"
    type="search"
    placeholder="Search..."
    aria-label="Search products"
  />
</div>
```

### Form Validation
```tsx
const [errors, setErrors] = useState<Record<string, string>>({});

<Input
  id="email-field"
  type="email"
  variant={errors.email ? "error" : "default"}
  error={errors.email}
  aria-invalid={!!errors.email}
/>
```

## Best Practices

### Do's
- ✅ Always provide accessible labels (visible or via `aria-label`)
- ✅ Use semantic input types (`email`, `tel`, `url`, etc.)
- ✅ Provide clear error messages
- ✅ Use helper text for complex formatting requirements
- ✅ Test with keyboard navigation
- ✅ Test with screen readers

### Don'ts
- ❌ Don't use placeholder text as the only label
- ❌ Don't rely solely on color to indicate errors
- ❌ Don't remove focus indicators
- ❌ Don't use generic error messages
- ❌ Don't forget to test with assistive technologies

## WCAG 2.1 Compliance

This component meets the following WCAG 2.1 criteria:

### Level A
- **1.3.1 Info and Relationships**: Proper semantic markup and ARIA labels
- **2.1.1 Keyboard**: Fully keyboard accessible
- **2.4.3 Focus Order**: Logical focus order
- **4.1.2 Name, Role, Value**: Proper name, role, and value for assistive technologies

### Level AA
- **1.4.3 Contrast (Minimum)**: Focus indicators meet contrast requirements
- **2.4.7 Focus Visible**: Clear focus indicators
- **3.3.2 Labels or Instructions**: Clear labeling and instructions

## Testing Commands

```bash
# Run accessibility tests
npm test -- Input.test.tsx --silent

# Run with axe-core
npm test -- --testNamePattern="accessibility" --silent

# Run specific accessibility test
npm test -- --grep "should be focusable with keyboard" --silent
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Accessibility Documentation](https://reactjs.org/docs/accessibility.html)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)