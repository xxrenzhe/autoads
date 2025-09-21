package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

func main() {
	ctx := context.Background()
	
	// Get credentials from environment variable
	credsJSON := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
	if credsJSON == "" {
		log.Fatalf("GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set")
	}
	opt := option.WithCredentialsJSON([]byte(credsJSON))

	// Initialize Firebase app
	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		log.Fatalf("error initializing Firebase app: %v\n", err)
	}

	// You can now use the app to interact with Firebase services.
	// For example, to get an auth client:
	// client, err := app.Auth(ctx)
	// if err != nil {
	// 	log.Fatalf("error getting Auth client: %v\n", err)
	// }
	
	log.Println("Firebase app initialized successfully.")
	log.Println("Starting Identity service...")

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		// A more meaningful health check could verify the Firebase connection
		_, err := app.Auth(ctx)
		if err != nil {
			http.Error(w, "Identity service is unhealthy: Firebase connection failed", http.StatusInternalServerError)
			return
		}
		fmt.Fprintf(w, "Identity service is healthy and connected to Firebase!")
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
