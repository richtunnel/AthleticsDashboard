# Opletics Production Readiness Checklist

## Environment Variables

### ✅ Security Fixes Applied

1. **Resend API Key Security**
   - Changed from `NEXT_PUBLIC_RESEND_API_KEY` to `RESEND_API_KEY`
   - This prevents the API key from being exposed to the browser
   - Updated in: `.env.example` and `.env.docker`
   - Updated all service files to use `process.env.RESEND_API_KEY`

### Required Environment Variables

#### Database
- `DATABASE_URL` - PostgreSQL connection string

#### Authentication
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `NEXTAUTH_URL` - Your app URL (https://your-domain.com)

#### Required API Keys (Server-Side Only)
- `GOOGLE_CALENDAR_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CALENDAR_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_MAPS_API_KEY` - Google Maps API
- `GOOGLE_DISTANCE_API_KEY` - Distance Matrix API
- `OPENWEATHER_API_KEY` - OpenWeatherMap API
- `RESEND_API_KEY` - Email service API key (formerly NEXT_PUBLIC_RESEND_API_KEY)
- `OPENAI_API_KEY` - OpenAI API (optional)
- `STRIPE_SECRET_KEY` - Stripe payments
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret

### Required Stripe Price IDs
```env
NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_MO
NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_YR
NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_MO
NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_YR
NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO
NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_YR
```

### Optional Environment Variables
- `MIXPANEL_SERVICE_SECRET` - Server-side analytics
- `NEXT_PUBLIC_MIXPANEL_TOKEN` - Client-side analytics
- `SLACK_FEEDBACK_WEBHOOK_URL` - Slack notifications
- `CRON_SECRET` - Cron job authentication

## Security Fixes Applied

### 1. Console Log Cleanup ✅
- Removed unnecessary console logs from browser/client-side code
- Kept only essential error handling
- Added production-safe logger utility at `src/lib/utils/logger.ts`

### 2. API Key Security ✅
- **CRITICAL**: Fixed exposed Resend API key
- Changed `NEXT_PUBLIC_RESEND_API_KEY` → `RESEND_API_KEY`
- Updated all API files to use secure variable
- Added warning comments in `.env.example` and `.env.docker`

### 3. Analytics Logging ✅
- Removed console errors from Mixpanel tracking failures
- Analytics failures now fail silently in production

## Pre-Deployment Checklist

### Environment Setup
- [ ] Set all required environment variables
- [ ] Ensure `NODE_ENV=production`
- [ ] Verify database connection works
- [ ] Test email service with valid `RESEND_API_KEY`
- [ ] Configure proper CORS origins

### Security
- [ ] Verify no sensitive data in browser console
- [ ] Check browser network tab for exposed keys
- [ ] Ensure all API routes use server-side environment variables
- [ ] Verify rate limiting is enabled
- [ ] Check security headers are configured

### Testing
- [ ] Test user registration flow
- [ ] Test email sending functionality
- [ ] Test calendar sync functionality
- [ ] Test payment processing (Stripe)
- [ ] Test file upload/CSV import
- [ ] Verify error handling works correctly

### Performance
- [ ] Enable production build caching
- [ ] Verify image optimization
- [ ] Check bundle size
- [ ] Test loading performance

## Files Modified

### Security Fixes
- `.env.example` - Added security warnings, changed `RESEND_API_KEY`
- `.env.docker` - Added security warnings, changed `RESEND_API_KEY`
- `src/lib/resend.ts` - Renamed environment variable reference
- `src/lib/services/email.service.ts` - Updated error messages
- `src/lib/services/referral.service.ts` - Updated environment variable
- `src/lib/utils/bulk-email.ts` - Updated error messages

### Client-Side Console Log Cleanup
- `src/components/utils/ServiceWorkerRegistration.tsx` - Removed SW logs
- `src/components/home/HomePageContent.tsx` - Removed navigation error logs
- `src/components/splash/NewsletterSubscription.tsx` - Removed subscription error log
- `src/components/travel/RecommendationCard.tsx` - Removed recommendation error logs
- `src/components/support/TicketList.tsx` - Removed ticket close error log
- `src/components/auth/ConnectGoogleCalendarDialog.tsx` - Removed calendar connection error log
- `src/lib/analytics/mixpanel.services.ts` - Removed analytics error logs

### New Utilities
- `src/lib/utils/logger.ts` - Production-safe logging utility

## Post-Deployment Next Steps

1. **Monitor Error Logs**: Set up proper logs monitoring service
2. **Set Up Analytics**: Verify Mixpanel or alternative analytics are working
3. **Email Deliverability**: Monitor email sending reputation
4. **Performance Monitoring**: Set up performance tracking
5. **Security Monitoring**: Implement security scanning and alerts

## Rollback Plan

If issues occur after deployment:

1. Check browser console for specific errors
2. Review server logs for API errors
3. Verify environment variable configuration
4. Check database connection status
5. Verify third-party service integrations (Stripe, Google, Resend)

## Known Limitations

- Analytics tracking failures are silent in production
- Service Worker registration errors are not logged (non-critical)
- Navigation errors from user cancellations are not logged

## Support

For deployment assistance, contact development team or review:
- `/src/lib/security/README.md` for security implementations
- `/SECURITY_IMPLEMENTATION.md` for comprehensive security guide
