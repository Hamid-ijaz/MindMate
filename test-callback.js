// Test script to debug the OAuth callback
const http = require('http');

const testEmail = 'test@example.com';

// Simulate a callback request with debugging
const options = {
  hostname: 'localhost',
  port: 9002,
  path: '/api/google/callback?code=test_code_123&state=test_state',
  method: 'GET',
  headers: {
    'Cookie': `mindmate-auth=${testEmail}`,
    'x-user-email': testEmail,
    'User-Agent': 'Test-Script/1.0'
  }
};

console.log('🧪 Testing OAuth callback with:');
console.log('   Email:', testEmail);
console.log('   Code: test_code_123');
console.log('   URL:', `http://${options.hostname}:${options.port}${options.path}`);
console.log('');

const req = http.request(options, (res) => {
  console.log('📥 Response status:', res.statusCode);
  console.log('📥 Response headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📥 Response body length:', data.length);
    if (data.length < 1000) {
      console.log('📥 Response body:', data);
    } else {
      console.log('📥 Response body (first 500 chars):', data.substring(0, 500) + '...');
    }
    
    if (res.headers.location) {
      console.log('🔀 Redirect location:', res.headers.location);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.end();
