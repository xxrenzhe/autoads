package main

import (
    "context"
    "log"
    "net/http"

    "github.com/xxrenzhe/autoads/services/workflow/internal/auth"
    "github.com/xxrenzhe/autoads/services/workflow/internal/config"
    "github.com/xxrenzhe/autoads/services/workflow/internal/handlers"
)

func main() {
    ctx := context.Background()
    cfg, err := config.Load(ctx)
    if err != nil { log.Fatalf("Failed to load configuration: %v", err) }

    authClient := auth.NewClient(ctx)
    apiHandler := handlers.NewMinimalHandler()

    mux := http.NewServeMux()
    apiHandler.RegisterRoutes(mux, authClient.Middleware)

    log.Printf("Workflow service HTTP server listening on port %s", cfg.Port)
    if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
        log.Fatalf("failed to start server: %v", err)
    }
}
