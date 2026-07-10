.PHONY: up down build logs shell add-user

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f app

shell:
	docker compose exec app bash

add-user:
	@read -p "Name: " name; \
	docker compose exec app python scripts/add_user.py --name "$$name"
