package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/gofly/pkg/gofly"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/autoads/gofly-autoads/internal/config"
	"github.com/autoads/gofly-autoads/internal/handlers"
	"github.com/autoads/gofly-autoads/internal/middleware"
	"github.com/autoads/gofly-autoads/pkg/logger"
)

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the server",
	Run: func(cmd *cobra.Command, args []string) {
		// Initialize configuration
		if err := config.Init(); err != nil {
			log.Fatalf("Failed to initialize config: %v", err)
		}

		// Initialize logger
		if err := logger.Init(); err != nil {
			log.Fatalf("Failed to initialize logger: %v", err)
		}

		// Initialize GoFly
		gf, err := gofly.New(&gofly.Config{
			AppName:    viper.GetString("app.name"),
			Version:    viper.GetString("app.version"),
			Debug:      viper.GetBool("app.debug"),
			Database:   viper.GetString("database.dsn"),
			Redis:      viper.GetString("redis.url"),
			JWTSecret:  viper.GetString("jwt.secret"),
			Middleware: []gofly.Middleware{
				middleware.CORS(),
				middleware.Logger(),
				middleware.RateLimiter(),
				middleware.Auth(),
			},
		})
		if err != nil {
			log.Fatalf("Failed to initialize GoFly: %v", err)
		}

		// Initialize Hertz server
		h := server.Default(
			server.WithHostPorts(viper.GetString("server.port")),
		)

		// Register routes
		registerRoutes(h, gf)

		// Start server in a goroutine
		go func() {
			if err := h.Spin(); err != nil {
				log.Fatalf("Failed to start server: %v", err)
			}
		}()

		// Wait for interrupt signal
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit

		logger.Info("Shutting down server...")

		// Graceful shutdown with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := h.Shutdown(ctx); err != nil {
			logger.Error("Server forced to shutdown:", err)
		}

		logger.Info("Server exited")
	},
}

func registerRoutes(h *server.Hertz, gf *gofly.GoFly) {
	// Health check
	h.GET("/health", func(c context.Context, ctx *app.RequestContext) {
		ctx.JSON(http.StatusOK, map[string]string{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// API Group
	api := h.Group("/api/v1")
	
	// BatchGo routes
	batch := api.Group("/batchgo")
	{
		// Silent mode
		batch.POST("/tasks/silent/start", handlers.SilentStart)
		batch.GET("/tasks/silent/progress", handlers.SilentProgress)
		batch.POST("/tasks/silent/terminate", handlers.SilentTerminate)
		
		// AutoClick mode
		batch.POST("/tasks/autoclick", handlers.CreateAutoClickTask)
		batch.PUT("/tasks/autoclick/:id/:action", handlers.AutoClickTaskAction)
		batch.GET("/tasks/autoclick/:id/progress", handlers.AutoClickProgress)
	}

	// SiteRankGo routes
	siterank := api.Group("/siterankgo")
	{
		siterank.GET("/traffic", handlers.GetDomainRank)
		siterank.POST("/traffic/batch", handlers.BatchQuery)
		siterank.POST("/traffic/priorities", handlers.CalculatePriorities)
		siterank.GET("/tasks/:id", handlers.GetTaskStatus)
		siterank.GET("/tasks/:id/results", handlers.GetTaskResults)
	}

	// Token routes
	api.POST("/tokens/consume", handlers.ConsumeTokens)
	api.GET("/tokens/balance", handlers.GetTokenBalance)
	api.GET("/tokens/history", handlers.GetTokenHistory)

	// Legacy API compatibility (proxy to new endpoints)
	legacy := h.Group("/api")
	{
		legacy.Any("/batchopen/silent-start", handlers.ProxyToBatchGoSilentStart)
		legacy.Any("/batchopen/silent-progress", handlers.ProxyToBatchGoSilentProgress)
		legacy.Any("/batchopen/silent-terminate", handlers.ProxyToBatchGoSilentTerminate)
		legacy.Any("/siterank/rank", handlers.ProxyToSiteRankGoTraffic)
		legacy.Any("/v1/siterank/tasks", handlers.ProxyToSiteRankGoTasks)
	}

	// WebSocket endpoints
	h.GET("/ws/batch/:taskId", handlers.BatchProgressWebSocket)
	h.GET("/ws/siterank/:taskId", handlers.SiteRankProgressWebSocket)
}

func init() {
	rootCmd.AddCommand(serveCmd)
}