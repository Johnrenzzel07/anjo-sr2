# IP Whitelist Configuration

This website is protected by IP-based access control. Only the following IP addresses are allowed to access the application:

## Allowed IP Addresses

1. `143.44.162.23`
2. `122.53.24.194`
3. `180.190.243.109`
4. `27.49.218.2`
5. `112.198.193.120`
6. `58.69.229.122`
7. `27.49.70.2`
8. `222.127.50.75`
9. `27.49.69.5`

## Development Access

- `localhost` / `127.0.0.1` / `::1` are automatically allowed when running in development mode (`NODE_ENV=development`)
- This allows local development on `http://localhost:3000`

## How to Add/Remove IPs

### Method 1: Environment Variable (Recommended for Production)

Set the `ALLOWED_IPS` environment variable with comma-separated IP addresses:

```bash
# In .env.local or .env file
ALLOWED_IPS=143.44.162.23,122.53.24.194,180.190.243.109,27.49.218.2,112.198.193.120,58.69.229.122,27.49.70.2,222.127.50.75,27.49.69.5
```

Benefits:
- More secure (not in source code)
- Easy to update without code changes
- Different IPs per environment (dev/staging/prod)

### Method 2: Hardcoded in middleware.ts

To modify the IP whitelist directly in code:

1. Open `middleware.ts` in the root directory
2. Locate the `DEFAULT_ALLOWED_IPS` array
3. Add or remove IP addresses as needed
4. Restart the server for changes to take effect

Example:
```typescript
const DEFAULT_ALLOWED_IPS = [
  '143.44.162.23',
  '122.53.24.194',
  // Add new IPs here
  '192.168.1.100',
];
```

## Testing

To test if IP protection is working:

1. **Development**: Access `http://localhost:3000` - should work
2. **Production**: Access from an allowed IP - should work
3. **Production**: Access from a non-allowed IP - should show "Access Denied" page

### Check Your Current IP

Visit `/api/ip-check` to see your current detected IP address and connection details:

```
http://localhost:3000/api/ip-check
```

This endpoint returns:
- Your detected IP address
- Environment mode (development/production)
- Request headers
- Localhost detection status

## Access Denied Page

When access is denied, users will see a custom error page with:
- A clear "Access Denied" message
- Their current IP address
- Instructions to contact the administrator

## Troubleshooting

### Can't access from an allowed IP?

1. Check if the IP in the logs matches your actual public IP
2. Verify you're using the correct IP address (public, not local)
3. If behind a proxy/load balancer, ensure `x-forwarded-for` header is set correctly
4. Check server logs for the actual IP being detected

### Can't access localhost in development?

1. Ensure `NODE_ENV=development` is set
2. Try accessing via `http://localhost:3000` instead of `http://127.0.0.1:3000`
3. Check that the middleware is not being cached

## Security Notes

- This middleware runs on every request (except static files)
- IP addresses are logged for audit purposes
- Consider using a VPN or static IP for remote team members
- Regularly review and update the IP whitelist
- Keep this list confidential and do not commit to public repositories

## Production Deployment

When deploying to production:

1. Ensure your hosting provider passes the correct client IP via headers
2. Common headers: `x-forwarded-for`, `x-real-ip`
3. Test thoroughly before going live
4. Have a backup way to access the site if locked out

### Popular Hosting Providers

- **Vercel**: Automatically sets `x-forwarded-for`
- **Netlify**: Automatically sets `x-forwarded-for`
- **AWS/DigitalOcean**: May need to configure load balancer to pass headers
- **Heroku**: Automatically sets `x-forwarded-for`
