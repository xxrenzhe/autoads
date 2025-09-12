# SiteRankGo SimilarWeb API 集成使用示例

SiteRankGo 已成功集成 SimilarWeb API，提供网站流量和排名数据查询功能。

## 1. 获取单个网站的流量数据

### 请求示例

```bash
curl -X GET "http://localhost:8080/api/v1/siterankgo/traffic?domain=example.com" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "domain": "example.com",
    "global_rank": 1500,
    "category": "News and Media",
    "category_rank": 50,
    "country": "US",
    "country_rank": 200,
    "visits": 15.5,
    "engagement": 0.85,
    "rank_change": -5,
    "engagement_time": 3.5,
    "page_per_visit": 2.8,
    "bounce_rate": 45.2,
    "similar_sites": [
      "similar-site-1.com",
      "similar-site-2.com"
    ],
    "traffic_sources": {
      "organic": 45.3,
      "paid": 12.5,
      "social": 18.7,
      "referral": 15.2,
      "mail": 5.3,
      "direct": 3.0
    }
  }
}
```

## 2. 批量查询多个网站

### 请求示例

```bash
curl -X POST "http://localhost:8080/api/v1/siterankgo/traffic/batch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "domains": [
      "example.com",
      "google.com",
      "facebook.com"
    ]
  }'
```

### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "results": {
      "example.com": {
        "domain": "example.com",
        "global_rank": 1500,
        "visits": 15.5,
        "category": "News and Media"
      },
      "google.com": {
        "domain": "google.com",
        "global_rank": 1,
        "visits": 89500.5,
        "category": "Search Engines"
      },
      "facebook.com": {
        "domain": "facebook.com",
        "global_rank": 3,
        "visits": 25400.2,
        "category": "Social Networks"
      }
    },
    "count": 3
  }
}
```

## 3. 获取查询历史

### 请求示例

```bash
curl -X GET "http://localhost:8080/api/v1/siterankgo/traffic/history?domain=example.com&days=30" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "history": [
      {
        "id": "task-uuid-1",
        "name": "流量查询-example.com",
        "domain": "example.com",
        "status": "COMPLETED",
        "created_at": "2024-01-15T10:30:00Z",
        "config": {
          "api_response": "{\"source\":\"similarweb\",\"global_rank\":1500,...}"
        }
      },
      {
        "id": "task-uuid-2",
        "name": "流量查询-example.com",
        "domain": "example.com",
        "status": "COMPLETED",
        "created_at": "2024-01-10T15:45:00Z",
        "config": {
          "api_response": "{\"source\":\"similarweb\",\"global_rank\":1505,...}"
        }
      }
    ],
    "domain": "example.com",
    "days": 30
  }
}
```

## 4. 错误处理

### 常见错误响应

**1. 未授权**
```json
{
  "code": 401,
  "message": "未授权访问"
}
```

**2. Token余额不足**
```json
{
  "code": 403,
  "message": "Token余额不足，需要100个Token"
}
```

**3. API调用失败**
```json
{
  "code": 500,
  "message": "API request failed with status 404: Not Found"
}
```

## 5. JavaScript/Frontend 调用示例

### 使用 Fetch API

```javascript
// 获取单个网站流量数据
async function getWebsiteTraffic(domain) {
  const response = await fetch(`/api/v1/siterankgo/traffic?domain=${domain}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  if (!response.ok) {
    throw new Error('获取流量数据失败');
  }
  
  return await response.json();
}

// 批量查询
async function batchGetTrafficData(domains) {
  const response = await fetch('/api/v1/siterankgo/traffic/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ domains })
  });
  
  if (!response.ok) {
    throw new Error('批量查询失败');
  }
  
  return await response.json();
}

// 使用示例
(async () => {
  try {
    // 查询单个网站
    const data = await getWebsiteTraffic('example.com');
    console.log('网站流量数据:', data.data);
    
    // 批量查询
    const batchData = await batchGetTrafficData(['example.com', 'google.com']);
    console.log('批量查询结果:', batchData.data);
  } catch (error) {
    console.error('查询失败:', error.message);
  }
})();
```

### 使用 Axios

```javascript
import axios from 'axios';

// 配置默认认证
const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});

// 获取网站流量数据
export const getWebsiteTraffic = async (domain) => {
  const response = await api.get('/siterankgo/traffic', {
    params: { domain }
  });
  return response.data;
};

// 批量获取网站流量数据
export const batchGetTrafficData = async (domains) => {
  const response = await api.post('/siterankgo/traffic/batch', {
    domains
  });
  return response.data;
};

// 获取查询历史
export const getTrafficHistory = async (domain, days = 30) => {
  const response = await api.get('/siterankgo/traffic/history', {
    params: { domain, days }
  });
  return response.data;
};
```

## 6. Python 调用示例

```python
import requests
import json

# 配置
BASE_URL = "http://localhost:8080/api/v1"
TOKEN = "your-jwt-token"

headers = {
    "Authorization": f"Bearer {TOKEN}"
}

# 获取单个网站流量数据
def get_website_traffic(domain):
    url = f"{BASE_URL}/siterankgo/traffic"
    params = {"domain": domain}
    
    response = requests.get(url, headers=headers, params=params)
    if response.status_code == 200:
        return response.json()["data"]
    else:
        raise Exception(f"请求失败: {response.json()}")

# 批量查询
def batch_get_traffic(domains):
    url = f"{BASE_URL}/siterankgo/traffic/batch"
    data = {"domains": domains}
    
    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 200:
        return response.json()["data"]
    else:
        raise Exception(f"请求失败: {response.json()}")

# 使用示例
if __name__ == "__main__":
    try:
        # 查询单个网站
        traffic_data = get_website_traffic("example.com")
        print(f"全球排名: {traffic_data['global_rank']}")
        print(f"月访问量: {traffic_data['visits']}M")
        
        # 批量查询
        domains = ["example.com", "google.com", "facebook.com"]
        batch_data = batch_get_traffic(domains)
        
        for domain, data in batch_data["results"].items():
            if isinstance(data, dict) and "global_rank" in data:
                print(f"{domain}: 排名 {data['global_rank']}")
            else:
                print(f"{domain}: 查询失败 - {data.get('error', '未知错误')}")
                
    except Exception as e:
        print(f"错误: {e}")
```

## 7. 环境变量配置

确保在部署环境中设置以下环境变量：

```bash
# SimilarWeb API 配置
export SIMILARWEB_API_URL="https://data.similarweb.com/api/v1/data"
export SIMILARWEB_API_KEY="your-similarweb-api-key"

# 数据库和Redis配置
export DATABASE_URL="mysql://user:password@localhost:3306/autoads_gofly"
export REDIS_URL="redis://localhost:6379"
```

## 8. 监控和日志

### 关键指标监控

```bash
# 查看API调用成功率和响应时间
grep "similarweb_request_success" runtime/log/*.log | tail -n 10

# 查看API调用失败
grep "similarweb_api_error" runtime/log/*.log | tail -n 10

# 查看Token消耗统计
grep "token_deduct_failed" runtime/log/*.log | tail -n 10
```

### 性能优化建议

1. **批量查询**: 尽量使用批量接口减少API调用次数
2. **缓存利用**: 避免短时间内重复查询相同域名
3. **错误重试**: 实现自动重试机制处理临时错误
4. **监控告警**: 设置API调用失败率告警