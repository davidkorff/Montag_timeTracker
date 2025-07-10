@echo off
echo 42 Consulting Time Tracker Setup for Windows
echo ============================================

echo Installing dependencies...
call npm install
call npm run install:backend

echo.
echo Creating .env file...
call npm run setup:env

echo.
echo Setup complete!
echo.
echo Next steps:
echo 1. Edit backend\.env with your database credentials
echo 2. Create database: createdb consulting_time_tracker
echo 3. Run schema: psql -d consulting_time_tracker -f database\schema.sql
echo 4. Generate admin password: cd backend\scripts && node hash-password.js yourpassword
echo 5. Start the application: npm start
echo.