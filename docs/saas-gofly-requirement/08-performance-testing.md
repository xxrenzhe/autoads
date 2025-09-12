# 性能测试方案

## 1. 测试概述

### 1.1 测试目标

Linus式简化测试：只验证核心功能是否正常

> **⚠️ 性能目标说明**：以下目标为理想状态，**实际可达成的性能需要通过测试确定**

- **响应时间**：P95 < 200ms*（需验证）
- **吞吐量**：核心接口 > 500 QPS*（需验证）
- **并发用户**：支持100并发用户*（需验证）
- **错误率**：< 0.1%*（需验证）
- **资源利用率**：CPU < 70%，内存 < 80%*（需验证）

*注：实际性能取决于GoFly框架的实现质量和具体业务逻辑复杂度

### 1.2 测试范围

1. **Google登录接口**：OAuth回调
2. **核心业务接口**：BatchGo、SiteRankGo
3. **Token操作接口**：余额查询、消费记录
4. **基础查询接口**：简单列表查询

## 2. 测试环境配置

### 2.1 硬件配置

**单服务器配置**（模拟ClawCloud 2C4G）
- CPU：2核
- 内存：4GB
- 磁盘：SSD 50GB
- 网络：千兆

### 2.2 软件配置

- **操作系统**：Ubuntu 22.04 LTS
- **Go版本**：1.21+
- **数据库**：MySQL 8.0
- **测试工具**：wrk

### 2.3 网络拓扑

```
[负载生成器] → [负载均衡] → [应用服务器集群] → [数据库]
                      ↓
                  [监控收集]
```

## 3. 测试工具选择

### 3.1 Vegeta（HTTP压力测试）

**优势**
- 简单易用，单二进制文件
- 支持自定义攻击速率
- 详细的性能指标
- 支持分布式测试

**使用场景**
- API基准测试
- 稳定性测试
- 容量规划

**安装**
```bash
# 下载安装
wget https://github.com/tsenart/vegeta/releases/download/v12.8.4/vegeta_12.8.4_linux_amd64.tar.gz
tar -xvf vegeta_12.8.4_linux_amd64.tar.gz
sudo mv vegeta /usr/local/bin/
```

### 3.2 JMeter（综合性能测试）

**优势**
- 图形化界面
- 支持复杂测试场景
- 丰富的插件生态
- 支持分布式测试

**使用场景**
- 复杂业务流程测试
- 数据库性能测试
- 前端性能测试

### 3.3 wrk（HTTP基准测试）

**优势**
- 轻量级
- 高性能
- 支持Lua脚本
- 多线程支持

**使用场景**
- 快速基准测试
- 单接口性能测试

## 4. 测试用例设计

### 4.1 认证性能测试

**测试目标**
- 登录接口并发性能
- JWT验证性能
- 权限检查性能

**测试脚本**
```bash
#!/bin/bash

# 登录接口测试
echo "POST /api/v1/auth/login" | vegeta attack -rate=100 -duration=30s -targets=targets.txt -output=login.bin

# JWT验证测试
echo "GET /api/v1/user/profile" | vegeta attack -rate=500 -duration=30s -header="Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" -targets=targets.txt -output=jwt.bin

# 生成报告
vegeta report login.bin
vegeta report jwt.bin
```

**预期结果**
- 登录接口：P95 < 200ms，成功率 > 99.9%
- JWT验证：P95 < 100ms，成功率 > 99.9%

### 4.2 业务接口性能测试

**BatchGo接口测试**

```go
package main

import (
	"fmt"
	"net/http"
	"strings"
	"time"
	
	"github.com/tsenart/vegeta/lib"
)

func main() {
	rate := 50 // 每秒50个请求
	duration := 30 * time.Second
	
	targets := make([]vegeta.Target, 0, 10)
	
	// 构造不同大小的批量任务
	urlCounts := []int{10, 50, 100}
	
	for _, count := range urlCounts {
		urls := make([]string, count)
		for i := 0; i < count; i++ {
			urls[i] = fmt.Sprintf("https://test%d.com", i)
		}
		
		body := fmt.Sprintf(`{"urls":%q}`, urls)
		
		targets = append(targets, vegeta.Target{
			Method: "POST",
			URL:    "http://localhost:8080/api/v1/batchgo/tasks",
			Body:   []byte(body),
			Header: http.Header{
				"Content-Type":   []string{"application/json"},
				"Authorization": []string{"Bearer test-token"},
			},
		})
	}
	
	// 执行测试
	attacker := vegeta.NewAttacker()
	var results vegeta.Results
	
	for res := range attacker.Attack(vegeta.NewStaticTargeter(targets...), vegeta.Constant(rate{Freq: rate, Per: time.Second}), duration, "BatchGo Test") {
		results = append(results, res)
	}
	
	// 输出结果
	metrics := vegeta.NewMetrics(results)
	fmt.Printf("BatchGo Performance:\n")
	fmt.Printf("  Requests: %d\n", metrics.Requests)
	fmt.Printf("  Duration: %v\n", metrics.Duration)
	fmt.Printf("  Success Rate: %.2f%%\n", (1-metrics.Errors)*100)
	fmt.Printf("  P95 Latency: %v\n", metrics.Latencies.P95)
	fmt.Printf("  QPS: %.2f\n", metrics.Throughput)
}
```

