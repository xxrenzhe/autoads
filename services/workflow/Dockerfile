# Use the official Golang image to create a build artifact.
FROM golang:1.25.1-alpine as builder
WORKDIR /workspace
RUN apk add --no-cache git
RUN git config --global user.name "Cloud Build"
RUN git config --global user.email "builder@gcp.com"
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN git config --global credential.helper ''
ENV GIT_TERMINAL_PROMPT=0
# 1) Prime module cache with minimal files
COPY go.work ./
RUN mkdir -p services/workflow
COPY services/workflow/go.mod services/workflow/go.mod
RUN GOPROXY=https://proxy.golang.org,direct GOPRIVATE="" go mod download || true
# 2) Copy full repo and build with workspace
COPY . .
WORKDIR /workspace/services/workflow
RUN GOPROXY=https://proxy.golang.org,direct GOPRIVATE="" go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -o /workflow-service .
# Start a new stage from scratch for a smaller image
FROM alpine:latest
WORKDIR /
COPY --from=builder /workflow-service /workflow-service
EXPOSE 8080
CMD ["/workflow-service"]
