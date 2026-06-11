import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'postfix',
  port: Number(process.env.SMTP_PORT) || 25,
  secure: false,
})

const FROM = process.env.SMTP_FROM || 'noreply@bandrang.com'

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const link = `${process.env.APP_URL || 'http://localhost'}/verify-email?token=${token}`
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Verify your Band Rang account',
    html: `
      <h2>Welcome to Band Rang!</h2>
      <p>Click the link below to verify your email address:</p>
      <a href="${link}">${link}</a>
      <p>This link expires in 15 minutes.</p>
    `,
  })
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const link = `${process.env.APP_URL || 'http://localhost'}/reset-password?token=${token}`
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Reset your Band Rang password',
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${link}">${link}</a>
      <p>This link expires in 15 minutes. If you did not request this, ignore this email.</p>
    `,
  })
}
