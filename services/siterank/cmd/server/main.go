
package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"github.com/xxrenzhe/autoads/services/siterank/internal/events"
	"github.com/xxrenzhe/autoads/pkg/config"
	"github.com/xxrenzhe/autoads/pkg/logger"
)

var (
	db  *sql.DB
	ctx = context.Background()
	log = logger.Get()
)

func main() {
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

	// Initialize the Pub/Sub publisher.
	publisher, err := events.NewPublisher(ctx)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create event publisher")
	}
	defer publisher.Close()

	// Initialize the Pub/Sub subscriber, passing the publisher to it.
	subscriber, err := events.NewSubscriber(ctx, db, publisher)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create event subscriber")
	}

	// Start listening for events in a background goroutine.
	go subscriber.StartListening(ctx)

	// --- HTTP Server Setup ---
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthCheckHandler)
	
	log.Info().Str("port", cfg.Server.Port).Msg("Siterank service starting...")
	if err := http.ListenAndServe(":"+cfg.Server.Port, mux); err != nil {
		log.Fatal().Err(err).Msg("Failed to start server")
	}
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	err := db.Ping()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, "Health check failed: Database error: %v\n", err)
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK")
}
