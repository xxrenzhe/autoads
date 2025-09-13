package docs

import (
	"gofly-admin-v3/utils/gf"
)

// Server Swagger服务器配置
type Server struct {
	URL         string `json:"url"`
	Description string `json:"description"`
}

// SwaggerSpec Swagger规范
type SwaggerSpec struct {
	OpenAPI string            `json:"openapi"`
	Servers []Server          `json:"servers"`
	Info    map[string]interface{} `json:"info"`
	Paths   map[string]interface{} `json:"paths"`
}

// GetSwaggerSpec 获取Swagger规范
func GetSwaggerSpec() *SwaggerSpec {
	return &SwaggerSpec{
		OpenAPI: "3.0.0",
		Info: map[string]interface{}{
			"title":       "GoFly Admin API",
			"description": "GoFly Admin管理系统API文档",
			"version":     "1.0.0",
		},
		Paths: make(map[string]interface{}),
	}
}

// PostmanCollection Postman集合
type PostmanCollection struct {
	Info struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	} `json:"info"`
	Variable []struct {
		Key   string      `json:"key"`
		Value interface{} `json:"value"`
	} `json:"variable"`
}

// GetSwaggerSpec 获取Swagger规范
func GetSwaggerSpec() *SwaggerSpec {
	return &SwaggerSpec{
		OpenAPI: "3.0.0",
		Servers: []Server{},
		Info: map[string]interface{}{
			"title":       "GoFly Admin V3 API",
			"description": "GoFly Admin V3 API Documentation",
			"version":     "1.0.0",
		},
		Paths: make(map[string]interface{}),
	}
}

// GetPostmanCollection 获取Postman集合
func GetPostmanCollection() *PostmanCollection {
	return &PostmanCollection{
		Info: struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}{
			Name:        "GoFly Admin V3 API",
			Description: "GoFly Admin V3 API Collection",
		},
		Variable: []struct {
			Key   string      `json:"key"`
			Value interface{} `json:"value"`
		}{
			{
				Key:   "base_url",
				Value: "http://localhost:8080",
			},
		},
	}
}

// GenerateAPIDocs 生成API文档
func GenerateAPIDocs() error {
	// 简单实现：不执行任何操作
	return nil
}

// DocsController API文档控制器
type DocsController struct{}

// @Router /api/docs [get]
func (c *DocsController) Index(ctx *gf.GinCtx) {
	// 重定向到Redoc页面
	ctx.Redirect(302, "/docs/")
}

// @Router /api/docs/swagger.json [get]
func (c *DocsController) SwaggerJSON(ctx *gf.GinCtx) {
	swagger := GetSwaggerSpec()

	// 添加服务器信息（动态）
	server := gf.GetConfig("app.url")
	if server == nil {
		server = "http://localhost:8080"
	}
	swagger.Servers = []Server{
		{
			URL:         server.(string),
			Description: "Current server",
		},
	}

	ctx.JSON(200, swagger)
}

// @Router /api/docs/redoc [get]
func (c *DocsController) Redoc(ctx *gf.GinCtx) {
	redocHTML := `
<!DOCTYPE html>
<html>
<head>
    <title>GoFly Admin V3 API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 0;
        }
        .loading {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }
        .loading-spinner {
            width: 50px;
            height: 50px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div id="loading" class="loading">
        <div class="loading-spinner"></div>
    </div>
    <redoc spec-url='/api/docs/swagger.json'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"></script>
    <script>
        // 隐藏加载动画
        window.addEventListener('load', function() {
            setTimeout(function() {
                document.getElementById('loading').style.display = 'none';
            }, 1000);
        });
    </script>
</body>
</html>
`

	ctx.Header("Content-Type", "text/html")
	ctx.String(200, redocHTML)
}

// @Router /api/docs/swagger [get]
func (c *DocsController) SwaggerUI(ctx *gf.GinCtx) {
	swaggerUIHTML := `
<!DOCTYPE html>
<html>
<head>
    <title>GoFly Admin V3 API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin: 0;
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: "/api/docs/swagger.json",
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                persistAuthorization: true,
                displayRequestDuration: true,
                docExpansion: "none",
                filter: true,
                showExtensions: true,
                showCommonExtensions: true,
                defaultModelsExpandDepth: -1,
                defaultModelExpandDepth: 1,
                displayOperationId: false,
                tryItOutEnabled: true,
                supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
                requestInterceptor: function(request) {
                    const token = localStorage.getItem('jwt_token');
                    if (token) {
                        request.headers.Authorization = 'Bearer ' + token;
                    }
                    return request;
                },
                responseInterceptor: function(response) {
                    return response;
                }
            });
        };
    </script>
</body>
</html>
`

	ctx.Header("Content-Type", "text/html")
	ctx.String(200, swaggerUIHTML)
}

