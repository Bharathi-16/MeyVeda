
import { createClient } from "@/shared/db/supabase.server";

export type PrescriptionItemView = {
  name: string;
  dose: string;
  frequency: string;
  anupana: string;
  durationDays: number;
  instructions: string;
  form: string;
  timing: string;
};

export type PrescriptionView = {
  id: string;
  consultationId?: string;
  date: string;
  doctorName: string;
  doctorInitials: string;
  patientId?: string;
  patientName?: string;
  gender?: string;
  age?: number | string;
  phone?: string;
  specialty: string;
  status: string;
  dietaryAdvice: string;
  lifestyleAdvice: string;
  physicalActivity: string;
  followUpDate: string | null;
  chiefComplaint: string;
  assessment: string;
  items: PrescriptionItemView[];
  isDetailed?: boolean;
  _raw?: any;
};

const PATIENT_SELECT = `
  id, status, dietary_advice, lifestyle_advice, physical_activity, followup_date, created_at,
  practitioner:practitioners ( full_name, specializations, disciplines ),
  consultation:consultations (
    emr_note:emr_notes ( chief_complaint, assessment )
  ),
  prescription_items ( medicine_name, dose, frequency, anupana, duration_days, special_instructions, sort_order, classical_type, time_of_intake )
`;

const PRACTITIONER_SELECT = `
  id, consultation_id, status, dietary_advice, lifestyle_advice, physical_activity, followup_date, created_at,
  patient:patients ( id, full_name, date_of_birth, gender, user_id, user:users(mobile) ),
  prescription_items ( medicine_name, dose, frequency, anupana, duration_days, special_instructions, sort_order, classical_type, time_of_intake ),
  consultation:consultations ( id, emr_notes ( chief_complaint, history_present, assessment, objective_findings, emr_attachments ( id, file_url, file_name, file_type ) ) )
`;

function mapItems(items: any[]): PrescriptionItemView[] {
  return (items ?? [])
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item: any) => ({
      name: item.medicine_name ?? "",
      dose: item.dose ?? "",
      frequency: item.frequency ?? "",
      anupana: item.anupana ?? "",
      durationDays: item.duration_days ?? 0,
      instructions: item.special_instructions ?? "",
      form: item.classical_type || "Tablet",
      timing: item.time_of_intake || item.anupana || "After Food",
    }));
}

