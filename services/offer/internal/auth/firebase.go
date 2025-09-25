package auth

import (
    "context"
    "net/http"
    "github.com/xxrenzhe/autoads/pkg/auth"
)

// userCtxKey is a custom type to use as a key for context values.
type userCtxKey string

// UserIDContextKey is the key for the user ID in the context.
const UserIDContextKey = userCtxKey("userID")

// Client is a thin wrapper to keep constructor and method shape unchanged.
type Client struct{}

// NewClient initializes and returns a new Firebase Auth client.
func NewClient(ctx context.Context) *Client { return &Client{} }

// Middleware verifies the Firebase ID token from the Authorization header.
func (c *Client) Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        uid, err := auth.ExtractUserID(r)
        if err != nil || uid == "" {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }
        ctx := context.WithValue(r.Context(), UserIDContextKey, uid)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
