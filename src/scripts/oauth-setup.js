// oauth-setup.js
const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config();

async function getNewToken() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        'http://localhost:8001/api/admin/oauth/google/callback'  // Match your NestJS endpoint
    );

    // Generate a URL for authorization
    const scopes = [
        'https://mail.google.com/',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.compose'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent' // Force to get refresh token every time
    });

    console.log('Authorize this app by visiting this URL:', authUrl);
    console.log('\nMake sure you are logged in with the email account you want to use for sending emails.');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('\nEnter the code you received after authorization: ', async (code) => {
        rl.close();
        try {
            const { tokens } = await oauth2Client.getToken(code);
            console.log('\n✅ Successfully retrieved tokens!');
            console.log('\nUpdate your .env file with these values:');
            console.log('\nGMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
            console.log('\nAccess token (temporary):', tokens.access_token);
            console.log('\nToken expiry:', new Date(tokens.expiry_date).toLocaleString());
        } catch (error) {
            console.error('\n❌ Error retrieving tokens:', error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
            }
        }
    });
}

getNewToken();