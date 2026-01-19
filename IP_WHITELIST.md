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
10. `192.168.0.179` (Local network)
11. `127.0.0.1` (Localhost IPv4)
12. `::1` (Localhost IPv6)

## How to Add/Remove IPs

To modify the IP whitelist:

1. Open `proxy.ts` in the root directory
2. Locate the `ALLOWED_IPS` array
3. Add or remove IP addresses as needed
4. Restart the server for changes to take effect

Example:
```typescript
const ALLOWED_IPS = [
  '143.44.162.23',
  '122.53.24.194',
  // Add new IPs here
  '192.168.1.100',
];
```

## Testing

To test if IP protection is working:

1. **Access from an allowed IP** - should work
2. **Access from a non-allowed IP** - should show "Access Denied" page

## Access Denied Page

When access is denied, users will see a custom error page with:
- A clear "Access Denied" message
- Their current IP address
- Instructions to contact the administrator

## Security Notes

- This proxy runs on every request (except static files)
- IP addresses are logged for audit purposes
- Only the exact IPs listed can access the site
- No development exceptions - restrictions apply in all environments
- Keep this list confidential and secure
