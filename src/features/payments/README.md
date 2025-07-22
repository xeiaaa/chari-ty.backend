# Payments Module

This module handles payment-related functionality using Stripe Connect for group payouts.

## Endpoints

### POST /api/v1/payments/stripe/connect

Creates a Stripe Connect account for a group to enable payouts.

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "groupId": "string"
}
```

**Response:**

```json
{
  "url": "string" // Stripe Connect onboarding URL
}
```

**Error Responses:**

- `400 Bad Request` - Invalid groupId or user is not the group owner
- `401 Unauthorized` - Missing or invalid authentication token
- `404 Not Found` - Group does not exist

## Environment Variables

The following environment variables are required:

- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `FRONTEND_URL` - Your frontend application URL for redirect URLs

## Usage

1. Group owners can call this endpoint to create a Stripe Connect account
2. The endpoint returns a URL that redirects to Stripe's onboarding flow
3. After completing onboarding, the group can receive payouts through Stripe Connect

## Security

- Only group owners can create Connect accounts for their groups
- Authentication is required for all endpoints
- Group ownership is verified before allowing Connect account creation
