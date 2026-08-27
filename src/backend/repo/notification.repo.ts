import { createClient } from "@/shared/db/supabase.server";
import { AppError } from "@/shared/api/api-error";
import { EmailService } from "../service/email.service";

const MISSABLE_STATUSES = ["completed", "missed", "cancelled", "no_show"];

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hours = parseInt(h, 10);
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${m} ${period}`;
}

export class NotificationRepository {
  /**
   * Scans a patient's own appointments for ones whose scheduled date/time has
   * already passed without being completed, marks them "missed", and creates
   * a one-time notification for the patient. Safe to call on every page load —
   * the conditional status update ensures each appointment is only processed once.
   */
  static async processMissedAppointmentsForPatient(patientId: string, patientUserId: string): Promise<void> {
    const supabase = await createClient();
    const todayStr = new Date().toLocaleDateString("en-CA");

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(`
        id,
        status,
        scheduled_date,
        scheduled_time,
        practitioner:practitioners ( full_name )
      `)
      .eq("patient_id", patientId)
      .lte("scheduled_date", todayStr)
      .not("status", "in", `(${MISSABLE_STATUSES.join(",")})`);

    if (error) {
      console.error("[NotificationRepository] Error fetching appointments for missed check:", error.message);
      return;
    }

    const { data: patientRow } = await supabase
      .from("patients")
      .select("full_name, user:users ( email )")
      .eq("id", patientId)
      .maybeSingle();

    const patientUser = Array.isArray(patientRow?.user) ? patientRow?.user[0] : patientRow?.user;
    const patientEmail = (patientUser as any)?.email as string | undefined;
    const patientFullName = patientRow?.full_name || "Patient";

    const now = Date.now();

    for (const appt of (appointments || []) as any[]) {
      if (!appt.scheduled_date || !appt.scheduled_time) continue;

      const scheduledAt = new Date(`${appt.scheduled_date}T${appt.scheduled_time}`).getTime();
      if (Number.isNaN(scheduledAt) || scheduledAt >= now) continue;

      // Conditional update: only proceeds (and only one caller wins) if the
      // appointment is still in the status we just read, preventing duplicate
      // notifications from concurrent/repeated calls.
      // Note: the DB enum (appointment_status) has no "missed" value — its
      // terminal label for this is "no_show".
      const { data: updated, error: updateError } = await supabase
        .from("appointments")
        .update({ status: "no_show" })
        .eq("id", appt.id)
        .eq("status", appt.status)
        .select("id");

      if (updateError) {
        console.error("[NotificationRepository] Error marking appointment missed:", updateError.message);
        continue;
      }
      if (!updated || updated.length === 0) continue;

      const practitioner = Array.isArray(appt.practitioner) ? appt.practitioner[0] : appt.practitioner;
      const practitionerName = practitioner?.full_name || "your practitioner";
      const formattedDate = new Date(`${appt.scheduled_date}T00:00:00`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const apptTime = formatTime(appt.scheduled_time);

      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: patientUserId,
        title: "Appointment Missed",
        body: `Your appointment with ${practitionerName} on ${formattedDate} at ${apptTime} was missed. You can book another appointment if you would like to continue your consultation.`,
        type: "missed_appointment",
        is_read: false,
      });

      if (notifError) {
        console.error("[NotificationRepository] Error inserting missed appointment notification:", notifError.message);
      }

      if (patientEmail) {
        await EmailService.sendAppointmentMissed(patientEmail, {
          patientName: patientFullName,
          practitionerName,
          date: formattedDate,
          time: apptTime,
        });
      }
    }
  }

  static async getNotifications(userId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new AppError("Error fetching notifications", 500);
    return data;
  }

  static async markNotificationRead(id: string) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (error) throw new AppError("Error marking notification read", 500);
  }

  static async markAllNotificationsRead(userId: string) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw new AppError("Error marking all notifications read", 500);
  }
}