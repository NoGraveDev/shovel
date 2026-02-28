# 🪓 Shovel: Ship What AI Builds

**Tagline:** Built with AI. Shipped with Shovel.

Shovel is a shipping platform for vibe coders and non-technical builders. People build amazing apps with AI tools (Cursor, Lovable, Bolt, Replit) but struggle to deploy them. Shovel scans their project, tells them what's missing (auth, payments, database, env vars), offers one-click fixes, and deploys with one button.

## 🚀 Live Demo

- **Landing Page:** [shovel-app.netlify.app](https://shovel-app.netlify.app)
- **App Dashboard:** [shovel-app.netlify.app/app.html](https://shovel-app.netlify.app/app.html)

## 🎯 What Problem Does Shovel Solve?

AI made building easy. Nobody made shipping easy.

### The Deployment Wall
1. **DNS? SSL? Env vars?** - Configure domains, certificates, environment variables
2. **Auth & Payments from scratch?** - Add user authentication and payment processing 
3. **Is it even secure?** - Security best practices, HTTPS, data protection

## ✨ How It Works

1. **🔗 Connect** - Link your GitHub repo or drag & drop your AI-built project
2. **🔍 Scan** - Our Ship Score™ analyzes your project and tells you what's missing
3. **🚀 Ship** - One click deploys your app with everything configured automatically

## 🏆 Ship Score™

Our proprietary scoring system that analyzes your AI-built project and gives you a deployment readiness score out of 100:

- **✅ Green (80-100):** Ready to ship!
- **⚠️ Yellow (50-79):** Needs some fixes
- **❌ Red (0-49):** Major issues to resolve

### Example Scoring:
- Frontend detected (React + Vite): **+25 points**
- TypeScript configuration: **+20 points** 
- Responsive design: **+15 points**
- Authentication system: **+20 points**
- Database configured: **+35 points**
- Payment processing: **+15 points**
- Environment variables: **+5 points**
- SSL & Security: **+10 points**

## 💰 Pricing Tiers

### 🟤 Dig (Free)
- 1 project
- Ship Score™ analysis  
- Basic deployment
- Community support

### ⚒️ Strike ($12/mo) - *Most Popular*
- 5 projects
- One-click fixes
- Auth & payments setup
- Custom domains
- Priority support

### 🥇 Gold ($29/mo)
- Unlimited projects
- Advanced integrations
- Team collaboration
- Analytics dashboard
- Dedicated support

### ⛏️ Mine ($79/mo)
- Everything in Gold
- White-label deployments
- Custom integrations
- SLA guarantees
- Enterprise support

## 🤖 Supported AI Tools

If AI built it, Shovel ships it:

- **Cursor** - AI-powered code editor
- **Lovable** - AI website builder
- **Bolt.new** - AI full-stack development
- **Replit** - AI collaborative coding
- **Claude** - AI assistant for coding
- **v0** - Vercel's AI UI generator
- **ChatGPT** - AI coding assistance

## 🛠️ Tech Stack (MVP)

This MVP is built with:
- **Frontend:** Vanilla HTML/CSS/JS with Tailwind CSS
- **Styling:** Dark theme with gold accents (#D4A017)
- **Typography:** Inter font family
- **Icons:** Emoji-based with shovel theme 🪓
- **Deployment:** Netlify (static hosting)
- **Storage:** LocalStorage (for waitlist - will upgrade to Supabase)

## 📁 Project Structure

```
shovel/
├── index.html          # Landing page
├── app.html           # Dashboard mockup  
├── README.md          # This file
└── .gitignore        # Git ignore file
```

## 🎨 Design System

### Colors
- Background: `#0a0a0a` (dark-bg)
- Card Background: `#141414` (card-bg)
- Border: `#222` (border-color)
- Gold Accent: `#D4A017` (primary)
- Gold Light: `#F5A623` (secondary)
- Text: `white/#e5e5e5`

### Typography
- Font: Inter (Google Fonts)
- Weights: 300, 400, 500, 600, 700

### Components
- Buttons: Gold gradient background, dark text
- Cards: Subtle border, slight shadow, rounded corners
- Animations: Subtle fade-ins on scroll (CSS only)

## 🚢 Deployment

### Quick Deploy to Netlify

1. **Push to GitHub:**
   ```bash
   git add -A
   git commit -m "Deploy Shovel MVP"
   git push origin main
   ```

2. **Connect to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - "New site from Git" 
   - Connect GitHub repo
   - Deploy settings: Build command: (none), Publish directory: `/`
   - Site name: `shovel-app` (or custom)

3. **Custom Domain (Optional):**
   - Add custom domain in Netlify settings
   - Configure DNS (CNAME to netlify.app subdomain)

## 🔮 Future Roadmap

### Phase 1: MVP (Current)
- [x] Landing page with waitlist
- [x] App shell/dashboard mockup
- [x] Design system and branding

### Phase 2: Core Product
- [ ] Real backend with Supabase/PocketBase
- [ ] GitHub integration for repo scanning
- [ ] Ship Score™ analysis engine
- [ ] User authentication system

### Phase 3: Deployment Engine  
- [ ] One-click deployment to various platforms
- [ ] Automated fixes (auth, database, payments)
- [ ] Integration with Vercel, Netlify, Railway

### Phase 4: Advanced Features
- [ ] Team collaboration
- [ ] Analytics dashboard
- [ ] White-label deployments
- [ ] Enterprise features

## 📞 Contact

Built by **NoGrave** 

- Website: [nograve.dev](https://nograve.dev)
- Twitter: [@NoGraveDev](https://twitter.com/NoGraveDev)
- Email: hello@nograve.dev

---

**Ready to ship what you built?** [Join the waitlist →](https://shovel-app.netlify.app)