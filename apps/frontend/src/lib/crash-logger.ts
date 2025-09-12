export class CrashLogger {
  initialize(): void {
    // Crash logger has been disabled in favor of unified-error-handling.ts
    // This prevents conflicts between multiple error handlers
    console.log('CrashLogger: Error handling is now managed by unified-error-handling.ts');
  }
}

export const crashLogger = new CrashLogger();
