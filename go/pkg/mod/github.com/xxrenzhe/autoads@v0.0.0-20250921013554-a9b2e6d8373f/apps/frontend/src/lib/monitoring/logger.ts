// Simple logger implementation
export class Logger {
  info(msg: string) {
    console.log(`[INFO] ${msg}`)
  }
  
  warn(msg: string) {
    console.warn(`[WARN] ${msg}`)
  }
  
  error(msg: string) {
    console.error(`[ERROR] ${msg}`)
  }
  
  debug(msg: string) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${msg}`)
    }
  }
}

export const logger = new Logger()