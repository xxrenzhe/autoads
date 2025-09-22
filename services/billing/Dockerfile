# Use the official Golang image to create a build artifact.
FROM golang:1.25-alpine as builder
WORKDIR /app

# 1. Install and configure git to be completely non-interactive.
RUN apk add --no-cache git
RUN git config --global user.name "Cloud Build"
RUN git config --global user.email "builder@gcp.com"
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN git config --global credential.helper '' # Disable credential helper
ENV GIT_TERMINAL_PROMPT=0

# 2. Copy module files
COPY go.mod go.sum ./

# 3. Download dependencies with environment variables explicitly set for the command.
# This is the most robust way to ensure the proxy is used.
RUN GOPROXY=https://proxy.golang.org,direct GOPRIVATE="" go mod download

# 4. Copy source code and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /billing-service .

# Start a new stage from scratch for a smaller image
FROM alpine:latest
WORKDIR /
COPY --from=builder /billing-service /billing-service
EXPOSE 8080
CMD ["/billing-service"]
