# Use the official Golang image to create a build artifact.
FROM golang:1.25-alpine as builder
WORKDIR /app
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /offer-service .
# Start a new stage from scratch for a smaller image
FROM alpine:latest
WORKDIR /
COPY --from=builder /offer-service /offer-service
EXPOSE 8080
CMD ["/offer-service"]
