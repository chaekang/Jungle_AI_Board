# Jungle AI Board

Seat review board for musical and theater venues. The workspace contains a
NestJS API, a FastAPI agent service, a React frontend, and PostgreSQL with
pgvector.

## Apps

```text
apps/
  nest-api/      NestJS API: auth, reviews, comments, tags, admin, RAG
  fastapi-api/   FastAPI service: seat recommendation, MCP/demo helpers
  web-react/     React + Vite frontend served by Nginx in Docker
```

## Quick Start With Docker

This is the cheapest deployable shape: one small VM, one Docker Compose stack,
one public web port, and internal API containers.

```powershell
npm run compose:up
```

Open `http://localhost:8080`.

Useful commands:

```powershell
npm run compose:ps
npm run compose:logs
npm run compose:down
```

The default stack runs:

- React/Nginx on `http://localhost:8080`
- NestJS internally at `nest-api:3000`, proxied through `/api`
- FastAPI internally at `fastapi-api:8000`, proxied through `/agent`, `/mcp`, and `/demo`
- PostgreSQL on the Docker network and on local host `127.0.0.1:5432`

Nest migrations run automatically before the API starts.

## Production Environment

For a real server, create a `.env` file next to `docker-compose.yml` and override
at least these values:

```dotenv
WEB_PORT=80
POSTGRES_PASSWORD=replace-with-a-long-random-password
JWT_SECRET=replace-with-a-64-byte-random-secret
GOOGLE_OAUTH_STATE_SECRET=replace-with-a-64-byte-random-secret
CORS_ORIGINS=https://your-domain.com
WEB_APP_ORIGIN=https://your-domain.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=lax
OPENAI_API_KEY=sk-...
```

Generate secrets with:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
```

Deploy or update on the server:

```powershell
git pull
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
```

Use a low-cost VM to start: 1-2 vCPU, 2 GB RAM, 20-30 GB disk. Put HTTPS in
front with Caddy, Nginx Proxy Manager, Cloudflare Tunnel, or your cloud load
balancer. Keep PostgreSQL private; the compose file only binds it to
`127.0.0.1`.

## Local Development

Install dependencies:

```powershell
npm run install:all
```

Start only PostgreSQL:

```powershell
npm run db:up
```

Run each app in dev mode:

```powershell
npm run nest:start
npm run web:dev
cd apps/fastapi-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

For local NestJS development, set `DATABASE_URL` before running migrations:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/agentic_board?schema=public"
npm run nest:migrate
```

## Verification

```powershell
npm run build
npm run test
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build
```

FastAPI tests require the Python dependencies from `apps/fastapi-api/requirements.txt`
and the root `requirements.txt`.

## Notes

- Do not deploy publicly with the default secrets from `docker-compose.yml`.
- Google OAuth requires real Google credentials and a redirect URI that matches
  your domain.
- RAG features require `OPENAI_API_KEY`; the rest of the app can run without it.
- More AWS-specific notes live in `docs/deployment/aws.md`.
