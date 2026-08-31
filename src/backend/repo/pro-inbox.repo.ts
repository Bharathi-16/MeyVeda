import { createClient } from "@/shared/db/supabase.server";

export type InboxThread = {
  id: string;
  patientId: string;
  patientName: string;
  patientInitials: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: boolean;
  consultationId: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export class ProInboxRepository {
  static async getPractitionerIdFromUserId(userId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("practitioners")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[ProInboxRepository] Error resolving practitioner_id:", error.message);
      return null;
    }
    return data?.id ?? null;
  }

  static async getInboxForPractitioner(practitionerId: string): Promise<InboxThread[]> {
    const supabase = await createClient();
    const { data: consults, error } = await supabase
      .from("consultations")
      .select(`
        id, created_at, patient_id,
        patient:patients ( full_name ),
        messages:bounded_messages ( content, sent_at, read_at, direction )
      `)
      .eq("practitioner_id", practitionerId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("[ProInboxRepository] Error fetching inbox:", error.message);
      throw new Error("Failed to fetch inbox from database");
    }

    return (consults ?? [])
      .filter((c: any) => (c.messages ?? []).length > 0)
      .map((c: any) => {
        const msgs = (c.messages ?? []).sort((a: any, b: any) =>
          new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
        );
        const last = msgs[0];
        const name = c.patient?.full_name ?? "Patient";
        return {
          id: c.id,
          patientId: c.patient_id,
          patientName: name,
          patientInitials: name.split(" ").filter((w: string) => w).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
          lastMessage: last?.content ?? "",
          lastMessageTime: last?.sent_at ? timeAgo(last.sent_at) : "",
          unread: msgs.some((m: any) => m.direction === "patient_to_doctor" && !m.read_at),
          consultationId: c.id,
        };
      });
  }
}
