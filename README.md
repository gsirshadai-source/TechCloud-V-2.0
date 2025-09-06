# TechCloud Website with Supabase Authentication

A modern static website for TechCloud with integrated Supabase authentication system.

## Features

- **User Authentication**: Complete signup, login, and logout functionality
- **User Profile Management**: Users can view and update their profiles
- **Dashboard**: Personalized user dashboard with activity tracking
- **Protected Content**: Authentication-gated areas and navigation
- **Responsive Design**: Bootstrap-based responsive layout
- **Password Management**: Password reset and change functionality

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project" and fill in your project details
3. Wait for your project to be set up (this takes a few minutes)

### 2. Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy your **Project URL** and **anon/public key**

### 3. Configure Your Website

1. Open `js/supabase-config.js`
2. Replace the placeholder values with your actual Supabase credentials:

```javascript
const SUPABASE_CONFIG = {
    url: 'https://your-project-id.supabase.co', // Replace with your Project URL
    anonKey: 'your-anon-key-here' // Replace with your anon/public key
};
```

### 4. Configure Authentication in Supabase

1. In your Supabase dashboard, go to **Authentication** → **Settings**
2. Under **Site URL**, add your website URL (e.g., `http://localhost:3000` for local development)
3. Under **Redirect URLs**, add:
   - `http://localhost:3000/index.html` (for local development)
   - Your production domain URLs

### 5. Enable Email Authentication

1. In **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. Configure email templates if desired under **Authentication** → **Templates**

### 6. Optional: Configure Email Provider

For production use, configure an email provider:

1. Go to **Settings** → **Auth**
2. Configure SMTP settings or use a service like SendGrid, Mailgun, etc.

## File Structure

```
TechCloud-V-2.0/
├── index.html              # Main homepage
├── login.html              # Login page
├── registration.html       # Registration page
├── profile.html            # User profile page
├── dashboard.html          # User dashboard
├── css/                    # Stylesheets
├── js/
│   ├── supabase-config.js  # Supabase configuration
│   ├── auth.js             # Authentication module
│   └── custom.js           # Custom JavaScript
├── img/                    # Images and assets
└── README.md               # This file
```

## Authentication Features

### User Registration
- Full name collection
- Email validation
- Password strength requirements (minimum 6 characters)
- Terms and conditions acceptance
- Email confirmation (if enabled in Supabase)

### User Login
- Email and password authentication
- "Remember me" functionality
- Forgot password feature
- Loading states and error handling

### User Profile
- View profile information
- Update full name
- Change password
- Account creation and last login dates

### User Dashboard
- Welcome message with user name
- Membership statistics
- Recent activity timeline
- Quick action buttons
- Account status information

## Security Features

- **Authentication Guards**: Protected pages redirect unauthenticated users
- **Session Management**: Automatic session handling and refresh
- **Password Security**: Minimum length requirements and confirmation
- **Email Verification**: Optional email confirmation for new accounts
- **Secure Logout**: Proper session cleanup on logout

## Customization

### Styling
The website uses Bootstrap 3 for styling. You can customize the appearance by:
- Modifying `css/style.css`
- Adding custom CSS classes
- Updating Bootstrap variables

### Authentication Flow
You can customize the authentication behavior by modifying:
- `js/auth.js` - Main authentication logic
- Individual page scripts in HTML files
- Supabase settings in your dashboard

### Email Templates
Customize email templates in your Supabase dashboard under **Authentication** → **Templates**:
- Welcome email
- Password reset email
- Email confirmation

## Development

### Local Development
1. Serve the files using a local web server (required for Supabase to work properly)
2. You can use tools like:
   - Python: `python -m http.server 8000`
   - Node.js: `npx serve .`
   - Live Server extension in VS Code

### Testing Authentication
1. Register a new account
2. Check your email for confirmation (if enabled)
3. Test login/logout functionality
4. Try password reset feature
5. Update profile information

## Deployment

### Static Hosting
This website can be deployed to any static hosting service:
- **Netlify**: Drag and drop deployment
- **Vercel**: Git-based deployment
- **GitHub Pages**: Free hosting for public repositories
- **Firebase Hosting**: Google's hosting service

### Environment Variables
For production, consider using environment variables for Supabase credentials instead of hardcoding them.

## Troubleshooting

### Common Issues

1. **"Invalid API key" error**
   - Check that your Supabase URL and anon key are correct
   - Ensure there are no extra spaces or characters

2. **CORS errors**
   - Make sure your site URL is added to Supabase Auth settings
   - Use a proper web server (not file:// protocol)

3. **Email not sending**
   - Configure SMTP settings in Supabase
   - Check spam folder
   - Verify email templates are enabled

4. **Redirect issues**
   - Add all your domain URLs to Supabase redirect URLs
   - Include both www and non-www versions

### Getting Help

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Community](https://github.com/supabase/supabase/discussions)
- [Bootstrap Documentation](https://getbootstrap.com/docs/3.4/)

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues and pull requests to improve this authentication implementation.
