# Use the official Golang image to create a build artifact.
FROM golang:1.25-alpine as builder
WORKDIR /app
RUN apk add --no-cache git
RUN git config --global user.name "Cloud Build"
RUN git config --global user.email "builder@gcp.com"
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN git config --global credential.helper ''
ENV GIT_TERMINAL_PROMPT=0
COPY go.mod go.sum ./
RUN GOPROXY=https://proxy.golang.org,direct GOPRIVATE="" go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /siterank-service .
# Start a new stage from scratch for a smaller image
FROM alpine:latest
WORKDIR /
COPY --from=builder /siterank-service /siterank-service
EXPOSE 8080
CMD ["/siterank-service"]
