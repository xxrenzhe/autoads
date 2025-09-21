package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/go-redis/redis/v8"
)

func RateLimitMiddleware(rdb *redis.Client, limit int, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.Background()
			ip := r.RemoteAddr // In a real world scenario, you'd want to get the IP from X-Forwarded-For
			key := fmt.Sprintf("ratelimit:%s:%s", ip, r.URL.Path)

			count, err := rdb.Incr(ctx, key).Result()
			if err != nil {
				http.Error(w, "Failed to process request", http.StatusInternalServerError)
				return
			}

			if count == 1 {
				rdb.Expire(ctx, key, window)
			}

			if count > int64(limit) {
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
