# Design Document

## Overview

This design addresses the systematic resolution of 657 TypeScript errors across 111 files in the codebase. The errors fall into several categories that require different approaches: database schema mismatches, missing properties, incorrect type assertions, null/undefined handling, and API compatibility issues.

## Architecture

### Error Classification System

The TypeScript errors can be categorized into the following groups:

1. **Database Schema Errors (40% of errors)**
   - Missing required fields in Prisma operations
   - Incorrect property names in database queries
   - JSON field handling issues
   - Select/include option mismatches

2. **Type Safety Errors (25% of errors)**
   - Null/undefined type mismatches
   - Incorrect type assertions
   - Missing type guards
   - String vs union type conflicts

3. **API Compatibility Errors (20% of errors)**
   - Deprecated Node.js crypto methods
   - Missing function parameters
   - Incorrect method signatures
   - Third-party library compatibility

4. **Component/Service Errors (15% of errors)**
   - Missing interface properties
   - Incorrect prop types
   - Service method signature mismatches
   - Event handler type issues

## Components and Interfaces

### Database Schema Fixes

**Component:** Prisma Schema Validator
- **Purpose:** Ensure all database operations match the current Prisma schema
- **Key Methods:**
  - `validateCreateInput()` - Validates create operation fields
  - `validateSelectOptions()` - Validates select/include options
  - `handleJsonFields()` - Properly handles nullable JSON fields

**Interface Updates:**
```typescript
// Fix for AuditLog model
interface AuditLogCreateInput {
  userId: string
  action: string
  resource: string
  // Remove: description, sessionId (not in schema)
  details?: JsonValue | null
  metadata?: JsonValue | null
}

// Fix for TokenUsage model
interface TokenUsageCreateInput {
  userId: string
  feature: string // Required field
  action: string
  amount: number
  balance: number
}
```

### Type Safety Enhancements

**Component:** Type Guard Utilities
- **Purpose:** Provide safe type checking and conversion utilities
- **Key Methods:**
  - `isNotNull<T>(value: T | null): value is T`
  - `safeStringConversion(value: unknown): string | undefined`
  - `handleNullableJson(value: JsonValue | null): any`

**Interface Updates:**
```typescript
// Fix for user name handling
interface UserBehaviorPattern {
  userName?: string // Allow undefined, handle null conversion
}

// Fix for service status types
type ServiceStatus = 'healthy' | 'warning' | 'critical'
```

### API Compatibility Fixes

**Component:** Crypto Service Modernization
- **Purpose:** Update deprecated crypto methods to current Node.js standards
- **Key Changes:**
  - Replace `createCipherGCM` with `createCipher`
  - Replace `createDecipherGCM` with `createDecipher`
  - Update method signatures to match current API

**Component:** Service Method Standardization
- **Purpose:** Ensure all service methods have consistent signatures
- **Key Changes:**
  - Add missing parameters to config service methods
  - Standardize notification service interfaces
  - Fix Gmail service authentication flow

## Data Models

### Updated Database Models

```typescript
// Prisma schema corrections needed
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  userEmail String?
  action    String
  resource  String?
  details   Json?
  metadata  Json?
  // Remove: description, sessionId
}

model User {
  id       String @id @default(cuid())
  // Remove: phone field (not in current schema)
  tokenUsages TokenUsage[] // Correct relation name
}

model TokenUsage {
  id      String @id @default(cuid())
  userId  String
  feature String // Required field
  action  String
  amount  Int
  balance Int
}
```

### Type Definitions

```typescript
// Service interfaces
interface NotificationService {
  sendEmail(payload: EmailPayload): Promise<NotificationResult>
  sendSMS(payload: SMSPayload): Promise<NotificationResult>
  // Remove: generic send() method
}

interface ConfigService {
  set(key: string, userId: string, value: any): Promise<void>
  get(key: string, userId?: string): Promise<any>
}
```

## Error Handling

### Null Safety Strategy

1. **Null Coalescing**: Use `??` operator for default values
2. **Optional Chaining**: Use `?.` for safe property access
3. **Type Guards**: Implement proper null checks before operations
4. **Conversion Utilities**: Create safe conversion functions

```typescript
// Example implementations
const safeUserName = (user: { name: string | null }) => user.name ?? undefined
const safeJsonParse = (value: string | JsonValue) => 
  typeof value === 'string' ? JSON.parse(value) : value
```

### Database Error Prevention

1. **Schema Validation**: Validate all database inputs against current schema
2. **Required Field Checks**: Ensure all required fields are provided
3. **Relation Validation**: Verify relationship field names match schema
4. **JSON Field Handling**: Properly handle nullable JSON fields

## Testing Strategy

### Type Safety Validation

1. **Compilation Tests**: Ensure `npm run type-check` passes
2. **Runtime Type Tests**: Verify type guards work correctly
3. **Database Operation Tests**: Test all Prisma operations
4. **API Endpoint Tests**: Validate request/response types

### Error Prevention

1. **Schema Drift Detection**: Monitor for schema changes
2. **Type Coverage Metrics**: Track TypeScript strict mode compliance
3. **Automated Type Checking**: Include in CI/CD pipeline
4. **Regression Testing**: Prevent reintroduction of type errors

### Testing Phases

1. **Unit Tests**: Test individual type fixes
2. **Integration Tests**: Test service interactions
3. **End-to-End Tests**: Verify complete workflows
4. **Performance Tests**: Ensure fixes don't impact performance

## Implementation Approach

### Phase 1: Database Schema Alignment
- Fix all Prisma-related type errors
- Update database operation calls
- Correct model property names
- Handle JSON field types

### Phase 2: Service Layer Fixes
- Update service method signatures
- Fix null/undefined handling
- Correct type assertions
- Update crypto service methods

### Phase 3: API and Component Fixes
- Fix API route parameter types
- Update component prop interfaces
- Correct event handler types
- Fix middleware type issues

### Phase 4: Validation and Testing
- Run comprehensive type checking
- Validate all fixes work correctly
- Ensure no functionality regression
- Update documentation