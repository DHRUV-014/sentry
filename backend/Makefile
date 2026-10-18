PYTHON ?= /opt/homebrew/bin/python3.11
VENV   := .venv
BIN    := $(VENV)/bin

.PHONY: setup run test lint fmt clean test-audio bench-stt stt-report demo-wav

setup:
	test -d $(VENV) || $(PYTHON) -m venv $(VENV)
	$(BIN)/pip install --upgrade pip
	$(BIN)/pip install -e ".[dev]"
	test -f .env || cp .env.example .env

run:
	$(BIN)/python -m app

test:
	$(BIN)/pytest -q

test-audio:
	$(BIN)/python -m tools.make_test_audio

bench-stt:
	$(BIN)/python -m tools.bench_stt

# Needs a running server (make run in another terminal).
stt-report:
	$(BIN)/python -m tools.stt_report

demo-wav:
	@test -n "$(FILE)" || (echo "usage: make demo-wav FILE=path/to/audio.wav" && exit 1)
	$(BIN)/python -m tools.stream_wav "$(FILE)"

lint:
	$(BIN)/ruff check .
	$(BIN)/ruff format --check .

fmt:
	$(BIN)/ruff check --fix .
	$(BIN)/ruff format .

clean:
	rm -rf .pytest_cache .ruff_cache
