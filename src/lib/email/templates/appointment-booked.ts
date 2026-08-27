import { renderEmailShell, toPlainTextRows, type EmailContent } from "./base";

export type AppointmentBookedTemplateInput = {
  patientName: string;
  practitionerName: string;
  date: string;
  time: string;
  mode: "video" | "clinic";
  fee?: string;
};

export function appointmentBookedTemplate(
  input: AppointmentBookedTemplateInput,
): EmailContent {
  const rows = [
    { label: "Practitioner", value: `Dr. ${input.practitionerName}` },
    { label: "Date", value: input.date },
    { label: "Time", value: input.time },
    { label: "Mode", value: input.mode === "video" ? "Video Consultation" : "In-Clinic Visit" },
    ...(input.fee ? [{ label: "Fee", value: input.fee }] : []),
  ];

  const html = renderEmailShell({
    heading: "Appointment Confirmed",
    intro: `Hi ${input.patientName}, your appointment has been booked successfully.`,
    rows,
    footerNote: "You can view or manage this appointment anytime from your MeyVeda dashboard.",
  });

  const text = [
    `Hi ${input.patientName},`,
    "",
    "Your appointment has been booked successfully.",
    "",
    toPlainTextRows(rows),
    "",
    "Regards,",
    "MeyVeda Team",
  ].join("\n");

  return {
    subject: "Your MeyVeda appointment is confirmed",
    html,
    text,
  };
}
