import { SITE_NAME } from "@/shared/config/site";
import { renderEmailShell, toPlainTextRows, type EmailContent } from "./base";

export type AppointmentCancelledTemplateInput = {
  patientName: string;
  practitionerName: string;
  date: string;
  time: string;
  reason: string;
};

export function appointmentCancelledTemplate(
  input: AppointmentCancelledTemplateInput,
): EmailContent {
  const rows = [
    { label: "Practitioner", value: `Dr. ${input.practitionerName}` },
    { label: "Date", value: input.date },
    { label: "Time", value: input.time },
    { label: "Reason", value: input.reason },
  ];

  const html = renderEmailShell({
    heading: "Appointment Cancelled",
    intro: `Hi ${input.patientName}, the appointment below has been cancelled.`,
    rows,
    footerNote: `If this was a mistake, you can book a new appointment anytime from your ${SITE_NAME} dashboard.`,
  });

  const text = [
    `Hi ${input.patientName},`,
    "",
    "The following appointment has been cancelled.",
    "",
    toPlainTextRows(rows),
    "",
    "Regards,",
    `${SITE_NAME} Team`,
  ].join("\n");

  return {
    subject: `Your ${SITE_NAME} appointment was cancelled`,
    html,
    text,
  };
}
