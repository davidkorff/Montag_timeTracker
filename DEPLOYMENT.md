# Deployment Guide for 42 Consulting Time Tracker

This guide will help you deploy the 42 Consulting Time Tracker application to Render.

## Prerequisites

1. A GitHub account with your code repository
2. A Render account (sign up at https://render.com)
3. Your code pushed to a GitHub repository

## Setup Steps

### 1. Prepare Your Repository

First, ensure your repository has all the necessary files:

```bash
# Initialize git if not already done
git init

# Add all files (excluding node_modules via .gitignore)
git add .

# Commit your changes
git commit -m "Initial commit for Render deployment"

# Add your GitHub remote (replace with your repository URL)
git remote add origin https://github.com/YOUR_USERNAME/42-consulting-time-tracker.git

# Push to GitHub
git push -u origin main
```

### 2. Update Configuration Files

Before deploying, update the following files:

1. **render.yaml**: Replace `YOUR_USERNAME` with your GitHub username in the repository URLs
2. **frontend/js/config.js**: Copy from `config.example.js` and update for local development

### 3. Deploy to Render

1. Log in to your Render account
2. Click "New +" and select "Blueprint"
3. Connect your GitHub repository
4. Select the repository containing your code
5. Render will automatically detect the `render.yaml` file
6. Review the services that will be created:
   - PostgreSQL database
   - Backend API service
   - Frontend static site
7. Click "Apply" to start the deployment

### 4. Environment Variables

Render will automatically set most environment variables based on the `render.yaml` configuration. The following will be auto-generated:
- `DATABASE_URL` (from the database connection)
- `JWT_SECRET` and `JWT_REFRESH_SECRET` (secure random values)

### 5. Post-Deployment Steps

1. **Database Setup**: 
   - The migrations will run automatically on first deployment
   - Create your first admin user by accessing the database console in Render

2. **Update Frontend Configuration**:
   - The frontend build process will automatically update the API URL
   - No manual configuration needed

3. **Set up Custom Domain** (optional):
   - In Render dashboard, go to your frontend service
   - Click "Settings" → "Custom Domains"
   - Follow the instructions to add your domain

### 6. Database Management

To create your first admin user:

1. Go to your database in Render dashboard
2. Click "Connect" → "PSQL Command"
3. Run the following SQL:

```sql
-- Create admin user (replace with your details)
INSERT INTO users (username, email, password_hash, first_name, last_name, user_type_id, hourly_rate, is_active)
VALUES (
  'admin',
  'admin@42consulting.com',
  '$2a$10$YourHashedPasswordHere', -- Generate using bcrypt
  'Admin',
  'User',
  1, -- Admin type
  175,
  true
);
```

To generate a password hash locally:
```javascript
const bcrypt = require('bcryptjs');
const password = 'your-secure-password';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
```

### 7. Monitoring and Logs

- View logs in Render dashboard for each service
- Set up alerts for service health
- Monitor database performance and connections

## Environment Configuration

### Backend Environment Variables (automatically set by Render):
- `NODE_ENV=production`
- `PORT=3001`
- `DATABASE_URL` (from database)
- `JWT_SECRET` (auto-generated)
- `JWT_REFRESH_SECRET` (auto-generated)
- `CORS_ORIGIN` (from frontend URL)

### Frontend Configuration:
- API URL is automatically configured during build
- No manual environment variables needed

## Troubleshooting

### Database Connection Issues
- Check that the database is running in Render dashboard
- Verify DATABASE_URL is correctly set in backend service
- Check database connection limits

### Frontend Can't Connect to API
- Verify CORS_ORIGIN is set correctly
- Check that both services are deployed and running
- Review browser console for CORS errors

### Build Failures
- Check build logs in Render dashboard
- Ensure all dependencies are in package.json
- Verify Node.js version compatibility

## Updating the Application

1. Push changes to your GitHub repository
2. Render will automatically detect changes and redeploy
3. Monitor deployment progress in Render dashboard

## Backup and Recovery

1. **Database Backups**:
   - Render automatically backs up databases daily
   - You can also create manual backups from the dashboard

2. **Data Export**:
   - Use pg_dump for full database exports
   - The application includes CSV export functionality for time entries

## Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **Database Access**: Restrict database access to Render services only
3. **API Security**: JWT tokens expire after 24 hours
4. **HTTPS**: Render provides free SSL certificates

## Cost Estimation

With Render's starter plan:
- Database: ~$7/month (starter)
- Backend API: ~$7/month (starter)
- Frontend: Free (static site)
- Total: ~$14/month

For production, consider upgrading to standard plans for better performance.

## Support

- Render Documentation: https://render.com/docs
- Render Community: https://community.render.com
- Application Issues: Create an issue in your GitHub repository