export class PrescriptionRepository {
  static async getPatientIdFromUserId(userId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("patients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[PrescriptionRepository] Error resolving patient_id:", error.message);
      return null;
    }
    return data?.id ?? null;
  }

  static async getPractitionerIdFromUserId(userId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("practitioners")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[PrescriptionRepository] Error resolving practitioner_id:", error.message);
      return null;
    }
    return data?.id ?? null;
  }

  static async getPrescriptionsForPatient(patientId: string): Promise<PrescriptionView[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prescriptions")
      .select(PATIENT_SELECT)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[PrescriptionRepository] Error fetching patient prescriptions:", error.message);
      throw new Error("Failed to fetch prescriptions from database");
    }

    return (data ?? []).map((row: any) => {
      const prac = row.practitioner ?? {};
      const name = prac.full_name ?? "Doctor";
      const initials = name.split(" ").filter((w: string) => w).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
      const consult = Array.isArray(row.consultation) ? row.consultation[0] : row.consultation;
      const emr = consult?.emr_note ? (Array.isArray(consult.emr_note) ? consult.emr_note[0] : consult.emr_note) : {};

      return {
        id: row.id,
        date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "",
        doctorName: name,
        doctorInitials: initials,
        specialty: [...(prac.specializations ?? []), ...(prac.disciplines ?? [])].join(" · ") || "AYUSH",
        status: row.status ?? "finalized",
        dietaryAdvice: row.dietary_advice ?? "",
        lifestyleAdvice: row.lifestyle_advice ?? "",
        physicalActivity: row.physical_activity ?? "",
        followUpDate: row.followup_date,
        chiefComplaint: emr?.chief_complaint ?? "",
        assessment: emr?.assessment ?? "",
        items: mapItems(row.prescription_items),
      };
    });
  }

  static async getPrescriptionsForPractitioner(practitionerId: string): Promise<PrescriptionView[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prescriptions")
      .select(PRACTITIONER_SELECT)
      .eq("practitioner_id", practitionerId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[PrescriptionRepository] Error fetching practitioner prescriptions:", error.message);
      throw new Error("Failed to fetch prescriptions from database");
    }

    // Family members have no `users` row (no login), so their phone lives on
    // family_members instead — look it up by patient_id, same as the owner path.
    const patientIds = Array.from(new Set((data ?? []).map((r: any) => r.patient?.id).filter(Boolean)));
    const phoneByPatientId: Record<string, string> = {};
    if (patientIds.length > 0) {
      const { data: familyMembers } = await supabase
        .from("family_members")
        .select("patient_id, phone")
        .in("patient_id", patientIds);
      for (const fm of familyMembers ?? []) {
        if (fm.patient_id && fm.phone) phoneByPatientId[fm.patient_id] = fm.phone;
      }
    }

    return (data ?? []).map((row: any) => {
      const name = row.patient?.full_name ?? "Patient";
      const initials = name.split(" ").filter((w: string) => w).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

      const patientObj = row.patient || {};
      let age: number | string = 0;
      if (patientObj.date_of_birth) {
        const birthDate = new Date(patientObj.date_of_birth);
        age = new Date().getFullYear() - birthDate.getFullYear();
      }

      let rawAssessment: any = {};
      let rawFindings: any = {};
      let parsedChiefComplaints: any[] = [];
      let emr: any = null;

      try {
        emr = row.consultation?.emr_notes ? (Array.isArray(row.consultation.emr_notes) ? row.consultation.emr_notes[0] : row.consultation.emr_notes) : null;
        if (emr?.assessment) rawAssessment = JSON.parse(emr.assessment);
        if (emr?.objective_findings) rawFindings = JSON.parse(emr.objective_findings);
        if (emr?.chief_complaint) parsedChiefComplaints = JSON.parse(emr.chief_complaint);
      } catch {
        // Malformed JSON in legacy EMR notes - fall back to empty structures
      }

      return {
        id: row.id,
        consultationId: row.consultation_id || row.consultation?.id,
        date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "",
        doctorName: name,
        doctorInitials: initials,
        patientId: patientObj.id,
        patientName: name,
        gender: patientObj.gender || "Unknown",
        age: age || "N/A",
        phone: phoneByPatientId[patientObj.id] || (Array.isArray(patientObj.user) ? patientObj.user[0]?.mobile : patientObj.user?.mobile) || "",
        specialty: "",
        status: row.status ?? "finalized",
        dietaryAdvice: row.dietary_advice ?? "",
        lifestyleAdvice: row.lifestyle_advice ?? "",
        physicalActivity: row.physical_activity ?? "",
        followUpDate: row.followup_date,
        chiefComplaint: parsedChiefComplaints?.length > 0 ? parsedChiefComplaints[0] : "",
        assessment: "",
        items: mapItems(row.prescription_items),
        isDetailed: true,
        _raw: {
          visitReason: rawAssessment?.visitReason,
          chiefComplaints: parsedChiefComplaints,
          diagnosis: rawAssessment?.diagnosis,
          vitals: rawFindings?.vitals,
          dosha: rawAssessment?.dosha,
          vikriti: rawAssessment?.vikriti,
          prescriptionNotes: row.dietary_advice,
          presentIllness: emr?.history_present,
          previousHistory: rawAssessment?.previousHistory,
          previousCalls: rawAssessment?.previousCalls,
          attachments: emr?.emr_attachments || [],
        },
      };
    });
  }

  static async getPrescriptionOwner(prescriptionId: string): Promise<{ id: string; practitioner_id: string; patient_id: string } | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prescriptions")
      .select("id, practitioner_id, patient_id")
      .eq("id", prescriptionId)
      .maybeSingle();

    if (error) {
      console.error("[PrescriptionRepository] Error fetching prescription:", error.message);
      return null;
    }
    return data;
  }

  static async delete(prescriptionId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from("prescriptions").delete().eq("id", prescriptionId);

    if (error) {
      console.error("[PrescriptionRepository] Error deleting prescription:", error.message);
      throw new Error(error.message);
    }
  }
}