FROM node:20-alpine AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM golang:1.21-alpine AS server-builder

WORKDIR /app

COPY server/go.mod server/go.sum ./
RUN go mod download

COPY server/*.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server .

FROM scratch

COPY --from=server-builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=server-builder /app/server /server
COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 12345

CMD ["/server"]
