// services/offer/main_test.go
package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/xxrenzhe/autoads/pkg/middleware"
)

// setupTestEnvironment loads necessary environment variables for the test.
func setupTestEnvironment() {
	os.Setenv("DATABASE_URL", "postgresql://user:password@host:port/db?sslmode=require")
	os.Setenv("GOOGLE_CLOUD_PROJECT", "your-gcp-project-id")
	os.Setenv("PUBSUB_TOPIC_ID", "domain-events")
	// Add other necessary env vars for subscribers if they are run in the same test process
}

// pollForOfferStatus repeatedly checks the database for the offer's status until it matches the expected status or times out.
func pollForOfferStatus(t *testing.T, db *sql.DB, offerID, expectedStatus string) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	for {
		select {
		case <-ctx.Done():
			t.Fatalf("timed out waiting for offer status to become '%s'", expectedStatus)
		default:
			var currentStatus string
			err := db.QueryRow(`SELECT status FROM "Offer" WHERE id = $1`, offerID).Scan(&currentStatus)
			if err != nil {
				if err == sql.ErrNoRows {
					// Offer might not have been created yet by the consumer, continue polling.
					time.Sleep(500 * time.Millisecond)
					continue
				}
				t.Fatalf("failed to query offer status: %v", err)
			}

			if currentStatus == expectedStatus {
				t.Logf("Success! Offer status is now '%s'.", expectedStatus)
				return
			}
			
			t.Logf("Current offer status is '%s', waiting for '%s'...", currentStatus, expectedStatus)
			time.Sleep(1 * time.Second)
		}
	}
}

func TestE2E_CreateOfferWorkflow(t *testing.T) {
	setupTestEnvironment()

	// Initialize dependencies (simplified for test)
	// In a real test, you'd start up all the services or use a test container setup.
	// For this test, we assume the other services (workflow, siterank) are running and listening.
	
	dbURL := os.Getenv("DATABASE_URL")
	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatalf("Failed to connect to db: %v", err)
	}
	defer db.Close()
	
	publisher, err = events.NewPublisher(context.Background())
	if err != nil {
		t.Fatalf("Failed to create publisher: %v", err)
	}
	defer publisher.Close()
	
	// 1. Simulate a user creating a new offer via API call.
	offerReq := OfferCreateRequest{
		Name:        "E2E Test Offer",
		OriginalUrl: "https://example.com/e2e-test",
	}
	body, _ := json.Marshal(offerReq)
	req := httptest.NewRequest("POST", "/offers", bytes.NewReader(body))
	
	// Inject user ID into request context, simulating auth middleware.
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "test-user-e2e")
	req = req.WithContext(ctx)
	
	rr := httptest.NewRecorder()
	createOffer(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Fatalf("createOffer handler returned wrong status code: got %v want %v", rr.Code, http.StatusAccepted)
	}
	
	var offerResponse domain.Offer
	if err := json.NewDecoder(rr.Body).Decode(&offerResponse); err != nil {
		t.Fatalf("Could not decode response: %v", err)
	}
	
	offerID := offerResponse.ID
	t.Logf("Offer created successfully with ID: %s. Now polling for final status...", offerID)
	
	// 2. Poll the database to verify the end-to-end event flow.
	// We expect the offer's status to eventually become "optimizing" after the entire
	// event chain (OfferCreated -> WorkflowStepStarted -> SiterankAnalysisCompleted) has completed.
	pollForOfferStatus(t, db, offerID, "optimizing")
	
	// 3. (Optional) Verify intermediate states.
	// You could also add polling for the workflow progress and siterank analysis records.
	var workflowExists bool
	err = db.QueryRow(`SELECT EXISTS(SELECT 1 FROM "UserWorkflowProgress" WHERE context->>'offerId' = $1)`, offerID).Scan(&workflowExists)
	if err != nil || !workflowExists {
		t.Errorf("Failed to verify workflow creation for offer %s", offerID)
	} else {
		t.Logf("Verified: Workflow was created for offer %s", offerID)
	}
	
	var analysisExists bool
	err = db.QueryRow(`SELECT EXISTS(SELECT 1 FROM "SiterankAnalysis" WHERE "offerId" = $1)`, offerID).Scan(&analysisExists)
	if err != nil || !analysisExists {
		t.Errorf("Failed to verify siterank analysis creation for offer %s", offerID)
	} else {
		t.Logf("Verified: Siterank analysis was created for offer %s", offerID)
	}
}
