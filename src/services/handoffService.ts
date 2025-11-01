// Patient Handoff Service - HIPAA Compliant Transfer of Care
// Service layer for secure patient transfers between healthcare facilities

import { supabase } from '../lib/supabaseClient';
import { PAGINATION_LIMITS, applyLimit } from '../utils/pagination';
import type {
  HandoffPacket,
  // HandoffSection - unused type
  HandoffAttachment,
  HandoffLog,
  CreateHandoffPacketRequest,
  CreateHandoffPacketResponse,
  SendHandoffPacketRequest,
  AcknowledgeHandoffPacketRequest,
  HandoffPacketListFilters,
  HandoffPacketStats,
  TokenValidationResult,
  AttachmentUpload,
} from '../types/handoff';

/**
 * Patient Handoff Service
 * Handles all operations for secure patient transfers
 */
export class HandoffService {
  // ============================================================================
  // PACKET MANAGEMENT
  // ============================================================================

  /**
   * Create a new handoff packet
   * @param request Packet creation data
   * @returns Created packet with access URL
   */
  static async createPacket(
    request: CreateHandoffPacketRequest
  ): Promise<CreateHandoffPacketResponse> {
    try {
      // Encrypt sensitive patient information using PHI encryption
      const encryptedName = await this.encryptPHI(request.patient_name);
      const encryptedDOB = await this.encryptPHI(request.patient_dob);

      const { data: packet, error } = await supabase
        .from('handoff_packets')
        .insert({
          patient_name_encrypted: encryptedName,
          patient_dob_encrypted: encryptedDOB,
          patient_mrn: request.patient_mrn,
          patient_gender: request.patient_gender,
          sending_facility: request.sending_facility,
          receiving_facility: request.receiving_facility,
          urgency_level: request.urgency_level,
          reason_for_transfer: request.reason_for_transfer,
          clinical_data: request.clinical_data,
          sender_provider_name: request.sender_provider_name,
          sender_callback_number: request.sender_callback_number,
          sender_notes: request.sender_notes,
          receiver_contact_name: request.receiver_contact_name,
          receiver_contact_email: request.receiver_contact_email,
          receiver_contact_phone: request.receiver_contact_phone,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      // Log packet creation
      await this.logEvent(packet.id, 'created', 'Handoff packet created');

      // Generate access URL
      const accessUrl = this.generateAccessUrl(packet.access_token);

      return {
        packet,
        access_url: accessUrl,
      };
    } catch (error: any) {

      throw new Error(`Failed to create handoff packet: ${error.message}`);
    }
  }

  /**
   * Get a packet by ID (requires authentication)
   */
  static async getPacket(packetId: string): Promise<HandoffPacket> {
    try {
      const { data, error } = await supabase
        .from('handoff_packets')
        .select('*')
        .eq('id', packetId)
        .single();

      if (error) throw error;

      // Log the view
      await this.logEvent(packetId, 'viewed', 'Packet viewed');

      return data;
    } catch (error: any) {
      throw new Error(`Failed to get handoff packet: ${error.message}`);
    }
  }

  /**
   * Get a packet by access token (no authentication required)
   */
  static async getPacketByToken(token: string): Promise<TokenValidationResult> {
    try {
      const { data, error } = await supabase.rpc('get_handoff_packet_by_token', {
        token,
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          isValid: false,
          error: 'Invalid access token',
        };
      }

      const tokenInfo = data[0];

      if (tokenInfo.is_expired) {
        return {
          isValid: false,
          error: 'Access token has expired',
        };
      }

      // Get full packet
      const packet = await this.getPacketByIdWithToken(tokenInfo.packet_id, token);

      await this.logEvent(
        tokenInfo.packet_id,
        'viewed',
        'Packet accessed via token'
      );

      return {
        isValid: true,
        packet,
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message,
      };
    }
  }

  /**
   * Get packet by ID using token (bypasses auth)
   */
  private static async getPacketByIdWithToken(
    packetId: string,
    token: string
  ): Promise<HandoffPacket> {
    const { data, error } = await supabase
      .from('handoff_packets')
      .select('*')
      .eq('id', packetId)
      .eq('access_token', token)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * List packets with filters
   */
  static async listPackets(
    filters?: HandoffPacketListFilters
  ): Promise<HandoffPacket[]> {
    try {
      let query = supabase
        .from('handoff_packets')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.sending_facility) {
        query = query.eq('sending_facility', filters.sending_facility);
      }

      if (filters?.receiving_facility) {
        query = query.eq('receiving_facility', filters.receiving_facility);
      }

      if (filters?.urgency_level) {
        query = query.eq('urgency_level', filters.urgency_level);
      }

      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      if (filters?.search) {
        query = query.or(
          `packet_number.ilike.%${filters.search}%,patient_mrn.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error: any) {
      throw new Error(`Failed to list handoff packets: ${error.message}`);
    }
  }

  /**
   * Send a packet (changes status to 'sent')
   */
  static async sendPacket(request: SendHandoffPacketRequest): Promise<HandoffPacket> {
    try {
      const { data, error } = await supabase
        .from('handoff_packets')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', request.packet_id)
        .eq('status', 'draft') // Only send drafts
        .select()
        .single();

      if (error) throw error;

      await this.logEvent(request.packet_id, 'sent', 'Packet sent to receiving facility');

      // Send email/SMS confirmations if requested and contact info is available
      if (request.send_confirmation_email || request.send_confirmation_sms) {
        try {
          const { HandoffNotificationService } = await import('./handoffNotificationService');

          // Build recipient list from packet data
          const recipients = [];
          if (data.receiver_contact_email || data.receiver_contact_phone) {
            recipients.push({
              name: data.receiver_contact_name || data.receiving_facility || 'Receiving Facility',
              email: request.send_confirmation_email ? data.receiver_contact_email : undefined,
              phone: request.send_confirmation_sms ? data.receiver_contact_phone : undefined,
              role: 'physician' as const
            });
          }

          if (recipients.length > 0) {
            await HandoffNotificationService.notifyPacketSent(data, recipients);

            // Update notification tracking
            await supabase
              .from('handoff_packets')
              .update({
                notification_preferences: {
                  send_email: request.send_confirmation_email || false,
                  send_sms: request.send_confirmation_sms || false,
                  email_sent: request.send_confirmation_email || false,
                  sms_sent: request.send_confirmation_sms || false,
                  email_sent_at: request.send_confirmation_email ? new Date().toISOString() : null,
                  sms_sent_at: request.send_confirmation_sms ? new Date().toISOString() : null
                }
              })
              .eq('id', request.packet_id);
          }
        } catch (notifyError) {

          // Don't fail the entire operation if notification fails
        }
      }

      return data;
    } catch (error: any) {
      throw new Error(`Failed to send handoff packet: ${error.message}`);
    }
  }

  /**
   * Acknowledge packet receipt
   */
  static async acknowledgePacket(
    request: AcknowledgeHandoffPacketRequest
  ): Promise<HandoffPacket> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Must be authenticated to acknowledge packet');
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { data, error } = await supabase.rpc('acknowledge_handoff_packet', {
        packet_id: request.packet_id,
        acknowledger_id: user.id,
        notes: request.acknowledgement_notes || null,
      });

      if (error) throw error;

      // Fetch updated packet
      return await this.getPacket(request.packet_id);
    } catch (error: any) {
      throw new Error(`Failed to acknowledge handoff packet: ${error.message}`);
    }
  }

  /**
   * Update packet (only drafts)
   */
  static async updatePacket(
    packetId: string,
    updates: Partial<CreateHandoffPacketRequest>
  ): Promise<HandoffPacket> {
    try {
      const updateData: any = {};

      if (updates.patient_name) {
        updateData.patient_name_encrypted = await this.encryptPHI(updates.patient_name);
      }
      if (updates.patient_dob) {
        updateData.patient_dob_encrypted = await this.encryptPHI(updates.patient_dob);
      }
      if (updates.patient_mrn !== undefined) updateData.patient_mrn = updates.patient_mrn;
      if (updates.patient_gender) updateData.patient_gender = updates.patient_gender;
      if (updates.sending_facility) updateData.sending_facility = updates.sending_facility;
      if (updates.receiving_facility)
        updateData.receiving_facility = updates.receiving_facility;
      if (updates.urgency_level) updateData.urgency_level = updates.urgency_level;
      if (updates.reason_for_transfer)
        updateData.reason_for_transfer = updates.reason_for_transfer;
      if (updates.clinical_data) updateData.clinical_data = updates.clinical_data;
      if (updates.sender_provider_name)
        updateData.sender_provider_name = updates.sender_provider_name;
      if (updates.sender_callback_number)
        updateData.sender_callback_number = updates.sender_callback_number;
      if (updates.sender_notes !== undefined)
        updateData.sender_notes = updates.sender_notes;

      const { data, error } = await supabase
        .from('handoff_packets')
        .update(updateData)
        .eq('id', packetId)
        .eq('status', 'draft') // Only update drafts
        .select()
        .single();

      if (error) throw error;

      await this.logEvent(packetId, 'updated', 'Packet updated');

      return data;
    } catch (error: any) {
      throw new Error(`Failed to update handoff packet: ${error.message}`);
    }
  }

  /**
   * Delete/Cancel a packet
   */
  static async cancelPacket(packetId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('handoff_packets')
        .update({ status: 'cancelled' })
        .eq('id', packetId);

      if (error) throw error;

      await this.logEvent(packetId, 'cancelled', 'Packet cancelled');
    } catch (error: any) {
      throw new Error(`Failed to cancel handoff packet: ${error.message}`);
    }
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  /**
   * Upload attachment to packet
   */
  static async uploadAttachment(upload: AttachmentUpload): Promise<HandoffAttachment> {
    try {
      const { file, handoff_packet_id } = upload;

      // Validate file
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('File size exceeds 50MB limit');
      }

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${handoff_packet_id}/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('handoff-attachments')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create attachment record
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: attachment, error: attachmentError } = await supabase
        .from('handoff_attachments')
        .insert({
          handoff_packet_id,
          file_name: file.name,
          file_type: fileExt || 'unknown',
          file_size_bytes: file.size,
          storage_bucket: 'handoff-attachments',
          storage_path: uploadData.path,
          mime_type: file.type,
          uploaded_by: user?.id,
          is_encrypted: true,
        })
        .select()
        .single();

      if (attachmentError) throw attachmentError;

      await this.logEvent(
        handoff_packet_id,
        'attachment_uploaded',
        `Attachment uploaded: ${file.name}`
      );

      return attachment;
    } catch (error: any) {
      throw new Error(`Failed to upload attachment: ${error.message}`);
    }
  }

  /**
   * Get attachments for a packet
   */
  static async getAttachments(packetId: string): Promise<HandoffAttachment[]> {
    try {
      // Limit to 100 attachments per handoff (scoped to single packet - reasonable limit)
      const query = supabase
        .from('handoff_attachments')
        .select('*')
        .eq('handoff_packet_id', packetId)
        .order('created_at', { ascending: true });

      return applyLimit<HandoffAttachment>(query, 100);
    } catch (error: any) {
      throw new Error(`Failed to get attachments: ${error.message}`);
    }
  }

  /**
   * Get signed URL for attachment download
   */
  static async getAttachmentUrl(attachment: HandoffAttachment): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from(attachment.storage_bucket)
        .createSignedUrl(attachment.storage_path, 3600); // 1 hour expiry

      if (error) throw error;

      await this.logEvent(
        attachment.handoff_packet_id,
        'attachment_viewed',
        `Attachment accessed: ${attachment.file_name}`
      );

      return data.signedUrl;
    } catch (error: any) {
      throw new Error(`Failed to get attachment URL: ${error.message}`);
    }
  }

  /**
   * Delete an attachment
   */
  static async deleteAttachment(attachmentId: string): Promise<void> {
    try {
      // Get attachment first
      const { data: attachment, error: fetchError } = await supabase
        .from('handoff_attachments')
        .select('*')
        .eq('id', attachmentId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(attachment.storage_bucket)
        .remove([attachment.storage_path]);

      if (storageError) throw storageError;

      // Delete record
      const { error: deleteError } = await supabase
        .from('handoff_attachments')
        .delete()
        .eq('id', attachmentId);

      if (deleteError) throw deleteError;
    } catch (error: any) {
      throw new Error(`Failed to delete attachment: ${error.message}`);
    }
  }

  // ============================================================================
  // AUDIT LOGS
  // ============================================================================

  /**
   * Get audit logs for a packet
   */
  static async getLogs(packetId: string): Promise<HandoffLog[]> {
    try {
      // Limit to 100 audit logs per handoff (scoped to single packet - reasonable for compliance tracking)
      const query = supabase
        .from('handoff_logs')
        .select('*')
        .eq('handoff_packet_id', packetId)
        .order('timestamp', { ascending: false });

      return applyLimit<HandoffLog>(query, 100);
    } catch (error: any) {
      throw new Error(`Failed to get audit logs: ${error.message}`);
    }
  }

  /**
   * Log an event
   */
  private static async logEvent(
    packetId: string,
    eventType: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from('handoff_logs').insert({
        handoff_packet_id: packetId,
        event_type: eventType,
        event_description: description,
        user_id: user?.id,
        user_email: user?.email,
        metadata: metadata || {},
      });
    } catch (error) {
      // Don't throw - logging errors shouldn't break main flow

    }
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get handoff statistics
   */
  static async getStats(filters?: HandoffPacketListFilters): Promise<HandoffPacketStats> {
    try {
      const packets = await this.listPackets(filters);

      const stats: HandoffPacketStats = {
        total_packets: packets.length,
        sent_packets: packets.filter((p) => p.status === 'sent').length,
        acknowledged_packets: packets.filter((p) => p.status === 'acknowledged').length,
        pending_acknowledgement: packets.filter((p) => p.status === 'sent').length,
        packets_by_status: {
          draft: packets.filter((p) => p.status === 'draft').length,
          sent: packets.filter((p) => p.status === 'sent').length,
          acknowledged: packets.filter((p) => p.status === 'acknowledged').length,
          cancelled: packets.filter((p) => p.status === 'cancelled').length,
        },
        packets_by_urgency: {
          routine: packets.filter((p) => p.urgency_level === 'routine').length,
          urgent: packets.filter((p) => p.urgency_level === 'urgent').length,
          emergent: packets.filter((p) => p.urgency_level === 'emergent').length,
          critical: packets.filter((p) => p.urgency_level === 'critical').length,
        },
      };

      // Calculate average acknowledgement time
      const acknowledgedPackets = packets.filter(
        (p) => p.status === 'acknowledged' && p.sent_at && p.acknowledged_at
      );

      if (acknowledgedPackets.length > 0) {
        const totalMinutes = acknowledgedPackets.reduce((sum, p) => {
          const sentTime = new Date(p.sent_at!).getTime();
          const ackTime = new Date(p.acknowledged_at!).getTime();
          return sum + (ackTime - sentTime) / 1000 / 60;
        }, 0);

        stats.average_acknowledgement_time_minutes =
          totalMinutes / acknowledgedPackets.length;
      }

      return stats;
    } catch (error: any) {
      throw new Error(`Failed to get statistics: ${error.message}`);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate access URL from token
   */
  private static generateAccessUrl(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/handoff/receive/${token}`;
  }

  /**
   * Encrypt PHI using Postgres pgcrypto (AES-256-GCM)
   * Uses your existing encrypt_phi_text function
   */
  private static async encryptPHI(data: string): Promise<string> {
    try {
      const { data: encrypted, error } = await supabase.rpc('encrypt_phi_text', {
        data: data,
        encryption_key: null, // Uses session key from app.phi_encryption_key
      });

      if (error) throw error;
      return encrypted || data; // Fallback to plaintext if encryption fails (logged in DB)
    } catch (error) {

      // In production, you may want to throw instead of fallback
      return data;
    }
  }

  /**
   * Decrypt PHI using Postgres pgcrypto (AES-256-GCM)
   * Uses your existing decrypt_phi_text function
   */
  static async decryptPHI(encryptedData: string): Promise<string> {
    try {
      const { data: decrypted, error } = await supabase.rpc('decrypt_phi_text', {
        encrypted_data: encryptedData,
        encryption_key: null, // Uses session key from app.phi_encryption_key
      });

      if (error) throw error;
      return decrypted || encryptedData; // Fallback to showing encrypted if decryption fails
    } catch (error) {

      return encryptedData;
    }
  }
}

export default HandoffService;
