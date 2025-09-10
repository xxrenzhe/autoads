export const logger = {
  info: (msg: string) => console.log(`[LOG] ${msg}`),
  warn: (msg: string) => console.warn(`[LOG] ${msg}`),
  error: (msg: string) => console.error(`[LOG] ${msg}`),
  debug: (msg: string) => console.debug(`[LOG] ${msg}`),
  flush: async () => {
    // Console logger doesn't need flushing, but provide async method for compatibility
    return Promise.resolve();
  }
};

export const createDefaultLoggingService = () => {
  return logger;
};
