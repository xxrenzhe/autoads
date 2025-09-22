# Stage 1: Build the Go application
FROM golang:1.25-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git
RUN git config --global user.name "Cloud Build"
RUN git config --global user.email "builder@gcp.com"
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN git config --global credential.helper ''
ENV GIT_TERMINAL_PROMPT=0

COPY go.mod go.sum ./
RUN GOPROXY=https://proxy.golang.org,direct GOPRIVATE="" go mod download

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
