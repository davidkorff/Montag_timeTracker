# Quick Start Guide - Fix for API Errors

## The Issue
You were getting "Failed to fetch" errors because:
1. The frontend was configured to connect to port 3001, but the backend runs on port 5000
2. The backend server wasn't running

## The Fix Applied
- Updated `/frontend/js/config.js` to use the correct API URL: `http://localhost:5000/api`

## How to Run the Application

### Terminal 1 - Start Backend Server
```bash
cd backend
npm install  # Only needed first time
npm run dev
```
The backend should start on http://localhost:5000

### Terminal 2 - Start Frontend Server  
```bash
cd frontend
# Use any static file server, for example:
npx http-server -p 3000
# OR
python -m http.server 3000
```
The frontend should be accessible at http://localhost:3000

## Verify Everything is Working
1. Backend health check: http://localhost:5000/api/health
2. Frontend: http://localhost:3000
3. Try logging in and accessing the Clients page - buttons should now work!

## Additional Notes
- The `requests.js` error in your console was likely from a browser extension
- Make sure both servers are running before accessing the application
- The backend requires a PostgreSQL database to be running