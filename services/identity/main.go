package main

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"service": "identity-service",
		})
	})

	// Start the server
	// We'll use port 8081 for the identity service
	if err := r.Run(":8081"); err != nil {
		panic(err)
	}
}