**SiteRankGo接口测试**

```bash
# 查询接口测试
cat > site_rank.txt << EOF
GET http://localhost:8080/api/v1/siterankgo/queries?page=1&page_size=20
GET http://localhost:8080/api/v1/siterankgo/queries?domain=example.com
GET http://localhost:8080/api/v1/siterankgo/queries?status=completed
EOF

vegeta attack -targets=site_rank.txt -rate=100 -duration=60s -output=siterank.bin
vegeta report siterank.bin
```

### 4.3 数据库性能测试

**连接池测试**

```go
// 测试数据库连接池性能
func TestDBConnectionPool(t *testing.T) {
	// 模拟并发查询
	queries := []string{
		"SELECT * FROM batch_tasks WHERE tenant_id = ? LIMIT 10",
		"SELECT COUNT(*) FROM site_rank_queries WHERE user_id = ?",
		"SELECT * FROM token_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
	}
	
	rate := vegeta.Rate{Freq: 200, Per: time.Second}
	duration := 60 * time.Second
	
	for i, query := range queries {
		target := vegeta.Target{
			Method: "GET",
			URL:    fmt.Sprintf("http://localhost:8080/api/v1/test/db-query?query_id=%d", i),
		}
		
		attacker := vegeta.NewAttacker()
		var results vegeta.Results
		
		// 错误处理：确保attack能正常启动
		ctx, cancel := context.WithTimeout(context.Background(), duration+30*time.Second)
		defer cancel()
		
		go func() {
			<-ctx.Done()
			attacker.Stop()
		}()
		
		for res := range attacker.Attack(vegeta.NewStaticTargeter(target), rate, duration, fmt.Sprintf("DB Query %d", i)) {
			results = append(results, res)
		}
		
		// 错误处理：检查是否有结果
		if len(results) == 0 {
			t.Errorf("DB Query %d: No results collected", i)
			continue
		}
		
		metrics := vegeta.NewMetrics(results)
		t.Logf("DB Query %d - P95: %v, QPS: %.2f, Success Rate: %.2f%%", 
			i, metrics.Latencies.P95, metrics.Throughput, (1-metrics.Errors)*100)
	}
}
```

**事务测试**

```go
// 测试Token消费事务性能
func TestTokenTransaction(t *testing.T) {
	rate := vegeta.Rate{Freq: 300, Per: time.Second}
	duration := 30 * time.Second
	
	target := vegeta.Target{
		Method: "POST",
		URL:    "http://localhost:8080/api/v1/tokens/consume",
		Body:   []byte(`{"amount": 10, "module": "batchgo", "action": "create_task"}`),
		Header: http.Header{
			"Content-Type":   []string{"application/json"},
			"Authorization": []string{"Bearer test-token"},
		},
	}
	
	attacker := vegeta.NewAttacker()
	var results vegeta.Results
	
	for res := range attacker.Attack(vegeta.NewStaticTargeter(target), rate, duration, "Token Transaction") {
		results = append(results, res)
	}
	
	metrics := vegeta.NewMetrics(results)
	t.Logf("Token Transaction - Success Rate: %.2f%%, P95: %v", (1-metrics.Errors)*100, metrics.Latencies.P95)
}
```

### 4.4 WebSocket性能测试

