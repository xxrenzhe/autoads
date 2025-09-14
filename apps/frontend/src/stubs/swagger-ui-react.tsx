// Lightweight stub for swagger-ui-react to allow offline builds.
// It avoids bundling the heavy dependency and network fetches.
import React from 'react'

const SwaggerUIStub: React.FC<any> = (props) => {
  return (
    <div id="swagger-ui" style={{ padding: 16 }}>
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        color: '#334155'
      }}>
        Swagger UI 在离线构建环境中被禁用。<br />
        如需启用交互式文档，请安装依赖并联网构建：
        <code style={{ marginLeft: 8 }}>npm i swagger-ui-react</code>
      </div>
    </div>
  )
}

export default SwaggerUIStub

