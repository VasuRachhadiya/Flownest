# Email & Invitation Integration Guide

Flownest intentionally avoids fake email delivery. When `Email:SmtpConfigured` is `false` (the default):

1. **Team Invitations**: Creating an invitation generates a cryptographically random token persisted in `OrganizationInvitations` (`Token`, `ExpiresAtUtc`, `Status`). Admins copy the secure join URL (`/register?invite=<token>`) and share it with teammates.
2. **Password Resets**: Calling `/api/auth/forgot-password` generates a standard ASP.NET Core Identity reset token. In `Development`, the token is returned in the response for testing; in `Production`, tokens are never returned in HTTP responses unless email delivery is wired up.

## Enabling Real Email Delivery

1. Add an `IEmailSender` service in `Flownest.Application` and implement it in `Flownest.Infrastructure` using SMTP (`MailKit` / `System.Net.Mail`) or an API provider (SendGrid, Postmark, Resend).
2. Configure credentials via environment variables (`Email__SmtpConfigured=true`, `Email__Host`, `Email__Username`, `Email__Password`).
3. Call `IEmailSender` inside `IdentityService.ForgotPasswordAsync` and `TeamService.InviteAsync`.
