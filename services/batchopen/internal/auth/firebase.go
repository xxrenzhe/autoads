package auth

import (
    "context"
    "net/http"
    "github.com/xxrenzhe/autoads/pkg/auth"
)

type userCtxKey string

const UserIDContextKey = userCtxKey("userID")

type Client struct{}

func NewClient(ctx context.Context) *Client { return &Client{} }

func (c *Client) Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        uid, err := auth.ExtractUserID(r)
        if err != nil || uid == "" { http.Error(w, "Unauthorized", http.StatusUnauthorized); return }
        ctx := context.WithValue(r.Context(), UserIDContextKey, uid)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
