# Build notifications service (Go + chi)
FROM golang:1.23-alpine as builder
WORKDIR /workspace
RUN apk add --no-cache git
ENV GIT_TERMINAL_PROMPT=0
ENV GOTOOLCHAIN=auto
ENV GOWORK=/workspace/go.work

# Prime module cache (best-effort)
COPY go.work ./
RUN mkdir -p services/notifications
COPY services/notifications/go.mod services/notifications/go.mod
RUN GOPROXY=https://proxy.golang.org,direct GOPRIVATE="" go mod download || true

# Copy entire repo for workspace replaces
COPY . .
WORKDIR /workspace/services/notifications
RUN GOPROXY=https://proxy.golang.org,direct GOPRIVATE="" go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -o /notifications-service ./cmd/server

# Runtime image
FROM alpine:latest
WORKDIR /
COPY --from=builder /notifications-service /notifications-service
EXPOSE 8080
CMD ["/notifications-service"]

