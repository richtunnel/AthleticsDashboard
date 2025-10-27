# Environment Variables Reference

Complete guide to all environment variables required for the Athletics Dashboard application.

## Table of Contents

1. [Quick Setup](#quick-setup)
2. [Variable Categories](#variable-categories)
3. [Required vs Optional](#required-vs-optional)
4. [Build-Time vs Runtime](#build-time-vs-runtime)
5. [Digital Ocean Configuration](#digital-ocean-configuration)
6. [Security Best Practices](#security-best-practices)

---

## Quick Setup

### For Local Development

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your actual values
nano .env
```

### For Docker Development

```bash
# Use the Docker-specific template
cp .env.docker .env

# Edit with your values
nano .env
```

### For Production (Digital Ocean)

Set all variables in the DigitalOcean dashboard under:
- **App Settings** → **Environment Variables**
- Mark sensitive values as "Secret"
- Set scope as "RUN_TIME" or "RUN_AND_BUILD_TIME" as needed

---

## Variable Categories

### 🗄️ Database Configuration

#### `DATABASE_URL` (REQUIRED)
**Format**: PostgreSQL connection string
**Example**: 
```
postgresql://user:password@host:5432/dbname?schema=public&sslmode=require
```

**When Used**:
- **Build**: Placeholder needed for Prisma client generation
- **Runtime**: Actual database connection

**Digital Ocean**: Auto-injected when using managed database
```yaml
DATABASE_URL: ${adscheduler-db.DATABASE_URL}
```

**Local Development**:
```
postgresql://localhost:5432/athletics_dev
```

**Notes**:
- Must include `?sslmode=require` for managed databases
- Use SSL certificate if required by your provider
- Connection pooling handled by Prisma

---

### 🔐 Authentication (NextAuth)

#### `NEXTAUTH_SECRET` (REQUIRED)
**Purpose**: JWT encryption and session signing
**Generate**: `openssl rand -base64 32`
**Scope**: RUN_AND_BUILD_TIME (for client-side Next.js)
**Example**: `your-random-secret-key-here`

**Security**: 
- ⚠️ NEVER commit this to git
- ✅ Use different secrets for dev/staging/production
- ✅ Rotate periodically

---

#### `NEXTAUTH_URL` (REQUIRED)
**Purpose**: Base URL for NextAuth callbacks
**Scope**: RUN_AND_BUILD_TIME
**Examples**:
- Development: `http://localhost:3000`
- Production: `https://your-app.ondigitalocean.app`

**Notes**:
- Must match your actual deployed URL
- Used for OAuth redirects
- No trailing slash

---

#### `NEXT_PUBLIC_APP_URL` (REQUIRED)
**Purpose**: Public-facing app URL for client-side code
**Scope**: RUN_AND_BUILD_TIME (embedded in client bundle)
**Examples**:
- Development: `http://localhost:3000`
- Production: `https://your-app.ondigitalocean.app`

**Used For**:
- Email templates (links back to app)
- Stripe redirect URLs
- Public-facing URLs

---

### 🔑 Google Integration

#### `GOOGLE_CALENDAR_CLIENT_ID` (REQUIRED)
**Purpose**: Google OAuth client ID
**Scope**: RUN_TIME
**Format**: `xxx.apps.googleusercontent.com`
**Get From**: [Google Cloud Console](https://console.cloud.google.com/)

**Setup Steps**:
1. Create project in Google Cloud Console
2. Enable Google Calendar API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs

---

#### `GOOGLE_CALENDAR_CLIENT_SECRET` (REQUIRED)
**Purpose**: Google OAuth client secret
**Scope**: RUN_TIME (KEEP SECRET)
**Security**: Mark as secret in DigitalOcean

---

#### `GOOGLE_REDIRECT_URI` (REQUIRED)
**Purpose**: OAuth callback URL
**Scope**: RUN_TIME
**Format**: `https://your-domain.com/api/auth/calendar-callback`

**Must Match**:
- Authorized redirect URIs in Google Cloud Console
- Your actual deployed domain

---

#### `GOOGLE_MAPS_API_KEY` (REQUIRED for Travel Features)
**Purpose**: Calculate travel times and distances
**Scope**: RUN_TIME
**Get From**: [Google Cloud Console](https://console.cloud.google.com/)

**APIs Needed**:
- Distance Matrix API
- Geocoding API

**Restrictions**: Limit to your domain for security

---

### 📧 Email Service (Resend)

#### `RESEND_API_KEY` (REQUIRED)
**Purpose**: Send transactional emails
**Scope**: RUN_TIME (KEEP SECRET)
**Format**: `re_xxxxxxxx`
**Get From**: [Resend Dashboard](https://resend.com/)

**Used For**:
- Password reset emails
- Account notifications
- Bulk game emails
- Calendar invites

---

#### `EMAIL_FROM` (REQUIRED)
**Purpose**: Sender email address and name
**Scope**: RUN_TIME
**Format**: `Your App Name <noreply@yourdomain.com>`
**Example**: `AD Hub <noreply@athletics-hub.com>`

**Requirements**:
- Domain must be verified in Resend
- Use noreply@ for transactional emails
- SPF/DKIM records configured

---

### 🤖 AI Services

#### `OPENAI_API_KEY` (REQUIRED for AI Features)
**Purpose**: AI-powered travel recommendations
**Scope**: RUN_TIME (KEEP SECRET)
**Format**: `sk-xxxxxxxx`
**Get From**: [OpenAI Platform](https://platform.openai.com/)

**Used For**:
- Travel time analysis
- Schedule conflict detection
- Route optimization

**Cost**: Pay-per-use API (monitor usage)

---

### 💳 Payment Processing (Stripe)

#### `STRIPE_SECRET_KEY` (REQUIRED)
**Purpose**: Stripe API authentication
**Scope**: RUN_TIME (KEEP SECRET)
**Format**: 
- Test: `sk_test_xxxxxxxx`
- Live: `sk_live_xxxxxxxx`

**Get From**: [Stripe Dashboard](https://dashboard.stripe.com/)

---

#### `STRIPE_WEBHOOK_SECRET` (REQUIRED)
**Purpose**: Verify webhook signatures
**Scope**: RUN_TIME (KEEP SECRET)
**Format**: `whsec_xxxxxxxx`

**Setup**:
1. Create webhook endpoint in Stripe Dashboard
2. Point to: `https://your-domain.com/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.*`
4. Copy signing secret

---

#### `STRIPE_MONTHLY_PRICE_ID` (REQUIRED)
**Purpose**: Monthly subscription price ID
**Scope**: RUN_TIME
**Format**: `price_xxxxxxxx`

**Get From**: Stripe Dashboard → Products → Your Product → Pricing

---

#### `STRIPE_ANNUAL_PRICE_ID` (REQUIRED)
**Purpose**: Annual subscription price ID
**Scope**: RUN_TIME
**Format**: `price_xxxxxxxx`

---

#### `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` (REQUIRED)
**Purpose**: Client-side price ID reference
**Scope**: RUN_AND_BUILD_TIME (embedded in client)
**Format**: `price_xxxxxxxx`

**Note**: Same value as `STRIPE_MONTHLY_PRICE_ID` but public

---

#### `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID` (REQUIRED)
**Purpose**: Client-side price ID reference
**Scope**: RUN_AND_BUILD_TIME (embedded in client)
**Format**: `price_xxxxxxxx`

---

### 🌤️ Weather API

#### `OPENWEATHER_API_KEY` (OPTIONAL)
**Purpose**: Weather conditions for travel planning
**Scope**: RUN_TIME
**Get From**: [OpenWeatherMap](https://openweathermap.org/api)

**Used For**:
- Weather alerts for game days
- Travel condition warnings

---

### 📍 IP Geolocation

#### `IPINFO_API_TOKEN` (OPTIONAL)
**Purpose**: Login tracking and analytics
**Scope**: RUN_TIME
**Get From**: [IPInfo.io](https://ipinfo.io/)

**Used For**:
- Tracking user login locations
- Security monitoring
- Analytics

---

### 🧹 Account Cleanup Automation

#### `CRON_SECRET` (REQUIRED for Cron Jobs)
**Purpose**: Secure cron job endpoints
**Scope**: RUN_TIME (KEEP SECRET)
**Generate**: `openssl rand -hex 32`

**Used In**: `/api/cron/account-cleanup` endpoint
**Security**: Prevents unauthorized cron job execution

---

#### `ACCOUNT_DELETION_GRACE_DAYS` (OPTIONAL)
**Purpose**: Days before deleting cancelled accounts
**Scope**: RUN_TIME
**Default**: `14`
**Format**: Number (days)

---

#### `ACCOUNT_DELETION_REMINDER_DAYS` (OPTIONAL)
**Purpose**: When to send reminder emails
**Scope**: RUN_TIME
**Default**: `7,1`
**Format**: Comma-separated days before deletion

**Example**: `7,1` sends reminders 7 days and 1 day before deletion

---

### ⚙️ System Configuration

#### `NODE_ENV` (REQUIRED)
**Purpose**: Node.js environment mode
**Scope**: RUN_TIME
**Values**: `development`, `production`, `test`

**Set in Dockerfile**: Automatically set to `production` in runner stage

---

#### `PORT` (REQUIRED)
**Purpose**: HTTP server port
**Scope**: RUN_TIME
**Default**: `3000`

**Digital Ocean**: Use default 3000, platform handles routing

---

#### `HOSTNAME` (REQUIRED)
**Purpose**: Server bind address
**Scope**: RUN_TIME
**Default**: `0.0.0.0`

**Note**: Must be `0.0.0.0` to accept external connections in Docker

---

## Required vs Optional

### ✅ Absolutely Required for Basic Functionality

```bash
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
NEXT_PUBLIC_APP_URL
GOOGLE_CALENDAR_CLIENT_ID
GOOGLE_CALENDAR_CLIENT_SECRET
GOOGLE_REDIRECT_URI
RESEND_API_KEY
EMAIL_FROM
```

### ⚠️ Required for Specific Features

**Payments (if using subscriptions)**:
```bash
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_MONTHLY_PRICE_ID
STRIPE_ANNUAL_PRICE_ID
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID
```

**AI Travel Features**:
```bash
OPENAI_API_KEY
GOOGLE_MAPS_API_KEY
```

### 📎 Optional Enhancements

```bash
OPENWEATHER_API_KEY  # Weather alerts
IPINFO_API_TOKEN     # Login tracking
CRON_SECRET          # Automated cleanup
```

---

## Build-Time vs Runtime

### Build-Time Only
These are baked into the client-side bundle during `yarn build`:

```bash
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID
```

**Important**: Changing these requires rebuilding the Docker image

### Runtime Only
These are only needed when the app runs:

```bash
DATABASE_URL
NEXTAUTH_SECRET
GOOGLE_CALENDAR_CLIENT_SECRET
RESEND_API_KEY
OPENAI_API_KEY
STRIPE_SECRET_KEY
# ... most secrets
```

**Important**: Can be changed without rebuilding

### Both Build and Runtime

```bash
NEXTAUTH_URL         # Used by Next.js client and server
NEXT_PUBLIC_APP_URL  # Embedded in bundle, used at runtime
```

---

## Digital Ocean Configuration

### Setting Variables in Dashboard

1. **Navigate to App**:
   - DigitalOcean Dashboard → Apps → Your App

2. **Go to Settings**:
   - Settings → App-Level Environment Variables

3. **Add Variable**:
   - Click "Edit"
   - Add new variable
   - Choose scope:
     - `RUN_TIME`: Only at runtime
     - `BUILD_TIME`: Only during build
     - `RUN_AND_BUILD_TIME`: Both
   - Check "Encrypt" for secrets

### Using App Spec YAML

See `.do/app-spec.yaml` for complete configuration:

```yaml
envs:
  - key: DATABASE_URL
    scope: RUN_TIME
    type: SECRET
    value: "${adscheduler-db.DATABASE_URL}"
  
  - key: NEXTAUTH_SECRET
    scope: RUN_AND_BUILD_TIME
    type: SECRET
    # Set in dashboard
```

### Best Practices

1. **Never commit secrets to YAML**
   - Use placeholders or references
   - Set actual values in dashboard

2. **Use DATABASE_URL reference**
   ```yaml
   value: "${your-db-name.DATABASE_URL}"
   ```

3. **Mark all keys/secrets as encrypted**

4. **Document all required variables**

---

## Security Best Practices

### 🔒 Secrets Management

1. **Never commit secrets to git**
   - Use `.env.example` with placeholders
   - Add `.env*` to `.gitignore` (already done)

2. **Use environment variable injection**
   - Set in DigitalOcean dashboard
   - Mark as "Secret" or "Encrypted"

3. **Rotate secrets regularly**
   - Especially `NEXTAUTH_SECRET`
   - API keys every 90 days

4. **Use different secrets per environment**
   - Development, staging, production
   - Never reuse production secrets in dev

### 🔐 API Key Restrictions

**Google Maps API**:
- Restrict to your domain
- Enable only needed APIs
- Set usage quotas

**Stripe**:
- Use test keys in development
- Restrict webhook IPs if possible
- Monitor for unusual activity

**Resend**:
- Verify domain SPF/DKIM
- Set up DMARC policy
- Monitor sending reputation

### ⚡ Rate Limiting

Consider adding rate limiting for:
- OpenAI API (expensive)
- Email sending (reputation)
- Stripe operations (fraud prevention)

---

## Troubleshooting

### "Missing environment variable" errors

**Symptom**: App crashes on startup with env var error

**Solutions**:
1. Check variable is set in DigitalOcean dashboard
2. Verify spelling matches exactly (case-sensitive)
3. Check scope (RUN_TIME vs BUILD_TIME)
4. Rebuild if it's a NEXT_PUBLIC_ variable

### "Invalid credentials" errors

**Symptom**: OAuth or API calls fail

**Solutions**:
1. Verify API key is correct (no extra spaces)
2. Check key hasn't expired
3. Verify redirect URIs match exactly
4. Check API is enabled in provider dashboard

### Database connection errors

**Symptom**: "Can't reach database server"

**Solutions**:
1. Verify DATABASE_URL format
2. Check SSL mode: `?sslmode=require`
3. Verify database allows connections from DO
4. Check if database is running

### Build succeeds but runtime fails

**Symptom**: Docker build works, but app crashes when running

**Likely Cause**: Missing runtime environment variables

**Solution**: 
1. Check all RUN_TIME variables are set
2. View app logs in DigitalOcean
3. Test locally with same env vars

---

## Example Configurations

### Minimal Development Setup

```bash
DATABASE_URL="postgresql://localhost:5432/athletics_dev"
NEXTAUTH_SECRET="dev-secret-not-for-production"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GOOGLE_CALENDAR_CLIENT_ID="your-dev-client-id"
GOOGLE_CALENDAR_CLIENT_SECRET="your-dev-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/calendar-callback"
RESEND_API_KEY="re_test_key"
EMAIL_FROM="Dev App <dev@localhost>"
```

### Full Production Setup

See `.env.example` for complete list with placeholders.

---

## Quick Reference Table

| Variable | Required | Secret | Scope | Provider |
|----------|----------|--------|-------|----------|
| `DATABASE_URL` | ✅ | ✅ | RUN_TIME | PostgreSQL |
| `NEXTAUTH_SECRET` | ✅ | ✅ | RUN_AND_BUILD | Generated |
| `NEXTAUTH_URL` | ✅ | ❌ | RUN_AND_BUILD | Your Domain |
| `GOOGLE_CALENDAR_CLIENT_ID` | ✅ | ❌ | RUN_TIME | Google Cloud |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | ✅ | ✅ | RUN_TIME | Google Cloud |
| `GOOGLE_MAPS_API_KEY` | ⚠️ | ✅ | RUN_TIME | Google Cloud |
| `RESEND_API_KEY` | ✅ | ✅ | RUN_TIME | Resend |
| `OPENAI_API_KEY` | ⚠️ | ✅ | RUN_TIME | OpenAI |
| `STRIPE_SECRET_KEY` | ⚠️ | ✅ | RUN_TIME | Stripe |
| `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` | ⚠️ | ❌ | BUILD+RUN | Stripe |
| `OPENWEATHER_API_KEY` | ❌ | ✅ | RUN_TIME | OpenWeatherMap |
| `IPINFO_API_TOKEN` | ❌ | ✅ | RUN_TIME | IPInfo |
| `CRON_SECRET` | ❌ | ✅ | RUN_TIME | Generated |

**Legend**:
- ✅ = Yes/Required
- ❌ = No/Optional
- ⚠️ = Required for specific features

---

## Getting Help

If you're missing credentials:
1. Check with your team/admin
2. Generate new ones from provider dashboards
3. Never share secrets in public channels
4. Use separate keys for each environment

For provider-specific setup:
- **Google**: [Google Cloud Console Docs](https://console.cloud.google.com/)
- **Stripe**: [Stripe Docs](https://stripe.com/docs)
- **Resend**: [Resend Docs](https://resend.com/docs)
- **OpenAI**: [OpenAI API Docs](https://platform.openai.com/docs)
