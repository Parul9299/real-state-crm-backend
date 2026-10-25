# EstateFlow CRM Backend

Node.js + Express + MongoDB/Mongoose + Socket.IO backend. The API preserves the frontend's existing property/lead/activity/message field names where practical.

## Prerequisites
- Node.js 20+
- MongoDB 7+ (local or managed)
- Existing Vite frontend at `http://localhost:5173`

## Start locally
```bash
cd backend
npm install
cp .env.example .env
# Edit .env; generate a long random JWT_ACCESS_SECRET.
npm run create-admin
npm run dev
```
The bootstrap command creates a workspace and its first admin only if the email does not already exist. It does not create a public registration endpoint.

Health check: `GET http://localhost:4000/api/health`

## Frontend integration
Set `VITE_API_URL=http://localhost:4000/api` in the frontend `.env.local`. Replace `src/lib/supabase.ts` usage with an API client and remove direct Supabase access. This backend requires authentication; add a login screen and call:
- `POST /api/auth/login` with `{ "email": "...", "password": "..." }`
- Keep `accessToken` in memory; send `Authorization: Bearer <accessToken>` on API calls.
- The refresh token is an HttpOnly cookie. Use `credentials: "include"` on requests and `POST /api/auth/refresh` when an access token expires.
- `POST /api/auth/logout` revokes the refresh session.
For cookie-based refresh to work, frontend requests must use credentials and the origin must exactly match `CLIENT_ORIGIN`.

## Main API routes
- `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET|POST /api/properties`, `GET|PATCH|DELETE /api/properties/:id`
- `GET|POST /api/leads`, `GET|PATCH|DELETE /api/leads/:id`
- `GET|POST /api/activities`, `PATCH|DELETE /api/activities/:id`
- `GET|POST /api/messages`, `DELETE /api/messages/:id`
- `GET /api/team-members`, `GET /api/dashboard`
- WebSocket events: `message:new`, `lead:updated`, `activity:updated`, `notification:new`

All resource queries are scoped to the authenticated user's workspace. Roles: `admin`, `manager`, `agent`. Agents can create/update CRM records but cannot delete properties/leads/messages; only admin/manager can delete. Only admin can manage workspace/team membership (team invitation endpoints are intentionally not exposed in this starter).

## Security notes
- Do not expose MongoDB credentials, JWT secrets, or any private service key in the frontend.
- Use HTTPS and `COOKIE_SECURE=true` in production; set `CLIENT_ORIGIN` to the exact production frontend origin.
- Use a dedicated MongoDB user with least privilege, network allowlisting, backups, and TLS.
- Configure a managed secret store and rotate secrets. Add monitoring, backup-restore drills, dependency scanning, and integration tests before production launch.
- Refresh tokens are opaque, HttpOnly cookies and are stored hashed server-side; logout revokes the session. Access JWTs are short-lived.
- This is a security-focused starter, not a guarantee of absolute security. Perform a deployment-specific security review before handling real customer data.
# real-state-crm-backend
