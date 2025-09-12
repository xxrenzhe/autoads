#!/usr/bin/env node

/**
 * Simple MCP Server for Context7 Documentation
 * 
 * This is a basic MCP (Model Context Protocol) server implementation
 * that serves the generated Context7 documentation to AI tools.
 */

const fs = require('fs')
const path = require('path')

class AdminSystemMCPServer {
  constructor() {
    this.docsPath = process.env.DOCS_PATH || '.context7'
    this.projectRoot = process.cwd()
    
    // Ensure docs path is absolute
    if (!path.isAbsolute(this.docsPath)) {
      this.docsPath = path.join(this.projectRoot, this.docsPath)
    }
  }

  /**
   * Get documentation by category
   */
  async getDocumentation(category) {
    try {
      const filePath = path.join(this.docsPath, `${category}.json`)
      
      if (!fs.existsSync(filePath)) {
        return {
          error: `Documentation category '${category}' not found`,
          available: this.getAvailableCategories()
        }
      }

      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      return {
        error: `Failed to read documentation: ${error.message}`,
        category
      }
    }
  }

  /**
   * Search across all documentation
   */
  async searchDocs(query, options = {}) {
    try {
      const { category, limit = 10, includeCode = true } = options
      const categories = category ? [category] : this.getAvailableCategories()
      const results = []

      for (const cat of categories) {
        const docs = await this.getDocumentation(cat)
        if (docs.error) continue

        if (Array.isArray(docs)) {
          const matches = docs.filter(doc => this.matchesQuery(doc, query))
          results.push(...matches.slice(0, limit))
        }
      }

      // Sort by relevance (simple scoring)
      results.sort((a, b) => this.calculateRelevance(b, query) - this.calculateRelevance(a, query))

      return {
        query,
        results: results.slice(0, limit),
        total: results.length
      }
    } catch (error) {
      return {
        error: `Search failed: ${error.message}`,
        query
      }
    }
  }

  /**
   * Get code examples by type or pattern
   */
  async getExamples(type, pattern) {
    try {
      const examples = []
      
      // Get examples from patterns file
      const patterns = await this.getDocumentation('patterns')
      if (patterns && patterns.patterns) {
        Object.entries(patterns.patterns).forEach(([name, patternData]) => {
          if (!type || patternData.tags?.includes(type)) {
            if (!pattern || name.toLowerCase().includes(pattern.toLowerCase())) {
              examples.push({
                name,
                ...patternData,
                source: 'patterns'
              })
            }
          }
        })
      }

      // Get examples from documentation files
      const categories = ['api', 'components', 'services']
      for (const category of categories) {
        const docs = await this.getDocumentation(category)
        if (Array.isArray(docs)) {
          docs.forEach(doc => {
            if (doc.content?.examples) {
              doc.content.examples.forEach(example => {
                if (!type || example.language === type || doc.metadata?.category === type) {
                  if (!pattern || example.title.toLowerCase().includes(pattern.toLowerCase())) {
                    examples.push({
                      ...example,
                      source: category,
                      documentTitle: doc.metadata?.title
                    })
                  }
                }
              })
            }
          })
        }
      }

      return {
        type,
        pattern,
        examples: examples.slice(0, 20) // Limit results
      }
    } catch (error) {
      return {
        error: `Failed to get examples: ${error.message}`,
        type,
        pattern
      }
    }
  }

  /**
   * Get workflow information
   */
  async getWorkflows(workflowId) {
    try {
      const workflows = await this.getDocumentation('workflows')
      
      if (workflows.error) {
        return workflows
      }

      if (workflowId) {
        const workflow = workflows.find(w => 
          w.metadata?.title.toLowerCase().includes(workflowId.toLowerCase()) ||
          w.content?.workflows?.some(step => step.id === workflowId)
        )
        
        return workflow || { error: `Workflow '${workflowId}' not found` }
      }

      return {
        workflows: workflows.map(w => ({
          title: w.metadata?.title,
          description: w.metadata?.description,
          category: w.metadata?.category,
          steps: w.content?.workflows?.length || 0
        }))
      }
    } catch (error) {
      return {
        error: `Failed to get workflows: ${error.message}`,
        workflowId
      }
    }
  }

  /**
   * Get API reference
   */
  async getApiReference(endpoint) {
    try {
      const apis = await this.getDocumentation('api')
      
      if (apis.error) {
        return apis
      }

      if (endpoint) {
        const api = apis.find(a => 
          a.content?.apiReference?.endpoint === endpoint ||
          a.content?.apiReference?.endpoint.includes(endpoint)
        )
        
        return api?.content?.apiReference || { error: `API endpoint '${endpoint}' not found` }
      }

      return {
        endpoints: apis.map(a => ({
          endpoint: a.content?.apiReference?.endpoint,
          method: a.content?.apiReference?.method,
          description: a.content?.apiReference?.description,
          title: a.metadata?.title
        })).filter(a => a.endpoint)
      }
    } catch (error) {
      return {
        error: `Failed to get API reference: ${error.message}`,
        endpoint
      }
    }
  }

