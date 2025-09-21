# Dockerfile for siterank service
FROM golang:1.25-alpine

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o /siterank-service ./cmd/server && \
    go clean -cache

EXPOSE 8080

CMD [ "/siterank-service" ]
