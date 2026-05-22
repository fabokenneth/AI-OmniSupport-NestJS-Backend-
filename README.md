# AI-OmniSupport

Multi-tenant RAG orchestrator that allows companies to ingest documents (PDF / Markdown) and deploy AI-powered customer support agents across multiple channels (WhatsApp, Web Widget).

Built with **NestJS 10** and **TypeScript**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Auth Flow](#auth-flow)
- [Scripts](#scripts)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)

---

## Features

- **Multi-tenancy** — full data isolation per company; every query is scoped by `company_id`
- **JWT Auth** — access tokens (15 min) + refresh token rotation (7 days, bcrypt-hashed)
- **RBAC** — three roles: `Admin`, `Manager`, `Agent` enforced via `RolesGuard`
- **Company bootstrapping** — atomic `Company + Admin` creation in a single DB transaction
- **RAG pipeline** — LangChain.js + pgvector for document ingestion and semantic search *(in progress)*
- **Multi-channel** — WhatsApp Cloud API webhook handling *(in progress)*
- **Swagger UI** — interactive API docs at `/api/docs`
- **Global exception filter** + unified response envelope on all endpoints

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 10 (TypeScript) |
| Database | PostgreSQL + pgvector |
| ORM | TypeORM |
| AI / RAG | LangChain.js + OpenAI / Mistral |
| Document Storage | AWS S3 |
| Auth | Passport.js · JWT · bcrypt |
| Validation | class-validator · class-transformer |
| API Docs | Swagger (OpenAPI 3) |
| Runtime | Node.js 24 |

---

## Architecture

```
src/
├── auth/                 # JWT auth, refresh token rotation, RBAC guards & strategies
├── companies/            # Tenant management (GET /me, PUT /me — Admin only)
├── ai-configuration/     # AI assistant identity, tone, and instruction rules (1:1 per company)
├── knowledge-base/       # Document upload, splitting, vectorisation via pgvector
├── messaging/            # Chat logic + RAG orchestration pipeline
├── connectors/           # Webhook handlers (WhatsApp Cloud API)
└── common/               # Global filter, response interceptor, decorators
```

All modules are fully isolated. Cross-tenant data access is architecturally impossible — `company_id` is always derived from the JWT, never from the request body.

---

## Prerequisites

- [Node.js 24](https://nodejs.org/) (use `nvm use` — `.nvmrc` is included)
- [Docker](https://www.docker.com/) + Docker Compose
- An OpenAI or Mistral API key *(for RAG features, when available)*

---

## Getting Started

### 1. Clone & install

```bash
git clone <repo-url>
cd Ai-OmniSupport
nvm use
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values — see [Environment Variables](#environment-variables) below.

### 3. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL with the `pgvector` extension pre-installed. The `init-pgvector.sql` script runs automatically on first boot.

### 4. Start the API

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

The API is available at `http://localhost:3000/api`.  
Swagger UI is available at `http://localhost:3000/api/docs`.

---

## Environment Variables

Copy `.env.example` to `.env` and update each value.

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | HTTP port | `3000` |
| `CORS_ORIGIN` | Allowed CORS origin | `*` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | Database user | `omnisupport` |
| `DB_PASSWORD` | Database password | — |
| `DB_NAME` | Database name | `omnisupport` |
| `DB_SYNC` | Auto-sync schema (disable in prod) | `true` |
| `DB_SSL` | Enable SSL for DB connection | `false` |
| `JWT_ACCESS_SECRET` | Secret for access tokens | — |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | — |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |
| `AWS_ACCESS_KEY_ID` | AWS credentials | — |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | — |
| `AWS_REGION` | S3 bucket region | `eu-west-1` |
| `AWS_S3_BUCKET` | S3 bucket name | — |
| `WHATSAPP_WEBHOOK_SECRET` | HMAC secret for webhook validation | — |

> **Never commit `.env`** — it is gitignored. Only `.env.example` belongs in version control.

---

## API Documentation

Interactive Swagger docs are available at `/api/docs` when the server is running.

All endpoints are prefixed with `/api`.

### Auth endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register-company` | Public | Create company + first Admin (atomic) |
| `POST` | `/api/auth/login` | Public | Returns `accessToken` + `refreshToken` |
| `POST` | `/api/auth/register` | Admin JWT | Invite a Manager or Agent |
| `POST` | `/api/auth/refresh` | — | Rotate token pair via `refreshToken` |
| `POST` | `/api/auth/logout` | JWT | Invalidate refresh token |
| `GET` | `/api/auth/me` | JWT | Current user profile |

### Company endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/companies/me` | Admin JWT | Get own company profile |
| `PUT` | `/api/companies/me` | Admin JWT | Update own company profile |

### AI Configuration endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/ai-config` | JWT | Fetch the company's AI assistant configuration |
| `PUT` | `/api/ai-config` | JWT | Create or overwrite the AI assistant configuration |

---

## Auth Flow

```
1. POST /api/auth/register-company   → creates Company + Admin user (one transaction)
2. POST /api/auth/login              → returns accessToken (15m) + refreshToken (7d)
3. POST /api/auth/register           → Admin invites Manager or Agent (companyId from JWT)
4. POST /api/auth/refresh            → rotates both tokens using refreshToken from body
5. POST /api/auth/logout             → clears stored refresh token hash
6. GET  /api/auth/me                 → returns profile (password + refreshToken excluded)
```

> The `companyId` is always read from the JWT — passing it in the request body has no effect.

---

## Scripts

```bash
npm run start:dev       # Start in watch mode (development)
npm run start:debug     # Start with debugger attached
npm run start:prod      # Start compiled output (production)
npm run build           # Compile TypeScript to dist/
npm run lint            # ESLint + auto-fix
npm run format          # Prettier format

npm run test            # Unit tests
npm run test:watch      # Unit tests in watch mode
npm run test:cov        # Unit tests with coverage report
npm run test:e2e        # End-to-end tests

npm run migration:generate -- -d <datasource> src/migrations/<Name>
npm run migration:run    -- -d <datasource>
npm run migration:revert -- -d <datasource>
```

---

## Testing

```bash
# Unit tests (Jest + ts-jest)
npm run test

# E2E tests (Supertest against a real DB)
npm run test:e2e

# Coverage report
npm run test:cov
```

Current coverage:

| Suite | Tests | Status |
|---|---|---|
| `AuthService` unit tests | 14 | Passing |
| Auth E2E (`/api/auth/*`) | 20 | Passing |
| `AiConfigurationService` unit tests | 5 | Passing |
| AI Config E2E (`/api/ai-config`) | 9 | Passing |

> E2E tests do not require a running database — all repositories are mocked.

---

## Project Structure

```
.
├── docker-compose.yml          # PostgreSQL + pgvector service
├── scripts/
│   └── init-pgvector.sql       # Enables the vector extension on first boot
├── requests.http               # Live API test file (VS Code REST Client / IntelliJ)
├── src/
│   ├── main.ts                 # Bootstrap: global pipes, filters, Swagger
│   ├── app.module.ts
│   ├── auth/
│   │   ├── dto/                # login, register, register-company, refresh-token, tokens
│   │   ├── entities/           # User entity
│   │   ├── enums/              # UserRole (Admin | Manager | Agent)
│   │   ├── guards/             # JwtAuthGuard, JwtRefreshGuard, RolesGuard
│   │   ├── strategies/         # JwtStrategy, JwtRefreshStrategy
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.service.spec.ts
│   ├── companies/
│   │   ├── dto/                # create-company, update-company
│   │   ├── entities/           # Company entity
│   │   ├── companies.controller.ts
│   │   └── companies.service.ts
│   ├── ai-configuration/
│   │   ├── dto/                # upsert-ai-configuration
│   │   ├── entities/           # AiConfiguration entity
│   │   ├── enums/              # Tone (professional | warm | casual | technical)
│   │   ├── ai-configuration.controller.ts
│   │   ├── ai-configuration.service.ts
│   │   └── ai-configuration.service.spec.ts
│   ├── knowledge-base/
│   │   ├── dto/                # upload-document
│   │   ├── entities/           # Document entity
│   │   └── enums/              # DocumentStatus
│   ├── messaging/
│   │   ├── dto/                # send-message
│   │   ├── entities/           # Conversation entity
│   │   └── enums/              # Channel (whatsapp | web)
│   ├── connectors/
│   │   └── dto/                # whatsapp-webhook
│   └── common/
│       ├── decorators/         # @CurrentUser(), @Roles()
│       ├── filters/            # AllExceptionsFilter
│       └── interceptors/       # TransformResponseInterceptor
└── test/
    ├── auth.e2e-spec.ts
    ├── ai-configuration.e2e-spec.ts
    └── jest-e2e.json
```

---

## Roadmap

- [x] Modular project scaffold (Auth, Companies, KnowledgeBase, Messaging, Connectors)
- [x] Company bootstrapping — atomic `register-company` transaction
- [x] JWT auth with refresh token rotation + RBAC
- [x] Unit tests — AuthService (14 tests)
- [x] E2E tests — Auth endpoints (20 tests)
- [x] AI Configuration module — `GET/PUT /api/ai-config` (upsert, 1:1 per company)
- [x] Unit tests — AiConfigurationService (5 tests)
- [x] E2E tests — AI Config endpoints (9 tests)
- [ ] LangChain RAG pipeline in `MessagingService`
- [ ] AWS S3 document upload in `KnowledgeBaseService`
- [ ] HMAC-SHA256 signature validation for WhatsApp webhooks
- [ ] TypeORM migrations (replace `DB_SYNC=true` before production)
