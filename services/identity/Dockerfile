# Use the official Golang image to create a build artifact.
# This is known as a multi-stage build.
FROM golang:1.25-alpine as builder

# Set the Current Working Directory inside the container
WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies. Dependencies will be cached if the go.mod and go.sum files are not changed
RUN go mod download

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
