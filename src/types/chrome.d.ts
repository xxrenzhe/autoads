// Chrome扩展类型定义
declare global {
  interface Window {
    chrome?: {
      runtime?: {
        id?: string;
        sendMessage: (
          message: Record<string, unknown>,
          callback?: (response: unknown) => void,
        ) => void;
        lastError?: {
          message: string;
        };
      };
      extension?: {
        id?: string;
      };
    };
  }
}

export {};