  /**
   * Get quick reference
   */
  async getQuickReference(section) {
    try {
      const quickRef = await this.getDocumentation('quick-reference')
      
      if (quickRef.error) {
        return quickRef
      }

      if (section && quickRef.sections) {
        return quickRef.sections[section] || { error: `Section '${section}' not found` }
      }

      return quickRef
    } catch (error) {
      return {
        error: `Failed to get quick reference: ${error.message}`,
        section
      }
    }
  }

  /**
   * Get troubleshooting information
   */
  async getTroubleshooting(issue) {
    try {
      const troubleshooting = await this.getDocumentation('troubleshooting')
      
      if (troubleshooting.error) {
        return troubleshooting
      }

      if (issue && troubleshooting.issues) {
        const matchingIssue = Object.entries(troubleshooting.issues).find(([key, data]) =>
          key.toLowerCase().includes(issue.toLowerCase()) ||
          data.symptoms?.some(symptom => symptom.toLowerCase().includes(issue.toLowerCase()))
        )
        
        if (matchingIssue) {
          return {
            issue: matchingIssue[0],
            ...matchingIssue[1]
          }
        }
        
        return { error: `Issue '${issue}' not found` }
      }

      return troubleshooting
    } catch (error) {
      return {
        error: `Failed to get troubleshooting info: ${error.message}`,
        issue
      }
    }
  }

  /**
   * Get project information
   */
  async getProjectInfo() {
    try {
      const index = await this.getDocumentation('index')
      
      if (index.error) {
        return index
      }

      return {
        name: index.name,
        version: index.version,
        description: index.description,
        lastUpdated: index.lastUpdated,
        categories: index.categories,
        aiContext: index.aiContext,
        availableFiles: this.getAvailableCategories()
      }
    } catch (error) {
      return {
        error: `Failed to get project info: ${error.message}`
      }
    }
  }

  /**
   * Helper: Get available documentation categories
   */
  getAvailableCategories() {
    try {
      const files = fs.readdirSync(this.docsPath)
      return files
        .filter(file => file.endsWith('.json') && file !== 'index.json')
        .map(file => file.replace('.json', ''))
    } catch (error) {
      return []
    }
  }

  /**
   * Helper: Check if document matches query
   */
  matchesQuery(doc, query) {
    const searchText = [
      doc.metadata?.title,
      doc.metadata?.description,
      doc.metadata?.tags?.join(' '),
      doc.content?.overview
    ].filter(Boolean).join(' ').toLowerCase()

    return searchText.includes(query.toLowerCase())
  }

  /**
   * Helper: Calculate relevance score
   */
  calculateRelevance(doc, query) {
    let score = 0
    const queryLower = query.toLowerCase()

    // Title match (highest weight)
    if (doc.metadata?.title?.toLowerCase().includes(queryLower)) {
      score += 10
    }

    // Description match
    if (doc.metadata?.description?.toLowerCase().includes(queryLower)) {
      score += 5
    }

    // Tags match
    if (doc.metadata?.tags?.some(tag => tag.toLowerCase().includes(queryLower))) {
      score += 3
    }

    // Content match
    if (doc.content?.overview?.toLowerCase().includes(queryLower)) {
      score += 2
    }

    return score
  }
}

// Simple CLI interface for testing
if (require.main === module) {
  const server = new AdminSystemMCPServer()
  const command = process.argv[2]
  const arg = process.argv[3]

  async function runCommand() {
    let result

    switch (command) {
      case 'search':
        result = await server.searchDocs(arg || 'user')
        break
      case 'api':
        result = await server.getApiReference(arg)
        break
      case 'examples':
        result = await server.getExamples(arg)
        break
      case 'workflows':
        result = await server.getWorkflows(arg)
        break
      case 'troubleshooting':
        result = await server.getTroubleshooting(arg)
        break
      case 'info':
        result = await server.getProjectInfo()
        break
      default:
        result = {
          usage: 'node mcp-server-simple.js <command> [arg]',
          commands: {
            'search <query>': 'Search documentation',
            'api [endpoint]': 'Get API reference',
            'examples [type]': 'Get code examples',
            'workflows [id]': 'Get workflow information',
            'troubleshooting [issue]': 'Get troubleshooting info',
            'info': 'Get project information'
          }
        }
    }

    console.log(JSON.stringify(result, null, 2))
  }

  runCommand().catch(console.error)
}

module.exports = AdminSystemMCPServer