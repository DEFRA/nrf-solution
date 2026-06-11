# Entra ID Auth for admin-frontend app

Add entra ID auth to admin-frontend app.

The point of the federated-credentials flow: instead of authenticating to Azure AD with a static client_secret, the app authenticates with a short-lived client assertion — a JWT minted by AWS Cognito. The trust is established via the federated credential (issuer/audience/subject) configured on the Azure app registration, so no shared secret is ever needed or stored.

There are work in progress changes on the 'entra-id-auth' branch in admin-frontend repo. Use the information from https://portal.cdp-int.defra.cloud/documentation/how-to/federated-credentials.md and the federated credentials below to configure the app and get auth working for the root path /.

## Federated credentials
Issuer: https://cognito-identity.amazonaws.com
Audience: eu-west-2:eb0a6f51-03e6-47ef-a45f-2294268f8cce
Subject: eu-west-2:5f52a133-cb4b-c509-6fbc-e9fc1a275093
Login string: nrf-admin-frontend-aad-access:nrf-admin-frontend

## Remaining work

The `entra-id-auth` branch has a near-complete federated-OIDC implementation following the CDP portal-frontend pattern. To get auth working on `/`:

1. Protect the root path: replace `auth: false` in `server.js` with the session strategy (`mode: 'required'`), so unauthenticated users are redirected to login.
2. Fix the Cognito login string: it is hard-coded to the portal values (`cdp-portal-frontend-aad-access`/`cdp-portal-frontend`). Use `nrf-admin-frontend-aad-access`/`nrf-admin-frontend`.
3. Wire the identity pool ID: set `AZURE_IDENTITY_POOL_ID` to the federated-credentials Audience (`eu-west-2:eb0a6f51-...`).
4. Tidy `.env.example`: remove the stale client-secret / mocking entries that the federated flow no longer uses.
