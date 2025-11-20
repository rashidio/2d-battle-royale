# tgpubg

2D battle royale game. Go server, PixiJS client, WebSocket communication.

## Features

- Client-side prediction with server reconciliation
- Spatial partitioning for collision detection
- Delta state updates
- Chunk-based world streaming
- Entity interpolation
- Object pooling and caching
- Touch controls
- Shrinking zone mechanic
- Multiple weapon types
- Bot players

## Run locally

Install dependencies:
```bash
make install
```

Run:
```bash
make
./tgpubg
```

Open http://localhost:12345

## Deploy

```bash
./scripts/deploy.sh
```

## Stack

- Go (server, game loop, WebSocket)
- PixiJS (rendering)
- Playwright (tests)

## Tests

```bash
cd tests
npm install
npm test
```
