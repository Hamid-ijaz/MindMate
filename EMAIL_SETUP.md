# MindMate Email System Documentation

## Overview

The MindMate email system provides comprehensive SMTP-based email functionality for user communication, notifications, and engagement. This system uses Nodemailer with professional HTML email templates.

## Setup Instructions

### 1. Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM_NAME=MindMate
SMTP_FROM_EMAIL=noreply@mindmate.app

# Email Templates Configuration
EMAIL_SUPPORT_EMAIL=support@mindmate.app
EMAIL_COMPANY_NAME=MindMate
EMAIL_COMPANY_URL=https://mindmate.app
```

### 2. Gmail Setup (Recommended)

For Gmail SMTP:
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this password as `SMTP_PASS`

### 3. Other SMTP Providers

#### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
```

#### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your_mailgun_smtp_user
SMTP_PASS=your_mailgun_smtp_password
```

## Email Types

### 1. Welcome Email
**Trigger:** User registration
**API Endpoint:** `POST /api/email/welcome`
**Payload:**
```json
{
  "userEmail": "user@example.com",
  "userName": "John Doe",
  "action": "welcome"
}
```

### 2. Password Reset Email
**Trigger:** Forgot password request
**API Endpoint:** `POST /api/email/password-reset`
**Payload:**
```json
{
  "email": "user@example.com"
}
```

### 3. Share Notification Email
**Trigger:** User shares a task/note
**API Endpoint:** `POST /api/email/share-notification`
**Payload:**
```json
{
  "recipientEmail": "recipient@example.com",
  "sharedItemId": "task_123",
  "sharedItemTitle": "Project Planning",
  "sharedItemType": "task",
  "sharedByEmail": "sender@example.com"
}
```

### 4. Team Invitation Email
**Trigger:** Team invitation sent
**API Endpoint:** `POST /api/email/team-invitation`
**Payload:**
```json
{
  "emails": ["user1@example.com", "user2@example.com"],
  "teamId": "team_123",
  "teamName": "Development Team",
  "inviterEmail": "admin@example.com",
  "role": "member",
  "customMessage": "Welcome to our team!"
}
```

### 5. Task Reminder Email
**Trigger:** Task due date approaching
**API Endpoint:** `POST /api/email/task-reminder`
**Payload:**
```json
{
  "taskId": "task_123",
  "userEmail": "user@example.com",
  "customMessage": "Don't forget this important task!"
}
```

### 6. Weekly Digest Email
**Trigger:** Scheduled weekly (configurable day)
**API Endpoint:** `POST /api/email/weekly-digest`
**Payload:**
```json
{
  "userEmail": "user@example.com"  // Optional, sends to all users if omitted
}
```

### 7. Test Email
**Trigger:** User testing email configuration
**API Endpoint:** `POST /api/email/test`
**Payload:**
```json
{
  "userEmail": "user@example.com",
  "userName": "John Doe"
}
```

## Email Preferences System

Users can configure their email preferences through the settings interface:

### Available Preferences
- **Task Reminders**: Email notifications for due tasks
- **Share Notifications**: Notifications when items are shared with them
- **Team Invitations**: Team invitation emails
- **Weekly Digest**: Weekly productivity summary
- **Marketing Emails**: Product updates and feature announcements
- **Reminder Frequency**: immediate, hourly, daily, weekly
- **Digest Day**: Which day of the week to receive the digest
- **Quiet Hours**: Time range to avoid sending emails

### API Endpoints
- `GET /api/email/preferences?userEmail=user@example.com` - Get preferences
- `POST /api/email/preferences` - Update preferences

## Implementation Details

### Auto-triggered Emails

#### 1. User Registration (Welcome Email)
Located in: `src/contexts/auth-context.tsx`
```typescript
// Automatically triggered when user signs up
await fetch('/api/email/welcome', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userEmail: newUser.email,
    userName: newUser.name,
    action: 'welcome',
  }),
});
```

#### 2. Share Notifications
Located in: `src/components/share-dialog.tsx`
```typescript
// Automatically triggered when adding collaborators
await fetch('/api/email/share-notification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    recipientEmail: collaboratorEmail.trim(),
    sharedItemId: itemId,
    sharedItemTitle: itemTitle,
    sharedItemType: itemType,
    sharedByEmail: user?.email,
  }),
});
```

### Automated Email Systems

#### 1. Task Reminders
The system includes bulk task reminder processing:
- `GET /api/email/task-reminder` - Processes all due tasks
- Can be called by cron jobs or schedulers
- Automatically prevents spam (max 3 reminders per task, 4-hour cooldown)

#### 2. Weekly Digests
- Automatically sends based on user preferences
- Includes productivity metrics, task completion rates
- Configurable send day (Monday-Sunday)

## Scheduled Email Jobs

### Setting Up Cron Jobs

#### 1. Task Reminders (Run every hour)
```bash
# Add to crontab (crontab -e)
0 * * * * curl -X GET https://your-domain.com/api/email/task-reminder
```

#### 2. Weekly Digests (Run daily at 9 AM)
```bash
# Add to crontab (crontab -e)
0 9 * * * curl -X POST https://your-domain.com/api/email/weekly-digest
```

### Vercel Cron (Recommended for Vercel deployments)
Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/email/task-reminder",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/email/weekly-digest",
      "schedule": "0 9 * * *"
    }
  ]
}
```

