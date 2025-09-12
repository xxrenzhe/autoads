declare global {
  var __BROWSER_POOL__: any;
  var __TASK_REGISTRY__: any;
  var __PERFORMANCE_MONITOR__: any;
  var globalTerminateFlags: Set<string> | undefined;
}

export {};
