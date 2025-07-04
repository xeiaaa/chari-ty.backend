# API Request Files

This directory contains organized HTTP request files for testing different features of the Chari-ty backend API.

## Files Overview

### `_common.http`

Contains shared variables that can be used across all request files:

- Base URL and API prefix
- Common content types
- Sample authentication tokens

### `auth.http`

Authentication and onboarding related requests:

- **Authentication**: Login, get current user, admin tests
- **Onboarding**: Individual, team, and nonprofit onboarding flows
- **Error Cases**: Validation failures, authentication errors

### `users.http`

User management and CRUD operations:

- **Development Utilities**: Token generation for testing
- **CRUD Operations**: Create, read, update, delete users
- **Validation Tests**: Error cases and edge cases

### `webhooks.http`

External service integration webhooks:

- **Clerk Webhooks**: User created, updated, deleted events
- **Error Cases**: Invalid signatures, unsupported events

## How to Use

### Prerequisites

1. Start the backend server: `npm run start:dev`
2. Ensure your database is running and migrated
3. Configure environment variables (`.env` file)

### Using with VS Code REST Client

1. Install the "REST Client" extension
2. Open any `.http` file
3. Click "Send Request" above any request block
4. Variables from `_common.http` can be imported in other files

### Using with other HTTP clients

1. Copy the request content from any file
2. Replace variables with actual values:
   - `{{baseUrl}}` → `http://localhost:3000`
   - `{{apiPrefix}}` → `api/v1`
   - `{{authToken}}` → Your actual authentication token

### Getting Authentication Tokens

#### Development Tokens (for testing)

1. Use the token generation endpoint in `users.http`:
   ```
   GET {{baseUrl}}/{{apiPrefix}}/users/clerk/token?email=test@example.com
   ```
2. Copy the returned token and use it in Authorization headers

#### Real Clerk Tokens

1. Set up a Clerk application
2. Get a session token from your Clerk frontend
3. Use it in the `@authToken` variable

## Request Flow Examples

### Complete Onboarding Flow

1. **Create a user** (usually via webhook):

   ```
   POST /api/v1/users (from users.http)
   ```

2. **Generate a token** for that user:

   ```
   GET /api/v1/users/clerk/token?email=user@example.com
   ```

3. **Complete onboarding**:
   ```
   POST /api/v1/auth/onboarding (from auth.http)
   ```

### Testing Webhooks

1. **Simulate user creation** from Clerk:

   ```
   POST /api/v1/webhooks/clerk (user.created from webhooks.http)
   ```

2. **Verify user was created**:
   ```
   GET /api/v1/users (from users.http)
   ```

## Tips

- **Variables**: Update tokens and IDs in the variable sections of each file
- **Order**: Some requests depend on others (e.g., get user by ID needs an existing user)
- **Error Testing**: Use the error case requests to test validation and error handling
- **Development**: The `users/clerk/token` endpoint is for development only
- **Security**: Never commit real authentication tokens to version control

## Common Issues

### 401 Unauthorized

- Check if your token is valid and not expired
- Ensure the Authorization header format: `Bearer <token>`
- Generate a new development token if needed

### 404 Not Found

- Verify the server is running on the correct port
- Check API endpoint URLs match your route definitions
- Ensure database is properly migrated

### Validation Errors

- Check request body format matches the DTO requirements
- Verify all required fields are included
- Review enum values (e.g., accountType must be 'individual', 'team', or 'nonprofit')
