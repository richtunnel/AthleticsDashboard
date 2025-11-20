# Task Runner Configuration

This document describes the task runner configuration for the AthleticsDashboard project.

## Configuration File

The task runner configuration is defined in `.taskrunner.yml` at the project root. This file provides a comprehensive definition of all commands, dependencies, and execution order needed for automated task execution.

## Key Components

### Environment Requirements
- **Node.js**: 20.x
- **Package Manager**: yarn 1.x
- **Database**: PostgreSQL (via Prisma)

### Installation & Setup
```bash
yarn install --frozen-lockfile
yarn prisma generate
```

### Build Pipeline
The build process requires Prisma client generation before building:
```bash
prisma generate && next build
```

### Development
Start the development server:
```bash
yarn dev
```
Runs on `http://localhost:3000`

### Production Deployment
Production start includes automatic database migrations:
```bash
prisma migrate deploy && yarn start
```

### Quality Checks

#### Type Checking
```bash
yarn tsc
```

#### Linting
```bash
yarn lint
```

## CI/CD Pipeline Stages

The configuration defines a complete CI/CD pipeline:

1. **Setup**: Install dependencies and generate Prisma client
2. **Validate**: Run type checking and linting
3. **Migrate**: Apply database migrations
4. **Build**: Build Next.js application
5. **Start**: Start production server

## Database Operations

### Generate Prisma Client
```bash
prisma generate
```

### Apply Migrations (Production)
```bash
prisma migrate deploy
```

### Create and Apply Migrations (Development)
```bash
prisma migrate dev
```

### Check Migration Status
```bash
bash ./scripts/prisma-migration-troubleshoot.sh status
```

## Docker Support

The configuration includes Docker commands for containerized deployment:

### Build Image
```bash
docker build -t athletics-dashboard:latest .
```

### Run Container
```bash
docker run -p 3000:3000 --env-file .env athletics-dashboard:latest
```

### Docker Compose
```bash
docker-compose up -d
docker-compose down
docker-compose logs -f app
```

## Deployment Order

For a complete deployment, tasks should be executed in this order:

1. `install` - Install dependencies
2. `database.generate` - Generate Prisma client
3. `checks.typeCheck` - Type check code
4. `checks.lint` - Lint code
5. `database.migrate` - Apply migrations
6. `build` - Build application
7. `start` - Start server

## Environment Variables

### Required
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Optional (for enhanced features)
- `OPENAI_API_KEY` - AI integrations
- `GOOGLE_MAPS_API_KEY` - Travel times
- `OPENWEATHER_API_KEY` - Weather data
- `RESEND_API_KEY` - Email sending
- `NEXT_PUBLIC_MIXPANEL_TOKEN` - Analytics
- `MIXPANEL_SERVICE_SECRET` - Server-side analytics
- `GOOGLE_FORMS_FEEDBACK_URL` - Feedback integration
- `NEXT_PUBLIC_CALENDLY_URL` - Demo booking

## Critical Notes

1. **Prisma client MUST be generated before building** - This is handled by the `postinstall` hook and build command
2. **Database migrations MUST be applied before starting production server** - This is handled by the start command
3. **Type checking and linting should run before build** - Recommended in CI/CD pipelines
4. **Use yarn 1.x** as specified in `package.json` engines
5. **PostgreSQL database required** - Ensure `DATABASE_URL` is configured

## Healthcheck

The application exposes a healthcheck at the root endpoint (`/`) with:
- Timeout: 30 seconds
- Retries: 3 attempts

## Scripts Reference

All scripts are defined in `package.json`:
- `dev` - Development server
- `build` - Production build
- `start` - Production server
- `tsc` - Type checking
- `lint` - Code linting
- `db:migrate` - Create migration
- `deploy:migrate` - Apply migrations
- `db:studio` - Open Prisma Studio

## Usage with Automated Task Runners

This configuration is designed to work with automated task runners and CI/CD systems. The structured YAML format allows task runners to:

1. Parse and understand project requirements
2. Execute commands in the correct order
3. Handle pre-conditions (e.g., Prisma generation before build)
4. Validate environment and dependencies
5. Run quality checks before deployment

## Support

For issues or questions about the task runner configuration, refer to:
- Project README: `README.md`
- Package scripts: `package.json`
- Environment template: `.env.example`
