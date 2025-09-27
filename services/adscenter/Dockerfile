# Use the official Golang image to create a build artifact.
FROM golang:1.25 as builder
WORKDIR /workspace
ENV GO111MODULE=on
# Copy only necessary modules to avoid pulling frontend/node assets
COPY go.work ./go.work
COPY pkg ./pkg
COPY services/adscenter ./services/adscenter
WORKDIR /workspace/services/adscenter
RUN go version && \
    go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /adscenter-service .
# Start a new stage from scratch for a smaller image
FROM gcr.io/distroless/base-debian12
WORKDIR /
COPY --from=builder /adscenter-service /adscenter-service
EXPOSE 8080
ENTRYPOINT ["/adscenter-service"]
