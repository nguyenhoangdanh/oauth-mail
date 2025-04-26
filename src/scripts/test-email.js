const nodemailer = require('nodemailer');
require('dotenv').config();

async function main() {
    const recipient = process.argv[2] || 'hoangdanh54317@gmail.com';
    console.log(`Sending test email to: ${recipient}`);

    try {
        // Sử dụng App Password thay vì OAuth2
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_FROM,
                pass: process.env.EMAIL_APP_PASSWORD_GOOGLE
            }
        });

        // Kiểm tra kết nối
        await transporter.verify();
        console.log('SMTP connection verified successfully!');

        // Gửi email
        const info = await transporter.sendMail({
            from: `"SecureMail Test" <${process.env.EMAIL_FROM}>`,
            to: recipient,
            subject: 'SecureMail Test Email',
            text: 'This is a test email from SecureMail.',
            html: `
            <h1>Test Email from SecureMail</h1>
            <p>This is a test email sent at: ${new Date().toLocaleString()}</p>
            <p>If you're seeing this, your email configuration is working properly!</p>
            `,
        });

        console.log('Email sent successfully!');
        console.log('Message ID:', info.messageId);
    } catch (error) {
        console.error('ERROR DETAILS:');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        if (error.command) console.error('Command:', error.command);
    }
}

main();
// // Chạy với: node src/scripts/test-email.js your@email.com
// const nodemailer = require('nodemailer');
// require('dotenv').config();

// async function main() {
//     const recipient = process.argv[2] || 'hoangdanh54317@gmail.com';
//     console.log(`Gửi email test đến: ${recipient}`);

//     // Cấu hình OAuth
//     const transporter = nodemailer.createTransport({
//         host: 'smtp.gmail.com',
//         port: 587,
//         secure: false,
//         auth: {
//             type: 'OAuth2',
//             user: process.env.EMAIL_FROM,
//             clientId: process.env.GMAIL_CLIENT_ID,
//             clientSecret: process.env.GMAIL_CLIENT_SECRET,
//             refreshToken: process.env.GMAIL_REFRESH_TOKEN,
//         },
//     });

//     // Kiểm tra kết nối
//     await transporter.verify();
//     console.log('Kết nối SMTP thành công!');

//     // Gửi email
//     const info = await transporter.sendMail({
//         from: `"SecureMail Test" <${process.env.EMAIL_FROM}>`,
//         to: recipient,
//         subject: 'SecureMail Test',
//         text: 'Đây là email test từ SecureMail.',
//         html: '<h1>Test Email</h1><p>Đây là email test từ SecureMail.</p>',
//     });

//     console.log('Email đã gửi:', info.messageId);
// }

// main().catch(console.error);
