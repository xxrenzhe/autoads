// services/siterank/cmd/server/main.go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
)

var ctx = context.Background()
var rdb *redis.Client

type AnalyzeRequest struct {
	UserID  string `json:"user_id"`
	OfferID string `json:"offer_id"`
	URL     string `json:"url"`
}

type AnalyzeResponse struct {
	AnalysisID string `json:"analysis_id"`
}

type SiterankAnalysisCompletedEvent struct {
	OfferID       string  `json:"offer_id"`
	SiterankScore float64 `json:"siterank_score"`
	Timestamp     time.Time `json:"timestamp"`
}

func analyzeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("Received analysis request for offer %s (URL: %s) by user %s", req.OfferID, req.URL, req.UserID)

	analysisID := fmt.Sprintf("analysis_%s_%d", req.OfferID, time.Now().Unix())

	go func() {
		log.Printf("Starting async analysis for %s...", analysisID)
		time.Sleep(5 * time.Second) // Simulate work

		// Generate a mock score
		score := 50 + rand.Float64()*(50) // Score between 50 and 100

		event := SiterankAnalysisCompletedEvent{
			OfferID:       req.OfferID,
			SiterankScore: score,
			Timestamp:     time.Now(),
		}

		eventData, err := json.Marshal(event)
		if err != nil {
			log.Printf("Error marshaling event for %s: %v", analysisID, err)
			return
		}

		// Publish event to Redis Pub/Sub
		err = rdb.Publish(ctx, "siterank-events", eventData).Err()
		if err != nil {
			log.Printf("Error publishing event for %s: %v", analysisID, err)
			return
		}

		log.Printf("Finished async analysis for %s. Score: %.2f. Event published.", analysisID, score)
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(AnalyzeResponse{AnalysisID: analysisID})
}

func main() {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}
	
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("could not parse redis url: %v", err)
	}

	rdb = redis.NewClient(opt)

	_, err = rdb.Ping(ctx).Result()
    if err != nil {
        log.Fatalf("Could not connect to Redis: %v", err)
    }
	log.Println("Successfully connected to Redis.")


	http.HandleFunc("/v1/siterank/analyze", analyzeHandler)

	port := 8080
	log.Printf("Siterank service starting on port %d", port)

	if err := http.ListenAndServe(fmt.Sprintf(":%d", port), nil); err != nil {
		log.Fatalf("could not start server: %v", err)
	}
}
