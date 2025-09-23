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

// userCtxKey is a custom type to use as a key for context values.
type userCtxKey string

// UserIDContextKey is the key for the user ID in the context.
const UserIDContextKey = userCtxKey("userID")

// Client holds the firebase auth client.
type Client struct {
	*auth.Client
}

// NewClient initializes and returns a new Firebase Auth client.
func NewClient(ctx context.Context) *Client {
    creds := os.Getenv("FIREBASE_CREDENTIALS_FILE")
    var app *firebase.App
    var err error
    if creds != "" {
        app, err = firebase.NewApp(ctx, nil, option.WithCredentialsFile(creds))
    } else {
        // Fallback to ADC on Cloud Run
        app, err = firebase.NewApp(ctx, nil)
    }
    if err != nil {
        log.Fatalf("error initializing Firebase app: %v\n", err)
    }

	authClient, err := app.Auth(ctx)
	if err != nil {
		log.Fatalf("error getting Firebase Auth client: %v\n", err)
	}

	return &Client{authClient}
}

// Middleware verifies the Firebase ID token from the Authorization header.
func (c *Client) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		idToken := strings.TrimPrefix(authHeader, "Bearer ")
		token, err := c.VerifyIDToken(context.Background(), idToken)
		if err != nil {
			log.Printf("Error verifying ID token: %v", err)
			http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		// Add user ID to context
		ctx := context.WithValue(r.Context(), UserIDContextKey, token.UID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
