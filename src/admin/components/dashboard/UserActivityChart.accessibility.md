# UserActivityChart Accessibility Documentation

## Overview

The `UserActivityChart` component has been enhanced to meet WCAG 2.1 AA accessibility standards and provide an inclusive experience for all users, including those using assistive technologies.

## Accessibility Features Implemented

### 1. ARIA Labels and Roles

- **Chart Container**: Uses `role="img"` to identify the chart as an image/graphic
- **Accessible Labeling**: Uses `aria-labelledby` and `aria-describedby` for comprehensive descriptions
- **Tooltip**: Includes `role="tooltip"` and `aria-live="polite"` for dynamic content announcements
- **Screen Reader Content**: Hidden descriptive text using `.sr-only` class

### 2. Keyboard Navigation

- **Focusable**: Chart container is keyboard accessible with `tabIndex={0}`
- **Focus Indicators**: Clear visual focus indicators using Tailwind's focus utilities
- **Focus Management**: Proper focus outline with `focus:ring-2 focus:ring-blue-500`

### 3. Semantic HTML Structure

- **Headings**: Proper heading hierarchy with `<h3>` for chart titles
- **Descriptive Text**: Meaningful descriptions and summaries
- **Logical Structure**: Well-organized DOM structure for screen readers

### 4. Color and Contrast

- **Accessible Colors**: Updated color palette for better contrast ratios:
  - Blue: `#3b82f6` (Tailwind blue-500)
  - Green: `#10b981` (Tailwind emerald-500)
  - Amber: `#f59e0b` (Tailwind amber-500)
  - Red: `#ef4444` (Tailwind red-500)
- **Multiple Indicators**: Uses shapes, patterns, and positioning beyond color
- **Dark Mode Support**: Proper contrast in both light and dark themes

### 5. Screen Reader Support

- **Data Summary**: Automatically generated summary of chart data
- **Contextual Information**: Provides context about time ranges and data points
- **Alternative Text**: Meaningful alternative descriptions for chart content
- **Live Regions**: Tooltip updates announced to screen readers

### 6. Responsive Design

- **Flexible Layout**: Maintains accessibility across different screen sizes
- **Touch Targets**: Adequate touch target sizes for mobile users
- **Scalable Text**: Text remains readable when zoomed to 200%

## Usage Examples

### Basic Accessible Chart

```tsx
<UserActivityChart
  data={activityData}
  timeRange="7d"
  title="Weekly User Activity"
  description="Chart showing active users, new users, and session data over the past week"
/>
```

### Chart with Custom Accessibility

```tsx
<UserActivityChart
  data={activityData}
  timeRange="30d"
  type="line"
  title="Monthly User Trends"
  description="Line chart displaying user engagement trends over the past 30 days"
  className="focus:ring-purple-500" // Custom focus color
/>