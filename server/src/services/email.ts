import nodemailer from 'nodemailer'

export async function sendEmail({ to, subject, text, html, attachments }: any) {
  // Note: User needs to provide SMTP credentials.
  // For now, I'll use a mock or environment variables.
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER || 'mock_user',
      pass: process.env.SMTP_PASS || 'mock_pass',
    },
  })

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
    attachments,
  })
}
