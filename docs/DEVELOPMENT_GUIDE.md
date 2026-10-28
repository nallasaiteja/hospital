# Local Development Guide

This guide walks you through setting up and running the Hospital Management System (HMS) locally on your workstation.

---

## Prerequisites
- **Node.js**: v20 or v22 LTS (`node -v`)
- **Python**: v3.11 or v3.12 (`python --version`)
- **Docker Desktop** (optional, for containerized execution)
- **Supabase Account** (see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md))

---

## 1. Quick Start with Local Services

### Step 1: Clone and Configure Environment Variables
```bash
# Clone the repository
git clone <repository_url>
cd Hospital

# Copy environment variable templates
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
Edit `backend/.env` and `frontend/.env` with your Supabase credentials or test PostgreSQL database credentials.

---

### Step 2: Backend Setup
```bash
cd backend

# Create virtual environment (if not already created)
python -m venv venv

# Activate virtual environment
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On macOS / Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Seed initial system roles and permissions (or superadmin)
python manage.py createsuperuser

# Start Django development server
python manage.py runserver 0.0.0.0:8000
```
Backend API will be accessible at: `http://localhost:8000/api/v1/`
Interactive Swagger API docs at: `http://localhost:8000/api/schema/swagger-ui/`

---

### Step 3: Frontend Setup
In a new terminal window:
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend Web Application will be accessible at: `http://localhost:5173/`

---

## 2. Running with Docker Compose

If you have Docker installed, you can launch the entire stack (Backend, Frontend, and Redis) with a single command:
```bash
docker-compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API & Swagger: `http://localhost:8000/api/schema/swagger-ui/`

---

## 3. Running Automated Tests

### Backend Tests (pytest)
```bash
cd backend
.\venv\Scripts\pytest
```

### Frontend Type Check & Build Validation
```bash
cd frontend
npm run build
```
