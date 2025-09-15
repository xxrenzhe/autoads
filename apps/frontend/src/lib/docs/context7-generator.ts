import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

/**
 * Context7 Documentation Generator
 * 
 * This module generates Context7-compatible documentation that can be injected
 * into AI programming tools like Cursor, Claude, etc. It creates structured,
 * machine-readable documentation with real-time code examples and API references.
 */

export interface Context7Document {
  metadata: {
    title: string
    description: string
    version: string
    lastUpdated: string
    category: 'api' | 'component' | 'service' | 'workflow' | 'config'
    tags: string[]
    dependencies: string[]
    aiContext: {
      purpose: string
      usagePatterns: string[]
      commonMistakes: string[]
      bestPractices: string[]
    }
  }
  content: {
    overview: string
    quickStart: CodeExample
    examples: CodeExample[]
    apiReference?: ApiReference
    componentProps?: ComponentProps
    workflows?: WorkflowStep[]
  }
  relationships: {
    relatedFiles: string[]
    dependencies: string[]
    usedBy: string[]
  }
}

export interface CodeExample {
  title: string
  description: string
  code: string
  language: string
  framework?: string
  version?: string
  context: {
    scenario: string
    prerequisites: string[]
    expectedOutput: string
  }
}

export interface ApiReference {
  endpoint: string
  method: string
  description: string
  parameters: Parameter[]
  responses: Response[]
  examples: {
    request: any
    response: any
    curl?: string
  }[]
  authentication?: {
    type: string
    required: boolean
    description: string
  }
}

export interface Parameter {
  name: string
  type: string
  required: boolean
  description: string
  example: any
  validation?: {
    min?: number
    max?: number
    pattern?: string
    enum?: any[]
  }
}

export interface Response {
  status: number
  description: string
  schema: any
  example: any
}

export interface ComponentProps {
  name: string
  description: string
  props: {
    [key: string]: {
      type: string
      required: boolean
      default?: any
      description: string
      examples: any[]
    }
  }
  events?: {
    [key: string]: {
      description: string
      payload: any
      example: any
    }
  }
  slots?: {
    [key: string]: {
      description: string
      props?: any
    }
  }
}

export interface WorkflowStep {
  id: string
  title: string
  description: string
  code?: string
  prerequisites: string[]
  outputs: string[]
  nextSteps: string[]
  troubleshooting?: {
    issue: string
    solution: string
  }[]
}

export class Context7Generator {
  private projectRoot: string
  private outputDir: string
  private packageJson: any

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
    this.outputDir = path.join(projectRoot, '.context7')
    
