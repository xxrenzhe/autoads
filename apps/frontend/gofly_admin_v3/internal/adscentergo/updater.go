package adscentergo

import (
    "bytes"
    "encoding/json"
    "errors"
    "fmt"
    "net"
    "net/http"
    "time"
)

// AdsUpdater 定义 AdsCenter 外部更新器接口
type AdsUpdater interface {
    Update(link string) (bool, string, error) // returns success, classification, error
}

// HTTPAdsUpdater 通过 HTTP 调用外部更新服务
type HTTPAdsUpdater struct {
    base   string
    client *http.Client
}

func NewHTTPAdsUpdater(base string) AdsUpdater {
    if base == "" { return nil }
    return &HTTPAdsUpdater{ base: base, client: &http.Client{ Timeout: 20 * time.Second } }
}

func (u *HTTPAdsUpdater) Update(link string) (bool, string, error) {
    body := map[string]string{"link": link}
    b, _ := json.Marshal(body)
    req, err := http.NewRequest("POST", fmt.Sprintf("%s/update", u.base), bytes.NewReader(b))
    if err != nil { return false, "network_error", err }
    req.Header.Set("content-type", "application/json")
    resp, err := u.client.Do(req)
    if err != nil {
        if nerr, ok := err.(net.Error); ok && nerr.Timeout() {
            return false, "timeout", err
        }
        return false, "network_error", err
    }
    defer resp.Body.Close()
    // 分类
    if resp.StatusCode >= 200 && resp.StatusCode < 300 { return true, "success", nil }
    if resp.StatusCode >= 400 && resp.StatusCode < 500 { return false, "validation_error", errors.New(resp.Status) }
    return false, "upstream_error", errors.New(resp.Status)
}

