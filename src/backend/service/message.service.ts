import "server-only";

import { MessageRepository, type MessageRow } from "../repo/message.repo";
import { AuthUser } from "@/shared/auth/auth.types";
import { resolveActingPractitionerUserId } from "@/shared/auth/resolve-practitioner-context";
import { ForbiddenError, AppError } from "@/shared/api/api-error";
import { randomUUID } from "crypto";
import { RealtimeTopics, broadcastSignal, type RealtimeEvent } from "../realtime/realtime-signal";

const ALLOWED_ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export type MessageAttachmentInput = { path: string; name: string; type: string; size: number };

function validateAttachmentMeta(type: string, size: number) {
  if (!ALLOWED_ATTACHMENT_TYPES.includes(type)) {
    throw new AppError("Only PNG, JPEG, WebP images and PDF documents are allowed", 400);
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) {
    throw new AppError("Attachments must be 5 MB or smaller", 400);
  }
}

async function signalParticipants(
  consultationId: string,
  event: RealtimeEvent,
  only?: "patient" | "practitioner"
): Promise<void> {
  const participants = await MessageRepository.getConsultationParticipants(consultationId);
  if (!participants) return;
  const topics: string[] = [];
  if (only !== "practitioner") topics.push(RealtimeTopics.patientInbox(participants.patient_id));
  if (only !== "patient") topics.push(RealtimeTopics.practitionerInbox(participants.practitioner_id));
  await broadcastSignal(topics, event);
}

async function assertParticipant(authUser: AuthUser, consultationId: string): Promise<"patient" | "practitioner"> {
  const consultation = await MessageRepository.getConsultationParticipants(consultationId);
  if (!consultation) {
    throw new AppError("Consultation not found", 404);
  }

  if (authUser.role === "patient") {
    const patientId = await MessageRepository.getPatientIdFromUserId(authUser.id);
    if (!patientId || consultation.patient_id !== patientId) {
      throw new ForbiddenError("You are not authorized to access this conversation");
    }
    return "patient";
  }

  if (
    authUser.role === "doctor" ||
    (authUser.role as string) === "practitioner" ||
    authUser.role === "assistant"
  ) {
    const practitionerId = await MessageRepository.getPractitionerIdFromUserId(
      await resolveActingPractitionerUserId(authUser)
    );
    if (!practitionerId || consultation.practitioner_id !== practitionerId) {
      throw new ForbiddenError("You are not authorized to access this conversation");
    }
    return "practitioner";
  }

  throw new ForbiddenError("You are not authorized to access this conversation");
}

export class MessageService {
  static async getMessages(authUser: AuthUser, consultationId: string): Promise<MessageRow[]> {
    if (!consultationId || consultationId.length !== 36) {
      return [];
    }
    const role = await assertParticipant(authUser, consultationId);
    const marked = await MessageRepository.markRead(consultationId, role);
    if (marked > 0) {
      // Let the sender's screen flip its read ticks. Only fires when something
      // was actually marked, so two open screens can't ping-pong.
      await signalParticipants(consultationId, "read", role === "patient" ? "practitioner" : "patient");
    }
    return MessageRepository.getMessagesForConsultation(consultationId);
  }

  static async createAttachmentUpload(
    authUser: AuthUser,
    consultationId: string,
    fileName: string,
    fileType: string,
    fileSize: number
  ): Promise<{ path: string; token: string }> {
    await assertParticipant(authUser, consultationId);
    validateAttachmentMeta(fileType, fileSize);

    const safeName = (fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    return MessageRepository.createAttachmentUploadTarget(`${consultationId}/${randomUUID()}-${safeName}`);
  }

  static async sendMessage(
    authUser: AuthUser,
    consultationId: string,
    content: string,
    attachment?: MessageAttachmentInput,
    replyToId?: string | null
  ): Promise<void> {
    if (!content?.trim() && !attachment) {
      throw new Error("Message content is required");
    }

    const role = await assertParticipant(authUser, consultationId);

    if (attachment) {
      validateAttachmentMeta(attachment.type, attachment.size);
      if (!attachment.path?.startsWith(`${consultationId}/`)) {
        throw new ForbiddenError("Invalid attachment for this conversation");
      }
    }
    const direction = role === "patient" ? "patient_to_doctor" : "doctor_to_patient";

    await MessageRepository.sendMessage({
      consultationId,
      senderUserId: authUser.id,
      direction,
      content: content?.trim() ?? "",
      attachment,
      replyToId,
    });
    await signalParticipants(consultationId, "message");
  }
}