import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/shared/api/api-error";

export type ProfileEntity = {
  id: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  age: number;
  gender: string;
  bloodGroup?: string;
  city: string;
  pinCode: string;
  prakriti: string;
  wellnessGoals: string[];
  abhaId: string | null;
  abhaAddress: string | null;
  address?: string;
};

export type UpdateProfileFields = {
  fullName?: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  city?: string;
  pinCode?: string;
  email?: string;
  phone?: string;
  prakriti?: string;
};

function normalizeRole(role?: string): string {
  return role?.trim().toLowerCase() ?? "";
}

function isPractitionerRole(role?: string): boolean {
  const normalizedRole = normalizeRole(role);

  return (
    normalizedRole === "doctor" ||
    normalizedRole === "practitioner"
  );
}

function calculateAge(dateOfBirth?: string | null): number {
  if (!dateOfBirth) return 0;

  const dob = new Date(dateOfBirth);

  if (Number.isNaN(dob.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();

  const birthdayNotReached =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() &&
      today.getDate() < dob.getDate());

  if (birthdayNotReached) age--;

  return Math.max(age, 0);
}

export class ProfileRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getProfileByUserId(
    userId: string,
    role?: string
  ): Promise<ProfileEntity | null> {
    const normalized = normalizeRole(role);
    if (normalized === "admin" || normalized === "super_admin") {
      return this.getAdminProfile(userId);
    }

    if (isPractitionerRole(role)) {
      return this.getPractitionerProfile(userId);
    }

    return this.getPatientProfile(userId);
  }

  private async getAdminProfile(userId: string): Promise<ProfileEntity | null> {
    const { data: user, error } = await this.supabase
      .from("users")
      .select("id, mobile, email")
      .eq("id", userId)
      .maybeSingle();

    if (error || !user) return null;

    return {
      id: user.id,
      name: "", // handled by JWT meta_data in the frontend
      email: user.email ?? "",
      phone: user.mobile ?? "",
      dob: "",
      age: 0,
      gender: "",
      city: "",
      pinCode: "",
      prakriti: "Unknown",
      wellnessGoals: [],
      abhaId: null,
      abhaAddress: null,
      address: "",
    };
  }

  private async getPractitionerProfile(
    userId: string
  ): Promise<ProfileEntity | null> {
    const { data: practitioner, error } = await this.supabase
      .from("practitioners")
      .select(`
        id,
        full_name,
        date_of_birth,
        gender,
        blood_group,
        user:users (
          id,
          mobile,
          email
        )
      `)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Practitioner profile query failed:", {
        userId,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      throw new AppError(
        `Database error while fetching practitioner profile: ${error.message}`,
        500
      );
    }

    if (!practitioner) {
      console.error("Practitioner row not found:", { userId });
      return null;
    }

    const user = Array.isArray(practitioner.user)
      ? practitioner.user[0]
      : practitioner.user;

    return {
      id: practitioner.id,
      name: practitioner.full_name ?? "",
      email: (user as { email?: string } | null)?.email ?? "",
      phone: (user as { mobile?: string } | null)?.mobile ?? "",
      dob: practitioner.date_of_birth ?? "",
      age: calculateAge(practitioner.date_of_birth),
      gender: practitioner.gender ?? "",
      bloodGroup: practitioner.blood_group ?? "",
      city: "",
      pinCode: "",
      prakriti: "Unknown",
      wellnessGoals: [],
      abhaId: null,
      abhaAddress: null,
      address: "",
    };
  }

  private async getPatientProfile(
    userId: string
  ): Promise<ProfileEntity | null> {
    const { data: patient, error } = await this.supabase
      .from("patients")
      .select(`
        id,
        full_name,
        date_of_birth,
        gender,
        blood_group,
        city,
        pin_code,
        prakriti,
        wellness_goals,
        address,
        user:users (
          id,
          mobile,
          email,
          abha:abha_links (
            abha_id,
            abha_address
          )
        )
      `)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Patient profile query failed:", {
        userId,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      throw new AppError(
        `Database error while fetching patient profile: ${error.message}`,
        500
      );
    }

    if (!patient) return null;

    const user = Array.isArray(patient.user)
      ? patient.user[0]
      : patient.user;

    const abhaRelation = (
      user as {
        abha?: Array<{
          abha_id?: string;
          abha_address?: string;
        }> | {
          abha_id?: string;
          abha_address?: string;
        };
      } | null
    )?.abha;

    const abha = Array.isArray(abhaRelation)
      ? abhaRelation[0]
      : abhaRelation;

    return {
      id: patient.id,
      name: patient.full_name ?? "",
      email: (user as { email?: string } | null)?.email ?? "",
      phone: (user as { mobile?: string } | null)?.mobile ?? "",
      dob: patient.date_of_birth ?? "",
      age: calculateAge(patient.date_of_birth),
      gender: patient.gender ?? "",
      bloodGroup: patient.blood_group ?? "",
      city: patient.city ?? "",
      pinCode: patient.pin_code ?? "",
      prakriti: patient.prakriti ?? "Unknown",
      wellnessGoals: patient.wellness_goals ?? [],
      abhaId: abha?.abha_id ?? null,
      abhaAddress: abha?.abha_address ?? null,
      address: patient.address ?? "",
    };
  }

  async updateProfile(
    userId: string,
    updates: UpdateProfileFields,
    role?: string
  ): Promise<void> {
    const normalized = normalizeRole(role);
    const isAdmin = normalized === "admin" || normalized === "super_admin";

    if (!isAdmin) {
      const practitioner = isPractitionerRole(role);

      const tableName = practitioner
        ? "practitioners"
        : "patients";

      const tableUpdates: Record<string, unknown> = {};

      // Use !== undefined so empty or null-like values can be handled properly.
      if (updates.fullName !== undefined) {
        tableUpdates.full_name = updates.fullName.trim();
      }

      if (updates.dob !== undefined) {
        tableUpdates.date_of_birth = updates.dob || null;
      }

      if (updates.gender !== undefined) {
        tableUpdates.gender = updates.gender
          ? updates.gender.trim().toLowerCase()
          : null;
      }

      if (updates.bloodGroup !== undefined) {
        tableUpdates.blood_group = updates.bloodGroup || null;
      }

      if (!practitioner) {
        if (updates.city !== undefined) {
          tableUpdates.city = updates.city || null;
        }

        if (updates.pinCode !== undefined) {
          tableUpdates.pin_code = updates.pinCode || null;
        }

        if (updates.prakriti !== undefined) {
          tableUpdates.prakriti = updates.prakriti || null;
        }
      }

      if (Object.keys(tableUpdates).length > 0) {
        const { data, error } = await this.supabase
          .from(tableName)
          .update(tableUpdates)
          .eq("user_id", userId)
          .select("id")
          .maybeSingle();

      if (error) {
        console.error("Profile update failed:", {
          tableName,
          userId,
          role,
          tableUpdates,
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });

        if (error.code === "23505") {
          throw new AppError("Profile details conflict with existing record", 400);
        }

        throw new AppError(
          `Database error while updating profile in ${tableName}`,
          500
        );
      }

      if (!data) {
        const upsertData = practitioner 
          ? { user_id: userId, ...tableUpdates }
          : { 
              user_id: userId, 
              date_of_birth: '1970-01-01', 
              gender: 'other',
              ...tableUpdates 
            };

        // Fallback: upsert profile row if it doesn't exist yet for this user
        const { error: upsertErr } = await this.supabase
          .from(tableName)
          .upsert(upsertData, { onConflict: "user_id" });

        if (upsertErr) {
          console.error("Profile upsert failed:", {
            tableName,
            userId,
            message: upsertErr.message,
          });
          throw new AppError(
            practitioner
              ? "Practitioner profile not found"
              : "Patient profile not found",
            404
          );
        }
      }
    }
    }

    const userUpdates: Record<string, unknown> = {};

    if (updates.email !== undefined && updates.email.trim() !== "") {
      userUpdates.email = updates.email.trim().toLowerCase();
    }

    if (updates.phone !== undefined && updates.phone.trim() !== "") {
      userUpdates.mobile = updates.phone.trim();
    }

    if (Object.keys(userUpdates).length > 0) {
      // Fetch current user details to skip redundant updates and avoid false constraint violations
      const { data: currentUser } = await this.supabase
        .from("users")
        .select("email, mobile")
        .eq("id", userId)
        .maybeSingle();

      if (currentUser) {
        if (userUpdates.email && userUpdates.email === currentUser.email) {
          delete userUpdates.email;
        }
        if (userUpdates.mobile && userUpdates.mobile === currentUser.mobile) {
          delete userUpdates.mobile;
        }
      }

      if (Object.keys(userUpdates).length > 0) {
        const { data, error } = await this.supabase
          .from("users")
          .update(userUpdates)
          .eq("id", userId)
          .select("id")
          .maybeSingle();

        if (error) {
          console.error("User details update failed:", {
            userId,
            userUpdates,
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });

          if (error.code === "23505") {
            const isMobile = error.message?.includes("users_mobile_key") || error.details?.includes("mobile");
            const isEmail = error.message?.includes("users_email_key") || error.details?.includes("email");
            const field = isMobile ? "Phone number" : isEmail ? "Email address" : "Account details";
            throw new AppError(`${field} is already registered by another account`, 400);
          }

          throw new AppError(
            "Database error while updating profile user details",
            500
          );
        }

        if (!data) {
          throw new AppError("User record not found", 404);
        }
      }
    }
  }
}