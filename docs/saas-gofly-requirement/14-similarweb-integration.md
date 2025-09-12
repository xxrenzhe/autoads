# SimilarWeb API Integration Guide

## Overview

> **⚠️ 重要警告**：本文档描述的SimilarWeb API集成方案**基于公开信息和假设**。**实际实施前必须验证以下内容：**
> - SimilarWeb是否提供公开API
> - API的实际端点和认证方式
> - 付费要求和调用限制
> - 响应数据格式的准确性

The SiteRankGo module plans to integrate with the SimilarWeb API to provide accurate website traffic and ranking data.

## Configuration

### Environment Variables

> **⚠️ 以下配置基于假设，需要根据SimilarWeb官方文档调整**

Add the following environment variable to your `.env` file:

```env
# SimilarWeb API Configuration (需要验证)
SIMILARWEB_API_URL="https://data.similarweb.com/api/v1/data"  # 需确认实际URL
SIMILARWEB_API_KEY="your-api-key-here"  # 如果需要API密钥
```

- `SIMILARWEB_API_URL`: The base URL for the SimilarWeb API (待验证)
- `SIMILARWEB_API_KEY`: API key for authentication (如果需要)

## API Integration Details

### Request Format

The integration makes HTTP GET requests to the SimilarWeb API with the following parameters:

```
GET {SIMILARWEB_API_URL}?domain={domain}&country={country}
```

### Headers

- `Accept`: application/json
- `User-Agent`: AutoAds-SaaS/1.0

### Response Format

> **⚠️ 以下响应格式为推测，需要根据实际API文档调整**

The API is expected to return JSON data with the following fields*:

```json
{
  "GlobalRank": 12345,        // *需要验证字段名
  "CategoryRank": 678,        // *需要验证字段名
  "Category": "News and Media",  // *需要验证字段名
  "CountryRank": 901,        // *需要验证字段名
  "CountryCode": "US",       // *需要验证字段名
  "Visits": 1234567.89,      // *需要验证字段名
  "PageViews": 2345678.90,   // *需要验证字段名
  "BounceRate": 45.67,       // *需要验证字段名
  "VisitDuration": 123.45,   // *需要验证字段名
  "SEORank": 12,             // *需要验证是否存在此字段
  "Backlinks": 34567
}
```

## Implementation Features

### Error Handling

- HTTP status code validation
- Request timeout (30 seconds)
- JSON parsing error handling
- Empty data detection

### Rate Limiting

The implementation includes built-in rate limiting:
- Batch processing: 10 domains per batch
- Random delay between batches: 2-5 seconds
- Prevents API overload

### Data Validation

- Validates domain format
- Checks for required fields in response
- Handles missing or null values gracefully

## Usage Example

```go
// Create service instance
service := siterank.NewService(db, tokenService)

// Query SimilarWeb data
result, err := service.QuerySimilarWeb("example.com", "US")
if err != nil {
    log.Printf("Error querying SimilarWeb: %v", err)
    return
}

fmt.Printf("Global Rank: %d\n", *result.GlobalRank)
fmt.Printf("Category: %s\n", result.Category)
fmt.Printf("Visits: %.2f\n", *result.Visits)
```

## Testing

To test the integration:

1. Set up environment variables in your `.env` file
2. Run the SiteRank task with test domains
3. Check the results in the database
4. Verify the API calls in the logs

## Migration from Simulated Data

The migration from simulated to real API integration is seamless:

1. No database schema changes required
2. Existing tasks continue to work
3. Same response format maintained
4. Only the data source changes

## Troubleshooting

### Common Issues

1. **Rate Limit Errors**
   - Check if you're exceeding API limits
   - Adjust batch size and delay settings if needed

2. **Invalid Domain**
   - Validate domain format before making requests
   - Handle special characters and subdomains properly

3. **Network Timeouts**
   - Check internet connectivity
   - Verify firewall settings
   - Adjust timeout value if needed

### Debug Mode

Enable debug logging to troubleshoot API issues:

```env
LOG_LEVEL=debug
```

This will log detailed information about API requests and responses.

## Security Considerations

- Requests use HTTPS for secure communication
- Error messages don't expose sensitive information
- User-Agent identifies the application properly

## Future Enhancements

> **⚠️ 以下增强功能基于SimilarWeb API能力的假设**

Potential improvements for the future:

1. **Caching Layer**: Implement caching to reduce API calls
2. **Batch API**: Use SimilarWeb's batch endpoint*（如果存在）
3. **Historical Data**: Store historical data for trend analysis
4. **Additional Metrics**: Add more SimilarWeb metrics as needed*（取决于API支持）
5. **Webhook Support**: Real-time updates for domain changes*（如果API支持）

## 建议的验证步骤

1. **第一步：确认API可用性**
   - 访问SimilarWeb开发者网站
   - 查看API文档和定价
   - 注册开发者账号（如果需要）

2. **第二步：测试基础功能**
   - 使用Postman或curl测试API端点
   - 验证认证方式
   - 检查响应数据格式

3. **第三步：评估成本**
   - 了解调用限制和费用
   - 估算项目使用量
   - 制定预算计划