```go
package main

import (
	"fmt"
	"net/http"
	"sync"
	"time"
	
	"github.com/gorilla/websocket"
)

func main() {
	connections := 50
	messages := 1000
	
	var wg sync.WaitGroup
	latencies := make(chan time.Duration, connections*messages)
	
	start := time.Now()
	
	for i := 0; i < connections; i++ {
		wg.Add(1)
		go func(connID int) {
			defer wg.Done()
			
			// 建立WebSocket连接
			dialer := websocket.Dialer{}
			conn, _, err := dialer.Dial("ws://localhost:8080/ws/test", nil)
			if err != nil {
				fmt.Printf("Connection %d failed: %v\n", connID, err)
				return
			}
			defer conn.Close()
			
			// 发送和接收消息
			for j := 0; j < messages; j++ {
				msg := fmt.Sprintf(`{"type":"ping","conn_id":%d,"msg_id":%d}`, connID, j)
				
				sendTime := time.Now()
				if err := conn.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
					continue
				}
				
				// 等待响应
				_, _, err = conn.ReadMessage()
				if err == nil {
					latencies <- time.Since(sendTime)
				}
			}
		}(i)
	}
	
	wg.Wait()
	close(latencies)
	
	// 统计结果
	var totalLatency time.Duration
	count := 0
	for lat := range latencies {
		totalLatency += lat
		count++
	}
	
	avgLatency := totalLatency / time.Duration(count)
	totalTime := time.Since(start)
	
	fmt.Printf("WebSocket Test Results:\n")
	fmt.Printf("  Connections: %d\n", connections)
	fmt.Printf("  Messages: %d\n", messages*connections)
	fmt.Printf("  Total Time: %v\n", totalTime)
	fmt.Printf("  Avg Latency: %v\n", avgLatency)
	fmt.Printf("  Throughput: %.2f msg/s\n", float64(messages*connections)/totalTime.Seconds())
}
```

## 5. 性能监控（简化版）

### 5.1 基础监控

**使用系统自带工具**
```bash
# 查看CPU和内存
top

# 查看进程状态
ps aux

# 查看网络连接
netstat -an

# 查看磁盘使用
df -h
```

**关键指标**
- CPU使用率
- 内存使用量
- 响应时间（通过测试工具输出）

### 5.2 应用日志监控

**简单日志输出**
```go
// 在关键位置添加日志
log.Printf("INFO: Processed batch task %s in %v", taskID, duration)
log.Printf("ERROR: Failed to connect to database: %v", err)
```

## 6. 测试执行计划（简化版）

### 6.1 测试阶段

**阶段一：基础功能测试（半天）**
- 测试核心接口是否正常工作
- 验证基本功能

**阶段二：简单负载测试（半天）**
- 模拟20个并发用户
- 观察系统表现

### 6.2 测试数据准备

```sql
-- 生成10个测试用户
INSERT INTO users (email, google_id, role, token_balance)
VALUES 
    ('user1@test.com', 'google1', 'user', 100),
    ('user2@test.com', 'google2', 'user', 100),
    -- ... 共10个用户
```

## 7. 性能优化建议（简化版）

### 7.1 基础优化

**数据库索引**
```sql
-- 为常用查询字段添加索引
CREATE INDEX idx_user_id ON batch_tasks(user_id);
CREATE INDEX idx_created_at ON token_transactions(created_at);
```

**连接池配置**
```go
// 适中的连接池大小
db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
    PoolSize: 20,
    MaxIdleConns: 5,
})
```

## 8. 测试报告模板（简化版）

### 8.1 测试摘要

```
AutoAds 简化性能测试报告
=======================

测试时间：2024-01-01 10:00:00 - 2024-01-01 12:00:00
测试环境：单机2C4G
测试版本：v1.0.0

测试目标：
- P95响应时间 < 500ms
- QPS > 100
- 错误率 < 1%

> **⚠️ 重要声明**：以下测试结果为**模拟数据**，**实际结果需要通过真实测试获得**

预期测试结果*：
✅ P95响应时间：320ms*（待验证）
✅ 平均QPS：150*（待验证）
✅ 错误率：0.2%*（待验证）
✅ 资源使用正常*（待验证）
```

### 8.2 详细结果

> **以下数据为示例格式，实际测试时需要替换为真实数据**

**核心接口性能**
| 接口 | QPS* | P95(ms)* | 成功率(%)* |
|------|-----|---------|-----------|
| /api/v1/auth/google | 200* | 150* | 99.8* |
| /api/v1/batchgo/tasks | 100* | 400* | 99.5* |
| /api/v1/siterankgo/queries | 180* | 280* | 99.9* |

**资源使用情况**
| 指标 | 平均值* | 峰值* |
|------|--------|------|
| CPU使用率 | 35%* | 60%* |
| 内存使用率 | 50%* | 70%* |

*注：标记为需要通过实际测试验证的数据

## 9. 持续性能测试（简化版）

### 9.1 简单测试脚本

```bash
#!/bin/bash
# 每次发布前运行

# 启动服务
./autoads-server &
SERVER_PID=$!
sleep 10

# 运行压力测试
wrk -t4 -c20 -d30s http://localhost:3000/api/v1/batchgo/tasks

# 停止服务
kill $SERVER_PID

# 检查结果是否满足要求
```

通过以上简化的性能测试方案，遵循Linus的原则，只测试必要的指标，确保系统基本可用即可。