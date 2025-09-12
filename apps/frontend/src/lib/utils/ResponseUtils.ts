/**
 * Response utilities for API responses
 */
export class ResponseUtils {
  static success(data: any, message?: string) {
    return {
      success: true,
      data,
      message
    }
  }

  static error(message: string, code?: string) {
    return {
      success: false,
      error: message,
      code
    }
  }

  static paginated(data: any[], pagination: any) {
    return {
      success: true,
      data,
      pagination
    }
  }
}
