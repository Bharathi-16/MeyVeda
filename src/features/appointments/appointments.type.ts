import type { MissedBy } from "@/shared/appointments/attendance";

export type AppointmentRow = {
  id: string;
  doctor: string;
  practitionerId: string;
  consultationId?: string;
  initials: string;
  timeRaw: string;
  specialty: string;
  date: string;
  dateRaw: string;
  mode: "video" | "clinic";
  status: "upcoming" | "past" | "cancelled";
  pastOutcome?: "completed" | "missed" | "awaiting_notes";
  /** For a missed appointment: who didn't show up. */
  missedBy?: MissedBy;
  /** Missed in-clinic visit where the patient had arrived but left before being seen. */
  patientLeft?: boolean;
  /** Both sides have joined and the consultation is happening right now. */
  inSession?: boolean;
  /** In-clinic: the patient has been marked arrived and is waiting for the doctor. */
  arrived?: boolean;
  fee: string;
  duration?: string;
  rating?: number;
  hasPrescription?: boolean;
  reason?: string;
  refunded?: boolean;
  reminder: boolean;
};