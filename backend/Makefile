PYTHON ?= /opt/homebrew/bin/python3.11
VENV   := .venv
BIN    := $(VENV)/bin

.PHONY: setup run test lint fmt clean

setup:
	test -d $(VENV) || $(PYTHON) -m venv $(VENV)
	$(BIN)/pip install --upgrade pip
	$(BIN)/pip install -e ".[dev]"
	test -f .env || cp .env.example .env

run:
	$(BIN)/python -m app

test:
	$(BIN)/pytest -q

lint:
	$(BIN)/ruff check .
	$(BIN)/ruff format --check .

fmt:
	$(BIN)/ruff check --fix .
	$(BIN)/ruff format .

clean:
	rm -rf .pytest_cache .ruff_cache
