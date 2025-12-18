// Patient Handoff Notification Service
// Email and SMS notifications for transfer events

import { supabase } from '../lib/supabaseClient';
import type { HandoffPacket } from '../types/handoff';

export interface NotificationRecipient {
  name: string;
  email?: string;
  phone?: string; // E.164 format: +1234567890
  role: 'physician' | 'nurse' | 'admin' | 'caregiver';
}

export interface HandoffNotification {
  event: 'packet_sent' | 'packet_received' | 'acknowledged' | 'high_risk_alert';
  packet: HandoffPacket;
  recipients: NotificationRecipient[];
  priority: 'normal' | 'high' | 'urgent';
}

export class HandoffNotificationService {
  /**
   * Send notification when new transfer packet is created
   */
  static async notifyPacketSent(
    packet: HandoffPacket,
    recipients: NotificationRecipient[]
  ): Promise<void> {
    const subject = `🏥 Patient Transfer Incoming - ${packet.urgency_level.toUpperCase()}`;
    const message = this.generatePacketSentMessage(packet);

    await this.sendNotifications({
      event: 'packet_sent',
      packet,
      recipients,
      priority: packet.urgency_level === 'critical' || packet.urgency_level === 'emergent' ? 'urgent' : 'normal'
    }, subject, message);
  }

  /**
   * Send notification when packet is acknowledged
   */
  static async notifyPacketAcknowledged(
    packet: HandoffPacket,
    acknowledgedBy: string,
    recipients: NotificationRecipient[]
  ): Promise<void> {
    const subject = `✅ Patient Transfer Acknowledged - ${packet.packet_number}`;
    const message = this.generateAcknowledgementMessage(packet, acknowledgedBy);

    await this.sendNotifications({
      event: 'acknowledged',
      packet,
      recipients,
      priority: 'normal'
    }, subject, message);
  }

  /**
   * Send HIGH RISK alert for medication discrepancies
   */
  static async notifyHighRiskMedicationAlert(
    packet: HandoffPacket,
    discrepancyCount: number,
    recipients: NotificationRecipient[]
  ): Promise<void> {
    const subject = `🚨 HIGH RISK - Medication Discrepancies Detected - ${packet.packet_number}`;
    const message = this.generateHighRiskAlertMessage(packet, discrepancyCount);

    await this.sendNotifications({
      event: 'high_risk_alert',
      packet,
      recipients,
      priority: 'urgent'
    }, subject, message);
  }

  /**
   * Core notification dispatcher
   */
  private static async sendNotifications(
    notification: HandoffNotification,
    subject: string,
    message: string
  ): Promise<void> {
    const emailRecipients = notification.recipients.filter(r => r.email);
    const smsRecipients = notification.recipients.filter(r => r.phone);

    // Send emails
    if (emailRecipients.length > 0) {
      await this.sendEmails(emailRecipients, subject, message, notification);
    }

    // Send SMS for urgent notifications
    if (smsRecipients.length > 0 && notification.priority === 'urgent') {
      await this.sendSMS(smsRecipients, message, notification);
    }

    // Log notification in database
    await this.logNotification(notification, emailRecipients.length, smsRecipients.length);
  }

  /**
   * Send email notifications using Supabase Edge Function or external service
   */
  private static async sendEmails(
    recipients: NotificationRecipient[],
    subject: string,
    message: string,
    notification: HandoffNotification
  ): Promise<void> {
    try {
      // Call Supabase Edge Function for email sending
      // This requires a Supabase Edge Function to be deployed
       
      const { data: _data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: recipients.map(r => ({ email: r.email, name: r.name })),
          subject,
          html: this.generateEmailHTML(message, notification),
          priority: notification.priority
        }
      });

