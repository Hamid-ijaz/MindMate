import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, userName } = body;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'userEmail is required' },
        { status: 400 }
      );
    }

    const templateData = {
      userName: userName || 'there',
      userEmail,
      companyName: process.env.EMAIL_COMPANY_NAME || 'MindMate',
      companyUrl: process.env.EMAIL_COMPANY_URL || 'https://mindmate.app',
      supportEmail: process.env.EMAIL_SUPPORT_EMAIL || 'support@mindmate.app',
    };

    // Create a test email template
    const testHtml = generateTestEmailTemplate(templateData);
    const testText = generateTestEmailText(templateData);

    const success = await emailService.sendEmail({
      to: userEmail,
      subject: 'Test Email from MindMate 📧',
      html: testHtml,
      text: testText,
    });

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to send test email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateTestEmailTemplate(data: any): string {
  const companyName = data.companyName || 'MindMate';
  const companyUrl = data.companyUrl || 'https://mindmate.app';
  const supportEmail = data.supportEmail || 'support@mindmate.app';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Email from ${companyName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .success-box { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 15px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 Test Email Success!</h1>
            <p>${companyName} Email Service</p>
        </div>
        <div class="content">
            <h2>Hello ${data.userName}! 👋</h2>
            
            <div class="success-box">
                <strong>✅ Email Configuration Working!</strong><br>
                Your email preferences are properly configured and you should receive notifications when enabled.
            </div>

            <p>This is a test email to verify that your email settings are working correctly. If you received this email, it means:</p>
            
            <ul>
                <li>✅ SMTP configuration is working</li>
                <li>✅ Your email address is correct</li>
                <li>✅ ${companyName} can send you notifications</li>
                <li>✅ Email templates are rendering properly</li>
            </ul>

            <p>You can now expect to receive emails for:</p>
            <ul>
                <li>🔔 Task reminders and due date notifications</li>
                <li>📤 Share notifications when someone shares content with you</li>
                <li>👥 Team invitations and collaboration requests</li>
                <li>🔐 Password reset and security notifications</li>
                <li>📊 Weekly productivity summaries (if enabled)</li>
            </ul>

            <p>You can manage your email preferences in the Settings section of your ${companyName} account.</p>
            
            <p>Best regards,<br>
            The ${companyName} Team</p>
        </div>
        <div class="footer">
            <p>This is a test email sent from ${companyName}</p>
            <p><a href="${companyUrl}">Visit ${companyName}</a> | <a href="mailto:${supportEmail}">Contact Support</a></p>
            <p>© 2025 ${companyName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;
}

function generateTestEmailText(data: any): string {
  const companyName = data.companyName || 'MindMate';
  
  return `
Test Email Success! - ${companyName}

Hello ${data.userName}!

✅ Email Configuration Working!
Your email preferences are properly configured and you should receive notifications when enabled.

This is a test email to verify that your email settings are working correctly.

If you received this email, it means:
✅ SMTP configuration is working
✅ Your email address is correct  
✅ ${companyName} can send you notifications
✅ Email templates are rendering properly

You can now expect to receive emails for:
🔔 Task reminders and due date notifications
📤 Share notifications when someone shares content with you
👥 Team invitations and collaboration requests  
🔐 Password reset and security notifications
📊 Weekly productivity summaries (if enabled)

You can manage your email preferences in the Settings section of your ${companyName} account.

Best regards,
The ${companyName} Team

Visit: ${data.companyUrl}
Support: ${data.supportEmail}
  `;
}
