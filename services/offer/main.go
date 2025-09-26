package main

import (
    "context"
    "database/sql"
    "log"
    "net/http"
    "time"
    "github.com/xxrenzhe/autoads/services/offer/internal/config"
    "github.com/xxrenzhe/autoads/services/offer/internal/events"
    "github.com/xxrenzhe/autoads/services/offer/internal/handlers"
    ev "github.com/xxrenzhe/autoads/pkg/events"
    "github.com/xxrenzhe/autoads/pkg/telemetry"
    "github.com/xxrenzhe/autoads/pkg/middleware"
    "github.com/go-chi/chi/v5"
    api "github.com/xxrenzhe/autoads/services/offer/internal/oapi"

	_ "github.com/lib/pq"
)

func main() {
    ctx := context.Background()
    cfg, err := config.Load(ctx)
    if err != nil {
        log.Fatalf("Failed to load configuration: %v", err)
    }

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

    // unified auth via pkg/middleware.AuthMiddleware

    // Offer service: publish via unified pkg/events. Projections由 notifications 服务负责。
    var publisherPub events.Publisher = &events.NoopPublisher{}
    if p, err := ev.NewPublisher(ctx); err != nil {
        log.Printf("WARN: pkg/events publisher unavailable: %v; falling back to NoopPublisher", err)
    } else {
        publisherPub = events.NewEVAdapter(p)
        defer p.Close()
    }


	log.Println("Starting Offer service...")

    r := chi.NewRouter()
    // Register metrics and basic request telemetry
    // Keep consistent with other services
    // (Prometheus metrics and request duration/total)
    // Note: pkg/telemetry is a lightweight helper; no external agent required.
    
    // Import telemetry and logging middleware
    // and mount /metrics for scraping
    // Also expose /health and /healthz endpoints
    // before mounting OpenAPI routes.
    // Create handler instance to reuse readyz/healthz if needed
    h := handlers.NewHandler(db, &events.LoggingMiddleware{Next: publisherPub})

    // Telemetry and logging
    // (matches siterank/adscenter/billing/batchopen)
    // Wrap OpenAPI handler via Chi-level middlewares below.
    // Avoid duplicate metrics by registering once per process.
    
    // lazy import to avoid unused if build tags change
    //nolint:depguard
    {
        // Local scoped import-like usage
    }

    // Bring in telemetry + logging
    // These packages are already in the repository
    // and used by other services for consistency.
    r.Use(middleware.LoggingMiddleware("offer"))
    telemetry.RegisterDefaultMetrics("offer")
    r.Use(telemetry.ChiMiddleware("offer"))
    r.Handle("/metrics", telemetry.MetricsHandler())
    // Basic health endpoints (DB readiness)
    r.Get("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
        ctx2, cancel := context.WithTimeout(r.Context(), 800*time.Millisecond)
        defer cancel()
        if err := db.PingContext(ctx2); err != nil { w.WriteHeader(http.StatusInternalServerError); return }
        w.WriteHeader(http.StatusOK)
    })

    // OpenAPI chi server mount with auth middleware
    oas := &oasImpl{h: h}
    oapiHandler := api.HandlerWithOptions(oas, api.ChiServerOptions{
        BaseURL: "/api/v1",
        Middlewares: []api.MiddlewareFunc{
            func(next http.Handler) http.Handler { return middleware.IdempotencyMiddleware(next) },
            func(next http.Handler) http.Handler { return middleware.AuthMiddleware(next) },
        },
    })
    r.Mount("/", oapiHandler)

    log.Printf("Offer service listening on port %s", cfg.Port)
    if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}

// oasImpl adapts generated server to existing handlers
type oasImpl struct{ h *handlers.Handler }

func (o *oasImpl) CreateOffer(w http.ResponseWriter, r *http.Request) { o.h.OffersHandler(w, r) }
func (o *oasImpl) ListOffers(w http.ResponseWriter, r *http.Request)   { o.h.OffersHandler(w, r) }
