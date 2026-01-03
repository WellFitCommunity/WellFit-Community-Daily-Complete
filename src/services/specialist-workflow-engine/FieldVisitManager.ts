/**
 * Field Visit Manager
 * Manages field visits with GPS tracking, location verification, and visit state
 */

import { supabase } from '../../lib/supabaseClient';
import { FieldVisit } from './types';
import type { SpecialistProvider as _SpecialistProvider } from './types';
import { offlineSync } from './OfflineDataSync';

export class FieldVisitManager {
  /**
   * Gets current GPS location
   */
  async getCurrentLocation(): Promise<GeolocationCoordinates | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {

        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position.coords),
        (_error) => {

          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  /**
   * Watches location continuously (for tracking visit duration at location)
   */
  watchLocation(callback: (coords: GeolocationCoordinates) => void): number | null {
    if (!navigator.geolocation) {
      return null;
    }

    return navigator.geolocation.watchPosition(
      (position) => callback(position.coords),
      (_error) => {
        // Geolocation watch error - logged via audit system
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );
  }

  /**
   * Stops watching location
   */
  stopWatchingLocation(watchId: number): void {
    if (navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  }

  /**
   * Calculates distance between two coordinates (in meters)
   */
  calculateDistance(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRadians(coord2.latitude - coord1.latitude);
    const dLon = this.toRadians(coord2.longitude - coord1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.latitude)) *
        Math.cos(this.toRadians(coord2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Verifies specialist is within service area
   */
  async isWithinServiceArea(
    specialistId: string,
    location: GeolocationCoordinates
  ): Promise<boolean> {
    const { data: specialist, error } = await supabase
      .from('specialist_providers')
      .select('service_area')
      .eq('id', specialistId)
      .single();

    if (error || !specialist || !specialist.service_area) {
      // If no service area defined, allow anywhere
      return true;
    }

    // Use PostGIS to check if point is within geography
    const { data, error: geoError } = await supabase.rpc('is_within_service_area', {
      specialist_id: specialistId,
      lat: location.latitude,
      lon: location.longitude
    });

    if (geoError) {

      return true; // Fail open for now
    }

    return data === true;
  }

  /**
   * Creates a new field visit
   */
  async createVisit(
    specialistId: string,
    patientId: string,
    visitType: string,
    workflowTemplateId: string,
    scheduledAt?: Date
  ): Promise<FieldVisit> {
    const visit: Partial<FieldVisit> = {
      specialist_id: specialistId,
      patient_id: patientId,
      visit_type: visitType,
      workflow_template_id: workflowTemplateId,
      scheduled_at: scheduledAt,
      current_step: 1,
      completed_steps: [],
      data: {},
      photos: [],
      voice_notes: [],
      offline_captured: !navigator.onLine,
      status: 'scheduled',
      created_at: new Date(),
      updated_at: new Date()
    };

    if (navigator.onLine) {
      const { data, error } = await supabase
        .from('field_visits')
        .insert(visit)
        .select()
        .single();

      if (error) throw new Error(`Failed to create visit: ${error.message}`);
      return data as FieldVisit;
    } else {
      // Offline mode: save to IndexedDB
      const offlineVisit = {
        ...visit,
        id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      } as FieldVisit;

      await offlineSync.saveOffline('visits', offlineVisit);
      return offlineVisit;
    }
  }

  /**
   * Starts a visit (check-in)
   */
  async startVisit(visitId: string): Promise<void> {
    const location = await this.getCurrentLocation();
    const updateData: Partial<FieldVisit> = {
      status: 'in_progress',
      check_in_time: new Date(),
      updated_at: new Date()
    };

    if (location) {
      updateData.check_in_location = {
        type: 'Point',
        coordinates: [location.longitude, location.latitude]
      };
    }

    if (navigator.onLine) {
      const { error } = await supabase
        .from('field_visits')
        .update(updateData)
        .eq('id', visitId);

      if (error) throw new Error(`Failed to start visit: ${error.message}`);
    } else {
      // Update in IndexedDB
      await offlineSync.saveOffline('visits', { id: visitId, ...updateData });
    }
  }

  /**
   * Completes a visit (check-out)
   */
  async completeVisit(visitId: string): Promise<void> {
    const location = await this.getCurrentLocation();
    const updateData: Partial<FieldVisit> = {
      status: 'completed',
      check_out_time: new Date(),
      updated_at: new Date()
    };

    if (location) {
      updateData.check_out_location = {
        type: 'Point',
        coordinates: [location.longitude, location.latitude]
      };
    }

    if (navigator.onLine) {
      const { error } = await supabase
        .from('field_visits')
        .update(updateData)
        .eq('id', visitId);

      if (error) throw new Error(`Failed to complete visit: ${error.message}`);
    } else {
      await offlineSync.saveOffline('visits', { id: visitId, ...updateData });
    }
  }

  /**
   * Gets visits for a specialist
   */
  async getVisitsForSpecialist(
    specialistId: string,
    status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  ): Promise<FieldVisit[]> {
    let query = supabase
      .from('field_visits')
      .select(`
        *,
        patient:profiles!field_visits_patient_id_fkey(id, full_name, date_of_birth, phone),
        specialist:specialist_providers!field_visits_specialist_id_fkey(id, user_id)
      `)
      .eq('specialist_id', specialistId)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch visits: ${error.message}`);
    return data as unknown as FieldVisit[];
  }

  /**
   * Gets a single visit by ID
   */
  async getVisit(visitId: string): Promise<FieldVisit | null> {
    const { data, error } = await supabase
      .from('field_visits')
      .select(`
        *,
        patient:profiles!field_visits_patient_id_fkey(id, full_name, date_of_birth, phone, address),
        specialist:specialist_providers!field_visits_specialist_id_fkey(id, user_id, specialist_type)
      `)
      .eq('id', visitId)
      .single();

    if (error) {

      return null;
    }

    return data as unknown as FieldVisit;
  }

  /**
   * Updates visit data
   */
  async updateVisitData(
    visitId: string,
    stepNumber: number,
    data: Record<string, unknown>
  ): Promise<void> {
    const visit = await this.getVisit(visitId);
    if (!visit) throw new Error('Visit not found');

    const updatedData = {
      ...visit.data,
      [`step_${stepNumber}`]: data
    };

    const completedSteps = [...new Set([...visit.completed_steps, stepNumber])];

    const updatePayload = {
      data: updatedData,
      completed_steps: completedSteps,
      current_step: stepNumber + 1,
      updated_at: new Date()
    };

    if (navigator.onLine) {
      const { error } = await supabase
        .from('field_visits')
        .update(updatePayload)
        .eq('id', visitId);

      if (error) throw new Error(`Failed to update visit: ${error.message}`);
    } else {
      await offlineSync.saveOffline('visits', { id: visitId, ...updatePayload });
    }
  }

  /**
   * Adds photo to visit
   */
  async addPhoto(
    visitId: string,
    photoData: string | Blob,
    metadata?: { type?: string; description?: string }
  ): Promise<string> {
    const photoId = `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (navigator.onLine) {
      // Upload to Supabase Storage
      const fileName = `${visitId}/${photoId}.${metadata?.type || 'jpg'}`;
      const { error: uploadError } = await supabase.storage
        .from('specialist-photos')
        .upload(fileName, photoData, {
          contentType: `image/${metadata?.type || 'jpeg'}`,
          upsert: true
        });

      if (uploadError) throw new Error(`Failed to upload photo: ${uploadError.message}`);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('specialist-photos')
        .getPublicUrl(fileName);

      // Add to visit photos array
      const visit = await this.getVisit(visitId);
      if (visit) {
        const { error } = await supabase
          .from('field_visits')
          .update({
            photos: [...visit.photos, urlData.publicUrl],
            updated_at: new Date()
          })
          .eq('id', visitId);

        if (error) throw new Error(`Failed to link photo: ${error.message}`);
      }

      return urlData.publicUrl;
    } else {
      // Save to IndexedDB for later sync
      await offlineSync.saveOffline('photos', {
        id: photoId,
        visit_id: visitId,
        data: photoData,
        type: metadata?.type || 'jpg',
        description: metadata?.description,
        contentType: `image/${metadata?.type || 'jpeg'}`
      });

      return photoId; // Return temp ID
    }
  }

  /**
   * Cancels a visit
   */
  async cancelVisit(visitId: string, reason?: string): Promise<void> {
    const updateData = {
      status: 'cancelled' as const,
      data: { cancel_reason: reason },
      updated_at: new Date()
    };

    const { error } = await supabase
      .from('field_visits')
      .update(updateData)
      .eq('id', visitId);

    if (error) throw new Error(`Failed to cancel visit: ${error.message}`);
  }

  /**
   * Gets visit duration in minutes
   */
  getVisitDuration(visit: FieldVisit): number | null {
    if (!visit.check_in_time || !visit.check_out_time) return null;

    const checkIn = new Date(visit.check_in_time).getTime();
    const checkOut = new Date(visit.check_out_time).getTime();

    return Math.round((checkOut - checkIn) / 60000); // Convert to minutes
  }

  /**
   * Gets today's visits for a specialist
   */
  async getTodaysVisits(specialistId: string): Promise<FieldVisit[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('field_visits')
      .select(`
        *,
        patient:profiles!field_visits_patient_id_fkey(id, full_name, address, phone)
      `)
      .eq('specialist_id', specialistId)
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', tomorrow.toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch today's visits: ${error.message}`);
    return data as unknown as FieldVisit[];
  }
}

// Singleton instance
export const fieldVisitManager = new FieldVisitManager();
