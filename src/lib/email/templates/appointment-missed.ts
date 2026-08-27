import { renderEmailShell, toPlainTextRows, type EmailContent } from "./base";

export type AppointmentMissedTemplateInput = {
  patientName: string;
  practitionerName: string;
  date: string;
  time: string;
};

export function appointmentMissedTemplate(
  input: AppointmentMissedTemplateInput,
): EmailContent {
  const rows = [
    { label: "Practitioner", value: `Dr. ${input.practitionerName}` },
    { label: "Date", value: input.date },
    { label: "Time", value: input.time },
  ];

  const html = renderEmailShell({
    heading: "Appointment Missed",
    intro: `Hi ${input.patientName}, it looks like you missed the appointment below.`,
    rows,
    footerNote: "You can book another appointment anytime if you would like to continue your consultation.",
  });

  const text = [
    `Hi ${input.patientName},`,
    "",
    "It looks like you missed the following appointment.",
    "",
    toPlainTextRows(rows),
    "",
    "You can book another appointment anytime if you would like to continue your consultation.",
    "",
    "Regards,",
    "MeyVeda Team",
  ].join("\n");

  return {
    subject: "You missed your MeyVeda appointment",
    html,
    text,
  };
}
