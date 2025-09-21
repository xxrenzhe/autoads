# Dockerfile for adscenter service
FROM golang:1.25-alpine

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
RUN go mod download

COPY . .

RUN go build -o /adscenter-service ./cmd/server && \
    go clean -cache

EXPOSE 8080

CMD [ "/adscenter-service" ]
