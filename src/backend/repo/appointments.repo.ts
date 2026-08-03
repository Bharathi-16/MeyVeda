import "server-only";

import { createClient } from "@/shared/db/supabase.server";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type AppointmentVideoStatus =
  | "not_started"
  | "waiting"
  | "in_progress"
  | "ended"
  | "cancelled";

export type AppointmentDbRow = {
  id: string;
  mode: string;
  status: string;
  reason_for_visit: string | null;

  scheduled_date: string;
  scheduled_time: string;

  duration_min: number | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;

  slot:
    | {
        fee: number | null;
      }
    | {
        fee: number | null;
      }[]
    | null;

  practitioner:
    | {
        id: string;
        full_name: string | null;
        specializations: string[] | null;
        disciplines: string[] | null;
      }
    | {
        id: string;
        full_name: string | null;
        specializations: string[] | null;
        disciplines: string[] | null;
      }[]
    | null;

  consultation:
    | {
        id: string;
        rating:
          | {
              stars: number | null;
            }
          | {
              stars: number | null;
            }[]
          | null;
      }
    | {
        id: string;
        rating:
          | {
              stars: number | null;
            }
          | {
              stars: number | null;
            }[]
          | null;
      }[]
    | null;
};

export type AppointmentOwnershipRow = {
  id: string;
  patient_id: string;
  practitioner_id: string;
  doctor_profile_id: string;
  mode: string;
  status: string;
};

export type AppointmentVideoRow = {
  id: string;
  patient_id: string;
  practitioner_id: string;

  mode: string;
  status: string;

  scheduled_date: string;
  scheduled_time: string;

  video_provider: string;
  video_room_name: string | null;
  video_status: AppointmentVideoStatus;

  session_started_at: string | null;
  session_ended_at: string | null;
  duration_min: number | null;
};

type SlotAppointmentData = {
  practitioner_id: string;
  date: string;
  start_time: string;
  duration_min: number | null;
};

/* -------------------------------------------------------------------------- */
/*                              Select statements                             */
/* -------------------------------------------------------------------------- */

const APPOINTMENT_SELECT = `
  id,
  mode,
  status,
  reason_for_visit,
  scheduled_date,
  scheduled_time,
  duration_min,
  cancellation_reason,
  cancelled_at,
  slot:slots (
    fee
  ),
  practitioner:practitioners (
    id,
    full_name,
    specializations,
    disciplines
  ),
  consultation:consultations (
    id,
    rating:ratings (
      stars
    )
  )
`;

const VIDEO_APPOINTMENT_SELECT = `
  id,
  patient_id,
  practitioner_id,
  mode,
  status,
  scheduled_date,
  scheduled_time,
  video_provider,
  video_room_name,
  video_status,
  session_started_at,
  session_ended_at,
  duration_min
`;

/* -------------------------------------------------------------------------- */
/*                              Repository class                              */
/* -------------------------------------------------------------------------- */

export class AppointmentsRepository {
  /**
   * Resolve the patients.id value associated with an authenticated users.id.
   */
  static async getPatientIdFromUserId(
    userId: string,
  ): Promise<string | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("patients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error(
        "[AppointmentsRepository] Error resolving patient ID:",
        error.message,
      );

