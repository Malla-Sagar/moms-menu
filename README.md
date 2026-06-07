# Mom's Menu

Daily meal planning with WhatsApp notifications for the family.

## Features

- **Daily Menu at 8 AM IST** - Sends a WhatsApp message with the day's lunch suggestion
- **Smart Rotation** - Respects non-veg frequency rules (fish 2x/week, egg 1x/week, chicken biweekly)
- **Family Preferences** - Suggests add-ons for members who don't eat certain dishes
- **WhatsApp Commands** - Reply to change the dish, get alternatives, or view next week's plan
- **Web Admin Panel** - Manage dishes, view history, and edit preferences

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your Twilio credentials
npm start
```

Open http://localhost:3000

## WhatsApp Commands

| Command | Action |
|---------|--------|
| `today` | Get today's menu |
| `another` | Get a different suggestion |
| `no veggies` | Get a dish that needs no veggies |
| `next week` | Get next week's plan |
| `add dish [name]` | Add a new dish |
| `remove dish [name]` | Remove a dish |
| `help` | Show commands |

## WhatsApp Setup (Twilio)

1. Create a free Twilio account at https://www.twilio.com/try-twilio
2. Activate the WhatsApp Sandbox: Console → Messaging → Try it out → Send a WhatsApp message
3. Join sandbox by sending the code from your phone
4. Set webhook URL to `https://your-server.com/api/webhook/whatsapp`
5. Copy Account SID and Auth Token to `.env`

**Cost**: Twilio sandbox is free for testing. Production WhatsApp API costs ~$0.005/message (essentially free for family use at ~30 msgs/month = $0.15/month).

## Hosting (Free Options)

### Option 1: Oracle Cloud Always Free (Recommended)
- 2 AMD instances (1 CPU, 1GB RAM each) - **forever free**
- Steps:
  1. Sign up at https://cloud.oracle.com (requires credit card for verification, never charged)
  2. Create a Compute instance (VM.Standard.E2.1.Micro)
  3. SSH in, install Node.js, clone repo, run with PM2
  4. Open port 3000 in security list

### Option 2: Render.com
- Free tier with 750 hours/month
- Auto-deploys from GitHub
- May sleep after 15 min inactivity (bad for cron)

### Option 3: Railway.app
- $5/month credit free tier
- Easy GitHub deploy

### Recommended: OCI + PM2
```bash
# On OCI instance
sudo apt update && sudo apt install -y nodejs npm
git clone https://github.com/Malla-Sagar/moms-menu.git
cd moms-menu
npm install
npm install -g pm2
cp .env.example .env
# Edit .env
pm2 start src/server.js --name moms-menu
pm2 save
pm2 startup
```

## Project Structure

```
moms-menu/
├── src/
│   ├── server.js          # Express app entry
│   ├── routes/api.js      # All API endpoints + WhatsApp webhook
│   ├── services/
│   │   ├── menuGenerator.js  # Core meal selection logic
│   │   ├── whatsapp.js       # Twilio WhatsApp integration
│   │   └── scheduler.js      # Daily 8 AM cron job
│   └── data/
│       ├── dishes.json       # All dishes with preferences
│       ├── preferences.json  # Family members, day types, rules
│       └── history.json      # Meal history (auto-generated)
├── public/                   # Web admin panel
├── Dockerfile
└── .env.example
```
