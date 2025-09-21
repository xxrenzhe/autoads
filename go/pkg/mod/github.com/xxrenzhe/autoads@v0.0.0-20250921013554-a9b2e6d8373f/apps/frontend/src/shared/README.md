# Shared Components and Utilities

## Overview

The shared directory contains reusable components, utilities, and services that are used across multiple business modules. This follows the DRY (Don't Repeat Yourself) principle and ensures consistency across the application.

## Directory Structure

```
shared/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (buttons, inputs, etc.)
│   ├── forms/          # Form-related components
│   ├── data-display/   # Tables, charts, data visualization
│   └── layout/         # Layout components (headers, sidebars, etc.)
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
│   ├── auth/           # Authentication utilities
│   ├── cache/          # Caching strategies
│   ├── validation/     # Validation schemas
│   └── utils.ts        # General utilities
├── types/              # Shared TypeScript types
├── config/             # Configuration management
├── services/           # Shared services
├── constants/          # Application constants
├── utils/              # Utility functions
└── testing/            # Testing utilities and setup
```

## Components

### UI Components (`components/ui/`)
Base atomic components following the atomic design methodology:

- **Button**: Configurable button component with variants
- **Input**: Form input components with validation
- **Modal**: Modal dialog component
- **Table**: Data table with sorting and filtering
- **Card**: Content card component
- **Badge**: Status and label badges
- **Spinner**: Loading indicators

### Form Components (`components/forms/`)
Form-related components for consistent form handling:

- **FormField**: Wrapper for form inputs with labels and validation
- **FormBuilder**: Dynamic form generation
- **ValidationMessage**: Error and validation message display

### Data Display (`components/data-display/`)
Components for data visualization and display:

- **DataTable**: Advanced table with pagination, sorting, filtering
- **Chart**: Chart components for analytics
- **ProgressBar**: Progress indicators
- **StatusIndicator**: Status display components

### Layout Components (`components/layout/`)
Layout and navigation components:

- **Header**: Application header
- **Sidebar**: Navigation sidebar
- **Footer**: Application footer
- **PageLayout**: Standard page layout wrapper

## Hooks

Custom React hooks for common functionality:

- **useApi**: Standardized API calls with error handling
- **useLocalStorage**: Local storage management
- **useDebounce**: Debounced values for search and input
- **usePermissions**: Role-based access control
- **useTenant**: Multi-tenant context management
- **useRealtime**: WebSocket connections and real-time updates

## Utilities

### Authentication (`lib/auth/`)
Authentication and authorization utilities:

- JWT token management
- Permission checking
- Role-based access control
- Session management

### Caching (`lib/cache/`)
Caching strategies and utilities:

- Multi-level cache management
- Cache invalidation strategies
- Performance optimization

### Validation (`lib/validation/`)
Data validation using Zod schemas:

- Common validation schemas
- Form validation utilities
- API request/response validation

## Types

Shared TypeScript interfaces and types:

```typescript
// Common types used across modules
export interface User {
  id: string;
  email: string;
  name: string;
  roles: Role[];
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

## Services

Shared services for common functionality:

- **ApiService**: HTTP client with interceptors
- **NotificationService**: Toast notifications and alerts
- **StorageService**: Local and session storage management
- **EventService**: Event bus for component communication

## Configuration

Configuration management utilities:

- Environment variable handling
- Feature flags
- Application settings
- Multi-environment support

## Testing

Testing utilities and setup:

- Jest configuration
- Testing utilities
- Mock factories
- Test data generators

## Usage Examples

```typescript
// Using shared components
import { Button, Modal, DataTable } from '@/shared/components/ui';
import { FormField } from '@/shared/components/forms';

// Using shared hooks
import { useApi, usePermissions } from '@/shared/hooks';

// Using shared utilities
import { validateEmail, formatDate } from '@/shared/lib/utils';
import { apiClient } from '@/shared/services/api';

// Using shared types
import type { User, ApiResponse } from '@/shared/types';
```

## Best Practices

1. **Component Design**: Follow atomic design principles
2. **Type Safety**: Use TypeScript for all shared code
3. **Documentation**: Document all public APIs
4. **Testing**: Write tests for all shared utilities
5. **Performance**: Optimize for reusability and performance
6. **Accessibility**: Ensure all components are accessible
7. **Consistency**: Maintain consistent naming and patterns