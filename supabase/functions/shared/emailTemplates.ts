// supabase/functions/shared/emailTemplates.ts
// Email template utilities for caregiver alerts

/**
 * Builds a professional, compassionate email for Day 7 caregiver alerts
 * when a community member hasn't checked in for 7 consecutive days.
 */
export function buildCaregiverAlertEmail(params: {
  patientFirstName: string | null;
  patientLastName: string | null;
  caregiverFirstName: string | null;
  consecutiveDays: number;
  lastCheckinDate: string | null;
}): { subject: string; html: string; text: string } {
  const {
    patientFirstName,
    patientLastName,
    caregiverFirstName,
    consecutiveDays,
    lastCheckinDate,
  } = params;

  // Friendly patient name
  const patientFullName = [patientFirstName, patientLastName]
    .filter(Boolean)
    .join(" ") || "a WellFit community member";
  const patientFirstOnly = patientFirstName || "the community member";

  // Friendly caregiver greeting
  const caregiverGreeting = caregiverFirstName
    ? `Hi ${caregiverFirstName},`
    : "Hi there,";

  // Format last check-in date
  const lastCheckinFormatted = lastCheckinDate
    ? new Date(lastCheckinDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
        timeZoneName: "short",
      })
    : "unknown";

  // Subject line
  const subject = `WellFit Wellness Check: ${patientFullName} hasn't checked in for ${consecutiveDays} days`;

  // Plain text version
  const text = `${caregiverGreeting}

We're reaching out because ${patientFullName} hasn't checked into WellFit for ${consecutiveDays} consecutive days.

Last check-in: ${lastCheckinFormatted}

We wanted to make sure ${patientFirstOnly} is safe, healthy, and still participating in the WellFit community. Could you please:

1. Reach out to ${patientFirstOnly} to see if they're okay
2. Check if they need any assistance with the app or their wellness routine
3. Confirm they're still interested in participating in WellFit

If ${patientFirstOnly} is doing well and just forgot to check in, a gentle reminder would be wonderful. If there are any concerns, please don't hesitate to contact our care team.

Thank you for being such an important part of ${patientFirstOnly}'s wellness journey. Your care and support make all the difference.

With gratitude,
The WellFit Community Team

---
Questions? Reply to this email or call our support line.
This is an automated wellness check notification.`;

  // HTML version (styled, professional, compassionate)
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WellFit Wellness Check</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; text-align: center;">
                💙 WellFit Wellness Check
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                ${caregiverGreeting}
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                We're reaching out because <strong>${patientFullName}</strong> hasn't checked into WellFit for <strong>${consecutiveDays} consecutive days</strong>.
              </p>

              <!-- Info Box -->
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #666666;">
                  <strong style="color: #333333;">Last check-in:</strong><br>
                  ${lastCheckinFormatted}
                </p>
              </div>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                We wanted to make sure <strong>${patientFirstOnly}</strong> is safe, healthy, and still participating in the WellFit community. Could you please:
              </p>

              <!-- Action Items -->
              <div style="background-color: #fff9e6; border-radius: 6px; padding: 20px; margin: 24px 0;">
                <ol style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.8; color: #333333;">
                  <li style="margin-bottom: 12px;">
                    <strong>Reach out</strong> to ${patientFirstOnly} to see if they're okay
                  </li>
                  <li style="margin-bottom: 12px;">
                    <strong>Check</strong> if they need any assistance with the app or their wellness routine
                  </li>
                  <li>
                    <strong>Confirm</strong> they're still interested in participating in WellFit
                  </li>
                </ol>
              </div>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                If ${patientFirstOnly} is doing well and just forgot to check in, a gentle reminder would be wonderful. If there are any concerns, please don't hesitate to contact our care team.
              </p>

              <p style="margin: 0 0 8px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Thank you for being such an important part of ${patientFirstOnly}'s wellness journey. Your care and support make all the difference.
              </p>

              <p style="margin: 24px 0 0 0; font-size: 16px; line-height: 1.6; color: #666666; font-style: italic;">
                With gratitude,<br>
                <strong style="color: #667eea;">The WellFit Community Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #6c757d; text-align: center;">
                Questions? Reply to this email or contact our support team.<br>
                <span style="color: #adb5bd;">This is an automated wellness check notification.</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Builds a gentle, encouraging SMS message for Day 5 reminder
 */
export function buildDay5SMSMessage(params: {
  firstName: string | null;
  consecutiveDays: number;
}): string {
  const { firstName } = params;
  const name = firstName || "friend";

  return `Hi ${name}! 👋 We noticed you haven't checked in for a few days. Just a friendly reminder to log how you're feeling today. Your wellness matters to us! 💙 - WellFit Community`;
}

/**
 * Builds a sweet, non-intrusive push notification for Day 3 reminder
 */
export function buildDay3PushNotification(params: {
  firstName: string | null;
}): { title: string; body: string } {
  const { firstName } = params;
  const name = firstName || "friend";

  return {
    title: "We Miss You! 💙",
    body: `Hi ${name}! It's been a few days since your last check-in. We'd love to hear how you're doing today. Tap to log your wellness update!`,
  };
}
