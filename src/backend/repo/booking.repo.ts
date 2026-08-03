import { createClient } from "@/shared/db/supabase.server";

export type BookAppointmentInput = {
  userId: string;
  slotId: string;
  practitionerId: string;
  date: string;
  time: string;
  reason: string;
  mode: "video" | "clinic";
  familyMemberId?: string;
};

export type SubmitRatingInput = {
  userId: string;
  consultationId: string;
  practitionerId: string;
  stars: number;
  reviewText?: string;
};

export type AppointmentRow = {
  id: string;
  doctor: string;
  practitionerId: string;
  consultationId?: string;
  initials: string;
  specialty: string;
  date: string;
  dateRaw: string;
  mode: "video" | "clinic";
  status: "upcoming" | "past" | "cancelled";
  fee: string;
  duration?: string;
  rating?: number;
  hasPrescription: boolean;
  reason?: string;
  refunded: boolean;
  reminder: boolean;
};

type PractitionerRelation = {
  id: string;
  full_name: string | null;
  specializations: string[] | null;
  disciplines: string[] | null;
};

type RatingRelation = {
  stars: number;
};

type ConsultationRelation = {
  id: string;
  rating?: RatingRelation | RatingRelation[] | null;
};

type AppointmentDatabaseRow = {
  id: string;
  mode: "video" | "clinic";
  status: string;
  reason_for_visit: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  duration_min: number | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  slot: { fee: number | null } | { fee: number | null }[] | null;
  practitioner:
    | PractitionerRelation
    | PractitionerRelation[]
    | null;
  consultation:
    | ConsultationRelation
    | ConsultationRelation[]
    | null;
};

function getSingleRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}

function formatTime(time?: string | null): string {
  if (!time) {
    return "";
  }

  const [hoursValue, minutesValue] = time.split(":");
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Converts a display-format time string ("4:05 PM", "12:30 AM", or already
 * 24-hour "16:05") into a zero-padded HH:MM string suitable for PostgreSQL
 * `time` / `timetz` columns.
 *
 * The bug this fixes: `params.time` comes from the availability API as
 * "4:05 PM". Slicing to 5 chars gives "4:05 " which Postgres stores as
 * 04:05:00 (4 AM instead of 4 PM).
 */
export function toHHMM(timeStr: string): string {
  // Already in HH:MM or HH:MM:SS 24-hour format (no AM/PM)
  if (!/AM|PM/i.test(timeStr)) {
    return timeStr.slice(0, 5);
  }
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    // Fallback: strip trailing chars and hope for the best
    return timeStr.slice(0, 5);
  }
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

class Mutex {
  private activeLocks = new Map<string, Promise<void>>();

  async acquire(key: string): Promise<() => void> {
    while (this.activeLocks.has(key)) {
      await this.activeLocks.get(key);
    }
    let resolveLock!: () => void;
    const promise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.activeLocks.set(key, promise);
    return () => {
      this.activeLocks.delete(key);
      resolveLock();
    };
  }
}

export const bookingMutex = new Mutex();


async function resolvePatientId(userId: string): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("patients")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("resolvePatientId error:", error);
    throw new Error("Unable to resolve patient");
  }

  if (!data?.id) {
    throw new Error("Patient profile not found");
  }

  return data.id;
}

export class BookingRepository {
  static async getAppointments(
    patientIdInput: string,
  ): Promise<AppointmentRow[]> {
    const supabase = createClient();
    const resolvedPatientId = await resolvePatientId(patientIdInput);

    const { data, error } = await supabase
      .from("appointments")
      .select(`
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
      `)
      .eq("patient_id", resolvedPatientId)
      .order("scheduled_date", { ascending: false })
      .order("scheduled_time", { ascending: false });

    if (error) {
      console.error("getAppointments error:", error);
      throw new Error(error.message);
    }

    return ((data ?? []) as AppointmentDatabaseRow[]).map((row) => {
      const practitioner = getSingleRelation(row.practitioner);
      const consultation = getSingleRelation(row.consultation);
      const slot = getSingleRelation(row.slot);
      const rating = getSingleRelation(consultation?.rating);

      const doctorName = practitioner?.full_name ?? "Unknown Doctor";

      const initials = doctorName
        .split(" ")
        .filter(Boolean)
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      const specializations = practitioner?.specializations ?? [];
      const disciplines = practitioner?.disciplines ?? [];
      const specialties = [...specializations, ...disciplines];

      const fee =
        typeof slot?.fee === "number"
          ? `₹${Math.round(slot.fee / 100)}`
          : "—";

      const today = new Date().toISOString().split("T")[0];
      const isToday = row.scheduled_date === today;

      const appointmentDate = new Date(
        `${row.scheduled_date}T${row.scheduled_time ?? "00:00:00"}`,
      );

      const formattedDate = isToday
        ? `Today, ${formatTime(row.scheduled_time)}`
        : `${appointmentDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })} · ${formatTime(row.scheduled_time)}`;

      let appointmentStatus: AppointmentRow["status"] = "upcoming";

      if (row.status === "completed") {
        appointmentStatus = "past";
      } else if (
        row.status === "cancelled" ||
        row.status === "no_show"
      ) {
        appointmentStatus = "cancelled";
      }

      return {
        id: row.id,
        doctor: doctorName,
        practitionerId: practitioner?.id ?? "",
        consultationId: consultation?.id,
        initials,
        specialty: specialties.join(" · ") || "AYUSH",
        date: formattedDate,
        dateRaw: row.scheduled_date,
        mode: row.mode,
        status: appointmentStatus,
        fee,
        duration: row.duration_min
          ? `${row.duration_min} min`
          : undefined,
        rating: rating?.stars,
        hasPrescription: Boolean(consultation),
        reason: row.cancellation_reason ?? undefined,
        refunded: row.status === "cancelled",
        reminder: false,
      };
    });
  }

