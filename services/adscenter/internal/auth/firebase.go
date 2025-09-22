package auth

import (
    "context"
    "log"
    "net/http"
    "strings"

    firebase "firebase.google.com/go/v4"
    "firebase.google.com/go/v4/auth"
    "google.golang.org/api/option"
    "os"
)

type userCtxKey string

// UserIDContextKey is the key for the user ID in the context.
const UserIDContextKey = userCtxKey("userID")

type Client struct{
    *auth.Client
}

func NewClient(ctx context.Context) *Client {
    creds := os.Getenv("FIREBASE_CREDENTIALS_FILE")
    if creds == "" { creds = "secrets/firebase-adminsdk.json" }
    opt := option.WithCredentialsFile(creds)
    app, err := firebase.NewApp(ctx, nil, opt)
    if err != nil { log.Fatalf("error initializing Firebase app: %v", err) }
    c, err := app.Auth(ctx)
    if err != nil { log.Fatalf("error getting Firebase Auth client: %v", err) }
    return &Client{c}
}

// Middleware verifies the Firebase ID token from Authorization header.
func (c *Client) Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            http.Error(w, "Authorization header required", http.StatusUnauthorized)
            return
        }
        idToken := strings.TrimPrefix(authHeader, "Bearer ")
        token, err := c.VerifyIDToken(r.Context(), idToken)
        if err != nil {
            log.Printf("error verifying ID token: %v", err)
            http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
            return
        }
        ctx := context.WithValue(r.Context(), UserIDContextKey, token.UID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
