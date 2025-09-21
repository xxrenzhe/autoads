# Dockerfile for offer service
FROM golang:1.21-alpine

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
RUN go mod download

COPY . .

RUN go build -o /offer-service ./cmd/server

EXPOSE 8080

CMD [ "/offer-service" ]