  static async cancelAppointment(
    appointmentId: string,
    reason: string,
  ): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", appointmentId);

    if (error) {
      console.error("cancelAppointment error:", error);
      throw new Error(error.message);
    }
  }

  static async bookAppointment(
    params: BookAppointmentInput,
  ): Promise<void> {
    const supabase = createClient();
    const resolvedPatientId = await resolvePatientId(params.userId);
    // Convert display-format time ("4:05 PM") → 24-hour HH:MM ("16:05")
    // The old slice(0,5) was giving "4:05 " which Postgres stored as 04:05 (4 AM)
    const formattedTime = toHHMM(params.time);

    // Acquire lock to serialize concurrent attempts to book the exact same slot
    const lockKey = `${params.practitionerId}_${params.date}_${formattedTime}`;
    const release = await bookingMutex.acquire(lockKey);

    try {
      const { data: existingAppointment, error: appointmentCheckError } =
        await supabase
          .from("appointments")
          .select("id")
          .eq("practitioner_id", params.practitionerId)
          .eq("scheduled_date", params.date)
          .eq("scheduled_time", formattedTime)
          .neq("status", "cancelled")
          .limit(1)
          .maybeSingle();

      if (appointmentCheckError) {
        throw new Error(appointmentCheckError.message);
      }

      if (existingAppointment) {
        throw new Error("Slot is no longer available");
      }

      const { data: existingUpcoming } = await supabase
        .from("prescriptions")
        .select("id")
        .eq("practitioner_id", params.practitionerId)
        .like("lifestyle_advice", `%[Upcoming Session Fixed: ${params.date} at ${formattedTime}]%`)
        .limit(1)
        .maybeSingle();

      if (existingUpcoming) {
        throw new Error("Slot is no longer available");
      }

      // Atomically update the slot status from 'open' to 'booked'.
      // If 0 rows are updated, another request has already claimed this slot.
      const { data: updatedSlots, error: slotUpdateError } = await supabase
        .from("slots")
        .update({ status: "booked" })
        .eq("id", params.slotId)
        .eq("status", "open")
        .select("id");

      if (slotUpdateError) {
        console.error("bookAppointment slot error:", slotUpdateError);
        throw new Error(slotUpdateError.message);
      }

      if (!updatedSlots || updatedSlots.length === 0) {
        throw new Error("Slot is no longer available");
      }

      // Now insert the appointment. If this fails, we must revert the slot status.
      const { error: appointmentInsertError } = await supabase
        .from("appointments")
        .insert({
          slot_id: params.slotId,
          practitioner_id: params.practitionerId,
          patient_id: resolvedPatientId,
          family_member_id: params.familyMemberId ?? null,
          mode: params.mode,
          status: "scheduled",
          reason_for_visit: params.reason,
          scheduled_date: params.date,
          scheduled_time: formattedTime,
        });

      if (appointmentInsertError) {
        console.error(
          "bookAppointment insert error:",
          appointmentInsertError,
        );
        // Rollback the slot status to 'open'
        await supabase
          .from("slots")
          .update({ status: "open" })
          .eq("id", params.slotId);

        throw new Error(appointmentInsertError.message);
      }
    } finally {
      release();
    }
  }


  static async submitRating(
    params: SubmitRatingInput,
  ): Promise<void> {
    const supabase = createClient();
    const resolvedPatientId = await resolvePatientId(params.userId);

    const { error } = await supabase.from("ratings").insert({
      consultation_id: params.consultationId,
      patient_id: resolvedPatientId,
      practitioner_id: params.practitionerId,
      stars: params.stars,
      review_text: params.reviewText,
      is_visible: true,
    });

    if (error) {
      console.error("submitRating error:", error);
      throw new Error(error.message);
    }
  }
}