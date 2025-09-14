declare module '@/components/SimpleStepsSectionSiterank' {
  const Component: any;
  export default Component;
}

// react-dropzone（用于文件上传控件）
declare module 'react-dropzone' {
  export function useDropzone(options?: any): {
    getRootProps: (props?: any) => any;
    getInputProps: (props?: any) => any;
    open?: () => void;
    [key: string]: any;
  };
}

// 兼容 swagger-ui-react
declare module 'swagger-ui-react' {
  const SwaggerUI: any;
  export default SwaggerUI;
}