    // Load package.json for version and dependency info
    try {
      const packagePath = path.join(projectRoot, 'package.json')
      this.packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    } catch (error) {
      console.warn('Could not load package.json:', error)
      this.packageJson = { version: '1.0.0', dependencies: {} }
    }
  }

  /**
   * Generate all Context7 documentation
   */
  async generateAll(): Promise<void> {
    console.log('🚀 Generating Context7 documentation...')
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }

    // Generate different types of documentation
    await Promise.all([
      this.generateApiDocs(),
      this.generateComponentDocs(),
      this.generateServiceDocs(),
      this.generateWorkflowDocs(),
      this.generateConfigDocs()
    ])

    // Generate index file
    await this.generateIndex()
    
    // Generate MCP configuration
    await this.generateMCPConfig()

    console.log('✅ Context7 documentation generated successfully')
  }

  /**
   * Generate API documentation
   */
  private async generateApiDocs(): Promise<void> {
    console.log('📡 Generating API documentation...')
    
    const apiFiles = await glob('src/app/api/**/*.ts', { cwd: this.projectRoot })
    const apiDocs: Context7Document[] = []

    for (const file of apiFiles) {
      const doc = await this.parseApiFile(file)
      if (doc) {
        apiDocs.push(doc)
      }
    }

    // Write API documentation
    const apiDocsPath = path.join(this.outputDir, 'api.json')
    fs.writeFileSync(apiDocsPath, JSON.stringify(apiDocs, null, 2))
    
    console.log(`✅ Generated ${apiDocs.length} API documents`)
  }

  /**
   * Generate component documentation
   */
  private async generateComponentDocs(): Promise<void> {
    console.log('🧩 Generating component documentation...')
    
    const componentFiles = await glob('src/components/**/*.tsx', { cwd: this.projectRoot })
    const componentDocs: Context7Document[] = []

    for (const file of componentFiles) {
      const doc = await this.parseComponentFile(file)
      if (doc) {
        componentDocs.push(doc)
      }
    }

    // Write component documentation
    const componentDocsPath = path.join(this.outputDir, 'components.json')
    fs.writeFileSync(componentDocsPath, JSON.stringify(componentDocs, null, 2))
    
    console.log(`✅ Generated ${componentDocs.length} component documents`)
  }

  /**
   * Generate service documentation
   */
  private async generateServiceDocs(): Promise<void> {
    console.log('⚙️ Generating service documentation...')
    
    const serviceFiles = await glob('src/lib/services/**/*.ts', { cwd: this.projectRoot })
    const serviceDocs: Context7Document[] = []

    for (const file of serviceFiles) {
      const doc = await this.parseServiceFile(file)
      if (doc) {
        serviceDocs.push(doc)
      }
    }

    // Write service documentation
    const serviceDocsPath = path.join(this.outputDir, 'services.json')
    fs.writeFileSync(serviceDocsPath, JSON.stringify(serviceDocs, null, 2))
    
    console.log(`✅ Generated ${serviceDocs.length} service documents`)
  }

  /**
   * Generate workflow documentation
   */
  private async generateWorkflowDocs(): Promise<void> {
    console.log('🔄 Generating workflow documentation...')
    
    const workflows = [
      await this.generateUserManagementWorkflow(),
      await this.generateSecurityWorkflow(),
      await this.generateApiWorkflow(),
      await this.generateDeploymentWorkflow()
    ]

    // Write workflow documentation
    const workflowDocsPath = path.join(this.outputDir, 'workflows.json')
    fs.writeFileSync(workflowDocsPath, JSON.stringify(workflows, null, 2))
    
    console.log(`✅ Generated ${workflows.length} workflow documents`)
  }

  /**
   * Generate configuration documentation
   */
  private async generateConfigDocs(): Promise<void> {
    console.log('⚙️ Generating configuration documentation...')
    
    const configs = [
      await this.generateEnvConfigDoc(),
      await this.generateDatabaseConfigDoc(),
      await this.generateSecurityConfigDoc(),
      await this.generateDeploymentConfigDoc()
    ]

    // Write config documentation
    const configDocsPath = path.join(this.outputDir, 'configs.json')
    fs.writeFileSync(configDocsPath, JSON.stringify(configs, null, 2))
    
    console.log(`✅ Generated ${configs.length} configuration documents`)
  }

  /**
   * Parse API file and extract documentation
   */
  private async parseApiFile(filePath: string): Promise<Context7Document | null> {
    try {
      const fullPath = path.join(this.projectRoot, filePath)
      const content = fs.readFileSync(fullPath, 'utf-8')
      
      // Extract route information
      const routeMatch = filePath.match(/src\/app\/api\/(.+)\/route\.ts$/)
      if (!routeMatch) return null
      
      const endpoint = '/' + routeMatch[1].replace(/\[([^\]]+)\]/g, ':$1')
      
      // Extract HTTP methods
      const methods: string[] = []
      if (content.includes('export async function GET')) methods.push('GET')
      if (content.includes('export async function POST')) methods.push('POST')
      if (content.includes('export async function PUT')) methods.push('PUT')
      if (content.includes('export async function DELETE')) methods.push('DELETE')
      
      // Extract JSDoc comments and types
      const description = this.extractDescription(content)
      const parameters = this.extractParameters(content)
      const examples = this.extractExamples(content, endpoint, methods[0] || 'GET')

      return {
        metadata: {
          title: `${endpoint} API`,
          description: description || `API endpoint for ${endpoint}`,
          version: this.packageJson.version,
          lastUpdated: new Date().toISOString(),
          category: 'api',
          tags: ['api', 'rest', ...this.extractTags(filePath)],
          dependencies: this.extractDependencies(content),
          aiContext: {
            purpose: `Handle HTTP requests for ${endpoint}`,
            usagePatterns: [
              `fetch('${endpoint}', { method: '${methods[0] || 'GET'}' })`,
              `await api.${methods[0]?.toLowerCase() || 'get'}('${endpoint}')`
            ],
            commonMistakes: [
              'Missing authentication headers',
              'Incorrect request body format',
              'Not handling error responses'
            ],
            bestPractices: [
              'Always validate input parameters',
              'Use proper HTTP status codes',
              'Include error handling',
              'Add request/response logging'
            ]
          }
        },
        content: {
          overview: description || `REST API endpoint for ${endpoint}`,
          quickStart: {
            title: 'Quick Start',
            description: `Basic usage of ${endpoint} endpoint`,
            code: this.generateQuickStartExample(endpoint, methods[0] || 'GET'),
            language: 'typescript',
            framework: 'Next.js',
            version: this.packageJson.dependencies?.['next'] || 'latest',
            context: {
              scenario: `Making a ${methods[0] || 'GET'} request to ${endpoint}`,
              prerequisites: ['Valid authentication token', 'Proper request headers'],
              expectedOutput: 'JSON response with requested data'
            }
          },
          examples: examples,
          apiReference: {
            endpoint,
            method: methods[0] || 'GET',
            description: description || `${methods[0] || 'GET'} ${endpoint}`,
            parameters,
            responses: this.extractResponses(content),
            examples: [{
              request: this.generateRequestExample(endpoint, methods[0] || 'GET'),
              response: this.generateResponseExample(content),
              curl: this.generateCurlExample(endpoint, methods[0] || 'GET')
            }],
            authentication: this.extractAuthInfo(content)
          }
        },
        relationships: {
          relatedFiles: this.findRelatedFiles(filePath),
          dependencies: this.extractDependencies(content),
          usedBy: []
        }
      }
    } catch (error) {
      console.error(`Error parsing API file ${filePath}:`, error)
      return null
    }
  }

  /**
   * Parse component file and extract documentation
   */
  private async parseComponentFile(filePath: string): Promise<Context7Document | null> {
    try {
      const fullPath = path.join(this.projectRoot, filePath)
      const content = fs.readFileSync(fullPath, 'utf-8')
      
      // Extract component name
      const componentMatch = content.match(/export\s+(?:default\s+)?function\s+(\w+)/)
      if (!componentMatch) return null
      
      const componentName = componentMatch[1]
      const description = this.extractDescription(content)
      const props = this.extractComponentProps(content)
      const examples = this.extractComponentExamples(content, componentName)

      return {
        metadata: {
          title: `${componentName} Component`,
          description: description || `React component: ${componentName}`,
          version: this.packageJson.version,
          lastUpdated: new Date().toISOString(),
          category: 'component',
          tags: ['react', 'component', 'ui', ...this.extractTags(filePath)],
          dependencies: this.extractDependencies(content),
          aiContext: {
            purpose: `Render ${componentName} UI component`,
            usagePatterns: [
              `<${componentName} />`,
              `import ${componentName} from '${filePath.replace('src/', '@/').replace('.tsx', '')}'`
            ],
            commonMistakes: [
              'Missing required props',
              'Incorrect prop types',
              'Not handling loading states'
            ],
            bestPractices: [
              'Use TypeScript for prop validation',
              'Handle loading and error states',
              'Follow accessibility guidelines',
              'Use proper semantic HTML'
            ]
          }
        },
        content: {
          overview: description || `${componentName} is a React component for rendering UI elements`,
          quickStart: {
            title: 'Quick Start',
            description: `Basic usage of ${componentName} component`,
            code: this.generateComponentQuickStart(componentName, props),
            language: 'tsx',
            framework: 'React',
            version: this.packageJson.dependencies?.['react'] || 'latest',
            context: {
              scenario: `Rendering ${componentName} component`,
              prerequisites: ['React environment', 'Required props'],
              expectedOutput: `Rendered ${componentName} component`
            }
          },
          examples: examples,
          componentProps: {
            name: componentName,
            description: description || `${componentName} component`,
            props: props
          }
        },
        relationships: {
          relatedFiles: this.findRelatedFiles(filePath),
          dependencies: this.extractDependencies(content),
          usedBy: []
        }
      }
    } catch (error) {
      console.error(`Error parsing component file ${filePath}:`, error)
      return null
    }
  }

  /**
   * Parse service file and extract documentation
   */
  private async parseServiceFile(filePath: string): Promise<Context7Document | null> {
    try {
      const fullPath = path.join(this.projectRoot, filePath)
      const content = fs.readFileSync(fullPath, 'utf-8')
      
      // Extract service class name
      const classMatch = content.match(/export\s+class\s+(\w+)/)
      if (!classMatch) return null
      
      const serviceName = classMatch[1]
      const description = this.extractDescription(content)
      const methods = this.extractServiceMethods(content)
      const examples = this.extractServiceExamples(content, serviceName)

      return {
        metadata: {
          title: `${serviceName} Service`,
          description: description || `Service class: ${serviceName}`,
          version: this.packageJson.version,
          lastUpdated: new Date().toISOString(),
          category: 'service',
          tags: ['service', 'business-logic', ...this.extractTags(filePath)],
          dependencies: this.extractDependencies(content),
          aiContext: {
            purpose: `Provide business logic for ${serviceName}`,
            usagePatterns: [
              `const result = await ${serviceName}.methodName()`,
              `import { ${serviceName} } from '${filePath.replace('src/', '@/').replace('.ts', '')}'`
            ],
            commonMistakes: [
              'Not handling async operations properly',
              'Missing error handling',
              'Not validating input parameters'
            ],
            bestPractices: [
              'Use async/await for asynchronous operations',
              'Implement proper error handling',
              'Validate input parameters',
              'Add comprehensive logging'
            ]
          }
        },
        content: {
          overview: description || `${serviceName} provides business logic and data operations`,
          quickStart: {
            title: 'Quick Start',
            description: `Basic usage of ${serviceName} service`,
            code: this.generateServiceQuickStart(serviceName, methods),
            language: 'typescript',
            framework: 'Node.js',
            version: this.packageJson.dependencies?.['node'] || 'latest',
            context: {
              scenario: `Using ${serviceName} service methods`,
              prerequisites: ['Service dependencies', 'Database connection'],
              expectedOutput: 'Service operation results'
            }
          },
          examples: examples
        },
        relationships: {
          relatedFiles: this.findRelatedFiles(filePath),
          dependencies: this.extractDependencies(content),
          usedBy: []
        }
      }
    } catch (error) {
      console.error(`Error parsing service file ${filePath}:`, error)
      return null
    }
  }

  /**
   * Generate user management workflow
   */
  private async generateUserManagementWorkflow(): Promise<Context7Document> {
    return {
      metadata: {
        title: 'User Management Workflow',
        description: 'Complete workflow for managing users in the admin system',
        version: this.packageJson.version,
        lastUpdated: new Date().toISOString(),
        category: 'workflow',
        tags: ['workflow', 'user-management', 'admin'],
        dependencies: ['@/lib/services/user-service' /*, '@/components/admin/UserManagement' */], // TEMPORARY: Admin component removed during Phase 1
        aiContext: {
          purpose: 'Guide through user management operations',
          usagePatterns: [
            'Creating new users',
            'Updating user roles',
            'Managing user permissions'
          ],
          commonMistakes: [
            'Not validating user permissions',
            'Missing role checks',
            'Incomplete user data validation'
          ],
          bestPractices: [
            'Always validate user permissions before operations',
            'Log all user management actions',
            'Use proper error handling',
            'Implement audit trails'
          ]
        }
      },
      content: {
        overview: 'This workflow covers all aspects of user management including creation, updates, role management, and permissions.',
        quickStart: {
          title: 'Create New User',
          description: 'Basic user creation workflow',
          code: `
// 1. Import required services
import { UserService } from '@/lib/services/user-service'

// 2. Create user with validation
const newUser = await UserService.createUser({
  email: 'user@example.com',
  name: 'John Doe',
  role: 'USER'
})

// 3. Handle success/error
if (newUser) {
  console.log('User created successfully:', newUser.id)
} else {
  console.error('Failed to create user')
}
          `,
          language: 'typescript',
          context: {
            scenario: 'Admin creating a new user account',
            prerequisites: ['Admin authentication', 'Valid user data'],
            expectedOutput: 'New user object with generated ID'
          }
        },
        examples: [],
        workflows: [
          {
            id: 'create-user',
            title: 'Create New User',
            description: 'Step-by-step process to create a new user',
            prerequisites: ['Admin role', 'Valid email address'],
            outputs: ['User ID', 'Welcome email sent'],
            nextSteps: ['assign-role', 'set-permissions'],
            code: `
const user = await UserService.createUser({
  email: userData.email,
  name: userData.name,
  role: userData.role || 'USER'
})
            `,
            troubleshooting: [
              {
                issue: 'Email already exists',
                solution: 'Check for existing user or use different email'
              }
            ]
          }
        ]
      },
      relationships: {
        relatedFiles: [
          'src/lib/services/user-service.ts',
          'src/components/admin/UserManagement.tsx',
          'ops/api/v1/console/users (backend)'
        ],
        dependencies: ['user-service', 'database'],
        usedBy: ['admin-dashboard', 'user-management-ui']
      }
    }
  }

  // Helper methods for extraction and generation
  private extractDescription(content: string): string {
    const docMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\s*\n/)
    return docMatch ? docMatch[1] : ''
  }

  private extractTags(filePath: string): string[] {
    const tags: string[] = []
    if (filePath.includes('/admin/')) tags.push('admin')
    if (filePath.includes('/api/')) tags.push('api')
    if (filePath.includes('/components/')) tags.push('component')
    if (filePath.includes('/services/')) tags.push('service')
    return tags
  }

  private extractDependencies(content: string): string[] {
    const imports = content.match(/import\s+.+?\s+from\s+['"](.+?)['"]/g) || []
    return imports?.filter(Boolean)?.map((imp: any) => {
      const match = imp.match(/from\s+['"](.+?)['"]/)
      return match ? match[1] : ''
    }).filter(Boolean)
  }

  private findRelatedFiles(filePath: string): string[] {
    // This would implement logic to find related files
    // For now, return empty array
    return []
  }

  private extractParameters(content: string): Parameter[] {
    // Extract parameters from request body parsing
    const zodMatch = content.match(/z\.object\(\{([\s\S]*?)\}\)/)
    if (!zodMatch) return []

    // Parse Zod schema to extract parameters
    // This is a simplified implementation
    return []
  }

  private extractResponses(content: string): Response[] {
    return [
      {
        status: 200,
        description: 'Success',
        schema: { type: 'object' },
        example: { success: true, data: {} }
      },
      {
        status: 400,
        description: 'Bad Request',
        schema: { type: 'object' },
        example: { error: 'Invalid input' }
      },
      {
        status: 401,
        description: 'Unauthorized',
        schema: { type: 'object' },
        example: { error: 'Unauthorized' }
      }
    ]
  }

  private extractAuthInfo(content: string): any {
    if (content.includes('getServerSession')) {
      return {
        type: 'session',
        required: true,
        description: 'Requires valid user session'
      }
    }
    return undefined
  }

  private extractExamples(content: string, endpoint: string, method: string): CodeExample[] {
    return [
      {
        title: `${method} ${endpoint}`,
        description: `Example ${method} request to ${endpoint}`,
        code: this.generateQuickStartExample(endpoint, method),
        language: 'typescript',
        context: {
          scenario: `Making ${method} request`,
          prerequisites: ['Authentication token'],
          expectedOutput: 'JSON response'
        }
      }
    ]
  }

  private extractComponentProps(content: string): any {
    // Extract props from TypeScript interface
    const propsMatch = content.match(/interface\s+\w*Props\s*\{([\s\S]*?)\}/)
    if (!propsMatch) return {}

    // Parse props - simplified implementation
    return {}
  }

  private extractComponentExamples(content: string, componentName: string): CodeExample[] {
    return [
      {
        title: `Basic ${componentName}`,
        description: `Basic usage of ${componentName} component`,
        code: `<${componentName} />`,
        language: 'tsx',
        context: {
          scenario: 'Basic component usage',
          prerequisites: ['React environment'],
          expectedOutput: 'Rendered component'
        }
      }
    ]
  }

  private extractServiceMethods(content: string): string[] {
    const methods = content.match(/static\s+async\s+(\w+)/g) || []
    return methods?.filter(Boolean)?.map((m: any) => m.replace('static async ', ''))
  }

  private extractServiceExamples(content: string, serviceName: string): CodeExample[] {
    return [
      {
        title: `Using ${serviceName}`,
        description: `Basic usage of ${serviceName} service`,
        code: `const result = await ${serviceName}.methodName()`,
        language: 'typescript',
        context: {
          scenario: 'Service method call',
          prerequisites: ['Service import'],
          expectedOutput: 'Method result'
        }
      }
    ]
  }

  private generateQuickStartExample(endpoint: string, method: string): string {
    return `
// Basic ${method} request to ${endpoint}
const response = await fetch('${endpoint}', {
  method: '${method}',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  }${method !== 'GET' ? ',\n  body: JSON.stringify(requestData)' : ''}
})

const data = await response.json()
console.log(data)
    `.trim()
  }

  private generateRequestExample(endpoint: string, method: string): any {
    const base = {
      method,
      url: endpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
      }
    }

    if (method !== 'GET') {
      return { ...base, body: { example: 'data' } }
    }

    return base
  }

  private generateResponseExample(content: string): any {
    return {
      success: true,
      data: {},
      message: 'Operation completed successfully'
    }
  }

  private generateCurlExample(endpoint: string, method: string): string {
    return `curl -X ${method} "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN"${method !== 'GET' ? ' \\\n  -d \'{"example": "data"}\'' : ''}`
  }

  private generateComponentQuickStart(componentName: string, props: any): string {
    return `
import ${componentName} from '@/components/${componentName}'

export default function Example() {
  return (
    <${componentName}${Object.keys(props).length > 0 ? '\n      // Add required props here' : ''} />
  )
}
    `.trim()
  }

  private generateServiceQuickStart(serviceName: string, methods: string[]): string {
    const firstMethod = methods[0] || 'methodName'
    return `
import { ${serviceName} } from '@/lib/services/${serviceName.toLowerCase()}'

// Basic usage
const result = await ${serviceName}.${firstMethod}()
console.log(result)
    `.trim()
  }

  // Additional workflow generators
  private async generateSecurityWorkflow(): Promise<Context7Document> {
    return {
      metadata: {
        title: 'Security Management Workflow',
        description: 'Security configuration and monitoring workflow',
        version: this.packageJson.version,
        lastUpdated: new Date().toISOString(),
        category: 'workflow',
        tags: ['workflow', 'security', 'admin'],
        dependencies: ['@/lib/security/*'],
        aiContext: {
          purpose: 'Guide through security management operations',
          usagePatterns: ['Password policy updates', 'Security monitoring', 'Threat detection'],
          commonMistakes: ['Weak password policies', 'Missing security headers'],
          bestPractices: ['Regular security audits', 'Strong authentication', 'Comprehensive logging']
        }
      },
      content: {
        overview: 'Complete security management workflow including policy configuration, monitoring, and incident response.',
        quickStart: {
          title: 'Update Password Policy',
          description: 'Basic password policy configuration',
          code: `
import { PasswordPolicyManager } from '@/lib/security/password-policy'

const policy = await PasswordPolicyManager.updatePasswordPolicy({
  minLength: 12,
  requireUppercase: true,
  requireNumbers: true,
  maxLoginAttempts: 5
}, adminUserId)
          `,
          language: 'typescript',
          context: {
            scenario: 'Admin updating security policy',
            prerequisites: ['Super admin role'],
            expectedOutput: 'Updated policy confirmation'
          }
        },
        examples: []
      },
      relationships: {
        relatedFiles: ['src/lib/security/*', 'src/components/admin/SecurityManagement.tsx'],
        dependencies: ['security-services'],
        usedBy: ['admin-dashboard']
      }
    }
  }

  private async generateApiWorkflow(): Promise<Context7Document> {
    return {
      metadata: {
        title: 'API Development Workflow',
        description: 'Complete API development and testing workflow',
        version: this.packageJson.version,
        lastUpdated: new Date().toISOString(),
        category: 'workflow',
        tags: ['workflow', 'api', 'development'],
        dependencies: ['Next.js', 'Prisma'],
        aiContext: {
          purpose: 'Guide through API development process',
          usagePatterns: ['Creating new endpoints', 'Testing APIs', 'Documentation'],
          commonMistakes: ['Missing validation', 'Poor error handling'],
          bestPractices: ['Input validation', 'Proper HTTP codes', 'Comprehensive testing']
        }
      },
      content: {
        overview: 'Step-by-step workflow for developing, testing, and documenting APIs.',
        quickStart: {
          title: 'Create New API Endpoint',
          description: 'Basic API endpoint creation',
          code: `
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return NextResponse.json({ success: true, data: {} })
}
          `,
          language: 'typescript',
          context: {
            scenario: 'Creating authenticated API endpoint',
            prerequisites: ['Next.js app router', 'NextAuth setup'],
            expectedOutput: 'Working API endpoint'
          }
        },
        examples: []
      },
      relationships: {
        relatedFiles: ['src/app/api/**/*'],
        dependencies: ['next', 'next-auth'],
        usedBy: ['frontend-components']
      }
    }
  }

  private async generateDeploymentWorkflow(): Promise<Context7Document> {
    return {
      metadata: {
        title: 'Deployment Workflow',
        description: 'Production deployment and configuration workflow',
        version: this.packageJson.version,
        lastUpdated: new Date().toISOString(),
        category: 'workflow',
        tags: ['workflow', 'deployment', 'production'],
        dependencies: ['Docker', 'Environment variables'],
        aiContext: {
          purpose: 'Guide through deployment process',
          usagePatterns: ['Environment setup', 'Database migration', 'Production deployment'],
          commonMistakes: ['Missing environment variables', 'Database connection issues'],
          bestPractices: ['Environment validation', 'Gradual rollout', 'Health checks']
        }
      },
      content: {
        overview: 'Complete deployment workflow from development to production.',
        quickStart: {
          title: 'Environment Setup',
          description: 'Basic environment configuration',
          code: `
# .env.production
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="https://yourdomain.com"
REDIS_URL="redis://..."
          `,
          language: 'bash',
          context: {
            scenario: 'Setting up production environment',
            prerequisites: ['Database server', 'Redis server'],
            expectedOutput: 'Configured environment'
          }
        },
        examples: []
      },
      relationships: {
        relatedFiles: ['Dockerfile', 'docker-compose.yml', '.env.example'],
        dependencies: ['docker', 'postgresql', 'redis'],
        usedBy: ['production-environment']
      }
    }
  }

  // Configuration documentation generators
  private async generateEnvConfigDoc(): Promise<Context7Document> {
    return {
      metadata: {
        title: 'Environment Configuration',
        description: 'Complete environment variables configuration guide',
        version: this.packageJson.version,
        lastUpdated: new Date().toISOString(),
        category: 'config',
        tags: ['config', 'environment', 'setup'],
        dependencies: [],
        aiContext: {
          purpose: 'Configure application environment variables',
          usagePatterns: ['Development setup', 'Production deployment', 'Testing configuration'],
          commonMistakes: ['Missing required variables', 'Incorrect database URLs'],
          bestPractices: ['Use .env.example template', 'Validate on startup', 'Secure secret management']
        }
      },
      content: {
        overview: 'Comprehensive guide for configuring all environment variables required by the application.',
        quickStart: {
          title: 'Basic Setup',
          description: 'Minimum required environment variables',
          code: `
# Copy from .env.example
cp .env.example .env.local

# Required variables
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
NEXTAUTH_SECRET="your-32-character-secret-key"
NEXTAUTH_URL="http://localhost:3000"
          `,
          language: 'bash',
          context: {
            scenario: 'Setting up development environment',
            prerequisites: ['PostgreSQL database'],
            expectedOutput: 'Working local environment'
          }
        },
        examples: []
      },
      relationships: {
        relatedFiles: ['.env.example', 'src/lib/config.ts'],
        dependencies: [],
        usedBy: ['all-services']
      }
    }
  }

  private async generateDatabaseConfigDoc(): Promise<Context7Document> {
    return {
      metadata: {
        title: 'Database Configuration',
        description: 'Database setup and migration guide',
        version: this.packageJson.version,
        lastUpdated: new Date().toISOString(),
        category: 'config',
        tags: ['config', 'database', 'prisma'],
        dependencies: ['prisma', 'postgresql'],
        aiContext: {
          purpose: 'Configure and manage database connections',
          usagePatterns: ['Initial setup', 'Migrations', 'Schema updates'],
          commonMistakes: ['Connection string format', 'Missing migrations'],
          bestPractices: ['Regular backups', 'Migration testing', 'Connection pooling']
        }
      },
      content: {
        overview: 'Complete database configuration including Prisma setup, migrations, and optimization.',
        quickStart: {
          title: 'Database Setup',
          description: 'Initial database configuration',
          code: `
# Install dependencies
npm install prisma @prisma/client

# Initialize Prisma
npx prisma init

# Run migrations
npx prisma db push

# Generate client
npx prisma generate
          `,
          language: 'bash',
          context: {
            scenario: 'Setting up new database',
            prerequisites: ['PostgreSQL server'],
            expectedOutput: 'Configured database with schema'
          }
        },
        examples: []
      },
      relationships: {
        relatedFiles: ['prisma/schema.prisma', 'src/lib/db.ts'],
        dependencies: ['prisma', 'postgresql'],
        usedBy: ['all-services']
      }
    }
  }

  private async generateSecurityConfigDoc(): Promise<Context7Document> {
    return {
      metadata: {
        title: 'Security Configuration',
        description: 'Security settings and best practices configuration',
        version: this.packageJson.version,
        lastUpdated: new Date().toISOString(),
        category: 'config',
        tags: ['config', 'security', 'authentication'],
        dependencies: ['next-auth', 'bcryptjs'],
        aiContext: {
          purpose: 'Configure security settings and policies',
          usagePatterns: ['Authentication setup', 'Password policies', 'Security headers'],
          commonMistakes: ['Weak secrets', 'Missing HTTPS', 'Insecure headers'],
          bestPractices: ['Strong secrets', 'HTTPS enforcement', 'Security headers', 'Regular audits']
        }
      },
      content: {
        overview: 'Comprehensive security configuration including authentication, authorization, and security policies.',
        quickStart: {
          title: 'Security Setup',
          description: 'Basic security configuration',
          code: `
# Security environment variables
NEXTAUTH_SECRET="your-very-secure-32-character-secret"
ENCRYPTION_KEY="another-32-character-encryption-key"

# Security headers (automatic)
# Password policy (configurable via admin panel)
# Rate limiting (built-in)
          `,
          language: 'bash',
          context: {
            scenario: 'Configuring application security',
            prerequisites: ['Secure environment'],
            expectedOutput: 'Secured application'
          }
        },
        examples: []
      },
      relationships: {
        relatedFiles: ['src/lib/security/*', 'src/lib/auth.ts'],
        dependencies: ['next-auth', 'security-services'],
        usedBy: ['all-authenticated-routes']
      }
    }
  }

  private async generateDeploymentConfigDoc(): Promise<Context7Document> {
    return {
      metadata: {
        title: 'Deployment Configuration',
        description: 'Production deployment configuration and setup',
        version: this.packageJson.version,
        lastUpdated: new Date().toISOString(),
        category: 'config',
        tags: ['config', 'deployment', 'production'],
        dependencies: ['docker', 'nginx'],
        aiContext: {
          purpose: 'Configure production deployment',
          usagePatterns: ['Docker deployment', 'Environment setup', 'Load balancing'],
          commonMistakes: ['Missing health checks', 'Incorrect ports', 'SSL configuration'],
          bestPractices: ['Health monitoring', 'Graceful shutdown', 'SSL termination', 'Load balancing']
        }
      },
      content: {
        overview: 'Complete production deployment configuration including Docker, environment setup, and monitoring.',
        quickStart: {
          title: 'Docker Deployment',
          description: 'Basic Docker deployment setup',
          code: `
# Build and run with Docker
docker build -t admin-system .
docker run -p 3000:3000 --env-file .env.production admin-system

# Or use docker-compose
docker-compose up -d
          `,
          language: 'bash',
          context: {
            scenario: 'Deploying to production',
            prerequisites: ['Docker installed', 'Production environment variables'],
            expectedOutput: 'Running production application'
          }
        },
        examples: []
      },
      relationships: {
        relatedFiles: ['Dockerfile', 'docker-compose.yml', 'nginx.conf'],
        dependencies: ['docker', 'nginx'],
        usedBy: ['production-environment']
      }
    }
  }

  /**
   * Generate documentation index
   */
  private async generateIndex(): Promise<void> {
    const index = {
      name: 'Admin Management System',
      version: this.packageJson.version,
      description: 'Comprehensive admin management system with user management, security, analytics, and more',
      lastUpdated: new Date().toISOString(),
      categories: {
        api: 'REST API endpoints and documentation',
        components: 'React components and UI elements',
        services: 'Business logic and data services',
        workflows: 'Step-by-step process guides',
        configs: 'Configuration and setup guides'
      },
      files: {
        'api.json': 'API endpoints documentation',
        'components.json': 'React components documentation',
        'services.json': 'Service classes documentation',
        'workflows.json': 'Workflow and process guides',
        'configs.json': 'Configuration documentation'
      },
      aiContext: {
        purpose: 'Provide comprehensive documentation for AI-assisted development',
        framework: 'Next.js 14 with App Router',
        language: 'TypeScript',
        database: 'PostgreSQL with Prisma ORM',
        authentication: 'NextAuth.js',
        styling: 'Tailwind CSS with shadcn/ui',
        deployment: 'Docker with multi-environment support'
      }
    }

    const indexPath = path.join(this.outputDir, 'index.json')
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2))
  }

  /**
   * Generate MCP configuration for AI editors
   */
  private async generateMCPConfig(): Promise<void> {
    const mcpConfig = {
      mcpServers: {
        'admin-system-docs': {
          command: 'node',
          args: [path.join(this.outputDir, 'mcp-server.js')],
          env: {
            DOCS_PATH: this.outputDir
          },
          disabled: false,
          autoApprove: [
            'get_documentation',
            'search_docs',
            'get_examples',
            'get_workflows'
          ]
        }
      }
    }

    const mcpPath = path.join(this.outputDir, 'mcp.json')
    fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2))

    // Also create a sample MCP server implementation
    await this.generateMCPServer()
  }

  /**
   * Generate MCP server implementation
   */
  private async generateMCPServer(): Promise<void> {
    const serverCode = `
const fs = require('fs')
const path = require('path')

class AdminSystemDocsServer {
  constructor() {
    this.docsPath = process.env.DOCS_PATH || '.context7'
  }

  async getDocumentation(category) {
    try {
      const filePath = path.join(this.docsPath, \`\${category}.json\`)
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      }
      return null
    } catch (error) {
      console.error('Error reading documentation:', error)
      return null
    }
  }

  async searchDocs(query) {
    const categories = ['api', 'components', 'services', 'workflows', 'configs']
    const results = []

    for (const category of categories) {
      const docs = await this.getDocumentation(category)
      if (docs) {
        const matches = docs.filter((doc: any) => 
          doc.metadata.title.toLowerCase().includes(query.toLowerCase()) ||
          doc.metadata.description.toLowerCase().includes(query.toLowerCase()) ||
          doc.metadata.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        )
        results.push(...matches)
      }
    }

    return results
  }

  async getExamples(type) {
    const docs = await this.getDocumentation(type)
    if (!docs) return []

    return docs.flatMap(doc => doc.content.examples || [])
  }

  async getWorkflows() {
    return await this.getDocumentation('workflows')
  }
}

// MCP Server implementation would go here
// This is a simplified version for demonstration
module.exports = AdminSystemDocsServer
    `

    const serverPath = path.join(this.outputDir, 'mcp-server.js')
    fs.writeFileSync(serverPath, serverCode)
  }
}

// Export for use in scripts
export default Context7Generator
