import { Resend } from 'resend';

export async function createResend({apiKey,email,subject,html}: {apiKey: string,email: string,subject: string,html: string}) {
    if(!apiKey) {
        console.log('❌ RESEND_API_KEY is not defined in environment variables');
        throw new Error('RESEND_API_KEY is not defined in environment variables');
    }

    const resend = new Resend(apiKey);
    if(!resend) {
        console.log('❌ Failed to create Resend client');
        throw new Error('Failed to create Resend client');
    }

    const { data, error } = await resend.emails.send({
    from: 'Sudip Sharma <sudip@sudipsharma.info.np>',
    to: [email],
    subject,
    html,
  });

  console.log('Resend email send response:', { data, error });

  if (error) {
    return console.error({ error });
  }
};

export function generateOtpEmailTemplate(otp: string, email: string) {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Sudip Sharma — OTP Verification</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f4f6f8;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .wrapper {
        width: 100%;
        background-color: #f4f6f8;
        padding: 32px 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 6px 18px rgba(0,0,0,0.06);
      }
      .header {
        padding: 24px 28px;
        background: linear-gradient(90deg,#0ea5a4,#06b6d4);
        color: #fff;
        text-align: left;
      }
      .logo {
        font-weight: 700;
        font-size: 20px;
        letter-spacing: 0.2px;
      }
      .content {
        padding: 28px;
        color: #0f172a;
        line-height: 1.5;
      }
      .lead {
        font-size: 16px;
        margin-bottom: 16px;
      }
      .otp-box {
        display: block;
        width: 100%;
        text-align: center;
        margin: 18px 0;
      }
      .otp {
        display: inline-block;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 4px;
        padding: 12px 20px;
        border-radius: 8px;
        background: #f1f5f9;
        border: 1px dashed #cbd5e1;
        color: #0f172a;
      }
      .btn {
        display: inline-block;
        padding: 12px 20px;
        border-radius: 8px;
        background: #06b6d4;
        color: #fff;
        text-decoration: none;
        font-weight: 600;
        margin-top: 12px;
      }
      .small {
        font-size: 13px;
        color: #475569;
        margin-top: 12px;
      }
      .footer {
        padding: 18px 28px;
        text-align: center;
        font-size: 13px;
        color: #64748b;
        background: #fbfdff;
      }
      a {
        color: #0ea5a4;
        text-decoration: none;
      }
      @media (max-width:420px) {
        .content { padding: 18px; }
        .header { padding: 18px; }
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div>
        <img src="https://res.cloudinary.com/diuy2xilf/image/upload/v1760532594/portfolio/olm9qcmxfyt9tmoqppgz.png" alt="Sudip Sharma" width="120" />
        </div>

        <div class="content">
          <p class="lead">Hi ${email},</p>

          <p>
            You requested a one-time code to access my personal Chat Avatar on
            <a href="https://sudipsharma.info.np" target="_blank">sudipsharma.info.np</a>.
          </p>

          <div class="otp-box">
            <span class="otp">${otp}</span>
          </div>

          <p class="small">
            Use this code within the next <strong>5 minutes</strong> to verify your email and start chatting.
          </p>


          <hr style="border:none;border-top:1px solid #eef2f7;margin:20px 0;" />

          <p style="font-size:13px;color:#64748b;">
            Enjoy chatting! 🚀<br/>
            — Sudip Sharma
          </p>
        </div>

        <div class="footer">
          <div>Need help? <a href="https://www.sudipsharma.info.np/#contact" target="_blank">Contact</a></div>
          <div style="margin-top:8px;color:#94a3b8;font-size:12px;">
            This email is computer generated and sent to ${email}. If you didn’t request this, you can safely ignore it.
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`;
}


