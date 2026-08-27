import { NextRequest } from "next/server";

import {
  AppointmentsService,
  createAppointmentSchema,
  cancelAppointmentSchema,
  videoAppointmentIdParamSchema,
  updateVideoStatusSchema,
} from "../service/appointments.service";

import { requireAuth } from "@/shared/auth/require-auth";
import { requirePermission } from "@/shared/auth/require-permission";
import { PERMISSIONS } from "@/shared/security/permissions";
import { apiSuccess } from "@/shared/api/api-response";
import { ValidationError } from "@/shared/api/api-error";
import { writeAuditLog } from "@/shared/security/audit-log";
import { getRequestIp, getRequestUserAgent } from "@/shared/security/request-meta";

/* -------------------------------------------------------------------------- */
/*                         Normal appointment routes                          */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/appointments
 *
 * Returns appointments filtered according to the authenticated user's role.
 */
export async function getAppointmentsController(
  req: NextRequest,
) {
  const auth = await requireAuth(req);

  requirePermission(
    auth,
    PERMISSIONS.APPOINTMENTS_READ,
  );

  const appointments =
    await AppointmentsService.getAppointmentsForUser(
      auth,
    );

  return apiSuccess(appointments);
}

/**
 * POST /api/appointments
 *
 * Creates an appointment for the authenticated patient.
 */
export async function createAppointmentController(
  req: NextRequest,
) {
  const auth = await requireAuth(req);

  requirePermission(
    auth,
    PERMISSIONS.APPOINTMENTS_CREATE,
  );

  const body: unknown = await req.json();

  const parsed =
    createAppointmentSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(
      "Appointment validation failed",
      parsed.error.format(),
    );
  }

  const result =
    await AppointmentsService.createAppointment(
      auth,
      parsed.data.slotId,
      parsed.data.mode,
      parsed.data.reasonForVisit,
    );

  await writeAuditLog({
    userId: auth.id,
    role: auth.role,
    action: "create_appointment",
    module: "appointments",
    recordId: result.id,
    ipAddress: getRequestIp(req),
    userAgent: getRequestUserAgent(req),
    metadata: {
      slotId: parsed.data.slotId,
      mode: parsed.data.mode,
    },
  });

  return apiSuccess(
    result,
    "Appointment scheduled successfully",
    201,
  );
}

/**
 * DELETE /api/appointments
 *
 * Cancels an appointment after permission and ownership validation.
 *
 * Body:
 * {
 *   "appointmentId": "uuid",
 *   "reason": "Cancellation reason"
 * }
 */
export async function cancelAppointmentController(
  req: NextRequest,
) {
  const auth = await requireAuth(req);

  requirePermission(
    auth,
    PERMISSIONS.APPOINTMENTS_DELETE,
  );

  const body: unknown = await req.json();

  const parsed =
    cancelAppointmentSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(
      "Cancellation validation failed",
      parsed.error.format(),
    );
  }

  await AppointmentsService.cancelAppointment(
    auth,
    parsed.data.appointmentId,
    parsed.data.reason,
  );

  await writeAuditLog({
    userId: auth.id,
    role: auth.role,
    action: "cancel_appointment",
    module: "appointments",
    recordId: parsed.data.appointmentId,
    ipAddress: getRequestIp(req),
    userAgent: getRequestUserAgent(req),
    metadata: {
      reason: parsed.data.reason,
    },
  });

  return apiSuccess(
    null,
    "Appointment cancelled successfully",
  );
}

/* -------------------------------------------------------------------------- */
/*                           Jitsi video routes                               */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/appointments/[appointmentId]/video
 *
 * Returns the existing Jitsi room or creates a new random room.
 */
export async function getOrCreateVideoSessionController(
  req: NextRequest,
  appointmentId: string,
) {
  const auth = await requireAuth(req);

  /*
   * APPOINTMENTS_READ is used because both the patient and practitioner must
   * be able to join. The service performs strict ownership validation.
   */
  requirePermission(
    auth,
    PERMISSIONS.APPOINTMENTS_READ,
  );

  const parsedParams =
    videoAppointmentIdParamSchema.safeParse({
      appointmentId,
    });

  if (!parsedParams.success) {
    throw new ValidationError(
      "Invalid video appointment ID",
      parsedParams.error.format(),
    );
  }

  const session =
    await AppointmentsService.getOrCreateJitsiSession(
      parsedParams.data.appointmentId,
      auth,
    );

  await writeAuditLog({
    userId: auth.id,
    role: auth.role,
    action: "open_video_consultation",
    module: "appointments",
    recordId: session.appointmentId,
    ipAddress: getRequestIp(req),
    userAgent: getRequestUserAgent(req),
    metadata: {
      provider: session.provider,
      videoStatus: session.videoStatus,
    },
  });

  return apiSuccess(
    session,
    "Video consultation room prepared successfully",
  );
}

/**
 * PATCH /api/appointments/[appointmentId]/video
 *
 * Updates Jitsi call state.
 *
 * Body:
 * {
 *   "status": "waiting" | "in_progress" | "ended" | "cancelled"
 * }
 */
export async function updateVideoSessionStatusController(
  req: NextRequest,
  appointmentId: string,
) {
  const auth = await requireAuth(req);

  /*
   * The service performs ownership and practitioner-role validation.
   *
   * APPOINTMENTS_READ is intentionally used because patients need permission
   * to mark themselves as waiting. They cannot start or end the consultation.
   */
  requirePermission(
    auth,
    PERMISSIONS.APPOINTMENTS_READ,
  );

  const parsedParams =
    videoAppointmentIdParamSchema.safeParse({
      appointmentId,
    });

  if (!parsedParams.success) {
    throw new ValidationError(
      "Invalid video appointment ID",
      parsedParams.error.format(),
    );
  }

  const body: unknown = await req.json();

  const parsedBody =
    updateVideoStatusSchema.safeParse(body);

  if (!parsedBody.success) {
    throw new ValidationError(
      "Invalid video consultation status",
      parsedBody.error.format(),
    );
  }

  const result =
    await AppointmentsService.updateJitsiSessionStatus(
      parsedParams.data.appointmentId,
      parsedBody.data.status,
      auth,
    );

  await writeAuditLog({
    userId: auth.id,
    role: auth.role,
    action: "update_video_consultation_status",
    module: "appointments",
    recordId: result.appointmentId,
    ipAddress: getRequestIp(req),
    userAgent: getRequestUserAgent(req),
    metadata: {
      videoStatus: result.videoStatus,
      sessionStartedAt:
        result.sessionStartedAt,
      sessionEndedAt:
        result.sessionEndedAt,
      durationMin: result.durationMin,
    },
  });

  return apiSuccess(
    result,
    "Video consultation status updated successfully",
  );
}