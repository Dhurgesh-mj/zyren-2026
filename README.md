# 🛡️ EventIQ Secure

**Cybersecurity-Driven College Event Management System**

> Secure Events • Verified Attendance • Smarter Campuses

EventIQ Secure is a centralized platform for managing college events with integrated cybersecurity mechanisms including JWT authentication, HMAC-SHA256 signed QR tokens, RBAC access control, rate limiting, and comprehensive audit logging.

---

## 🏗️ Architecture

```
Internet
    │
    ▼
Nginx Reverse Proxy (Rate Limiting)
    │
    ├── Frontend (Next.js)     → Port 3000
    └── Backend  (FastAPI)     → Port 8000
              │
              ├── PostgreSQL   → Port 5432
              └── Redis        → Port 6379
```

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| **Authentication** | JWT tokens (HS256) with expiration |
| **Password Hashing** | bcrypt with salt |
| **QR Token Signing** | HMAC-SHA256 cryptographic signatures |
| **Replay Prevention** | One-time QR scan + 24h token expiry |
| **RBAC** | 4 roles: Student, Organizer, Dept Admin, College Admin |
| **Rate Limiting** | slowapi (Redis-backed in production) |
| **Input Validation** | Pydantic models on all endpoints |
| **Audit Logging** | All actions logged with IP, user, timestamp |
| **CORS** | Restricted origin whitelist |

## 🚀 Quick Start (Development)

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt greenlet
python seed.py        # Seed demo data
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Open in Browser
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs

### Test Accounts
| Role | Email | Password |
|------|-------|----------|
| College Admin | admin@college.edu | admin123 |
| Organizer | smith@college.edu | org123 |
| Student | rahul@student.edu | stu123 |
| Student | aisha@student.edu | stu123 |

## 🐳 Docker Deployment (Production)

```bash
docker-compose up --build
```

This starts:
- **PostgreSQL** database
- **Redis** cache & rate limiting
- **FastAPI** backend
- **Next.js** frontend
- **Nginx** reverse proxy on port 80

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Rate Limit | Description |
|--------|----------|------------|-------------|
| POST | `/auth/register` | 3/min | Register new user |
| POST | `/auth/login` | 5/min | Login & get JWT |
| GET | `/auth/me` | — | Get current user |

### Events
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/events/create` | Organizer+ | Create event |
| GET | `/events/list` | All | List events |
| GET | `/events/{id}` | All | Event details |
| PUT | `/events/{id}` | Owner/Admin | Update event |
| POST | `/events/{id}/approve` | Admin | Approve & publish |

### Registrations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/registrations/register` | Register for event |
| POST | `/registrations/cancel/{id}` | Cancel (auto-promotes waitlist) |
| GET | `/registrations/my` | My registrations |
| GET | `/registrations/event/{id}` | Event participants (Organizer+) |

### Attendance
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/attendance/checkin` | Organizer+ | Verify QR & record |
| GET | `/attendance/event/{id}` | Organizer+ | Event attendance |

### Analytics & Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/overview` | Dashboard stats |
| GET | `/analytics/events` | Event performance |
| GET | `/notifications/` | User notifications |
| POST | `/notifications/read-all` | Mark all read |

## 🗄️ Database Schema

```
users ──┬──── events
        │        │
        ├── registrations
        │        │
        ├── attendance
        │
        ├── notifications
        │
        └── audit_logs
```

## 📁 Project Structure

```
zyren-26/
├── backend/
│   ├── app/
│   │   ├── config.py          # Environment config
│   │   ├── database.py        # Async SQLAlchemy
│   │   ├── main.py            # FastAPI app + middleware
│   │   ├── models/            # SQLAlchemy models (6 tables)
│   │   ├── schemas/           # Pydantic validation
│   │   ├── routers/           # API endpoints (6 routers)
│   │   └── utils/
│   │       ├── auth.py        # JWT + bcrypt + RBAC
│   │       ├── qr.py          # HMAC-SHA256 QR tokens
│   │       └── audit.py       # Security audit logging
│   ├── seed.py                # Demo data seeder
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js pages
│   │   │   ├── login/         # JWT login
│   │   │   ├── register/      # User registration
│   │   │   ├── dashboard/     # Role-based dashboard
│   │   │   ├── events/        # Event listing & details
│   │   │   ├── scanner/       # QR attendance scanner
│   │   │   ├── analytics/     # Charts & audit logs
│   │   │   └── notifications/ # Notification center
│   │   ├── components/        # Sidebar + shared UI
│   │   ├── context/           # Auth context (JWT)
│   │   └── lib/               # API client
│   └── Dockerfile
├── nginx/
│   └── nginx.conf             # Reverse proxy + rate limiting
├── docker-compose.yml         # Full stack deployment
└── README.md
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python async) |
| Frontend | Next.js 16 + React 19 |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Cache | Redis (rate limiting + queue) |
| Auth | JWT + bcrypt |
| QR | HMAC-SHA256 signed tokens |
| Proxy | Nginx |
| Deploy | Docker Compose |

---

*Built as a cybersecurity-focused project demonstrating secure backend development, authentication, cryptographic signing, RBAC, and real-world system architecture.*
