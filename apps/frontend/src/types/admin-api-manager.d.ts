declare module '@/admin/components/api/APIManager' {
  export interface APIEndpoint {
    id: string
    endpoint?: string
    path?: string
    method?: string
    description?: string
    enabled?: boolean
    rateLimit?: any
    [key: string]: any
  }

  export interface APIKey {
    id: string
    name?: string
    createdAt?: string | Date
    revoked?: boolean
    status?: string
    fullKey?: string
    [key: string]: any
  }

  // Ensure consumers see a valid React component default export in type space
  const APIManager: import('react').ComponentType<any>
  export default APIManager
}
