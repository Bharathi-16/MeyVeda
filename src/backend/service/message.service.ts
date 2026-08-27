import "server-only";

import { MessageRepository, type MessageRow } from "../repo/message.repo";
import { AuthUser } from "@/shared/auth/auth.types";
import { resolveActingPractitionerUserId } from "@/shared/auth/resolve-practitioner-context";
import { ForbiddenError, AppError } from "@/shared/api/api-error";

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
    await assertParticipant(authUser, consultationId);
    return MessageRepository.getMessagesForConsultation(consultationId);
  }

  static async sendMessage(authUser: AuthUser, consultationId: string, content: string): Promise<void> {
    if (!content?.trim()) {
      throw new Error("Message content is required");
    }

    const role = await assertParticipant(authUser, consultationId);
    const direction = role === "patient" ? "patient_to_doctor" : "doctor_to_patient";

    await MessageRepository.sendMessage({
      consultationId,
      senderUserId: authUser.id,
      direction,
      content: content.trim(),
    });
  }
}