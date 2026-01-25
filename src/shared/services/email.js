// src/shared/services/email.js
// Brevo Email Service for CivQuest

const BREVO_CONFIG = {
  apiKey: import.meta.env.VITE_BREVO_API_KEY || '',
  senderName: 'CivQuest',
  senderEmail: 'noreply@civicvanguard.com'
};

/**
 * Send welcome email to new users via Brevo
 * @param {string} email - Recipient email address
 * @param {string} name - Optional recipient name
 */
export async function sendWelcomeEmail(email, name = '') {
  const firstName = name ? name.split(' ')[0] : email.split('@')[0];
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8FAFC;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <tr>
                        <td style="background-color: #004E7C; padding: 32px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">CivQuest Notify</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 16px; color: #1A1A1A; font-size: 20px; font-weight: 600;">Welcome, ${firstName}!</h2>
                            <p style="margin: 0 0 16px; color: #1E293B; font-size: 16px; line-height: 1.6;">
                                Your CivQuest Notify account has been created successfully. You can now subscribe to notification feeds and stay updated on the topics that matter to you.
                            </p>
                            <p style="margin: 0 0 24px; color: #1E293B; font-size: 16px; line-height: 1.6;">
                                CivQuest Notify delivers personalized GIS-powered notifications directly to your inbox, helping you stay informed about changes and updates in your areas of interest.
                            </p>
                            <p style="margin: 0 0 8px; color: #1E293B; font-size: 16px;">
                                Questions? Just reply to this email.
                            </p>
                            <p style="margin: 24px 0 0; color: #1E293B; font-size: 16px;">
                                Best,<br>
                                <strong>The CivQuest Team</strong>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #F8FAFC; padding: 24px 40px; border-top: 1px solid #E2E8F0;">
                            <p style="margin: 0; color: #64748B; font-size: 13px; text-align: center;">
                                &copy; 2026 Civic Vanguard. All rights reserved.<br>
                                <a href="https://civicvanguard.com" style="color: #004E7C; text-decoration: none;">civicvanguard.com</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_CONFIG.apiKey
      },
      body: JSON.stringify({
        sender: {
          name: BREVO_CONFIG.senderName,
          email: BREVO_CONFIG.senderEmail
        },
        to: [{ email: email, name: name || email }],
        cc: [{ email: 'support@civicvanguard.com', name: 'CivQuest Support' }],
        replyTo: { email: 'support@civicvanguard.com', name: 'CivQuest Support' },
        subject: 'Welcome to CivQuest Notify!',
        htmlContent: htmlContent
      })
    });
    
    if (!response.ok) {
      console.error('Failed to send welcome email:', await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error sending welcome email:', err);
    return false;
  }
}

export default {
  sendWelcomeEmail
};