// @Router /api/docs/postman [get]
func (c *DocsController) PostmanCollection(ctx *gf.GinCtx) {
	collection := GetPostmanCollection()

	// 更新基础URL
	baseURL := gf.GetConfig("app.url")
	if baseURL == nil {
		baseURL = "http://localhost:8080"
	}
	if len(collection.Variable) > 0 {
		collection.Variable[0].Default = baseURL.(string)
	}

	ctx.JSON(200, collection)
}

// @Router /api/docs/openapi.json [get]
func (c *DocsController) OpenAPIJSON(ctx *gf.GinCtx) {
	// 生成OpenAPI 3.0.1版本
	swagger := GetSwaggerSpec()
	swagger.OpenAPI = "3.0.1"

	ctx.JSON(200, swagger)
}

// @Router /api/docs/api-reference [get]
func (c *DocsController) APIReference(ctx *gf.GinCtx) {
	// 生成API参考页面
	referenceHTML := `
<!DOCTYPE html>
<html>
<head>
    <title>GoFly Admin V3 API Reference</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css" rel="stylesheet">
    <style>
        .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            width: 250px;
            background: #f8f9fa;
            border-right: 1px solid #dee2e6;
            overflow-y: auto;
            z-index: 100;
        }
        .main-content {
            margin-left: 250px;
            padding: 20px;
        }
        .endpoint-card {
            margin-bottom: 20px;
            border: 1px solid #dee2e6;
            border-radius: 8px;
        }
        .method-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            color: white;
        }
        .method-get { background: #28a745; }
        .method-post { background: #007bff; }
        .method-put { background: #ffc107; color: #212529; }
        .method-delete { background: #dc3545; }
        .method-patch { background: #6f42c1; }
        pre[class*="language-"] {
            margin: 0;
            border-radius: 4px;
        }
        .nav-link {
            color: #495057;
            padding: 8px 16px;
        }
        .nav-link:hover {
            background: #e9ecef;
        }
        .nav-link.active {
            background: #007bff;
            color: white;
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="p-3">
            <h5>API Reference</h5>
            <div class="list-group">
                <a href="#authentication" class="nav-link">Authentication</a>
                <a href="#users" class="nav-link">Users</a>
                <a href="#batchgo" class="nav-link">BatchGo</a>
                <a href="#siterankgo" class="nav-link">SiteRankGo</a>
                <a href="#adscentergo" class="nav-link">AdsCenterGo</a>
                <a href="#errors" class="nav-link">Errors</a>
            </div>
        </div>
    </div>
    
    <div class="main-content">
        <div class="mb-4">
            <h1>GoFly Admin V3 API Reference</h1>
            <p class="text-muted">Welcome to the AutoAds GoFly Admin V3 API documentation.</p>
        </div>
        
        <section id="authentication" class="mb-5">
            <h2>Authentication</h2>
            <div class="card">
                <div class="card-body">
                    <h5>JWT Authentication</h5>
                    <p>All API requests must include a JWT token in the Authorization header:</p>
                    <pre><code class="language-bash">Authorization: Bearer your_jwt_token</code></pre>
                    
                    <h6 class="mt-3">Login Endpoint</h6>
                    <div class="endpoint-card">
                        <div class="card-body">
                            <div class="d-flex align-items-center mb-2">
                                <span class="method-badge method-post me-2">POST</span>
                                <code>/api/v1/auth/login</code>
                            </div>
                            <pre><code class="language-json">{
  "email": "user@example.com",
  "password": "password123"
}</code></pre>
                        </div>
                    </div>
                </div>
            </div>
        </section>
        
        <section id="users" class="mb-5">
            <h2>Users</h2>
            <div class="endpoint-card">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-2">
                        <span class="method-badge method-get me-2">GET</span>
                        <code>/api/v1/users</code>
                    </div>
                    <p class="mb-2">Get list of users with pagination</p>
                    
                    <h6>Query Parameters</h6>
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Parameter</th>
                                <th>Type</th>
                                <th>Required</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>page</td>
                                <td>integer</td>
                                <td>No</td>
                                <td>Page number (default: 1)</td>
                            </tr>
                            <tr>
                                <td>limit</td>
                                <td>integer</td>
                                <td>No</td>
                                <td>Items per page (default: 20)</td>
                            </tr>
                            <tr>
                                <td>search</td>
                                <td>string</td>
                                <td>No</td>
                                <td>Search keyword</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
        
        <section id="batchgo" class="mb-5">
            <h2>BatchGo</h2>
            <div class="endpoint-card">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-2">
                        <span class="method-badge method-post me-2">POST</span>
                        <code>/api/v1/batchgo/tasks</code>
                    </div>
                    <p class="mb-2">Create a new batch task</p>
                    
                    <h6>Request Body</h6>
                    <pre><code class="language-json">{
  "type": "HTTP_GET",
  "urls": [
    "https://example.com",
    "https://example.org"
  ],
  "options": {
    "timeout": 30,
    "headers": {
      "User-Agent": "BatchGo/1.0"
    }
  }
}</code></pre>
                </div>
            </div>
        </section>
        
        <section id="siterankgo" class="mb-5">
            <h2>SiteRankGo</h2>
            <div class="endpoint-card">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-2">
                        <span class="method-badge method-post me-2">POST</span>
                        <code>/api/v1/siterankgo/queries</code>
                    </div>
                    <p class="mb-2">Create a new site rank query</p>
                    
                    <h6>Request Body</h6>
                    <pre><code class="language-json">{
  "url": "https://example.com",
  "metrics": ["global_rank", "traffic", "engagement"],
  "params": {
    "country": "US"
  }
}</code></pre>
                </div>
            </div>
        </section>
        
        <section id="adscentergo" class="mb-5">
            <h2>AdsCenterGo</h2>
            <div class="endpoint-card">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-2">
                        <span class="method-badge method-get me-2">GET</span>
                        <code>/api/v1/adscentergo/analytics</code>
                    </div>
                    <p class="mb-2">Get ad analytics data</p>
                    
                    <h6>Query Parameters</h6>
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Parameter</th>
                                <th>Type</th>
                                <th>Required</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>account_id</td>
                                <td>string</td>
                                <td>Yes</td>
                                <td>Ad account ID</td>
                            </tr>
                            <tr>
                                <td>start_date</td>
                                <td>string</td>
                                <td>Yes</td>
                                <td>Start date (YYYY-MM-DD)</td>
                            </tr>
                            <tr>
                                <td>end_date</td>
                                <td>string</td>
                                <td>Yes</td>
                                <td>End date (YYYY-MM-DD)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
        
        <section id="errors" class="mb-5">
            <h2>Errors</h2>
            <div class="card">
                <div class="card-body">
                    <h5>Error Response Format</h5>
                    <pre><code class="language-json">{
  "code": 400,
  "message": "Bad Request",
  "data": {
    "field": "email",
    "error": "email is required"
  }
}</code></pre>
                    
                    <h6 class="mt-3">Common Error Codes</h6>
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>400</td>
                                <td>Bad Request</td>
                            </tr>
                            <tr>
                                <td>401</td>
                                <td>Unauthorized</td>
                            </tr>
                            <tr>
                                <td>403</td>
                                <td>Forbidden</td>
                            </tr>
                            <tr>
                                <td>404</td>
                                <td>Not Found</td>
                            </tr>
                            <tr>
                                <td>422</td>
                                <td>Validation Error</td>
                            </tr>
                            <tr>
                                <td>429</td>
                                <td>Too Many Requests</td>
                            </tr>
                            <tr>
                                <td>500</td>
                                <td>Internal Server Error</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
</body>
</html>
`

	ctx.Header("Content-Type", "text/html")
	ctx.String(200, referenceHTML)
}

// @Router /api/docs/generate [post]
func (c *DocsController) GenerateDocs(ctx *gf.GinCtx) {
	// 重新生成文档
	if err := GenerateAPIDocs(); err != nil {
		gf.Error().SetMsg("生成文档失败: " + err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetMsg("文档生成成功").Regin(ctx)
}

// @Router /api/docs/stats [get]
func (c *DocsController) GetStats(ctx *gf.GinCtx) {
	stats := gf.Map{
		"total_endpoints": 0,
		"total_models":    0,
		"last_updated":    gf.Now(),
		"documentation": gf.Map{
			"swagger":   "/api/docs/swagger.json",
			"redoc":     "/api/docs/redoc",
			"postman":   "/api/docs/postman",
			"openapi":   "/api/docs/openapi.json",
			"reference": "/api/docs/api-reference",
		},
	}

	gf.Success().SetData(stats).Regin(ctx)
}