      throw new Error(
        "Database error while resolving the patient profile",
      );
    }

    return data?.id ?? null;
  }

  /**
   * Resolve the practitioners.id value associated with an authenticated
   * users.id.
   */
  static async getDoctorIdFromUserId(
    userId: string,
  ): Promise<string | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("practitioners")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error(
        "[AppointmentsRepository] Error resolving practitioner ID:",
        error.message,
      );

      throw new Error(
        "Database error while resolving the practitioner profile",
      );
    }

    return data?.id ?? null;
  }

  /**
   * Alias using the database entity's correct name.
   */
  static async getPractitionerIdFromUserId(
    userId: string,
  ): Promise<string | null> {
    return this.getDoctorIdFromUserId(userId);
  }

  /**
   * Fetch appointments belonging to a patient.
   */
  static async getAppointmentsForPatient(
    patientId: string,
  ): Promise<AppointmentDbRow[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("patient_id", patientId)
      .order("scheduled_date", { ascending: false })
      .order("scheduled_time", { ascending: false });

    if (error) {
      console.error(
        "[AppointmentsRepository] Error fetching patient appointments:",
        error.message,
      );

      throw new Error(
        "Failed to fetch patient appointments from the database",
      );
    }

    return (data ?? []) as unknown as AppointmentDbRow[];
  }

  /**
   * Fetch appointments belonging to a practitioner.
   *
   * practitioner_id is used because the appointments table has a foreign key
   * from appointments.practitioner_id to practitioners.id.
   */
  static async getAppointmentsForDoctor(
    practitionerId: string,
  ): Promise<AppointmentDbRow[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("practitioner_id", practitionerId)
      .order("scheduled_date", { ascending: false })
      .order("scheduled_time", { ascending: false });

    if (error) {
      console.error(
        "[AppointmentsRepository] Error fetching practitioner appointments:",
        error.message,
      );

      throw new Error(
        "Failed to fetch practitioner appointments from the database",
      );
    }

    return (data ?? []) as unknown as AppointmentDbRow[];
  }

  /**
   * Fetch all appointments for admin and super-admin users.
   */
  static async getAllAppointments(): Promise<
    AppointmentDbRow[]
  > {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .order("scheduled_date", { ascending: false })
      .order("scheduled_time", { ascending: false });

    if (error) {
      console.error(
        "[AppointmentsRepository] Error fetching all appointments:",
        error.message,
      );

      throw new Error(
        "Failed to fetch appointments from the database",
      );
    }

    return (data ?? []) as unknown as AppointmentDbRow[];
  }

  /**
   * Fetch the appointment information required for ownership validation.
   */
  static async getAppointmentById(
    appointmentId: string,
  ): Promise<AppointmentOwnershipRow | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        patient_id,
        practitioner_id,
        doctor_profile_id,
        mode,
        status
      `)
      .eq("id", appointmentId)
      .maybeSingle();

    if (error) {
      console.error(
        "[AppointmentsRepository] Error fetching appointment by ID:",
        error.message,
      );

      throw new Error(
        "Database error while fetching appointment details",
      );
    }

    if (!data) {
      return null;
    }

    /*
     * doctor_profile_id is retained for compatibility with your existing
     * service. When it is null, practitioner_id is used as the fallback.
     */
    return {
      id: data.id,
      patient_id: data.patient_id,
      practitioner_id: data.practitioner_id,
      doctor_profile_id:
        data.doctor_profile_id ?? data.practitioner_id,
      mode: data.mode,
      status: data.status,
    };
  }

  /**
   * Cancel an existing appointment.
   */
  static async cancelAppointment(
    appointmentId: string,
    reason: string,
  ): Promise<void> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
        video_status: "cancelled",
      })
      .eq("id", appointmentId)
      .neq("status", "cancelled")
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(
        "[AppointmentsRepository] Error cancelling appointment:",
        error.message,
      );

      throw new Error(
        "Failed to update the appointment cancellation state",
      );
    }

    if (!data) {
      throw new Error(
        "Appointment was not found or is already cancelled",
      );
    }
  }

  /**
   * Create an appointment using the selected slot.
   */
  static async createAppointment(
    patientId: string,
    slotId: string,
    mode: string,
    reasonForVisit?: string,
  ): Promise<{ id: string }> {
    const supabase = await createClient();

    const { data: slotData, error: slotError } =
      await supabase
        .from("slots")
        .select(`
          practitioner_id,
          date,
          start_time,
          duration_min
        `)
        .eq("id", slotId)
        .maybeSingle();

    if (slotError) {
      console.error(
        "[AppointmentsRepository] Error fetching selected slot:",
        slotError.message,
      );

      throw new Error(
        "Database error while validating the selected slot",
      );
    }

    if (!slotData) {
      throw new Error(
        "Selected appointment slot does not exist",
      );
    }

    const slot = slotData as SlotAppointmentData;

    if (!slot.practitioner_id) {
      throw new Error(
        "The selected slot is not assigned to a practitioner",
      );
    }

    if (!slot.date || !slot.start_time) {
      throw new Error(
        "The selected slot does not contain a valid date and time",
      );
    }

    /*
     * Optional protection against booking the same slot more than once.
     * Cancelled appointments do not block the slot.
     */
    const { data: existingAppointment, error: conflictError } =
      await supabase
        .from("appointments")
        .select("id")
        .eq("slot_id", slotId)
        .not("status", "in", '("cancelled","no_show")')
        .limit(1)
        .maybeSingle();

    if (conflictError) {
      console.error(
        "[AppointmentsRepository] Error checking slot availability:",
        conflictError.message,
      );

      throw new Error(
        "Database error while checking slot availability",
      );
    }

    if (existingAppointment) {
      throw new Error(
        "The selected appointment slot has already been booked",
      );
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        slot_id: slotId,
        patient_id: patientId,

        /*
         * practitioner_id is mandatory in your appointments schema.
         */
        practitioner_id: slot.practitioner_id,

        /*
         * Retained for compatibility with your current application.
         * Remove this assignment later if doctor_profile_id represents
         * a different table in your final database design.
         */
        doctor_profile_id: slot.practitioner_id,

        scheduled_date: slot.date,
        scheduled_time: slot.start_time,
        duration_min: slot.duration_min ?? 30,

        mode,
        status: "scheduled",
        reason_for_visit: reasonForVisit?.trim() || null,

        video_provider: "jitsi",
        video_status: "not_started",
      })
      .select("id")
      .single();

    if (error) {
      console.error(
        "[AppointmentsRepository] Error creating appointment:",
        error.message,
      );

      if (
        error.code === "23505" ||
        error.message.toLowerCase().includes("duplicate")
      ) {
        throw new Error(
          "The selected appointment slot has already been booked",
        );
      }

      throw new Error(
        "Database error while registering the appointment",
      );
    }

    return {
      id: data.id,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                         Jitsi video-call methods                          */
  /* ------------------------------------------------------------------------ */

  /**
   * Fetch all database information required to prepare a Jitsi session.
   */
  static async getVideoAppointmentById(
    appointmentId: string,
  ): Promise<AppointmentVideoRow> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("appointments")
      .select(VIDEO_APPOINTMENT_SELECT)
      .eq("id", appointmentId)
      .maybeSingle();

    if (error) {
      console.error(
        "[AppointmentsRepository] Error fetching video appointment:",
        error.message,
      );

      throw new Error(
        "Database error while fetching the video appointment",
      );
    }

    if (!data) {
      throw new Error("Appointment not found");
    }

    return data as AppointmentVideoRow;
  }

  /**
   * Save the generated Jitsi room only when the appointment does not already
   * have a room.
   *
   * The null condition helps prevent the patient and practitioner from
   * generating different rooms at the same time.
   */
  static async createJitsiRoomIfMissing(
    appointmentId: string,
    generatedRoomName: string,
  ): Promise<AppointmentVideoRow> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("appointments")
      .update({
        video_provider: "jitsi",
        video_room_name: generatedRoomName,
        video_status: "waiting",
      })
      .eq("id", appointmentId)
      .is("video_room_name", null)
      .select(VIDEO_APPOINTMENT_SELECT)
      .maybeSingle();

    if (error) {
      console.error(
        "[AppointmentsRepository] Error creating Jitsi room:",
        error.message,
      );

      if (
        error.code === "23505" ||
        error.message.toLowerCase().includes("duplicate")
      ) {
        throw new Error(
          "A duplicate Jitsi room name was generated",
        );
      }

      throw new Error(
        "Database error while creating the video room",
      );
    }

    /*
     * Another participant may have created the room between the initial
     * read and this update. Return the room already saved in the database.
     */
    if (!data) {
      const existingAppointment =
        await this.getVideoAppointmentById(appointmentId);

      if (!existingAppointment.video_room_name) {
        throw new Error(
          "Unable to create the video consultation room",
        );
      }

      return existingAppointment;
    }

    return data as AppointmentVideoRow;
  }

  /**
   * Update the Jitsi call status and appointment timing fields.
   */
  static async updateVideoStatus(
    appointmentId: string,
    videoStatus: AppointmentVideoStatus,
  ): Promise<AppointmentVideoRow> {
    const currentAppointment =
      await this.getVideoAppointmentById(appointmentId);

    /*
     * Make repeated Jitsi browser events idempotent.
     */
    if (currentAppointment.video_status === videoStatus) {
      return currentAppointment;
    }

    const now = new Date();

    const updates: {
      video_status: AppointmentVideoStatus;
      session_started_at?: string;
      session_ended_at?: string;
      duration_min?: number | null;
    } = {
      video_status: videoStatus,
    };

    if (
      videoStatus === "in_progress" &&
      !currentAppointment.session_started_at
    ) {
      updates.session_started_at = now.toISOString();
    }

    if (videoStatus === "ended") {
      updates.session_ended_at = now.toISOString();

      if (currentAppointment.session_started_at) {
        const startedAt = new Date(
          currentAppointment.session_started_at,
        );

        if (!Number.isNaN(startedAt.getTime())) {
          updates.duration_min = Math.max(
            1,
            Math.ceil(
              (now.getTime() - startedAt.getTime()) /
                60_000,
            ),
          );
        }
      } else {
        updates.duration_min = null;
      }
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("appointments")
      .update(updates)
      .eq("id", appointmentId)
      .select(VIDEO_APPOINTMENT_SELECT)
      .single();

    if (error) {
      console.error(
        "[AppointmentsRepository] Error updating video status:",
        error.message,
      );

      throw new Error(
        "Database error while updating the video consultation",
      );
    }

    return data as AppointmentVideoRow;
  }

  /**
   * Mark the video room as waiting.
   */
  static async markVideoWaiting(
    appointmentId: string,
  ): Promise<AppointmentVideoRow> {
    return this.updateVideoStatus(
      appointmentId,
      "waiting",
    );
  }

  /**
   * Mark the video consultation as started.
   */
  static async markVideoStarted(
    appointmentId: string,
  ): Promise<AppointmentVideoRow> {
    return this.updateVideoStatus(
      appointmentId,
      "in_progress",
    );
  }

  /**
   * Mark the video consultation as completed.
   */
  static async markVideoEnded(
    appointmentId: string,
  ): Promise<AppointmentVideoRow> {
    return this.updateVideoStatus(
      appointmentId,
      "ended",
    );
  }

  /**
   * Mark the video consultation as cancelled.
   */
  static async markVideoCancelled(
    appointmentId: string,
  ): Promise<AppointmentVideoRow> {
    return this.updateVideoStatus(
      appointmentId,
      "cancelled",
    );
  }
}