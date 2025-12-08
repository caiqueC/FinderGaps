import 'dotenv/config';
import nodemailer from 'nodemailer';

async function testEmail() {
    console.log('Testing Email Connection...');
    console.log(`Host: ${process.env.SMTP_HOST}`);
    console.log(`Port: ${process.env.SMTP_PORT}`);
    console.log(`User: ${process.env.SMTP_USER}`);

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        debug: true, // Enable debug
        logger: true // Enable logger
    });

    try {
        console.log('Verifying connection...');
        await transporter.verify();
        console.log('Connection Verified! Attempting to send...');

        const info = await transporter.sendMail({
            from: `"Test Debug" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER, // Send to self
            subject: "Test Email from Debugger",
            text: "If you receive this, SMTP is working.",
        });

        console.log('Message sent: %s', info.messageId);
    } catch (error) {
        console.error('SMTP Error:', error);
    }
}

testEmail();
