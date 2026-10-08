.PHONY: dev test

VENV := .venv
PY := $(VENV)/bin/python

dev:
	test -d $(VENV) || python3 -m venv $(VENV)
	$(PY) -m pip install -r requirements.txt
	$(PY) -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

test:
	test -d $(VENV) || python3 -m venv $(VENV)
	$(PY) -m pip install -r requirements.txt
	$(PY) -m unittest discover -s tests -v
