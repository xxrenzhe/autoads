
package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"github.com/xxrenzhe/autoads/services/siterank/internal/events"
	"github.com/xxrenzhe/autoads/pkg/logger"
)

var (
	db  *sql.DB
	ctx = context.Background()
	log = logger.Get()
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal().Msg("DATABASE_URL is not set")
	}
	var err error
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
	
	port := os.Getenv("PORT")
	if port == "" { port = "8080" }
	log.Info().Str("port", port).Msg("Siterank service starting...")
	if err := http.ListenAndServe(":"+port, mux); err != nil {
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
