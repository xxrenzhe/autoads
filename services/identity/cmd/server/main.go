package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/golang-jwt/jwt/v4"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/xxrenzhe/autoads/pkg/config"
	"github.com/xxrenzhe/autoads/pkg/eventbus"
	"github.com/xxrenzhe/autoads/pkg/logger"
	"github.com/xxrenzhe/autoads/pkg/middleware"
	"golang.org/x/crypto/bcrypt"
)

// ... (User struct and global variables remain the same)
type User struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	Name         string `json:"name"`
	PasswordHash string `json:"-"`
}

var (
	db  *sql.DB
	rdb *redis.Client
	ctx = context.Background()
	log = logger.Get()
	publisher *eventbus.Publisher
)

func main() {
	// ... (Config, DB, Redis setup remains the same)
	cfg, err := config.LoadConfig("config.yaml")
	if err != nil {
		log.Fatal().Err(err).Msg("Error loading config")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal().Msg("DATABASE_URL is not set")
	}
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Error connecting to the database")
	}
	defer db.Close()
	err = db.Ping()
	if err != nil {
		log.Fatal().Err(err).Msg("Error pinging the database at startup")
	}
	log.Info().Msg("Successfully connected to the database!")

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		log.Fatal().Msg("REDIS_URL is not set")
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Error parsing Redis URL")
	}
	rdb = redis.NewClient(opt)
	_, err = rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatal().Err(err).Msg("Error pinging Redis at startup")
	}
	log.Info().Msg("Successfully connected to Redis!")


	publisher = eventbus.NewPublisher(rdb)

	mux := http.NewServeMux()

	rateLimitMiddleware := middleware.RateLimitMiddleware(rdb, 10, time.Minute)
	mux.Handle("/login", rateLimitMiddleware(http.HandlerFunc(loginHandler)))
	mux.HandleFunc("/register", registerHandler)
	mux.HandleFunc("/healthz", healthCheckHandler)

	protectedRoutes := http.NewServeMux()
	protectedRoutes.HandleFunc("/users", getUsersHandler)
	protectedRoutes.HandleFunc("/me", getCurrentUserHandler)

	mux.Handle("/", middleware.AuthMiddleware(protectedRoutes))

	log.Info().Str("port", cfg.Server.Port).Msg("Identity service starting...")
	if err := http.ListenAndServe(":"+cfg.Server.Port, mux); err != nil {
		log.Fatal().Err(err).Msg("Failed to start server")
	}
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Error().Err(err).Msg("Failed to hash password")
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	userID := uuid.New().String()
	payload := map[string]interface{}{
		"userID":       userID,
		"email":        req.Email,
		"name":         req.Name,
		"passwordHash": string(hashedPassword),
	}
	payloadJSON, _ := json.Marshal(payload)

	tx, err := db.Begin()
	if err != nil {
		log.Error().Err(err).Msg("Failed to begin transaction")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(
		`INSERT INTO "Event" (id, "aggregateId", "aggregateType", "eventType", payload, version) VALUES ($1, $2, $3, $4, $5, 1)`,
		uuid.New().String(), userID, "User", "UserRegistered", payloadJSON,
	)

	if err != nil {
		tx.Rollback()
		log.Error().Err(err).Msg("Failed to insert event")
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		log.Error().Err(err).Msg("Failed to commit transaction")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	publisher.Publish(ctx, "UserRegistered", payload)

	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"userID": userID})
}

// ... (other handlers remain the same)
func loginHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var user User
	err := db.QueryRow(`SELECT id, "passwordHash" FROM "User" WHERE email = $1`, req.Email).Scan(&user.ID, &user.PasswordHash)
	if err != nil {
		log.Warn().Err(err).Str("email", req.Email).Msg("Failed login attempt: user not found")
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		log.Warn().Str("email", req.Email).Msg("Failed login attempt: invalid password")
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	jwtSecret := os.Getenv("INTERNAL_JWT_SECRET")
	if jwtSecret == "" {
		log.Error().Msg("JWT secret not configured")
		http.Error(w, "JWT secret not configured", http.StatusInternalServerError)
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userID": user.ID,
		"exp":    time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate token")
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	log.Info().Str("userID", user.ID).Msg("User logged in successfully")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": tokenString})
}
func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	dbErr := db.Ping()
	redisErr := rdb.Ping(ctx).Err()
	if dbErr != nil || redisErr != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, "Health check failed:\n")
		if dbErr != nil {
			fmt.Fprintf(w, "  - Database error: %v\n", dbErr)
		}
		if redisErr != nil {
			fmt.Fprintf(w, "  - Redis error: %v\n", redisErr)
		}
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK")
}

func getCurrentUserHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey)
	if userID == nil {
		http.Error(w, "User ID not found in context", http.StatusInternalServerError)
		return
	}
	fmt.Fprintf(w, "Your user ID is: %s", userID)
}


func getUsersHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, email, name FROM \"User\"")
	if err != nil {
		http.Error(w, fmt.Sprintf("Error querying users: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name); err != nil {
			http.Error(w, fmt.Sprintf("Error scanning user: %v", err), http.StatusInternalServerError)
			return
		}
		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
