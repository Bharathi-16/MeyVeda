import { NextRequest } from "next/server";

import {
  getAppointmentsController,
  createAppointmentController,
  cancelAppointmentController,
  getOrCreateVideoSessionController,
  updateVideoSessionStatusController,
} from "@/backend/controller/appointments.controller";

import { withErrorHandler } from "@/backend/middleware/error.middleware";

export const GET = withErrorHandler(
  async (req: NextRequest) => {
    return getAppointmentsController(req);
  },
);

export const POST = withErrorHandler(
  async (req: NextRequest) => {
    const action =
      req.nextUrl.searchParams.get("action");

    if (action === "video-session") {
      const appointmentId =
        req.nextUrl.searchParams.get(
          "appointmentId",
        ) ?? "";

      return getOrCreateVideoSessionController(
        req,
        appointmentId,
      );
    }

    return createAppointmentController(req);
  },
);

export const PATCH = withErrorHandler(
  async (req: NextRequest) => {
    const action =
      req.nextUrl.searchParams.get("action");

    if (action !== "video-status") {
      throw new Error(
        "Unsupported appointment update action",
      );
    }

    const appointmentId =
      req.nextUrl.searchParams.get(
        "appointmentId",
      ) ?? "";

    return updateVideoSessionStatusController(
      req,
      appointmentId,
    );
  },
);

export const DELETE = withErrorHandler(
  async (req: NextRequest) => {
    return cancelAppointmentController(req);
  },
);