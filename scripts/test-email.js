#!/usr/bin/env node

/**
 * MindMate Email System Test Script
 * 
 * This script helps you test the email functionality
 * Usage: node scripts/test-email.js [email-address]
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testEmail() {
  console.log('🧠 MindMate Email System Test\n');

  // Get configuration
  const baseUrl = await question('Enter your app URL (default: http://localhost:3000): ') || 'http://localhost:3000';
  const testEmail = await question('Enter your test email address: ');
  const userName = await question('Enter test user name (default: Test User): ') || 'Test User';

  if (!testEmail) {
    console.log('❌ Email address is required');
    rl.close();
    return;
  }

  console.log('\n📧 Testing email system...\n');

  try {
    // Test 1: Configuration Test
    console.log('1. Testing email configuration...');
    const testResponse = await fetch(`${baseUrl}/api/email/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: testEmail,
        userName: userName
      })
    });

    if (testResponse.ok) {
      console.log('✅ Test email sent successfully!');
    } else {
      const error = await testResponse.json();
      console.log('❌ Test email failed:', error.error);
    }

    // Test 2: Welcome Email
    console.log('\n2. Testing welcome email...');
    const welcomeResponse = await fetch(`${baseUrl}/api/email/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: testEmail,
        userName: userName,
        action: 'welcome'
      })
    });

    if (welcomeResponse.ok) {
      console.log('✅ Welcome email sent successfully!');
    } else {
      const error = await welcomeResponse.json();
      console.log('❌ Welcome email failed:', error.error);
    }

    // Test 3: Password Reset Email
    console.log('\n3. Testing password reset email...');
    const resetResponse = await fetch(`${baseUrl}/api/email/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail
      })
    });

    if (resetResponse.ok) {
      console.log('✅ Password reset email sent successfully!');
    } else {
      const error = await resetResponse.json();
      console.log('❌ Password reset email failed:', error.error);
    }

    console.log('\n📬 Check your email inbox for the test emails!');
    console.log('\n🔧 Configuration Tips:');
    console.log('- Ensure all SMTP environment variables are set');
    console.log('- Check spam folder if emails don\'t arrive');
    console.log('- Verify SMTP credentials are correct');
    console.log('- For Gmail, use App Password instead of regular password');

  } catch (error) {
    console.log('❌ Error testing email system:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('- Make sure your app is running');
    console.log('- Check network connectivity');
    console.log('- Verify the base URL is correct');
  }

  rl.close();
}

// Run the test
testEmail();
