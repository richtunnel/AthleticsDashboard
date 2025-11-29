# 🔧 Quick Fix: Google API Referer Restriction Error

## ✅ Your Code is Already Correct!

The error you're seeing is **NOT a code problem** - it's a **Google Cloud Console configuration issue**.

Your application already implements the correct architecture:
- ✅ All Google API calls go through backend API routes
- ✅ API keys are stored server-side only
- ✅ Frontend never directly accesses Google APIs

---

## 🎯 The Problem

You're seeing this error:
> **"API keys with referer restrictions cannot be used with this API."**

This happens when your Google API key in the Cloud Console is configured with **HTTP referrer restrictions** instead of **IP address restrictions**.

---

## 🛠️ The Solution (5 minutes)

### Step 1: Open Google Cloud Console
Go to: https://console.cloud.google.com/apis/credentials

### Step 2: Find Your API Key
Look for the API key you're using in your `.env` file:
```bash
GOOGLE_MAPS_API_KEY="AIzaSy..."
```

### Step 3: Edit the API Key
1. Click on the API key name
2. Under **Application restrictions**, you'll see it's set to:
   - ❌ **HTTP referrers (web sites)** ← This is the problem!

### Step 4: Change to IP Restrictions
1. Select **IP addresses** (recommended for production)
2. OR select **None** (only for testing)

#### Option A: IP Address Restrictions (Recommended)
```
Application restrictions: IP addresses

Add IP address:
- For development: Your computer's IP (google "what's my ip")
- For production: Your server's IP address
```

**How to find your server IP:**
```bash
# SSH into your server
curl ifconfig.me
```

#### Option B: No Restrictions (Testing Only)
```
Application restrictions: None
```
⚠️ Use only for development/testing

### Step 5: Save Changes
Click **Save** at the bottom

### Step 6: Wait 5 Minutes
Google API changes can take a few minutes to propagate.

---

## ✅ Test Your Fix

### Browser Test
1. Go to your app: `http://localhost:3000` (or your domain)
2. Navigate to `/onboarding/details` or `/dashboard/settings`
3. Start typing an address in the "School Address" field
4. You should see autocomplete suggestions appear! 🎉

### API Test (Optional)
```bash
curl -X POST http://localhost:3000/api/google-places/autocomplete \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{"input": "123 Main Street"}'
```

Expected response:
```json
{
  "success": true,
  "predictions": [...]
}
```

---

## 🔍 Make Sure These APIs Are Enabled

While you're in Google Cloud Console, verify these are enabled:

1. **Places API** ✅
2. **Distance Matrix API** ✅
3. **Geocoding API** ✅

To check:
1. Go to: https://console.cloud.google.com/apis/library
2. Search for each API
3. If not enabled, click **Enable**

---

## 📋 Checklist

- [ ] API key restriction changed from "HTTP referrers" to "IP addresses" or "None"
- [ ] Places API enabled
- [ ] Distance Matrix API enabled
- [ ] Geocoding API enabled
- [ ] Billing enabled for project
- [ ] Waited 5 minutes for changes to propagate
- [ ] Tested address autocomplete in browser

---

## 🐛 Still Not Working?

### Error: "This API project is not authorized to use this API"
**Fix**: Enable the required API in Google Cloud Console (see above)

### Error: "The provided API key is invalid"
**Fix**: Double-check your `.env` file has the correct key:
```bash
GOOGLE_MAPS_API_KEY="AIzaSy..."
```

### Error: "You must enable Billing"
**Fix**: 
1. Go to: https://console.cloud.google.com/billing
2. Link a billing account to your project

### Still having issues?
Check the full documentation: [docs/GOOGLE_API_KEY_CONFIGURATION.md](./docs/GOOGLE_API_KEY_CONFIGURATION.md)

---

## 🎓 Why This Happened

### Backend APIs vs Frontend APIs

Some Google APIs require **server-side** calls:
- ❌ Cannot use HTTP referrer restrictions
- ✅ Must use IP address restrictions or no restrictions

Examples:
- Google Places Autocomplete API
- Google Place Details API
- Google Distance Matrix API
- Google Geocoding API

Your app correctly calls these from the backend, but your API key was configured for frontend use (HTTP referrers).

---

## 📚 Learn More

- **[Full Documentation](./docs/GOOGLE_API_KEY_CONFIGURATION.md)** - Complete guide
- **[Architecture Overview](./docs/GOOGLE_API_ARCHITECTURE.md)** - How it all works
- **[Google API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)** - Official docs

---

## ✨ Summary

1. Your **code is correct** ✅
2. Your **API key configuration** needs updating ❌
3. Change from **HTTP referrers** → **IP addresses** 🔧
4. Wait 5 minutes ⏱️
5. Test and enjoy! 🎉

---

**Quick Link**: https://console.cloud.google.com/apis/credentials

**Estimated Time**: 5 minutes  
**Difficulty**: Easy 😊