## Email Templates

All email templates are responsive and include:
- Professional HTML design with CSS inline styles
- Dark/light mode compatibility
- Mobile-responsive layout
- Fallback text versions
- Company branding placeholders
- Unsubscribe links (where applicable)

### Template Customization

Templates can be customized by modifying the functions in `src/lib/email.ts`:
- `generateWelcomeEmailTemplate()`
- `generatePasswordResetTemplate()`
- `generateShareNotificationTemplate()`
- `generateTeamInvitationTemplate()`
- `generateTaskReminderTemplate()`

## Security Features

### Password Reset Security
- Tokens expire in 1 hour
- Tokens are single-use only
- Secure token generation with randomization
- Email verification required

### Email Validation
- Email format validation
- User existence verification before sending
- Rate limiting (implement as needed)
- SMTP authentication

## Troubleshooting

### Common Issues

#### 1. "Authentication Failed"
- Verify SMTP credentials
- Check if 2FA is enabled (requires app password)
- Verify SMTP host and port

#### 2. "Connection Timeout"
- Check firewall settings
- Verify SMTP_PORT (587 for TLS, 465 for SSL)
- Try different SMTP provider

#### 3. "Email Not Delivered"
- Check spam folder
- Verify recipient email address
- Check SMTP provider quotas/limits

#### 4. "Template Not Loading"
- Verify all environment variables are set
- Check for syntax errors in templates
- Ensure all required data is passed to templates

### Debug Mode
Add to your environment for debugging:
```env
NODE_ENV=development
EMAIL_DEBUG=true
```

## Performance Optimization

### Email Queue (Future Enhancement)
For high-volume applications, consider implementing an email queue:
- Redis-based job queue
- Background email processing
- Retry mechanisms for failed emails
- Email delivery tracking

### Monitoring
- Track email delivery rates
- Monitor SMTP provider limits
- Log email sending failures
- Set up alerts for email service downtime

## Email Analytics (Optional Enhancement)

Consider integrating email analytics:
- Open rates tracking
- Click-through rates
- Bounce rate monitoring
- Unsubscribe tracking

This can be implemented using:
- Email service provider APIs (SendGrid, Mailgun)
- Custom pixel tracking
- Link click tracking

## Production Deployment Checklist

- [ ] All environment variables configured
- [ ] SMTP provider account set up
- [ ] Email sending limits verified
- [ ] Cron jobs configured
- [ ] Email templates tested
- [ ] Error handling implemented
- [ ] Email preferences system functional
- [ ] Security tokens working
- [ ] Unsubscribe links working (if applicable)
- [ ] Email deliverability tested
