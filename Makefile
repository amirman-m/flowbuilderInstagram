# Development commands for Social Media Flow

.PHONY: help install-backend install-frontend install dev-backend dev-frontend dev clean

help:
	@echo "Available commands:"
	@echo "  install          - Install all dependencies"
	@echo "  install-backend  - Install backend dependencies"
	@echo "  install-frontend - Install frontend dependencies"
	@echo "  dev-backend      - Run backend development server"
	@echo "  dev-frontend     - Run frontend development server"
	@echo "  dev              - Run both backend and frontend"
	@echo "  clean            - Clean up generated files"

install: install-backend install-frontend

install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

dev-backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

dev:
	@echo "Starting backend and frontend servers..."
	@echo "Backend will run on http://localhost:8000"
	@echo "Frontend will run on http://localhost:5173"
	@echo "Use Ctrl+C to stop both servers"
	@make dev-backend & make dev-frontend

clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	cd frontend && rm -rf node_modules dist
	cd backend && rm -f *.db
