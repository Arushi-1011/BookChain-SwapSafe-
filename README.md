# BookChain — SwapSafe

**A full-stack, peer-to-peer textbook exchange platform for students.** Browse books listed by other students, publish your own listing, propose a book-for-book exchange, and manage requests through to completion.

> BookChain started as a vanilla HTML/CSS/JavaScript prototype. This version keeps its original visual direction and adds a Node.js/Express API, MongoDB persistence, secure password hashing, cookie-based authentication, and real swap workflows.

## Features

- **Marketplace:** browse available books; search by title, author, subject or campus; filter by subject and condition.
- **Accounts:** register, sign in and sign out. Passwords are hashed with bcrypt; the signed session token is stored in an HTTP-only cookie.
- **Persistent listings:** create, edit and delete your books. The API validates every listing and restricts edits/deletions to its owner.
- **Book exchanges:** request a swap by offering one of your available books; owners can accept or decline; either participant can mark an accepted exchange complete.
- **Swap dashboard:** incoming, outgoing and completed requests with status timelines.
- **Student profile:** update course/year/campus details, view active listings and swap statistics, and manage your own listings.
- **Live aggregate stats:** marketplace counts are calculated from the database instead of hard-coded numbers.
- **Security foundations:** HTTP-only SameSite cookies, bcrypt password hashing, JWT expiry, Helmet security headers, request limits, server-side validation, and ownership checks.
- **Responsive UI:** existing custom HTML/CSS/vanilla JavaScript interface; no frontend framework required.
- **Automated model tests:** built-in Node.js test runner checks important database schema constraints.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript |
| Backend | Node.js, Express.js, REST API |
| Database | MongoDB with Mongoose |
| Authentication | bcryptjs + JWT in an HTTP-only cookie |
| Security | Helmet, express-rate-limit, server-side validation |
| Testing | Node.js built-in test runner |
| Tooling | npm, Git, GitHub |

## Project structure

```text
BookChain-SwapSafe/
├── public/
│   ├── index.html
│   ├── css/
│   │   ├── reset.css
│   │   └── style.css
│   └── js/
│       └── app.js
├── models/
│   ├── User.js
│   ├── Book.js
│   └── SwapRequest.js
├── routes/
│   ├── auth.js
│   ├── books.js
│   └── swaps.js
├── middleware/
│   └── auth.js
├── scripts/
│   └── seed.js
├── tests/
│   └── models.test.js
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

## Run locally

### Requirements

- Node.js 20 or newer
- npm
- A MongoDB database. MongoDB Atlas is the easiest option; a local MongoDB instance also works.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and replace the placeholders:

```bash
cp .env.example .env
```

Set:

- `MONGODB_URI` — your MongoDB Atlas connection string (or local MongoDB URI)
- `JWT_SECRET` — a long random string of at least 32 characters
- `PORT` — optional; defaults to `3000`
- `NODE_ENV` — use `development` locally and `production` when deployed behind HTTPS

**Never commit `.env` or share your database credentials / JWT secret.** In Atlas, create a database user and allow network access from your development machine. Use a least-privilege database user.

### 3. Add sample marketplace books (optional)

```bash
npm run seed
```

The seed script adds example books under `demo@bookchain.local` only when that demo user has no existing books. The default local demo password is `DemoBookChain2026!`; you can override it with `SEED_DEMO_PASSWORD` before running the seed command. This account is for local demonstration only—change or remove it before any public deployment. Do not run the demo seed against a production database.

### 4. Start the server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Express server serves the frontend and API from the same origin, so no separate frontend server or CORS configuration is needed.

### 5. Run checks

```bash
npm run check
npm test
```

`npm run check` validates JavaScript syntax. `npm test` runs model validation tests; it does not require a live MongoDB connection.

## API overview

All endpoints return JSON. Protected endpoints expect the HTTP-only `bookchain_token` cookie created during sign-in.

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account and start a session |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Clear the session cookie |
| `GET` | `/api/auth/me` | Get current user |
| `PATCH` | `/api/auth/profile` | Update the user's profile |
| `GET` | `/api/auth/profile/stats` | Get personal listing/swap stats |

### Books

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/books` | Browse and filter available books |
| `GET` | `/api/books?mine=true` | Get the signed-in user's listings |
| `POST` | `/api/books` | Create a listing |
| `PATCH` | `/api/books/:id` | Update an owned listing |
| `DELETE` | `/api/books/:id` | Delete an available owned listing |

Query parameters for `GET /api/books` include `q`, `subject`, `condition` and `mine=true`.

### Swaps

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/swaps?tab=incoming` | Incoming pending/accepted requests |
| `GET` | `/api/swaps?tab=outgoing` | Requests sent by the current user |
| `GET` | `/api/swaps?tab=completed` | Completed exchanges |
| `GET` | `/api/swaps/summary` | Request counts for tabs/notifications |
| `POST` | `/api/swaps` | Request a swap by offering one of your books |
| `PATCH` | `/api/swaps/:id/status` | Accept, decline, cancel or complete a request (subject to permissions) |

### Utility

- `GET /api/health` — health check
- `GET /api/stats` — live marketplace counts

## Data model

- **User:** identity, unique email, password hash, year, course, campus.
- **Book:** title, author, subject, condition, ISBN, notes, campus, owner and availability state.
- **SwapRequest:** requested book, offered book, requester, owner, status and timestamps.

Accepted swaps reserve both books; completing a swap marks both as swapped so they are no longer available in the marketplace.

## Design / engineering decisions

- The existing custom UI was retained instead of rewriting the frontend in React solely to change frameworks.
- The API and frontend run on one origin to keep local development simple and avoid unnecessary CORS configuration.
- Authentication uses an HTTP-only cookie rather than exposing the JWT to frontend JavaScript.
- Marketplace counts are read from MongoDB; they are not presented as invented usage metrics.
- The API—not just the browser—enforces listing ownership and swap state transitions.

## Current scope and future improvements

- Add integration tests that exercise routes against a dedicated test database.
- Add atomic transactions for simultaneous swap acceptance and cancellation edge cases.
- Add a mutual completion confirmation step before permanently completing an exchange.
- Add optional cover-photo uploads, in-app messaging, email notifications and moderation tools.
- Consider a blockchain-based proof of completed swaps as a separate layer. Core user data and book listings do not need to be on-chain.
- Deploy the API and database with HTTPS, a production secret, and no public demo account.

## Author

**Arushi Srivastava** · [GitHub](https://github.com/Arushi-1011)
