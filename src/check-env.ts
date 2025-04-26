// src/check-env.ts
// Run with: npx ts-node src/check-env.ts

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis';
// Load environment variables
dotenv.config();

const EMAIL_VARS = [
  'EMAIL_ENABLED',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_FROM',
  'EMAIL_SECURE',
  'EMAIL_USE_OAUTH',
  'EMAIL_USE_TEST_ACCOUNT',
];

const OAUTH_VARS = [
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'GMAIL_REDIRECT_URI',
];

const REDIS_VARS = ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'];

function checkVars(varList: string[], groupName: string) {
  console.log(`\n--- ${groupName} Configuration ---`);

  const results = varList.map((varName) => {
    const value = process.env[varName];
    const masked =
      varName.includes('SECRET') ||
      varName.includes('PASSWORD') ||
      varName.includes('PASS') ||
      varName.includes('TOKEN');

    return {
      name: varName,
      set: value !== undefined,
      value: masked ? (value ? '********' : '[NOT SET]') : value || '[NOT SET]',
    };
  });

  results.forEach((result) => {
    console.log(`${result.name}: ${result.set ? '✓' : '✗'} ${result.value}`);
  });

  const allSet = results.every((r) => r.set);
  console.log(
    `\nStatus: ${allSet ? '✅ All variables set' : '❌ Some variables missing'}`,
  );

  return allSet;
}

// Create a basic .env file if it doesn't exist
function createSampleEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.log('\nCreating sample .env file...');

    const sampleContent = `# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=securemail

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=

# Email Settings
EMAIL_ENABLED=true
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM="SecureMail <your-email@gmail.com>"
EMAIL_SECURE=false
EMAIL_USE_OAUTH=false
EMAIL_USE_TEST_ACCOUNT=false

# Email OAuth (if EMAIL_USE_OAUTH=true)
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
GMAIL_REDIRECT_URI=http://localhost:3000/oauth2/callback

# App Settings
APP_NAME=SecureMail
APP_URL=http://localhost:3000
`;

    fs.writeFileSync(envPath, sampleContent);
    console.log(
      'Sample .env file created. Please edit it with your actual configuration.',
    );
  }
}

console.log('Checking Environment Variables:');

const emailConfigOk = checkVars(EMAIL_VARS, 'Email');
const useOAuth = process.env.EMAIL_USE_OAUTH === 'true';

if (useOAuth) {
  checkVars(OAUTH_VARS, 'OAuth');
}

const redisConfigOk = checkVars(REDIS_VARS, 'Redis');

if (!emailConfigOk || !redisConfigOk) {
  console.log('\n❗ Some required configuration is missing');
  createSampleEnv();
} else {
  console.log('\n✅ Basic configuration looks good');
}

// Test Redis connection
console.log('\n--- Testing Redis Connection ---');
async function testRedisConnection() {
  try {
    // Sử dụng ioredis thay vì redis vì nó hỗ trợ Promise API tốt hơn
    // const Redis = require('ioredis');

    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6380', 10);
    const password = process.env.REDIS_PASSWORD;

    console.log(`Connecting to Redis at ${host}:${port}...`);

    const client = new Redis({
      host,
      port,
      password: password || undefined,
    });

    client.on('error', (err) => {
      console.error('Redis Error:', err.message);
    });

    const pong = await client.ping();
    console.log(`Redis connection successful, ping response: ${pong}`);

    await client.quit();
    return true;
  } catch (error) {
    console.error('Redis connection test failed:', error.message);
    return false;
  }
}

testRedisConnection().then((success) => {
  if (!success) {
    console.log(
      '\n❗ Redis connection failed. Make sure Redis is running and properly configured.',
    );
    console.log('  You can start Redis locally with Docker:');
    console.log('  docker run -d --name redis -p 6380:6380 redis');
  }
});
