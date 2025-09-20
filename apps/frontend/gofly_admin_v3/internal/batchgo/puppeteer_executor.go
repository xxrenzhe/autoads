package batchgo

import (
    "bytes"
    "encoding/json"
    "errors"
    "fmt"
    "net/http"
    "os"
    "time"
)

// BrowserExecutor 定义浏览器执行器接口
type BrowserExecutor interface {
    Visit(url string) (bool, error)
}

// HTTPPuppeteerExecutor 通过HTTP调用外部 Puppeteer 服务
type HTTPPuppeteerExecutor struct {
    base   string
    client *http.Client
}

func NewHTTPPuppeteerExecutor(base string) *HTTPPuppeteerExecutor {
    if base == "" { return nil }
    return &HTTPPuppeteerExecutor{
        base:   base,
        client: &http.Client{ Timeout: 45 * time.Second },
    }
}

func (e *HTTPPuppeteerExecutor) Visit(target string) (bool, error) {
    payload := map[string]string{"url": target}
    b, _ := json.Marshal(payload)
    req, err := http.NewRequest("POST", fmt.Sprintf("%s/visit", e.base), bytes.NewReader(b))
    if err != nil { return false, err }
    req.Header.Set("content-type", "application/json")
    resp, err := e.client.Do(req)
    if err != nil { return false, err }
    defer resp.Body.Close()
    if resp.StatusCode >= 200 && resp.StatusCode < 300 { return true, nil }
    return false, errors.New(resp.Status)
}

// helper: 从环境变量创建执行器
func newPuppeteerExecutorFromEnv() BrowserExecutor {
    base := os.Getenv("PUPPETEER_EXECUTOR_URL")
    if base == "" { return nil }
    return NewHTTPPuppeteerExecutor(base)
}

