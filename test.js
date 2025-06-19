const nodemailer = require('nodemailer');

// Configure the email transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com', // Office 365 SMTP host
  port: 587, // SMTP port
  secure: false, // Use STARTTLS
  auth: {
    user: 'it.service@galaxytechnology.vn', // Your Office 365 email
    pass: 'GTS@2028', // Your Office 365 email password
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false, // Accept all certificates (not recommended for production)
  },
  debug: true, // Enable debug output
});

// Verify SMTP connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('SMTP server is ready to take our messages');
  }
});

// Function to send email
async function sendEmail() {
  try {
    // NOTE: Make sure the 'from' email matches your authenticated user
    // or use the format: "Your Name <your.email@domain.com>"
    const mailOptions = {
      from: '"IT Service" <it.service@galaxytechnology.vn>', // Should match auth.user
      to: 'hoangdanh54317@gmail.com', // List of recipients
      subject: 'Test Email from Node.js', // Subject line
      text: 'This is a test email sent from Node.js using Office 365 SMTP.', // Plain text body
      html: '<h1>Test Email</h1><p>This is a <b>test email</b> sent from Node.js using Office 365 SMTP.</p>', // HTML body
    };

    console.log('Attempting to send email...');
    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));

    return info;
  } catch (error) {
    console.error('Error sending email:');

    if (error.code === 'EAUTH') {
      console.error('Authentication failed. Check your username and password.');
    } else if (error.code === 'ESOCKET') {
      console.error('Socket error. Check your connection and port settings.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error(
        'Connection timed out. Check your host settings and firewall.',
      );
    } else if (error.code === 'ECONNECTION') {
      console.error('Connection error. Check your host settings.');
    } else {
      console.error('Detail:', error.message);
    }

    throw error;
  }
}

// Execute the email sending function
sendEmail()
  .then(() => {
    console.log('Email test completed.');
  })
  .catch(() => {
    console.log('Email test failed.');
  })
  .finally(() => {
    // Close the connection pool
    transporter.close();
  });
