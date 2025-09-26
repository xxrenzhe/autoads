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
    _ "github.com/lib/pq"
    "github.com/xxrenzhe/autoads/pkg/errors"
    "github.com/xxrenzhe/autoads/pkg/logger"
    "github.com/xxrenzhe/autoads/pkg/middleware"
    adsconfig "github.com/xxrenzhe/autoads/services/adscenter/internal/config"
)

type Campaign struct {
	Name string `json:"name"`
}

var (
	db  *sql.DB
	rdb *redis.Client
	ctx = context.Background()
	log = logger.Get()
)

func main() {
    // Load config (DATABASE_URL may come from Secret Manager)
    cfg, err := adsconfig.Load(context.Background())
    if err != nil {
        log.Fatal().Err(err).Msg("Error loading config")
    }
    db, err = sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Error connecting to the database")
	}
	defer db.Close()
	err = db.Ping()
	if err != nil {
		log.Fatal().Err(err).Msg("Error pinging the database at startup")
	}
	log.Info().Msg("Successfully connected to the database!")

    // Redis is optional in local; only initialize when REDIS_URL is present
    redisURL := os.Getenv("REDIS_URL")
    var opt *redis.Options
    var rerr error
    if redisURL != "" {
        opt, err = redis.ParseURL(redisURL)
        rerr = err
    }
    if rerr == nil && opt != nil {
        rdb = redis.NewClient(opt)
        if _, err = rdb.Ping(ctx).Result(); err == nil {
            log.Info().Msg("Successfully connected to Redis!")
        } else {
            log.Warn().Err(err).Msg("Redis configured but not reachable")
        }
    } else {
        log.Info().Msg("REDIS_URL not set; skipping Redis init")
    }

    mux := http.NewServeMux()
    mux.HandleFunc("/healthz", healthCheckHandler)
    mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
        c, cancel := context.WithTimeout(r.Context(), 800*time.Millisecond)
        defer cancel()
        if err := db.PingContext(c); err != nil {
            errors.Write(w, r, http.StatusInternalServerError, "NOT_READY", "dependencies not ready", map[string]string{"db": err.Error()})
            return
        }
        w.WriteHeader(http.StatusOK)
    })

    protected := http.NewServeMux()
    protected.HandleFunc("/adscenter/campaigns", createCampaignHandler)

    // Firebase Auth middleware
    mux.Handle("/", middleware.AuthMiddleware(protected))

    log.Info().Str("port", cfg.Port).Msg("Adscenter service starting...")
    if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
        log.Fatal().Err(err).Msg("Failed to start server")
    }
}

// no-op helpers removed

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

func createCampaignHandler(w http.ResponseWriter, r *http.Request) {
    userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	var campaign Campaign
	if err := json.NewDecoder(r.Body).Decode(&campaign); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", err.Error(), nil); return }
	log.Info().Str("userID", userID).Str("campaignName", campaign.Name).Msg("Adscenter campaign created")
	w.WriteHeader(http.StatusCreated)
}
