import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailTemplateData {
  userName?: string;
  userEmail?: string;
  resetLink?: string;
  verificationLink?: string;
  sharedItemTitle?: string;
  sharedItemType?: 'task' | 'note' | 'list';
  sharedByName?: string;
  sharedByEmail?: string;
  shareLink?: string;
  teamName?: string;
  inviteLink?: string;
  inviterName?: string;
  companyName?: string;
  companyUrl?: string;
  supportEmail?: string;
  unsubscribeLink?: string;
  [key: string]: any;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isInitialized: boolean = false;

  private async initializeTransporter(): Promise<void> {
    if (this.isInitialized && this.transporter) {
      return;
    }

    try {
      const config = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      };

      if (!config.auth.user || !config.auth.pass) {
        throw new Error('SMTP credentials not configured');
      }

      this.transporter = nodemailer.createTransport(config);
      
      // Verify connection
      await this.transporter.verify();
      this.isInitialized = true;
      
      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      throw error;
    }
  }

  private getDefaultFromAddress(): string {
    const name = process.env.SMTP_FROM_NAME || 'MindMate';
    const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    return `${name} <${email}>`;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      await this.initializeTransporter();
      
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: this.getDefaultFromAddress(),
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  // Welcome email when user signs up
  async sendWelcomeEmail(to: string, data: EmailTemplateData): Promise<boolean> {
    const html = this.generateWelcomeEmailTemplate(data);
    const text = this.generateWelcomeEmailText(data);

    return this.sendEmail({
      to,
      subject: `Welcome to ${data.companyName || 'MindMate'}! 🧠`,
      html,
      text,
    });
  }

  // Password reset email
  async sendPasswordResetEmail(to: string, data: EmailTemplateData): Promise<boolean> {
    const html = this.generatePasswordResetTemplate(data);
    const text = this.generatePasswordResetText(data);

    return this.sendEmail({
      to,
      subject: 'Reset Your Password - MindMate',
      html,
      text,
    });
  }

  // Email verification
  async sendVerificationEmail(to: string, data: EmailTemplateData): Promise<boolean> {
    const html = this.generateVerificationTemplate(data);
    const text = this.generateVerificationText(data);

    return this.sendEmail({
      to,
      subject: 'Verify Your Email - MindMate',
      html,
      text,
    });
  }

  // Share notification email
  async sendShareNotificationEmail(to: string, data: EmailTemplateData): Promise<boolean> {
    const html = this.generateShareNotificationTemplate(data);
    const text = this.generateShareNotificationText(data);

    const itemType = data.sharedItemType || 'item';
    const subject = `${data.sharedByName} shared a ${itemType} with you - MindMate`;

    return this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  // Team invitation email
  async sendTeamInvitationEmail(to: string, data: EmailTemplateData): Promise<boolean> {
    const html = this.generateTeamInvitationTemplate(data);
    const text = this.generateTeamInvitationText(data);

    return this.sendEmail({
      to,
      subject: `You're invited to join ${data.teamName} on MindMate`,
      html,
      text,
    });
  }

  // Task reminder email
  async sendTaskReminderEmail(to: string, data: EmailTemplateData): Promise<boolean> {
    const html = this.generateTaskReminderTemplate(data);
    const text = this.generateTaskReminderText(data);

    return this.sendEmail({
      to,
      subject: `⏰ Task Reminder: ${data.taskTitle}`,
      html,
      text,
    });
  }

  // Email Templates
  private generateWelcomeEmailTemplate(data: EmailTemplateData): string {
    const companyName = data.companyName || 'MindMate';
    const companyUrl = data.companyUrl || 'https://mindmate.app';
    const supportEmail = data.supportEmail || 'support@mindmate.app';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${companyName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .feature { padding: 15px; margin: 10px 0; background: #f8f9ff; border-radius: 6px; border-left: 4px solid #667eea; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧠 Welcome to ${companyName}!</h1>
            <p>Your AI-powered task management companion</p>
        </div>
        <div class="content">
            <h2>Hello ${data.userName || 'there'}! 👋</h2>
            <p>Thank you for joining ${companyName}! We're excited to help you stay organized and productive with our AI-powered task management platform.</p>
            
            <h3>🚀 What you can do with ${companyName}:</h3>
            <div class="feature">
                <strong>✨ AI-Powered Task Suggestions</strong><br>
                Let our AI help you break down complex tasks and suggest optimal workflows.
            </div>
            <div class="feature">
                <strong>📅 Smart Scheduling</strong><br>
                Intelligent reminders and calendar integration to keep you on track.
            </div>
            <div class="feature">
                <strong>🤝 Team Collaboration</strong><br>
                Share tasks and notes with your team seamlessly.
            </div>
            <div class="feature">
                <strong>📱 Cross-Platform Sync</strong><br>
                Access your tasks anywhere with real-time synchronization.
            </div>

            <p style="text-align: center;">
                <a href="${companyUrl}" class="button">Get Started Now</a>
            </p>

            <p>If you have any questions, our team is here to help. Simply reply to this email or contact us at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
            
            <p>Welcome aboard!<br>
            The ${companyName} Team</p>
        </div>
        <div class="footer">
            <p>© 2025 ${companyName}. All rights reserved.</p>
            <p><a href="${companyUrl}">Visit our website</a> | <a href="mailto:${supportEmail}">Contact Support</a></p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private generatePasswordResetTemplate(data: EmailTemplateData): string {
    const companyName = data.companyName || 'MindMate';
    const resetLink = data.resetLink || '#';
    const supportEmail = data.supportEmail || 'support@mindmate.app';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .button { display: inline-block; padding: 12px 24px; background: #f5576c; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset Request</h1>
            <p>${companyName}</p>
        </div>
        <div class="content">
            <h2>Hello ${data.userName || 'there'}!</h2>
            <p>We received a request to reset your password for your ${companyName} account (<strong>${data.userEmail}</strong>).</p>
            
            <p style="text-align: center;">
                <a href="${resetLink}" class="button">Reset My Password</a>
            </p>

            <div class="warning">
                <strong>⚠️ Important:</strong><br>
                • This link will expire in 1 hour for security reasons<br>
                • If you didn't request this reset, please ignore this email<br>
                • Your password will remain unchanged unless you click the link above
            </div>

            <p>For security reasons, please don't share this link with anyone. If you have any concerns, contact our support team immediately.</p>
            
            <p>Stay secure,<br>
            The ${companyName} Security Team</p>
        </div>
        <div class="footer">
            <p>If you're having trouble clicking the button, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetLink}</p>
            <p>© 2025 ${companyName}. All rights reserved. | <a href="mailto:${supportEmail}">Contact Support</a></p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private generateShareNotificationTemplate(data: EmailTemplateData): string {
    const companyName = data.companyName || 'MindMate';
    const shareLink = data.shareLink || '#';
    const itemType = data.sharedItemType || 'item';
    const itemTitle = data.sharedItemTitle || 'Untitled';
    const sharedByName = data.sharedByName || 'Someone';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Item Shared With You</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .button { display: inline-block; padding: 12px 24px; background: #4facfe; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .shared-item { background: #f8f9ff; padding: 20px; border-radius: 6px; border-left: 4px solid #4facfe; margin: 20px 0; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; background: #4facfe; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-right: 10px; vertical-align: middle; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📤 Something has been shared with you!</h1>
            <p>${companyName}</p>
        </div>
        <div class="content">
            <div style="margin-bottom: 20px;">
                <span class="avatar">${sharedByName.charAt(0).toUpperCase()}</span>
                <strong>${sharedByName}</strong> shared a ${itemType} with you
            </div>
            
            <div class="shared-item">
                <h3 style="margin: 0 0 10px 0; color: #4facfe;">
                    ${itemType === 'task' ? '📋' : itemType === 'note' ? '📝' : '📄'} ${itemTitle}
                </h3>
                <p style="margin: 0; color: #666;">Type: ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}</p>
            </div>

            <p style="text-align: center;">
                <a href="${shareLink}" class="button">View Shared ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}</a>
            </p>

            <p>Click the button above to view the ${itemType} that was shared with you. You can collaborate, comment, and stay updated on any changes.</p>
            
            <p>Happy collaborating!<br>
            The ${companyName} Team</p>
        </div>
        <div class="footer">
            <p>This ${itemType} was shared from ${companyName}</p>
            <p>© 2025 ${companyName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private generateTeamInvitationTemplate(data: EmailTemplateData): string {
    const companyName = data.companyName || 'MindMate';
    const teamName = data.teamName || 'Team';
    const inviteLink = data.inviteLink || '#';
    const inviterName = data.inviterName || 'Someone';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Invitation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: #333; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .button { display: inline-block; padding: 12px 24px; background: #4ade80; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .team-info { background: #f0fdf4; padding: 20px; border-radius: 6px; border-left: 4px solid #4ade80; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤝 You're Invited to Join a Team!</h1>
            <p>${companyName}</p>
        </div>
        <div class="content">
            <h2>Hello!</h2>
            <p><strong>${inviterName}</strong> has invited you to join the <strong>${teamName}</strong> team on ${companyName}.</p>
            
            <div class="team-info">
                <h3 style="margin: 0 0 10px 0; color: #4ade80;">👥 ${teamName}</h3>
                <p style="margin: 0;">Collaborate on tasks, share notes, and stay organized together with your team.</p>
            </div>

            <p style="text-align: center;">
                <a href="${inviteLink}" class="button">Join ${teamName}</a>
            </p>

            <p>By joining this team, you'll be able to:</p>
            <ul>
                <li>✅ Collaborate on shared tasks and projects</li>
                <li>📝 Share notes and important information</li>
                <li>💬 Communicate with team members</li>
                <li>📊 Track team progress and analytics</li>
            </ul>

            <p>If you don't have a ${companyName} account yet, clicking the link above will help you create one.</p>
            
            <p>Looking forward to having you on the team!<br>
            The ${companyName} Team</p>
        </div>
        <div class="footer">
            <p>This invitation was sent by ${inviterName} through ${companyName}</p>
            <p>© 2025 ${companyName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private generateTaskReminderTemplate(data: EmailTemplateData): string {
    const companyName = data.companyName || 'MindMate';
    const taskTitle = data.taskTitle || 'Your Task';
    const taskLink = data.taskLink || '#';
    const dueDate = data.dueDate ? new Date(data.dueDate).toLocaleDateString() : null;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Reminder</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); color: #333; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .button { display: inline-block; padding: 12px 24px; background: #f97316; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .task-info { background: #fff7ed; padding: 20px; border-radius: 6px; border-left: 4px solid #f97316; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Task Reminder</h1>
            <p>${companyName}</p>
        </div>
        <div class="content">
            <h2>Don't forget about your task!</h2>
            
            <div class="task-info">
                <h3 style="margin: 0 0 10px 0; color: #f97316;">📋 ${taskTitle}</h3>
                ${dueDate ? `<p style="margin: 0; color: #666;">Due: ${dueDate}</p>` : ''}
            </div>

            <p style="text-align: center;">
                <a href="${taskLink}" class="button">View Task</a>
            </p>

            <p>This is a friendly reminder about your upcoming task. Click the button above to view the full details and mark it as complete when you're done.</p>
            
            <p>Stay productive!<br>
            The ${companyName} Team</p>
        </div>
        <div class="footer">
            <p>© 2025 ${companyName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private generateVerificationTemplate(data: EmailTemplateData): string {
    const companyName = data.companyName || 'MindMate';
    const verificationLink = data.verificationLink || '#';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%); color: #333; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✉️ Verify Your Email</h1>
            <p>${companyName}</p>
        </div>
        <div class="content">
            <h2>Almost there, ${data.userName || 'there'}!</h2>
            <p>Thanks for signing up for ${companyName}. To complete your registration and secure your account, please verify your email address.</p>
            
            <p style="text-align: center;">
                <a href="${verificationLink}" class="button">Verify My Email</a>
            </p>

            <p>After verification, you'll have full access to all ${companyName} features. This link will expire in 24 hours for security reasons.</p>
            
            <p>Welcome to the ${companyName} family!<br>
            The ${companyName} Team</p>
        </div>
        <div class="footer">
            <p>If you're having trouble clicking the button, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all; color: #10b981;">${verificationLink}</p>
            <p>© 2025 ${companyName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  // Text versions for better email client compatibility
  private generateWelcomeEmailText(data: EmailTemplateData): string {
    const companyName = data.companyName || 'MindMate';
    return `
Welcome to ${companyName}!

Hello ${data.userName || 'there'}!

Thank you for joining ${companyName}! We're excited to help you stay organized and productive with our AI-powered task management platform.

What you can do with ${companyName}:
✨ AI-Powered Task Suggestions - Let our AI help you break down complex tasks
📅 Smart Scheduling - Intelligent reminders and calendar integration
🤝 Team Collaboration - Share tasks and notes with your team
📱 Cross-Platform Sync - Access your tasks anywhere

Get started: ${data.companyUrl || 'https://mindmate.app'}

If you have any questions, contact us at ${data.supportEmail || 'support@mindmate.app'}.

Welcome aboard!
The ${companyName} Team
    `;
  }

  private generatePasswordResetText(data: EmailTemplateData): string {
    const companyName = data.companyName || 'MindMate';
    return `
Password Reset Request - ${companyName}

Hello ${data.userName || 'there'}!

We received a request to reset your password for your ${companyName} account (${data.userEmail}).

Reset your password: ${data.resetLink}

Important:
- This link expires in 1 hour
- If you didn't request this reset, please ignore this email
- Your password remains unchanged unless you use the link above

For security concerns, contact: ${data.supportEmail || 'support@mindmate.app'}

Stay secure,
The ${companyName} Security Team
    `;
  }

  private generateShareNotificationText(data: EmailTemplateData): string {
    const companyName = data.companyName || 'MindMate';
    const itemType = data.sharedItemType || 'item';
    
    return `
${data.sharedByName} shared a ${itemType} with you - ${companyName}

${data.sharedByName} shared "${data.sharedItemTitle}" (${itemType}) with you.

View the shared ${itemType}: ${data.shareLink}

You can now collaborate, comment, and stay updated on any changes.

Happy collaborating!
The ${companyName} Team
    `;
  }

  private generateTeamInvitationText(data: EmailTemplateData): string {
    const companyName = data.companyName || 'MindMate';
    return `
You're invited to join ${data.teamName} - ${companyName}

Hello!

${data.inviterName} has invited you to join the ${data.teamName} team on ${companyName}.

Join the team: ${data.inviteLink}

By joining, you'll be able to:
✅ Collaborate on shared tasks
📝 Share notes and information
💬 Communicate with team members
📊 Track team progress

Looking forward to having you on the team!
The ${companyName} Team
    `;
  }

  private generateTaskReminderText(data: EmailTemplateData): string {
    const companyName = data.companyName || 'MindMate';
    const dueDate = data.dueDate ? new Date(data.dueDate).toLocaleDateString() : '';
    
    return `
Task Reminder - ${companyName}

Don't forget about your task: ${data.taskTitle}
${dueDate ? `Due: ${dueDate}` : ''}

View task: ${data.taskLink}

This is a friendly reminder about your upcoming task.

Stay productive!
The ${companyName} Team
    `;
  }

  private generateVerificationText(data: EmailTemplateData): string {
    const companyName = data.companyName || 'MindMate';
    return `
Verify Your Email - ${companyName}

Almost there, ${data.userName || 'there'}!

Thanks for signing up for ${companyName}. Please verify your email address to complete registration.

Verify your email: ${data.verificationLink}

This link expires in 24 hours for security.

Welcome to the ${companyName} family!
The ${companyName} Team
    `;
  }
}

export const emailService = new EmailService();
