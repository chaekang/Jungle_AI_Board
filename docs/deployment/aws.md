# AWS Deployment Checklist

This project can be deployed as three services:

- `nest-api`: public NestJS API for auth, reviews, admin, and RAG.
- `fastapi-api`: seat recommendation and MCP helper API.
- `web-react`: static React app served by Nginx.

Use `docker-compose.aws.example.yml` only as a production-like local build/run
example. In AWS, build each image into ECR and run them through ECS/Fargate or
an equivalent container platform.

## Required AWS Resources

1. RDS PostgreSQL 16 with `pgvector` enabled.
2. Secrets Manager or SSM Parameter Store for all values in `.env.aws.example`.
3. Application Load Balancer with HTTPS listeners.
4. Security groups:
   - ALB can reach `web-react`, `nest-api`, and optionally `fastapi-api`.
   - App tasks can reach RDS.
   - RDS is not public.
5. Optional but recommended: AWS WAF rate limits on `/rag/questions`,
   `/auth/login`, and write-heavy endpoints.

## Environment Setup

Copy `.env.aws.example` to `.env.aws` only for local production-like runs. The
real AWS values should live in Secrets Manager or SSM, not in git.

Important production values:

- `DATABASE_URL`: RDS URL with `sslmode=require`.
- `JWT_SECRET`: 64-byte random value.
- `GOOGLE_OAUTH_CLIENT_SECRET`: secret from Google Cloud Console.
- `GOOGLE_OAUTH_REDIRECT_URI`: `https://<api-domain>/auth/google/callback`.
- `OPENAI_API_KEY`: OpenAI API key for RAG.
- `CORS_ORIGINS`: exact frontend origin allowlist.
- `WEB_APP_ORIGIN`: exact frontend app origin.
- `AUTH_COOKIE_SECURE=true`.
- `AUTH_COOKIE_SAME_SITE=lax` when frontend and API are same-site.
- `TRUST_PROXY_HOPS=1` behind one ALB hop.

If the frontend and API require cross-site cookies and you set
`AUTH_COOKIE_SAME_SITE=none`, add CSRF token validation before going public.

## Build Locally

From the repository root:

```powershell
docker compose --env-file .env.aws -f docker-compose.aws.example.yml build
```

To validate the example without real secrets:

```powershell
$env:AWS_ENV_FILE=".env.aws.example"
docker compose --env-file .env.aws.example -f docker-compose.aws.example.yml config
```

Run locally:

```powershell
docker compose --env-file .env.aws -f docker-compose.aws.example.yml up
```

The local compose example exposes:

- React: `http://localhost:8080`
- Nest API: `http://localhost:3000`
- FastAPI: `http://localhost:8000`

## Database Migration

Run migrations before sending traffic to a new Nest API deployment:

```powershell
docker run --rm --env-file .env.aws <nest-api-image> npx prisma migrate deploy
```

Seed data only when intentionally preparing a demo or staging environment:

```powershell
docker run --rm --env-file .env.aws <nest-api-image> npm run db:seed
```

## Public Endpoint Safety

The RAG indexing endpoints are admin-protected:

- `POST /rag/index`
- `POST /rag/index/:reviewId`

The public question endpoint has an application-level per-IP rate limit:

- `RAG_QUESTION_RATE_LIMIT_MAX_REQUESTS`
- `RAG_QUESTION_RATE_LIMIT_WINDOW_MS`

Keep AWS WAF or ALB throttling in front of the service for stronger distributed
rate limiting.

## Go/No-Go

Before production traffic:

1. `npm --prefix apps/nest-api run test -- --runInBand`
2. `npm --prefix apps/nest-api run build`
3. `npm --prefix apps/web-react run test`
4. `npm --prefix apps/web-react run build`
5. `PYTHONPATH=apps/fastapi-api python -m pytest apps/fastapi-api/tests -p no:cacheprovider`
6. `docker compose --env-file .env.aws -f docker-compose.aws.example.yml build`

Do not deploy with local database credentials, public RDS access, wildcard CORS,
or missing HTTPS cookie settings.
