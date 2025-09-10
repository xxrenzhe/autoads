# Implementation Plan

- [x] 1. Fix Prisma client imports and generation
  - Regenerate Prisma client to ensure all exports are available
  - Fix PrismaClient import errors in seed.ts and service files
  - Fix UserRole import error in admin API routes
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Fix implicit any type errors in admin analytics routes
  - [x] 2.1 Add explicit types to callback parameters in analytics route
    - Fix parameter 'u', 'user', 'd', 'acc', 'item', 'feature' implicit any types
    - Add proper type annotations for array method callbacks
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.2 Add explicit types to callback parameters in analytics tokens route
    - Fix parameter 'c', 'consumer', 'd', 'acc', 'metric' implicit any types
    - Add proper type annotations for array method callbacks
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Fix unknown type handling in analytics routes
  - [x] 3.1 Implement type guards for unknown data in analytics route
    - Add type guards for 'data' of type 'unknown' before property access
    - Implement proper type assertions for API response data
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.2 Implement type guards for unknown data in analytics tokens route
    - Add type guards for 'data' of type 'unknown' before property access
    - Implement proper type assertions for API response data
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Fix Zod error handling issues
  - [x] 4.1 Fix ZodError.errors access in admin config routes
    - Replace .errors with .issues for proper ZodError handling
    - Update error message extraction to use ZodError.issues
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.2 Fix ZodError.errors access in config export route
    - Replace .errors with .issues for proper ZodError handling
    - Update error message extraction to use ZodError.issues
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 5. Fix service method parameter type errors
  - [x] 5.1 Fix service monitoring service type issues
    - Fix ServiceStatus parameter type (should be enum, not string)
    - Add missing queueStats variable declaration
    - Fix NotificationRequest interface usage (remove invalid 'recipient' property)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.2 Fix token service array type issues
    - Fix amount property type in token usage array (ensure number, not undefined)
    - Add proper type annotations for array transformation callbacks
    - _Requirements: 5.1, 5.2, 6.1, 6.2_

- [x] 6. Fix remaining implicit any types in service files
  - [x] 6.1 Add explicit types to callback parameters in service files
    - Fix implicit any types in stripe-service.ts callback parameters
    - Fix implicit any types in token-config-service.ts callback parameters
    - Fix implicit any types in token-consumption-service.ts callback parameters
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 6.2 Add explicit types to callback parameters in remaining service files
    - Fix implicit any types in token-service.ts callback parameters
    - Fix implicit any types in user-service.ts callback parameters
    - Fix implicit any types in token-triggers.ts callback parameters
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 7. Fix API management route implicit any types
  - Add explicit types to callback parameters in endpoints route
  - Fix 'stat', 'e' parameter implicit any types
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 8. Fix config history analytics route implicit any types
  - Add explicit types to callback parameters for 'change', 'config', 'record' parameters
  - Implement proper type annotations for data processing callbacks
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 9. Fix remaining Prisma client import errors
  - [x] 9.1 Fix PrismaClient import in seed.ts
    - Regenerate Prisma client if needed
    - Fix PrismaClient import error in prisma/seed.ts
    - _Requirements: 1.1, 1.2_

  - [x] 9.2 Fix missing Prisma type imports in service files
    - Fix UserRole import errors in api-limit-service.ts, auth-service.ts, permission-service.ts
    - Fix UserStatus import error in auth-service.ts
    - Fix SystemConfig import error in config-service.ts
    - _Requirements: 1.1, 1.2_

- [ ] 10. Fix remaining unknown type handling issues
  - [x] 10.1 Fix unknown data access in analytics routes
    - Fix 'data' is of type 'unknown' errors in src/app/api/admin/analytics/route.ts (lines 204-207)
    - Fix 'data' is of type 'unknown' errors in src/app/api/admin/analytics/tokens/route.ts (lines 186-194)
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 11. Fix remaining implicit any type errors
  - [x] 11.1 Fix implicit any types in admin config routes
    - Fix 'config' parameter in src/app/api/admin/config/export/route.ts (line 58)
    - Fix 'existing' parameter in src/app/api/admin/config/import/route.ts (line 103)
    - Fix 'e' parameter in src/app/api/admin/config/import/route.ts (line 140)
    - Fix 'v' parameter in src/app/api/admin/config/sync/route.ts (line 161)
    - Fix 'config' parameter in src/app/api/admin/config/sync/route.ts (line 298)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 11.2 Fix implicit any types in integration routes
    - Fix 'alert' parameter in src/app/api/admin/integrations/monitoring/alerts/route.ts (line 31)
    - Fix 'log' parameters in src/app/api/admin/integrations/similarweb/stats/route.ts (lines 37, 41, 42)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 11.3 Fix implicit any types in service files
    - Fix callback parameters in api-health-service.ts (lines 214, 253)
    - Fix callback parameters in api-limit-service.ts (lines 96, 428, 430, 463)
    - Fix callback parameters in audit-service.ts (lines 327, 438, 442, 446, 450, 455, 459, 463, 562, 570, 574)
    - Fix callback parameters in auth-service.ts (lines 495, 500)
    - Fix 'log' parameter in config-service.ts (line 255)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 11.4 Fix implicit any types in remaining service files
    - Fix callback parameters in monitoring-service.ts (lines 345, 591)
    - Fix callback parameters in notification-service.ts (lines 706, 711, 716)
    - Fix 'user' parameter in notification-trigger-service.ts (line 324)
    - Fix callback parameters in plan-service.ts (lines 137, 160, 594, 596, 603)
    - Fix callback parameters in security-audit-service.ts (lines 257, 309, 313, 317, 321, 325, 516, 517, 518)
    - Fix 'tx' parameters in token-config-service.ts (lines 205, 275, 404)
    - Fix 'tx' and 'config' parameters in token-service.ts (lines 138, 557)
    - Fix 'tx' parameter in user-service.ts (line 189)
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 12. Fix service method parameter and type issues
  - [x] 12.1 Fix Gmail integration service call errors
    - Fix argument count mismatches in gmail config route (lines 18, 80, 97)
    - Fix argument type mismatch in gmail connect route (line 62)
    - Fix argument count mismatch in gmail disconnect route (line 57)
    - Fix type assignment errors in gmail test route (lines 54, 56, 64, 66, 74, 76)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 12.2 Fix SimilarWeb integration service call errors
    - Fix argument count mismatches in similarweb config route (lines 18, 92)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 12.3 Fix config hot-update property errors
    - Fix 'category' property that doesn't exist in type (lines 58, 105)
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 13. Fix auth service type indexing issues
  - Fix UserRole indexing errors in auth-service.ts (lines 539, 540, 541)
  - Implement proper type-safe role mapping
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 14. Fix monitoring service status type issues
  - Fix status type compatibility in monitoring-service.ts (line 783)
  - Ensure status values match expected union type
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 15. Run comprehensive type checking validation
  - Execute npm run type-check to verify all errors are resolved
  - Run unit tests to ensure functionality is preserved
  - Validate that all Prisma operations work correctly
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_