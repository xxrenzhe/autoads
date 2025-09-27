# Simple Cloud Run container for Pub/Sub push projection
FROM golang:1.25-alpine AS builder
WORKDIR /workspace
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /projector-service .

FROM gcr.io/distroless/base-debian12
COPY --from=builder /projector-service /projector-service
EXPOSE 8080
ENTRYPOINT ["/projector-service"]

