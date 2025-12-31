# Spotify Battle - Centralized Authentication

## Overview

The system has been updated to use centralized server-side authentication. The Spotify token is now stored on the server and automatically used for all users.

## Changes

### Backend (Go)

1. **Global Token**: The Spotify Access Token is now stored globally on the server
2. **Auto-Refresh**: The token is automatically renewed before it expires
3. **Discord Webhook**: A notification is sent to Discord when the token expires
4. **New Endpoints**:
   - `GET /login` - Initiates Spotify OAuth for server-side authentication
   - `GET /admin-callback` - Callback handler for server token
   - `GET /api/token-status` - Returns the current token status

### Frontend (React)

1. **Login Button Removed**: No more individual user authentication
2. **Token Status**: The UI shows "No function available" when no valid token is present
3. **Disabled Search**: Search buttons are disabled when no token is available

## Setup

### 1. Environment Variables

Add the following variables to your `.env` file:

```bash
# Existing variables
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URL=http://localhost:8080/admin-callback

# New variable for Discord Webhook (optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
```

### 2. Adjust Redirect URL

Make sure the redirect URL is configured in your Spotify Developer Dashboard:
- Add `http://localhost:8080/admin-callback` (for local development)
- For production: `https://yourdomain.com/admin-callback`

### 3. Initial Login

1. Start the server
2. Navigate to `http://localhost:8080/login`
3. Sign in with your Spotify account
4. You will be redirected back to the main page
5. The token is now available for all users

## How It Works

### Token Management

- **Persistent Storage**: The token is stored in `./data/spotify_token.json` and persists across Docker restarts
- **Auto-Refresh**: The token is automatically renewed 5 minutes before expiration
- **Background Process**: A background routine checks the token every minute and refreshes it when needed
- **Docker Volume**: The token file is persisted in the `spotify-battle-data` volume
- A valid token is automatically used for every API request

### Startup Behavior

When the server starts:
1. It checks if a saved token exists in `./data/spotify_token.json`
2. If found, the token is loaded into memory
3. If the token is expired or about to expire, it's automatically refreshed using the refresh token
4. If no token is found or refresh fails, you need to authenticate once via `/login`

### Discord Notification

When the token cannot be renewed, a message is sent to the Discord webhook:

```
⚠️ Spotify token has expired and could not be refreshed. Please re-authenticate at /login
```

Additionally, Discord notifications are sent for:
- ✅ **Successful token acquisition**: When a new token is obtained via `/login`
- 🎨 **Image generation**: When a ranking image is created, including:
  - Title of the ranking
  - Number of items
  - Direct link to the generated image (with preview embed)

### Frontend Behavior

- **Without Token**: Shows "No function available" - Search buttons are disabled
- **With Token**: Normal functionality - Search and all features are available

## Security Notes

⚠️ **Important**: 
- The `/login` endpoint should be protected in production (e.g., via HTTP Basic Auth or IP whitelist)
- The token is stored in `./data/spotify_token.json` with restricted file permissions (0600)
- The token file is persisted in a Docker volume and survives container restarts
- The refresh token allows automatic token renewal without requiring re-authentication
- **One-time setup**: After the initial login, the token is automatically maintained indefinitely

## Monitoring

You can check the token status at any time:

```bash
curl http://localhost:8080/api/token-status
```

Response:
```json
{
  "hasToken": true,
  "expiry": "2025-12-31T14:30:00Z"
}
```

## Troubleshooting

### Token Has Expired

1. Navigate to `/login`
2. Sign in again
3. The token will be updated

### Discord Notifications Not Working

- Check the `DISCORD_WEBHOOK_URL` in the `.env` file
- Test the webhook manually
- Check the server logs

### Search Is Disabled

- Check the token status via `/api/token-status`
- Re-authenticate via `/login` if necessary
- Verify the Spotify credentials in the `.env` file
