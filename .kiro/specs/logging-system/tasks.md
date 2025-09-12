# Implementation Plan

- [x] 1. Enhance existing LoggingService with dual output and file rotation
  - Modify the existing LoggingService to ensure ALL logs are written to both stdout AND log files simultaneously
  - Update the createDefaultLoggingService function to always include both ConsoleTransport and FileTransport
  - Extend the existing FileTransport class to support log rotation based on file size
  - Implement daily cleanup logic to remove logs older than 7 days
  - Add configuration options for max file size and retention period
  - Ensure existing application logs (from all current console.log, logger.info, etc.) are captured in files
  - Write unit tests for dual output, rotation and cleanup functionality
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Create log file management utilities
  - Implement LogFileManager class to handle file operations and directory management
  - Create functions to list available log files with metadata (size, date, etc.)
  - Add error handling for file system operations (permissions, disk space)
  - Write tests for file management operations
  - _Requirements: 1.3, 2.1, 8.1, 8.2, 8.3_

- [x] 3. Build log query API endpoints
  - Create `/api/logs/current` endpoint to fetch recent log entries with pagination
  - Create `/api/logs/files` endpoint to list available log files
  - Create `/api/logs/search` endpoint with filtering by level, time range, and text search
  - Implement efficient log file reading with streaming for large files
  - Add proper error handling and response formatting
  - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 7.3, 7.4_

- [x] 4. Implement log statistics API
  - Create `/api/logs/stats` endpoint to return log counts by level and time periods
  - Implement efficient log parsing to generate statistics without loading entire files
  - Add caching mechanism for frequently requested statistics
  - Create data structures for hourly and daily log count trends
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 5. Add "实时日志" to navigation menu
  - Update the Navigation component to include "实时日志" in the dropdownItems array
  - Add appropriate icon and description for the log viewer menu item
  - Ensure the menu item highlights correctly when on the logs page
  - Test navigation functionality across desktop and mobile views
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Create log viewer page structure
  - Create `/app/logs/page.tsx` using existing Header and PageFooter components
  - Follow the same layout pattern as homepage with consistent styling and spacing
  - Implement tab-based interface for "实时日志" and "历史日志" views using existing UI components
  - Add search and filter controls using existing form components and design system
  - Ensure responsive layout matches other pages and works on desktop and mobile
  - Use consistent color scheme, typography, and component styling from the existing design system
  - _Requirements: 3.3, 4.3, 5.1, 5.2_

- [x] 7. Build real-time log display component
  - Create LogViewer component using existing UI components and design patterns
  - Implement virtual scrolling for performance using consistent styling with other components
  - Implement HTTP polling mechanism to fetch new log entries every 3 seconds
  - Add auto-scroll functionality to show latest logs
  - Implement log entry formatting with syntax highlighting using existing color scheme
  - Add loading states and error handling using existing Button, Spinner, and Alert components
  - Ensure component styling matches the overall application design language
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2_

- [x] 8. Implement historical log search functionality
  - Create HistoricalLogViewer component using existing design patterns and UI components
  - Add file selection dropdown using existing Select component with consistent styling
  - Implement search and filtering using existing Input and Button components
  - Add pagination using existing pagination patterns from other pages
  - Include download functionality using existing button styles and icons
  - Maintain consistent spacing, colors, and typography with the rest of the application
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Create log statistics dashboard
  - Build LogStatistics component following existing dashboard patterns and card layouts
  - Implement charts for log counts by level using recharts with existing color scheme
  - Add time range selector using existing button group and tab components
  - Ensure chart colors and styling match the application's design system
  - Add loading states using existing skeleton components and error handling with consistent alert styling
  - Use same spacing, shadows, and border radius as other dashboard components
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 10. Add comprehensive error handling and performance optimization
  - Implement graceful degradation when file operations fail
  - Add retry logic for API calls with exponential backoff
  - Optimize log file reading with streaming and buffering
  - Add client-side caching for log statistics
  - Implement proper cleanup of polling intervals and event listeners
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11. Write comprehensive tests for logging system
  - Create unit tests for enhanced LoggingService and file rotation
  - Write integration tests for log API endpoints
  - Add component tests for log viewer and statistics components
  - Create end-to-end tests for complete log flow from generation to display
  - Add performance tests for handling large log files
  - _Requirements: All requirements - testing coverage_

- [ ] 12. Update configuration and ensure complete log capture
  - Add logging system configuration to environment variables
  - Update existing logging.ts config file with new dual-output options
  - Modify application startup to initialize enhanced logging service globally
  - Ensure all existing console.log, console.error, etc. calls throughout the codebase are captured
  - Create logs directory structure in project setup
  - Add logging system documentation to project README
  - Update Docker configuration if needed for log persistence
  - Verify that logs from all application components (API routes, services, components) are captured
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 8.4_