      if (error) {

        // Fallback: Log to database for manual review
        await this.logFailedNotification('email', recipients, error.message);
      }
    } catch {

    }
  }

  /**
   * Send SMS notifications using Twilio/Supabase Edge Function
   */
  private static async sendSMS(
    recipients: NotificationRecipient[],
    message: string,
    notification: HandoffNotification
  ): Promise<void> {
    try {
      // Call Supabase Edge Function for SMS sending
       
      const { data: _data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: recipients.map(r => r.phone),
          message: this.generateSMSMessage(message, notification),
          priority: notification.priority
        }
      });

      if (error) {

        await this.logFailedNotification('sms', recipients, error.message);
      }
    } catch {

    }
  }

  /**
   * Generate message for packet sent event
   */
  private static generatePacketSentMessage(packet: HandoffPacket): string {
    return `
New patient transfer packet received:

Transfer ID: ${packet.packet_number}
From: ${packet.sending_facility}
To: ${packet.receiving_facility}
Urgency: ${packet.urgency_level.toUpperCase()}
Reason: ${packet.reason_for_transfer}

Sender: ${packet.sender_provider_name}
Callback: ${packet.sender_callback_number}

${packet.urgency_level === 'critical' || packet.urgency_level === 'emergent' ?
  '⚠️ URGENT - Immediate attention required' : ''}

Please acknowledge receipt as soon as possible.

Access packet: [Link will be in email version]
    `.trim();
  }

  /**
   * Generate acknowledgement message
   */
  private static generateAcknowledgementMessage(packet: HandoffPacket, acknowledgedBy: string): string {
    return `
Patient transfer has been acknowledged:

Transfer ID: ${packet.packet_number}
Patient: [See secure portal]
Acknowledged By: ${acknowledgedBy}
Time: ${new Date().toLocaleString()}

Transfer complete. Patient handoff documentation is available in the system.
    `.trim();
  }

  /**
   * Generate high-risk alert message
   */
  private static generateHighRiskAlertMessage(packet: HandoffPacket, discrepancyCount: number): string {
    return `
🚨 HIGH RISK MEDICATION ALERT 🚨

Transfer ID: ${packet.packet_number}
${discrepancyCount} medication discrepanc${discrepancyCount === 1 ? 'y' : 'ies'} detected

IMMEDIATE ACTION REQUIRED:
- Review medication reconciliation alert
- Reconcile all discrepancies before patient admission
- Document all changes in patient chart

This is a Joint Commission NPSG.03.06.01 compliance requirement.

Access full report: [Link in email]
    `.trim();
  }

  /**
   * Generate HTML email template
   */
  private static generateEmailHTML(message: string, notification: HandoffNotification): string {
    const urgencyColors = {
      normal: '#4CAF50',
      high: '#FF9800',
      urgent: '#F44336'
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${urgencyColors[notification.priority]}; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    .button { background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
    pre { background: white; padding: 15px; border-left: 4px solid ${urgencyColors[notification.priority]}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏥 WellFit Patient Transfer System</h1>
      <p>${notification.event.replace('_', ' ').toUpperCase()}</p>
    </div>
    <div class="content">
      <pre>${message}</pre>
      <p style="text-align: center;">
        <a href="${this.generateAccessURL(notification.packet)}" class="button">
          View Transfer Packet
        </a>
      </p>
    </div>
    <div class="footer">
      <p><strong>Protected Health Information (PHI)</strong><br/>
      This email contains protected health information. Do not forward.</p>
      <p>WellFit Patient Handoff System - HIPAA Compliant</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate SMS message (160 character limit)
   */
  private static generateSMSMessage(message: string, notification: HandoffNotification): string {
    const prefix = notification.priority === 'urgent' ? '🚨 URGENT: ' : '';
    const core = `Patient transfer ${notification.packet.packet_number} - ${notification.event}`;
    const link = this.generateAccessURL(notification.packet);

    return `${prefix}${core}\n${link}`.substring(0, 160);
  }

  /**
   * Generate secure access URL for packet
   */
  private static generateAccessURL(packet: HandoffPacket): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/handoff/receive/${packet.access_token}`;
  }

  /**
   * Log notification in database for audit trail
   */
  private static async logNotification(
    notification: HandoffNotification,
    emailCount: number,
    smsCount: number
  ): Promise<void> {
    try {
      await supabase.from('handoff_notifications').insert({
        packet_id: notification.packet.id,
        event_type: notification.event,
        priority: notification.priority,
        emails_sent: emailCount,
        sms_sent: smsCount,
        sent_at: new Date().toISOString()
      });
    } catch {

    }
  }

  /**
   * Log failed notification for manual follow-up
   */
  private static async logFailedNotification(
    type: 'email' | 'sms',
    recipients: NotificationRecipient[],
    errorMessage: string
  ): Promise<void> {
    try {
      await supabase.from('handoff_notification_failures').insert({
        notification_type: type,
        recipients: JSON.stringify(recipients),
        error_message: errorMessage,
        failed_at: new Date().toISOString(),
        retry_count: 0
      });
    } catch {

    }
  }
}

export default HandoffNotificationService;
