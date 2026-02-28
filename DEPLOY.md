# 🚀 Deployment Guide

## Quick Deploy to Netlify

### Option 1: Deploy from GitHub (Recommended)

1. **Go to [netlify.com](https://netlify.com) and sign in**

2. **Click "Add new site" → "Import an existing project"**

3. **Connect to GitHub and select the `NoGraveDev/shovel` repository**

4. **Configure build settings:**
   - Build command: (leave empty)
   - Publish directory: `.` (root)
   - Site name: `shovel-app` (or your preferred name)

5. **Click "Deploy site"**

6. **Your site will be available at:** `https://shovel-app.netlify.app` (or your chosen name)

### Option 2: Manual Upload

1. **Download the repository files**
   ```bash
   git clone https://github.com/NoGraveDev/shovel.git
   cd shovel
   ```

2. **Go to [netlify.com](https://netlify.com) and sign in**

3. **Drag and drop the entire folder onto Netlify's dashboard**

4. **Your site will be deployed instantly**

### Option 3: Netlify CLI (if authenticated)

```bash
cd /Users/vexornex28/.openclaw/workspace/shovel
netlify deploy --prod --dir=.
```

## Custom Domain Setup (Optional)

1. **In Netlify dashboard, go to Site settings → Domain management**

2. **Click "Add custom domain"**

3. **Add your domain (e.g., `shovel.dev`)**

4. **Configure DNS:**
   - For root domain: A record to Netlify's load balancer IP
   - For subdomain: CNAME to `your-site.netlify.app`

5. **Netlify will automatically provision SSL certificate**

## Environment Variables (Future)

When adding backend features, set these in Netlify dashboard under Site settings → Environment variables:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
STRIPE_PUBLISHABLE_KEY=your_stripe_key
AUTH0_DOMAIN=your_auth0_domain
AUTH0_CLIENT_ID=your_auth0_client_id
```

## Branch Deploys

- **Main branch:** Auto-deploys to production
- **Other branches:** Create deploy previews automatically
- **Pull requests:** Generate preview URLs for testing

## Build & Deploy Status

Check deployment status at: `https://app.netlify.com/sites/your-site-name/deploys`

---

🎉 **That's it!** Your Shovel MVP is now live and ready to collect signups!