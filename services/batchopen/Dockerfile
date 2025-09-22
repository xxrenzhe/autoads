# Use the official Golang image to create a build artifact.
FROM golang:1.25-alpine as builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /batchopen-service .
# Start a new stage from scratch for a smaller image
FROM alpine:latest
WORKDIR /
COPY --from=builder /batchopen-service /batchopen-service
EXPOSE 8080
CMD ["/batchopen-service"]
