# 🏆 AthleticsDashboard

A comprehensive Next.js 15 application designed for athletic directors to efficiently manage game schedules, teams, opponents, and venues. This modern web application streamlines athletic program management with powerful features like Google Calendar integration, AI-powered travel planning, and automated email communications.

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Prisma Migration Troubleshooting](#-prisma-migration-troubleshooting)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Key Features Explained](#key-features-explained)
- [API Routes](#api-routes)
- [Deployment](#deployment)
- [Scripts](#scripts)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

AthleticsDashboard is a powerful sports management platform built to solve the complex challenges faced by athletic directors in managing multiple sports programs, coordinating schedules, and communicating with teams and staff. The application provides a centralized hub for:

- **Athletic Directors** to oversee all sports programs and manage schedules
- **Coaches** to view their team schedules and receive updates
- **Administrative Staff** to coordinate travel, venues, and communications

### Target Audience

- High school athletic directors
- College sports administrators
- Multi-sport athletic programs
- School district athletic coordinators

### Problem It Solves

Athletic directors juggle numerous responsibilities across multiple sports, teams, and venues. This application consolidates:
- ✅ Complex scheduling across seasons and sports
- ✅ Communication with coaches, staff, and vendors
- ✅ Travel coordination and budget tracking
- ✅ Conflict detection and resolution
- ✅ Calendar synchronization across platforms
- ✅ Data import/export for reporting

## ✨ Key Features

### 🗓️ Game Scheduling Workspace
- **Inline CRUD operations** - Create, read, update, and delete games directly in the interface
- **Advanced filtering** - Filter by sport, team level, date range, status, and custom fields
- **Custom columns** - Add organization-specific data fields to game records
- **Drag-and-drop sorting** - Reorder opponents and manage priorities
- **Bulk operations** - Update multiple games simultaneously

### 📊 Management Modules
- **Team Management** - Organize teams by sport, level (Varsity, JV, Freshman), and gender
- **Opponent Management** - Maintain opponent database with contact info, colors, and mascots
- **Venue Management** - Track locations with addresses, coordinates, and venue-specific notes
- **User Roles** - Control access with roles: Super Admin, Athletic Director, Assistant AD, Coach, Staff, Vendor

### 📅 Google Calendar Integration
- **Two-way sync** - Automatically sync games to Google Calendar
- **Real-time updates** - Changes in the app reflect in Google Calendar
- **Bulk sync** - Sync entire seasons or filtered game sets
- **OAuth authentication** - Secure Google account integration

### 📧 Communication Tools
- **Bulk email campaigns** - Send updates to coaches, staff, or custom groups
- **Email groups** - Organize contacts into reusable distribution lists
- **Game notifications** - Automated alerts for schedule changes
- **Email tracking** - Monitor sent emails and delivery status
- **Rich HTML emails** - Professional, branded email templates

### 📁 Data Management
- **CSV import** - Bulk import games from spreadsheets
- **CSV export** - Export schedules for reporting and sharing
- **Data validation** - Ensure data integrity during import
- **Mock data seeding** - Quick setup with sample data

### 🤖 AI-Powered Features
- **Travel recommendations** - OpenAI generates optimal departure times and bus requirements
- **Cost estimation** - Automatic calculation of travel expenses
- **Conflict detection** - AI identifies scheduling conflicts and venue overlaps
- **Smart scheduling** - Suggestions based on historical data and constraints

### 📈 Analytics Dashboard
- **Upcoming games summary** - Quick view of next week's schedule
- **Travel metrics** - Budget tracking and distance calculations
- **Team performance** - Win/loss records and season progress
- **Custom reports** - Generate insights specific to your organization

### 💳 Subscription Management
- **Stripe integration** - Secure payment processing
- **Multiple plans** - Free trial, Standard, and Business tiers
- **Customer portal** - Self-service subscription management
- **Usage tracking** - Monitor plan limits and features

## 🛠️ Tech Stack

### Frontend
- **[Next.js 15](https://nextjs.org/)** - React framework with App Router
- **[React 19](https://react.dev/)** - UI library
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Material UI (MUI)](https://mui.com/)** - Component library
- **[TanStack Query](https://tanstack.com/query)** - Data fetching and caching
- **[Zustand](https://zustand-demo.pmnd.rs/)** - Lightweight state management
- **[React Hook Form](https://react-hook-form.com/)** - Form handling
- **[Zod](https://zod.dev/)** - Schema validation
- **[date-fns](https://date-fns.org/)** - Date utilities

### Backend
- **[Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)** - Serverless API endpoints
- **[Prisma ORM](https://www.prisma.io/)** - Database toolkit
- **[Knex.js](https://knexjs.org/)** - SQL query builder
- **[PostgreSQL](https://www.postgresql.org/)** - Relational database

### Authentication & Authorization
- **[NextAuth.js](https://next-auth.js.org/)** - Authentication library
- **Google OAuth** - Social login
- **Credentials Provider** - Email/password authentication
- **bcryptjs** - Password hashing

### Integrations
- **[Google Calendar API](https://developers.google.com/calendar)** - Calendar synchronization
- **[Google Maps API](https://developers.google.com/maps)** - Travel time calculations
- **[Resend](https://resend.com/)** - Transactional email service
- **[OpenAI](https://openai.com/)** - AI-powered recommendations
- **[Stripe](https://stripe.com/)** - Payment processing

### Developer Tools
- **[ESLint](https://eslint.org/)** - Code linting
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS
- **[Docker](https://www.docker.com/)** - Containerization (optional)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20.x or higher ([Download](https://nodejs.org/))
- **Yarn** 1.x package manager ([Install](https://classic.yarnpkg.com/en/docs/install))
- **PostgreSQL** 14+ database ([Download](https://www.postgresql.org/download/))
- **Git** version control ([Download](https://git-scm.com/downloads))

### External Service Accounts (Required for full functionality)
- Google Cloud Platform account (for OAuth and Calendar API)
- Resend account (for email services)
- OpenAI account (for AI features)
- Stripe account (for subscription management)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/athletics-dashboard.git
cd athletics-dashboard
```

### 2. Install Dependencies

```bash
yarn install
```

This will also automatically run `prisma generate` via the postinstall script.

### 3. Configure Environment Variables

Copy the example environment file and update it with your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values (see [Environment Variables](#environment-variables) section).

### 4. Set Up the Database

See the [Database Setup](#database-setup) section for detailed instructions.

### 5. Run Database Migrations

For development, run migrations to set up your database schema:

```bash
yarn prisma migrate dev
```

> **Note:** In production deployments, migrations are **not** run automatically. See the [Database Migrations in Production](#database-migrations-in-production) section for details.

### 6. Seed the Database (Optional)

Populate the database with sample data:

```bash
yarn prisma db seed
```

### 7. Start the Development Server

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔐 Environment Variables

Create a `.env.local` file in the root directory with the following variables:

### Database Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/athletics_dashboard` |

### NextAuth Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXTAUTH_SECRET` | Secret key for NextAuth.js (generate with `openssl rand -base64 32`) | `your-secret-key-here` |
| `NEXTAUTH_URL` | Base URL of your application | `http://localhost:3000` |

### Google OAuth & Calendar

| Variable | Description | How to Get |
|----------|-------------|------------|
| `GOOGLE_CALENDAR_CLIENT_ID` | Google OAuth 2.0 Client ID | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Google OAuth 2.0 Client Secret | Same as above |
| `GOOGLE_REDIRECT_URI` | Authorized OAuth callback URL registered with Google | Typically `http://localhost:3000/api/auth/calendar-callback` in development |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key for distance calculations | Google Cloud Console → APIs & Services → Enable Maps JavaScript API |

### Email Service (Resend)

| Variable | Description | How to Get |
|----------|-------------|------------|
| `RESEND_API_KEY` | Resend API key for sending emails | [Resend Dashboard](https://resend.com/api-keys) |
| `EMAIL_FROM` | Sender email address | `"AD Hub <noreply@yourdomain.com>"` |

### OpenAI

| Variable | Description | How to Get |
|----------|-------------|------------|
| `OPENAI_API_KEY` | OpenAI API key for AI features | [OpenAI API Keys](https://platform.openai.com/api-keys) |

### Stripe Payment Processing

| Variable | Description | How to Get |
|----------|-------------|------------|
| `STRIPE_SECRET_KEY` | Stripe secret key | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe Dashboard → Developers → Webhooks |

### Other

| Variable | Description | Values |
|----------|-------------|--------|
| `NODE_ENV` | Environment mode | `development`, `production`, or `test` |

> **Note:** Never commit `.env.local` to version control. Use `.env.example` as a template.

## 🗄️ Database Setup

### PostgreSQL Installation

#### macOS (using Homebrew)
```bash
brew install postgresql@14
brew services start postgresql@14
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

#### Windows
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

### Create the Database

```bash
# Access PostgreSQL
psql postgres

# Create database
CREATE DATABASE athletics_dashboard;

# Create user (optional)
CREATE USER your_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE athletics_dashboard TO your_user;

# Exit
\q
```

### Run Migrations

```bash
# Run all pending migrations
yarn prisma migrate dev

# Or deploy migrations in production
yarn prisma migrate deploy
```

### Seed Data

The seed script populates your database with:
- Sample organization (Central High School)
- Default user (dev@example.com)
- Sports (Football, Basketball, Soccer, Volleyball, Baseball, Softball)
- Teams at various levels
- Opponents with mascots and colors
- Venues with addresses
- Sample games

```bash
yarn prisma db seed
```

### Prisma Studio

View and edit your database with Prisma's GUI:

```bash
yarn prisma studio
```

Open [http://localhost:5555](http://localhost:5555)

## 🛡️ Prisma Migration Troubleshooting

When Prisma reports an error such as `P3009` referencing the `20251024000526_new_migration`, the target database still records that migration as failed in the `_prisma_migrations` table. Follow the checklist below to bring the database back to a consistent state and keep future deployments safe.

### Quick commands

| Task | Command |
|------|---------|
| Check migration status | `yarn migrate:status` |
| Mark `20251024000526_new_migration` as rolled back | `yarn migrate:resolve:rollback 20251024000526_new_migration` |
| Mark a migration as applied (only if schema already matches) | `yarn migrate:resolve:applied <migration_id>` |
| Deploy pending migrations | `yarn migrate:deploy` |
| Pre-deployment health check | `yarn migrate:check` |
| Reset local database (destructive) | `yarn prisma migrate reset` |

These commands wrap the helper scripts in `scripts/prisma-migration-troubleshoot.sh` and `scripts/prisma-predeploy-check.sh` for convenience.

### 1. Check the database state

1. Export the database connection string (example for DigitalOcean – replace placeholders with your credentials):
   ```bash
   export DATABASE_URL="postgresql://<user>:<password>@app-2dd01d8a-31e6-4723-b689-814bd76312a9-do-user-11349805-0.h.db.ondigitalocean.com:25060/adscheduler?schema=public&sslmode=require"
   ```
2. Run the status command to see whether any migrations are pending, failed, or drifted:
   ```bash
   yarn migrate:status
   ```
   This wraps `npx prisma migrate status` and requires `DATABASE_URL` to be set.

### 2. Resolve the failed migration safely

- If the migration failed part-way through (most common), mark it as **rolled back** so Prisma can attempt it again:
  ```bash
  yarn migrate:resolve:rollback 20251024000526_new_migration
  # Equivalent: npx prisma migrate resolve --rolled-back 20251024000526_new_migration
  ```
- If you manually verified that the changes already exist in the database, mark it as **applied** instead:
  ```bash
  yarn migrate:resolve:applied 20251024000526_new_migration
  # Equivalent: npx prisma migrate resolve --applied 20251024000526_new_migration
  ```
- Re-run the migrations to apply the updated SQL (we added automatic data backfills and de-duplication for `EmailGroup` in this migration so it can succeed when retried):
  ```bash
  yarn migrate:deploy
  ```

### 3. Understand why the migration failed

1. Inspect the migration logs stored by Prisma:
   ```sql
   SELECT migration_name, finished_at, rolled_back_at, logs
   FROM "_prisma_migrations"
   WHERE migration_name = '20251024000526_new_migration';
   ```
2. Review the SQL at `prisma/migrations/20251024000526_new_migration/migration.sql`. The file now:
   - Backfills `EmailGroup.organizationId` from the owning user.
   - Renames duplicate group names per organization before enforcing the unique constraint.
   - Blocks the change if any `organizationId` would still be `NULL`.
3. If additional data cleanup is required, perform it manually and re-run the migration deploy command.

### 4. Add guard rails to deployments

- Run the pre-check script before starting any production instance (useful for CI/CD or container health checks):
  ```bash
  yarn migrate:check
  ```
  `scripts/prisma-predeploy-check.sh` exits non-zero when pending migrations or drift are detected so your pipeline can fail fast.
- Keep migration execution separate from starting the application (e.g., run `yarn migrate:deploy` or `yarn migrate:check` in a dedicated job before launching `yarn start`).

### 5. Development-only reset option

For local environments you can drop and recreate the database from scratch:
```bash
yarn prisma migrate reset
```
Do **not** use this in production because all data will be lost. Instead, resolve or roll back the problematic migration as shown above.

### 6. Include a runtime health check

If you run the app in Docker or on a PaaS, add a health/ready check that executes `yarn migrate:check`. This ensures the server only starts when the schema in the database matches the Prisma schema, preventing future startup failures caused by schema drift.

## 🏃 Running the Application

### Development Mode

Start the development server with hot reload:

```bash
yarn dev
```

Access the app at [http://localhost:3000](http://localhost:3000)

### Production Build

Build the optimized production bundle:

```bash
yarn build
```

### Production Server

Run the production server:

```bash
yarn start
```

### Production with Database Migration

**Note:** Automatic migrations during deployment have been disabled to prevent deployment failures. The `start:prod` script now only starts the server without running migrations.

To run database migrations manually when needed:

```bash
# Deploy pending migrations to production database
yarn migrate:deploy

# Or use the full command
npx prisma migrate deploy
```

Then start the production server:

```bash
yarn start:prod
```

> **Important:** Database migrations must be run manually before deploying new code that requires schema changes. This separation allows you to:
> - Control when migrations run
> - Handle migration failures without blocking deployments
> - Test migrations independently
> - Roll back or resolve problematic migrations before redeploying

### Type Checking

Run TypeScript type checking:

```bash
yarn type-check
```

## 📁 Project Structure

```
athletics-dashboard/
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── migrations/          # Database migrations
│   └── seed.ts              # Database seeding script
├── public/                  # Static assets
├── scripts/                 # Utility scripts
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/         # Authentication routes (login, signup, forgot password)
│   │   ├── api/            # API route handlers
│   │   │   ├── auth/       # NextAuth and OAuth endpoints
│   │   │   ├── games/      # Game CRUD operations
│   │   │   ├── teams/      # Team management
│   │   │   ├── opponents/  # Opponent management
│   │   │   ├── venues/     # Venue management
│   │   │   ├── calendar/   # Google Calendar sync
│   │   │   ├── email/      # Email sending and campaigns
│   │   │   ├── import/     # CSV import
│   │   │   ├── export/     # CSV export
│   │   │   ├── travel-recommendations/ # AI travel planning
│   │   │   ├── detection/  # Conflict detection
│   │   │   └── stripe/     # Payment processing
│   │   ├── dashboard/      # Protected dashboard pages
│   │   │   ├── games/      # Games management page
│   │   │   ├── teams/      # Teams page
│   │   │   ├── opponents/  # Opponents page
│   │   │   ├── venues/     # Venues page
│   │   │   ├── analytics/  # Dashboard analytics
│   │   │   ├── compose-email/ # Email composition
│   │   │   ├── compose-email-campaign/ # Email campaigns
│   │   │   ├── email-groups/ # Email group management
│   │   │   ├── csv-import/ # CSV import interface
│   │   │   ├── gsync/      # Google Calendar sync
│   │   │   └── settings/   # User settings
│   │   ├── onboarding/     # Onboarding flow
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Home page
│   ├── components/         # React components
│   │   ├── calendar/       # Calendar components
│   │   ├── communication/  # Email components
│   │   ├── dashboard/      # Dashboard widgets
│   │   ├── email/          # Email templates
│   │   ├── games/          # Game management components
│   │   ├── import-export/  # CSV import/export components
│   │   ├── opponents/      # Opponent components
│   │   ├── plans/          # Subscription plan components
│   │   ├── settings/       # Settings components
│   │   ├── travel/         # Travel components
│   │   └── utils/          # Utility components
│   ├── contexts/           # React context providers
│   ├── lib/                # Shared utilities
│   │   ├── database/       # Database clients (Prisma, Knex)
│   │   ├── google/         # Google API integration
│   │   ├── services/       # Business logic services
│   │   │   ├── calendar.service.ts  # Calendar sync logic
│   │   │   ├── email.service.ts     # Email sending logic
│   │   │   └── travel.service.ts    # Travel planning logic
│   │   ├── utils/          # Helper functions
│   │   └── stripe.ts       # Stripe configuration
│   ├── store/              # Zustand stores
│   ├── styles/             # CSS modules
│   └── middleware.ts       # Next.js middleware (auth protection)
├── types/                  # TypeScript type definitions
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
├── docker-compose.yml      # Docker setup (optional)
├── Dockerfile              # Docker image definition
├── next.config.ts          # Next.js configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## 🎯 Key Features Explained

### Game Scheduling Workspace

The games page (`/dashboard/games`) is the heart of the application:

- **DataGrid with inline editing** - Click any cell to edit game details
- **Filter panel** - Multi-criteria filtering with save/load functionality
- **Status management** - Track games as Scheduled, Confirmed, Postponed, Cancelled, or Completed
- **Travel planning** - Mark games requiring travel and get AI recommendations
- **Calendar sync buttons** - One-click sync to Google Calendar
- **Bulk actions** - Select multiple games for batch operations

### Google Calendar Synchronization

How it works:
1. User connects Google account via OAuth 2.0
2. App requests Calendar API permissions
3. Games can be synced individually or in bulk
4. Updates in the app automatically update the calendar event
5. Refresh tokens stored securely for long-term access

### AI Travel Recommendations

Using OpenAI's GPT-4 model:
1. Input: Game details, venue location, team size
2. Processing: AI calculates optimal departure time, bus count, and costs
3. Output: Comprehensive travel plan with reasoning
4. Fallback: Manual calculation if OpenAI is unavailable

### Email Campaign System

Features:
- Create reusable email groups
- Compose rich HTML emails
- Send to teams, coaches, or custom lists
- Track delivery status
- Email history and logs

### CSV Import/Export

Import games from spreadsheets:
- Drag-and-drop CSV files
- Column mapping interface
- Data validation and error reporting
- Bulk create games from external sources

Export schedules:
- Filter games to export
- Download as CSV
- Share with coaches and staff
- Import into other systems

## 🛣️ API Routes

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth.js handlers (login, logout, session)
- `GET /api/auth/calendar-connect` - Initiate Google Calendar OAuth
- `GET /api/auth/callback/google` - OAuth callback handler

### Games
- `GET /api/games` - List all games (with filters)
- `POST /api/games` - Create new game
- `GET /api/games/[id]` - Get game by ID
- `PUT /api/games/[id]` - Update game
- `DELETE /api/games/[id]` - Delete game

### Teams
- `GET /api/teams` - List all teams
- `POST /api/teams` - Create team
- `PUT /api/teams/[id]` - Update team
- `DELETE /api/teams/[id]` - Delete team

### Opponents
- `GET /api/opponents` - List opponents
- `POST /api/opponents` - Create opponent
- `PUT /api/opponents/[id]` - Update opponent
- `DELETE /api/opponents/[id]` - Delete opponent
- `PUT /api/opponents/reorder` - Update sort order

### Venues
- `GET /api/venues` - List venues
- `POST /api/venues` - Create venue
- `PUT /api/venues/[id]` - Update venue
- `DELETE /api/venues/[id]` - Delete venue

### Calendar
- `POST /api/calendar/sync` - Sync single game to Google Calendar
- `POST /api/calendar/sync-all` - Sync all games
- `DELETE /api/calendar/unsync/[id]` - Remove game from calendar

### Email
- `POST /api/email/send` - Send email
- `GET /api/email-campaigns` - List campaigns
- `POST /api/email-campaigns` - Create campaign
- `POST /api/email-campaigns/[id]/send` - Send campaign

### Import/Export
- `POST /api/import` - Import games from CSV
- `GET /api/export` - Export games to CSV

### AI Features
- `POST /api/travel-recommendations` - Get AI travel recommendations
- `GET /api/detection/conflicts` - Detect scheduling conflicts

### Stripe
- `POST /api/stripe/webhook` - Stripe webhook handler
- `POST /api/stripe/portal` - Create customer portal session

## 🚀 Deployment

### Vercel (Recommended)

The easiest way to deploy Next.js applications:

1. Push your code to GitHub
2. Import your repository on [Vercel](https://vercel.com/new)
3. Configure environment variables in Vercel dashboard
4. Deploy automatically on every push

```bash
# Or use Vercel CLI
npm i -g vercel
vercel
```

### Railway

Deploy with PostgreSQL included:

1. Create account on [Railway](https://railway.app/)
2. New Project → Deploy from GitHub
3. Add PostgreSQL plugin
4. Configure environment variables
5. Railway will auto-deploy

### DigitalOcean App Platform

DigitalOcean's App Platform can deploy this project directly from the repository or from a container image. When using the Node.js runtime, configure the app with:

1. **Build command:** `yarn prisma generate && yarn build`
2. **Run command:** `yarn prisma migrate deploy && yarn start`
3. **Environment:** set `NODE_VERSION` (or `NODEJS_VERSION`) to `20` to match the engine requirements.
4. **Secrets:** mark `DATABASE_URL` and any variables required during build time as `RUN_AND_BUILD_TIME`. All other secrets (e.g., `NEXTAUTH_SECRET`, OAuth keys) can remain `RUN_TIME`.
5. **Database:** if you use a managed Postgres instance, append `?sslmode=require` to the `DATABASE_URL` so Prisma can connect over TLS.
6. **Application URL:** set `NEXTAUTH_URL` to the live app domain (e.g., `https://your-app.ondigitalocean.app` or your custom domain).
7. **Secrets & APIs:** provide `NEXTAUTH_SECRET`, `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `RESEND_API_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`.

After deployment completes, trigger `yarn prisma migrate deploy` (via the start command above) to ensure the database schema is up to date. You can also use the provided `.do/app.yaml` template with `doctl apps update` if you prefer managing the spec through code.

> 💡 **Tip:** Add a dedicated pipeline step (or App Platform pre-deployment job) that runs `yarn migrate:check`. The command exits non-zero when pending migrations or drift are detected so deployments can fail fast before the application starts.

### Docker

This application is fully optimized for Docker deployment with a multi-stage build that minimizes image size and memory usage. Perfect for platforms like App Platform, Cloud Run, ECS, and others.

**Quick Start:**

```bash
# Build image
yarn docker:build

# Run container
yarn docker:run:detached

# View logs
yarn docker:logs

# Stop container
yarn docker:stop
```

**With Docker Compose (includes PostgreSQL + Adminer):**

```bash
# Start all services
yarn docker:compose:up

# View logs
yarn docker:compose:logs

# Stop all services
yarn docker:compose:down
```

**Direct Docker commands:**

```bash
# Build image
docker build -t athletics-dashboard:latest .

# Run container
docker run -p 3000:3000 --env-file .env athletics-dashboard:latest

# With Docker Compose
docker-compose up -d
```

**📦 Optimizations:**
- Multi-stage build with 3 stages (deps, builder, runner)
- Next.js standalone output mode for minimal bundle
- Alpine Linux base (~300-400MB final image)
- Memory limit: 4GB during build
- Non-root user for security
- Health checks included

**📖 For detailed Docker deployment instructions**, including platform-specific guides for Google Cloud Run, DigitalOcean App Platform, AWS ECS, and more, see **[DOCKER.md](./DOCKER.md)**.

### Database Migrations in Production

**⚠️ Important: Automatic migrations during deployment are disabled by default.**

Database migrations are no longer run automatically during application startup. This prevents deployment failures due to migration errors (e.g., P3009) and gives you better control over when schema changes are applied.

**To run migrations manually:**

```bash
# Before deploying new code with schema changes
yarn migrate:deploy

# Or use npx directly
npx prisma migrate deploy
```

**Deployment workflow:**

1. Deploy your application (migrations will NOT run automatically)
2. The app will connect to the database using the existing schema
3. When you need to apply schema changes, run migrations manually as a separate step
4. Use `yarn migrate:check` to verify migration status before deployment

**Why migrations are separate:**
- ✅ App can deploy successfully even if there are pending migrations
- ✅ Migrations can be fixed and tested without re-deploying the entire app
- ✅ Failed migrations don't block application startup
- ✅ Better control over when schema changes are applied in production
- ✅ Easier to roll back or resolve migration issues

See the [Prisma Migration Troubleshooting](#-prisma-migration-troubleshooting) section for details on resolving migration issues.

### Environment Variables for Production

Ensure these are set in your hosting platform:
- `DATABASE_URL` (production database)
- `NEXTAUTH_SECRET` (secure random string)
- `NEXTAUTH_URL` (your production URL)
- All API keys and secrets

## 📜 Scripts

### Development & Build

| Command | Description |
|---------|-------------|
| `yarn dev` | Start development server |
| `yarn build` | Build production bundle |
| `yarn start` | Start production server |
| `yarn start:prod` | Start production server (migrations must be run manually) |
| `yarn type-check` | Run TypeScript type checking |

### Database (Prisma)

| Command | Description |
|---------|-------------|
| `yarn prisma migrate dev` | Create and apply new migration |
| `yarn prisma migrate deploy` | Apply migrations in production |
| `yarn prisma db seed` | Seed database with sample data |
| `yarn prisma studio` | Open Prisma Studio GUI |
| `yarn prisma generate` | Generate Prisma Client |

### Docker

| Command | Description |
|---------|-------------|
| `yarn docker:build` | Build Docker image |
| `yarn docker:build:prod` | Build Docker image without cache |
| `yarn docker:run` | Run container (interactive) |
| `yarn docker:run:detached` | Run container in background |
| `yarn docker:stop` | Stop and remove container |
| `yarn docker:logs` | View container logs |
| `yarn docker:shell` | Open shell in container |
| `yarn docker:compose:up` | Start all services with Docker Compose |
| `yarn docker:compose:down` | Stop all Docker Compose services |
| `yarn docker:compose:logs` | View Docker Compose logs |
| `yarn docker:compose:build` | Rebuild Docker Compose services |

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code style and conventions
- Write TypeScript with proper types
- Use Material UI components for consistency
- Add comments for complex logic
- Test thoroughly before submitting PR
- Update documentation for new features

## 📄 License

This project is proprietary and is not currently licensed for public redistribution. Please contact the maintainers for licensing inquiries.

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/) by Vercel
- UI components from [Material UI](https://mui.com/)
- Icons from [MUI Icons](https://mui.com/material-ui/material-icons/)
- AI powered by [OpenAI](https://openai.com/)
- Email service by [Resend](https://resend.com/)

## 📞 Support

For questions, issues, or feature requests, please use your team's standard support channels:

- 🐛 Issue Tracker: Open a GitHub issue in this repository so the engineering team can triage it.
- 💬 Internal Contact: Reach out to the AthleticsDashboard maintainers via your internal communication platform.

---

**Built with ❤️ for athletic directors everywhere**
