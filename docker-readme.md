# Docker Setup for Athletics Dashboard

> **📖 For comprehensive Docker documentation**, including optimizations, platform-specific deployment guides (Cloud Run, App Platform, ECS), and troubleshooting, see **[DOCKER.md](./DOCKER.md)**.

This Docker setup provides both production and development environments for the Athletics Dashboard application.

## Prerequisites

- Docker Desktop (includes Docker and Docker Compose)
- Git

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/richtunnel/AthleticsDashboard.git
cd AthleticsDashboard
```

### 2. Set up environment variables

```bash
cp .env.docker.example .env
```

Edit `.env` file with your actual values:

- Generate `NEXTAUTH_SECRET` with: `openssl rand -base64 32`
- Add your OAuth credentials if using Google login
- Add API keys for services you're using (Stripe, OpenAI, etc.)

### 3. Make the script executable

```bash
chmod +x docker-scripts.sh
```

### 4. Start the application

**For Production:**

```bash
./docker-scripts.sh build
./docker-scripts.sh up
```

**For Development (with hot-reload):**

```bash
./docker-scripts.sh dev
```

The application will be available at:

- Application: http://localhost:3000
- Database Admin (Adminer): http://localhost:8080

## Docker Commands Reference

### Basic Operations

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f app

# View all services status
docker-compose ps
```

### Development Mode

```bash
# Start with hot-reload
docker-compose -f docker-compose.dev.yml up

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

### Database Management

```bash
# Run migrations
docker-compose exec app npx prisma migrate deploy

# Open Prisma Studio
docker-compose exec app npx prisma studio

# Seed database
docker-compose exec app npx prisma db seed

# Create new migration (dev mode)
docker-compose exec app-dev npx prisma migrate dev --name your_migration_name
```

### Troubleshooting

```bash
# Access container shell
docker-compose exec app sh

# Rebuild without cache
docker-compose build --no-cache

# Remove all volumes (WARNING: deletes all data)
docker-compose down -v

# Clean up everything
docker system prune -a --volumes
```

## File Structure

```
.
├── Dockerfile                 # Multi-stage build for production
├── docker-compose.yml         # Production orchestration
├── docker-compose.dev.yml     # Development orchestration
├── .dockerignore             # Files to exclude from Docker context
├── .env.docker.example       # Example environment variables
├── docker-scripts.sh         # Helper scripts for common tasks
└── DOCKER_README.md          # This file
```

## Environment Variables

Key environment variables to configure:

| Variable                     | Description                  | Required |
| ---------------------------- | ---------------------------- | -------- |
| `DATABASE_URL`               | PostgreSQL connection string | Yes      |
| `NEXTAUTH_URL`               | Your application URL         | Yes      |
| `NEXTAUTH_SECRET`            | Secret for NextAuth.js       | Yes      |
| `GOOGLE_CLIENT_ID`           | Google OAuth client ID       | Optional |
| `GOOGLE_CLIENT_SECRET`       | Google OAuth client secret   | Optional |
| `NEXT_PUBLIC_RESEND_API_KEY` | Resend email service API key | Optional |
| `STRIPE_SECRET_KEY`          | Stripe secret key            | Optional |
| `OPENAI_API_KEY`             | OpenAI API key               | Optional |

## Database Access

### Using Adminer (Web UI)

1. Navigate to http://localhost:8080
2. Use these credentials:
   - System: PostgreSQL
   - Server: postgres
   - Username: athleticsuser (or your DATABASE_USER`)
   - Password: athleticspass (or your `DATABASE_PASSWORD`)
   - Database: athleticsdb (or your `DATABASE_NAME`)

### Using psql (Command Line)

```bash
docker-compose exec postgres psql -U athleticsuser -d athleticsdb
```

## Common Issues & Solutions

### Port already in use

```bash
# Find and kill process using port 3000
lsof -i :3000
kill -9 <PID>

# Or change the port in docker-compose.yml
ports:
  - "3001:3000"  # Changed from 3000 to 3001
```

### Database connection issues

1. Ensure PostgreSQL container is healthy:

```bash
docker-compose ps postgres
```

2. Check database logs:

```bash
docker-compose logs postgres
```

3. Verify DATABASE_URL format:

```
postgresql://USER:PASSWORD@postgres:5432/DATABASE?schema=public
```

### Build failures

1. Clear Docker cache:

```bash
docker-compose build --no-cache
```

2. Update dependencies:

```bash
docker-compose exec app yarn install
```

3. Check for Node/Yarn version compatibility

## Production Deployment

For production deployment:

1. Use proper secrets management (e.g., Docker Secrets, AWS Secrets Manager)
2. Set `NODE_ENV=production`
3. Use a reverse proxy (nginx, Traefik) for HTTPS
4. Implement proper backup strategies for PostgreSQL
5. Consider using managed database services
6. Set up monitoring and logging

## Performance Optimization

### Docker Build Optimization

- The Dockerfile uses multi-stage builds to minimize image size
- Node modules are cached between builds when possible
- Production image only includes necessary files

### Database Optimization

- Add volume for PostgreSQL data persistence
- Consider adding read replicas for scaling
- Implement connection pooling

## Security Considerations

1. **Never commit `.env` files** to version control
2. **Change default passwords** before deploying
3. **Use strong secrets** for `NEXTAUTH_SECRET`
4. **Limit database access** to only necessary services
5. **Keep Docker images updated** regularly
6. **Use non-root users** in containers (already configured)

## Support

For issues specific to:

- Docker setup: Check this README and docker-scripts.sh
- Application issues: See main README.md
- Database/Prisma issues: Check Prisma documentation

## License

See main repository for license information.
