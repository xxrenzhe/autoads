# Use the official Golang image to create a build artifact.
# This is known as a multi-stage build.
FROM golang:1.25-alpine as builder

# Set the Current Working Directory inside the container
WORKDIR /app

# Configure git to be completely non-interactive
RUN apk add --no-cache git
RUN git config --global user.name "Cloud Build"
RUN git config --global user.email "builder@gcp.com"
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN git config --global credential.helper ''
ENV GIT_TERMINAL_PROMPT=0

# Copy module files
COPY go.mod go.sum ./

# Download dependencies with environment variables explicitly set.
RUN GOPROXY=https://proxy.golang.org,direct GOPRIVATE="" go mod download

# Copy the source code
COPY . .

# Build the Go app
RUN CGO_ENABLED=0 GOOS=linux go build -o /identity-service .

# Start a new stage from scratch for a smaller image
FROM alpine:latest

WORKDIR /

# Copy the Pre-built binary file from the previous stage
COPY --from=builder /identity-service /identity-service

# Expose port 8080 to the outside world
EXPOSE 8080

# Command to run the executable
CMD ["/identity-service"]
