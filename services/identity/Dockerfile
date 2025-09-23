# Use the official Golang image to create a build artifact.
# This is known as a multi-stage build.
FROM golang:1.25.1-alpine as builder

# Set the Current Working Directory inside the container
WORKDIR /workspace

# Configure git to be completely non-interactive
RUN apk add --no-cache git
RUN git config --global user.name "Cloud Build"
RUN git config --global user.email "builder@gcp.com"
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN git config --global credential.helper ''
ENV GIT_TERMINAL_PROMPT=0

# 1) Prime module cache
COPY go.work ./
RUN mkdir -p services/identity
COPY services/identity/go.mod services/identity/go.mod
RUN GOPROXY=https://proxy.golang.org,direct GOPRIVATE="" go mod download || true

# 2) Copy the source code and build
COPY . .
WORKDIR /workspace/services/identity
RUN GOPROXY=https://proxy.golang.org,direct GOPRIVATE="" go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -o /identity-service .

# Start a new stage from scratch for a smaller image
FROM alpine:latest

WORKDIR /

# Copy the Pre-built binary file from the previous stage
COPY --from=builder /identity-service /identity-service

# Expose port 8080 to the outside world
EXPOSE 8080

# Command to run the executable
CMD ["/identity-service"]
