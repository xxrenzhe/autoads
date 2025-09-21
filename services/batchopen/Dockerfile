# Dockerfile for batchopen service
FROM golang:1.25-alpine

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
RUN go mod download

COPY . .

RUN go build -o /batchopen-service ./cmd/server && \
    go clean -cache

EXPOSE 8080

CMD [ "/batchopen-service" ]
