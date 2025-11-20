.PHONY: run build deploy stop restart test build-test install

install:
	cd server && go mod download
	cd client && npm install
	cd tests && npm install

run:
	cd server && go run .

build:
	cd client && npm run build
	cd server && go build -o tgpubg

deploy:
	bash scripts/deploy.sh

stop:
	@pkill -f "go run ." || pkill -f "tgpubg" || true

restart: stop
	@sleep 1
	@$(MAKE) run

test: build
	cd tests && npx playwright test --workers=4 $(ARGS)
