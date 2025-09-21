package middleware

import (
	"bytes"
	"context"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/go-redis/redis/v8"
)

type responseWriter struct {
	http.ResponseWriter
	body *bytes.Buffer
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	rw.body.Write(b)
	return rw.ResponseWriter.Write(b)
}

func IdempotencyMiddleware(rdb *redis.Client, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		idempotencyKey := r.Header.Get("Idempotency-Key")
		if idempotencyKey == "" {
			next.ServeHTTP(w, r)
			return
		}

		ctx := context.Background()
		key := "idempotency:" + idempotencyKey

		// Check if the response is already cached
		cachedResponse, err := rdb.Get(ctx, key).Result()
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(cachedResponse))
			return
		}

		if err != redis.Nil {
			http.Error(w, "Failed to check idempotency key", http.StatusInternalServerError)
			return
		}

		// Wrap the response writer to capture the response
		rw := &responseWriter{ResponseWriter: w, body: &bytes.Buffer{}}
		next.ServeHTTP(rw, r)

		// Cache the response
		rdb.Set(ctx, key, rw.body.Bytes(), 24*time.Hour)
	})
}
