package middleware

import (
    "context"
    "net/http"

    "github.com/xxrenzhe/autoads/pkg/auth"
    "github.com/xxrenzhe/autoads/pkg/errors"
    "github.com/xxrenzhe/autoads/pkg/logger"
)

type contextKey string

const UserIDKey contextKey = "userID"

// AuthMiddleware is a placeholder for Firebase JWT validation.
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        _ = logger.Get()
        uid, err := auth.ExtractUserID(r)
        if err != nil || uid == "" {
            errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required", nil)
            return
        }
        // TODO: 可在此处做用户存在性检查与懒注册事件
        ctx := context.WithValue(r.Context(), UserIDKey, uid)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
