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

    // Internal auto-status endpoint (protected via X-Service-Token)
    r.Handle("/api/v1/offers/internal/auto-status", http.HandlerFunc(h.AutoStatusHandler))

    log.Printf("Offer service listening on port %s", cfg.Port)
    if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}

// oasImpl adapts generated server to existing handlers
type oasImpl struct{ h *handlers.Handler }

func (o *oasImpl) CreateOffer(w http.ResponseWriter, r *http.Request) { o.h.OffersHandler(w, r) }
func (o *oasImpl) ListOffers(w http.ResponseWriter, r *http.Request)   { o.h.OffersHandler(w, r) }
// Below endpoints reuse the consolidated tree handler to avoid duplication.
func (o *oasImpl) GetOffer(w http.ResponseWriter, r *http.Request, id string)           { o.h.OffersHandler(w, withPath(r, "/api/v1/offers/"+id)) }
func (o *oasImpl) UpdateOffer(w http.ResponseWriter, r *http.Request, id string)        { o.h.OffersHandler(w, withPath(r, "/api/v1/offers/"+id)) }
func (o *oasImpl) DeleteOffer(w http.ResponseWriter, r *http.Request, id string)        { o.h.OffersHandler(w, withPath(r, "/api/v1/offers/"+id)) }
func (o *oasImpl) UpdateOfferStatus(w http.ResponseWriter, r *http.Request, id string)  { o.h.OffersHandler(w, withPath(r, "/api/v1/offers/"+id+"/status")) }
func (o *oasImpl) GetOfferKpi(w http.ResponseWriter, r *http.Request, id string)        { o.h.OffersHandler(w, withPath(r, "/api/v1/offers/"+id+"/kpi")) }
func (o *oasImpl) AggregateOfferKpi(w http.ResponseWriter, r *http.Request, id string, _ api.AggregateOfferKpiParams) {
    o.h.OffersHandler(w, withPath(r, "/api/v1/offers/"+id+"/kpi/aggregate"))
}
func (o *oasImpl) ListOfferAccounts(w http.ResponseWriter, r *http.Request, id string)  { o.h.OffersHandler(w, withPath(r, "/api/v1/offers/"+id+"/accounts")) }
func (o *oasImpl) LinkOfferAccount(w http.ResponseWriter, r *http.Request, id string)   { o.h.OffersHandler(w, withPath(r, "/api/v1/offers/"+id+"/accounts")) }
func (o *oasImpl) UnlinkOfferAccount(w http.ResponseWriter, r *http.Request, id string, accountId string) {
    o.h.OffersHandler(w, withPath(r, "/api/v1/offers/"+id+"/accounts/"+accountId))
}
func (o *oasImpl) GetOfferPreferences(w http.ResponseWriter, r *http.Request, id string) { o.h.OffersHandler(w, withPath(r, "/api/v1/offers/"+id+"/preferences")) }
func (o *oasImpl) UpdateOfferPreferences(w http.ResponseWriter, r *http.Request, id string) {
    o.h.OffersHandler(w, withPath(r, "/api/v1/offers/"+id+"/preferences"))
}

// withPath clones r with an overridden URL.Path so that legacy path-parsing code works
// regardless of chi/oapi mounting details.
func withPath(r *http.Request, path string) *http.Request {
    // shallow clone is sufficient; body and context are reused
    rr := new(http.Request)
    *rr = *r
    // clone URL struct to avoid mutating original
    if r.URL != nil {
        u := *r.URL
        u.Path = path
        rr.URL = &u
    }
    return rr
}
