"use client";

import { useQuery } from "./useQuery";
import { apiClient } from "@/shared/api/api-client";

export async function fetchDetailedConsultations(familyMemberId?: string | null): Promise<any[]> {
  const query = familyMemberId ? `?familyMemberId=${encodeURIComponent(familyMemberId)}` : "";
  const response = await apiClient<{ data: any[] }>(`/api/consultations/detailed${query}`);
  return response.data;
}

export function usePatientUpcomingCalls(patientId: string | undefined) {
  return useQuery<any[]>(
    async () => {
      if (!patientId) return [];
      const response = await apiClient<{ data: any[] }>("/api/consultations/upcoming-calls");
      return response.data;
    },
    [patientId]
  );
}

export function usePractitionerUpcomingCalls(practitionerId: string | undefined) {
  return useQuery<any[]>(
    async () => {
      if (!practitionerId) return [];
      const response = await apiClient<{ data: any[] }>("/api/consultations/upcoming-calls");
      return response.data;
    },
    [practitionerId]
  );
}