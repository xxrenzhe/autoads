// services/workflow/cmd/server/main.go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"time"
)

var siterankServiceURL = os.Getenv("SITERANK_SERVICE_URL")

type StartWorkflowRequest struct {
	UserID     string `json:"user_id"`
	TemplateID string `json:"template_id"`
	OfferID    string `json:"offer_id"`
}

type StartWorkflowResponse struct {
	WorkflowInstanceID string `json:"workflow_instance_id"`
}

type AnalyzeRequest struct {
	UserID  string `json:"user_id"`
	OfferID string `json:"offer_id"`
	URL     string `json:"url"` // In a real scenario, we'd fetch this URL from the db based on offer_id
}

func startWorkflowHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req StartWorkflowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("Received start workflow request for offer %s by user %s", req.OfferID, req.UserID)

	// 1. Create a workflow instance ID
	instanceID := fmt.Sprintf("wf_inst_%s", req.OfferID)

	// 2. Call Siterank service to start analysis
	// In a real implementation, you'd get the Offer's URL from your database first.
	// We'll use a placeholder URL for now.
	analyzeReq := AnalyzeRequest{
		UserID:  req.UserID,
		OfferID: req.OfferID,
		URL:     "https://example.com/placeholder-for-" + req.OfferID,
	}

	body, err := json.Marshal(analyzeReq)
	if err != nil {
		http.Error(w, "Failed to create siterank request", http.StatusInternalServerError)
		return
	}

	// This is a simplified, synchronous call. In a real system, this would be an event.
	resp, err := http.Post(siterankServiceURL+"/v1/siterank/analyze", "application/json", bytes.NewBuffer(body))
	if err != nil {
		log.Printf("Failed to call siterank service: %v", err)
		http.Error(w, "Failed to start analysis", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		bodyBytes, _ := ioutil.ReadAll(resp.Body)
		log.Printf("Siterank service returned an error: %s", string(bodyBytes))
		http.Error(w, "Siterank service failed", resp.StatusCode)
		return
	}

	log.Printf("Successfully triggered siterank analysis for offer %s", req.OfferID)

	// 3. Respond to the client
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(StartWorkflowResponse{WorkflowInstanceID: instanceID})
}

func main() {
	if siterankServiceURL == "" {
		siterankServiceURL = "http://localhost:8084" // Default for local dev without compose
	}
	
	http.HandleFunc("/v1/workflows/start", startWorkflowHandler)
	
	port := 8080
	log.Printf("Workflow service starting on port %d", port)
	log.Printf("Siterank service URL: %s", siterankServiceURL)

	if err := http.ListenAndServe(fmt.Sprintf(":%d", port), nil); err != nil {
		log.Fatalf("could not start server: %v", err)
	}
}
