package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/xxrenzhe/autoads/pkg/logger"
)

type contextKey string

const UserIDKey contextKey = "userID"

// AuthMiddleware is a placeholder for Firebase JWT validation.
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log := logger.Get()
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header is required", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			http.Error(w, "Authorization header must be in 'Bearer {token}' format", http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]

		// TODO: Integrate Firebase Admin SDK to verify the tokenString
		// For now, we'll use a placeholder logic.
		// In a real implementation, you would get the UID from the verified token.
		//
		// Example with Firebase Admin SDK:
		// token, err := firebaseAuthClient.VerifyIDToken(r.Context(), tokenString)
		// if err != nil {
		//      http.Error(w, "Invalid token", http.StatusUnauthorized)
		//      return
		// }
		// userID := token.UID

		// Placeholder user ID for now
		userID := "placeholder-firebase-uid"
		log.Info().Str("userID", userID).Msg("User authenticated (placeholder)")


		// TODO: Add logic to check if the user exists in the database.
		// If not, publish a UserRegistered event.

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
