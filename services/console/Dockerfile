# Stage 1: Build the Go application
FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /console-api ./main.go

# Stage 2: Serve the API and static files
FROM alpine:latest

WORKDIR /app

# Copy the Go binary from the builder stage
COPY --from=builder /console-api /app/console-api

# Here, you would typically copy the pre-built admin UI files
# For now, we will create a placeholder index.html to prove the concept.
RUN mkdir -p /app/static && echo "<h1>Admin Console Placeholder</h1>" > /app/static/index.html

EXPOSE 8080

CMD ["/app/console-api"]
