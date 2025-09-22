package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type Handler struct {
	DB *pgxpool.Pool
	// publisher events.Publisher
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{DB: db}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// API routes
	mux.HandleFunc("/api/v1/console/users", h.getUsers)

	// Static file serving for the admin UI
	// The path to the static files will be configured via an environment variable
	// for flexibility, defaulting to a path inside the container.
	staticDir := "/app/static" // This will be the path inside the Docker container
	fileServer := http.FileServer(http.Dir(staticDir))
	
	// Serve static files for requests starting with /console
	// and redirect the root /console to /console/index.html
	mux.HandleFunc("/console/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/console/" {
			http.ServeFile(w, r, staticDir+"/index.html")
			return
		}
		// Use StripPrefix to remove the /console/ prefix before handing it to the file server
		http.StripPrefix("/console/", fileServer).ServeHTTP(w,r)
	})
}

func (h *Handler) getUsers(w http.ResponseWriter, r *http.Request) {
	// In a real app, this handler would be protected by an admin-only middleware.
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := h.DB.Query(r.Context(), `SELECT id, email, name, role, "createdAt" FROM "User" ORDER BY "createdAt" DESC`)
	if err != nil {
		log.Printf("Error querying users: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.CreatedAt); err != nil {
			log.Printf("Error scanning user row: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
