# Late Again?

A Melbourne public transport delay intelligence app using live GTFS feeds, disruption alerts, and weather context.

## Setup

1. **Clone the repo and install**
   ```bash
   git clone <your-repo>
   cd late-again
   npm install
   ```

2. **Get your free PTV API key**
   - Visit https://opendata.transport.vic.gov.au/
   - Click "Sign Up" — it's free, no credit card
   - Go to your profile → API Keys → Generate Key
   - Copy the key

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and set: PTV_API_KEY=your_key_here
   ```

4. **Run locally**
   ```bash
   npm run dev       # Starts both server (port 3001) and client (port 5173)
   ```

5. **Deploy to Render (free)**
   - Push to GitHub
   - Connect repo on render.com → "New Web Service"
   - Set env var PTV_API_KEY in Render dashboard
   - Deploy — zero cost on free tier

## Scripts

- `npm run dev` starts server and client
- `npm run test` runs all tests
- `npm run build` builds the client
- `npm start` starts the production server
