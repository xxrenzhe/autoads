# Use the official Golang image to create a build artifact.
FROM golang:1.25 as builder
WORKDIR /workspace
ENV GO111MODULE=on
# Copy only necessary modules to avoid pulling frontend/node assets
COPY go.work ./go.work
COPY pkg ./pkg
COPY services/siterank ./services/siterank
WORKDIR /workspace/services/siterank
RUN go version && \
    go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /siterank-service .
# Start a new stage from scratch for a smaller image
FROM gcr.io/distroless/base-debian12
WORKDIR /
COPY --from=builder /siterank-service /siterank-service
EXPOSE 8080
ENTRYPOINT ["/siterank-service"]
