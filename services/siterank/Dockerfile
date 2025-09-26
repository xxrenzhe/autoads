# Use the official Golang image to create a build artifact.
FROM golang:1.23-alpine as builder
WORKDIR /workspace
RUN apk add --no-cache git
RUN git config --global user.name "Cloud Build"
RUN git config --global user.email "builder@gcp.com"
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN git config --global credential.helper ''
ENV GIT_TERMINAL_PROMPT=0
ENV GOTOOLCHAIN=auto
ENV GOWORK=/workspace/go.work
# 1) Prime module cache with minimal files
COPY go.work ./
RUN mkdir -p services/siterank
COPY services/siterank/go.mod services/siterank/go.mod
RUN GOPROXY=https://proxy.golang.org,direct GOPRIVATE="" go mod download || true
# 2) Copy entire repo to allow go.work resolve sibling modules
COPY . .
WORKDIR /workspace/services/siterank
RUN GOPROXY=https://proxy.golang.org,direct GOPRIVATE="" go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -o /siterank-service .
# Start a new stage from scratch for a smaller image
FROM alpine:latest
WORKDIR /
COPY --from=builder /siterank-service /siterank-service
EXPOSE 8080
CMD ["/siterank-service"]
