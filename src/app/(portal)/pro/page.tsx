"use client";

import { useState } from "react";
import Link from "next/link";
import { HPRBadge } from "@/components/Badges";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { usePractitionerUpcomingCalls } from "@/hooks/use-consultations";
import { usePractitioner } from "@/hooks/use-discover";
import { usePractitionerPrescriptions } from "@/hooks/use-prescriptions";
import { usePractitionerAnalytics } from "@/hooks/use-analytics";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/shared/api/api-client";
import type { QueuePatient, QueueStatus } from "@/lib/types";

function usePractitionerQueue(practitionerId: string | undefined) {
  return useQuery<any[]>(
    () => (practitionerId ? apiClient<{ data: any[] }>("/api/queue/today").then((r) => r.data) : Promise.resolve([])),
    [practitionerId]
  );
}

function usePractitionerUpcomingAppointments(practitionerId: string | undefined) {
  return useQuery<any[]>(
    () => (practitionerId ? apiClient<{ data: any[] }>("/api/queue/upcoming").then((r) => r.data) : Promise.resolve([])),
    [practitionerId]
  );
}
import { 
  UserPlus, Search, PenTool, FileText, Calendar, 
  Video, MapPin, CheckCircle2, Clock, History, Activity
} from "lucide-react";


const STATUS_CONFIG: Record<QueueStatus, { label: string; color: string; dot: string }> = {
  waiting:     { label: "Waiting",    color: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-400" },
  "checked-in":{ label: "Checked In", color: "bg-indigo-50 text-indigo-700 border border-indigo-200", dot: "bg-indigo-400" },
  "in-session":{ label: "In Session", color: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500 animate-pulse" },
  completed:   { label: "Completed",  color: "bg-gray-100 text-gray-600 border border-gray-200", dot: "bg-gray-400" },
};

export default function ProDashboardPage() {
  const { user } = useAuth();

  // ── Core practitioner data ──────────────────────────────────────────────────
  const { data: practitioner, loading: practLoading } = usePractitioner(user?.id);
  const { data: analytics } = usePractitionerAnalytics(user?.id);
  const { data: prescriptions } = usePractitionerPrescriptions(user?.id);
  const { data: upcomingCalls } = usePractitionerUpcomingCalls(user?.id);

  const doctorName     = practitioner?.name ?? user?.name ?? "Practitioner";
  const doctorInitials = doctorName.split(" ").filter((w: string) => w).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const [isOnline, setIsOnline]         = useState(true);
  const [upcomingTab, setUpcomingTab]   = useState<"today" | "future">("today");

  // ── Queue (today) ───────────────────────────────────────────────────────────
  // usePractitionerQueue expects the practitioners table PK (practitioner?.id)
  const { data: rawQueuePatients, loading: queueLoading } = usePractitionerQueue(practitioner?.id);
  const queuePatients = rawQueuePatients || [];

  // ── Upcoming appointments (today + future) ──────────────────────────────────
  const { data: rawUpcoming, loading: upcomingLoading } = usePractitionerUpcomingAppointments(practitioner?.id);
  const upcomingAppointments = rawUpcoming || [];

  // Split into today vs future
  const todayStr = new Date().toLocaleDateString("en-CA");
  const todayAppts   = upcomingAppointments.filter((a: any) => a.date === todayStr);
  const futureAppts  = upcomingAppointments.filter((a: any) => a.date !== todayStr);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const todayStats = {
    total:       queuePatients.length,
    completed:   queuePatients.filter((p: any) => p.status === "completed").length,
    remaining:   queuePatients.filter((p: any) => p.status !== "completed").length,
    avgDuration: analytics?.avgDuration ? String(analytics.avgDuration) : "0",
  };

  const isLoading = practLoading || queueLoading;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="px-6 lg:px-8 py-8 max-w-[1200px] mx-auto">

        {/* ── Doctor Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 bg-white p-6 rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md ring-4 ring-indigo-50">
              <span className="text-white font-bold text-xl">{doctorInitials}</span>
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{doctorName}</h1>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Pro</span>
              </div>
              <p className="text-sm font-medium text-gray-500 mt-1">
                {practitioner
                  ? `${practitioner.discipline} · ${practitioner.specialty || "Holistic Clinic"}`
                  : "Ayurveda · Holistic Wellness Clinic"}
              </p>
              {practitioner ? (
                practitioner.isVerified ? (
                  <HPRBadge hprId={practitioner.hprId} showId className="mt-2" />
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 mt-2">
                    <Clock className="w-3.5 h-3.5" /> Verification Pending
                  </span>
                )
              ) : null}
            </div>
          </div>

          {/* Online toggle */}
          <div className="flex items-center gap-3 bg-[#F8FAFC] px-4 py-3 rounded-[12px] border border-gray-100">
            <span className="text-sm font-semibold text-gray-600">{isOnline ? "Online" : "Offline"}</span>
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={cn("relative w-12 h-6 rounded-full transition-all shadow-inner", isOnline ? "bg-emerald-500" : "bg-gray-300")}
            >
              <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all", isOnline ? "left-7" : "left-1")} />
            </button>
          </div>
        </div>

        {upcomingCalls && upcomingCalls.length > 0 && (
          <div className="mb-8 bg-emerald-50 border border-emerald-200 rounded-[16px] p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-900">Next Upcoming Fixed Session</h3>
                <p className="text-sm text-emerald-700 mt-0.5">
                  You have a session with <span className="font-bold">{upcomingCalls[0].patientName}</span> on <span className="font-bold">{upcomingCalls[0].date}</span> at <span className="font-bold">{upcomingCalls[0].time}</span>.
                </p>
              </div>
            </div>
            <Link href="/pro/patients?filter=followup">
              <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all">
                View All
              </button>
            </Link>
          </div>
        )}

        {/* ── Offline state ─────────────────────────────────────────────── */}
        {!isOnline ? (
          <div className="flex flex-col items-center justify-center h-80 bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-center">
            <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-5 border border-gray-100">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-xl font-bold text-gray-900 mb-2">You are currently offline</p>
            <p className="text-sm text-gray-500 leading-relaxed max-w-sm mb-6">
              Toggle online to start receiving new booking requests and manage your patient queue.
            </p>
            <button
              onClick={() => setIsOnline(true)}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-[0_4px_12px_rgb(79,70,229,0.25)] transition-all"
            >
              Go Online Now
            </button>
          </div>
        ) : (
          <>
            {/* ── Stats cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {[
                { label: "Total Patients", value: todayStats.total, color: "text-indigo-600", bg: "bg-indigo-50", icon: Calendar },
                { label: "Completed", value: todayStats.completed, color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle2 },
                { label: "Waiting", value: todayStats.remaining, color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
                { label: "Avg Wait (min)", value: todayStats.avgDuration, color: "text-purple-600", bg: "bg-purple-50", icon: Activity },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-[16px] border border-[#E5E7EB] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", s.bg)}>
                    <s.icon className={cn("w-6 h-6", s.color)} />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {isLoading ? "-" : s.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Main grid ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8">

              {/* ═══════════════════════════════════════════════════════
                  LEFT COLUMN — Queue + Upcoming Appointments
              ═══════════════════════════════════════════════════════ */}
              <div className="space-y-8">

                {/* ── Today's Patient Queue ──────────────────────────── */}
                <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-[#F8FAFC]/50">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-500" /> Patient Queue · Today
                    </h2>
                    <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-3 py-1.5 rounded-lg">Edit Schedule</button>
                  </div>

                  <div className="p-6">
                    {queueLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-gray-50 rounded-2xl border border-gray-100 p-5 h-24 animate-pulse">
                            <div className="w-1/3 h-4 bg-gray-200 rounded mb-3" /><div className="w-1/2 h-3 bg-gray-200 rounded" />
                          </div>
                        ))}
                      </div>
                    ) : queuePatients.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                          <UserPlus className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-gray-900 font-bold mb-1">No patients in queue for today.</p>
                        <p className="text-sm text-gray-500">New bookings will appear here automatically.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {queuePatients.map((patient: QueuePatient) => {
                          const statusConf = STATUS_CONFIG[patient.status] || STATUS_CONFIG.waiting;
                          const isPending  = patient.status === "checked-in" || patient.status === "waiting";
                          return (
                            <div
                              key={patient.appointmentId}
                              className={cn(
                                "bg-white rounded-2xl border p-5 transition-all hover:shadow-md",
                                patient.status === "checked-in" ? "border-indigo-200 ring-1 ring-indigo-50" : "border-gray-200",
                                patient.status === "completed" && "opacity-60 bg-gray-50"
                              )}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-4 flex-1">
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0 border border-white shadow-sm">
                                    <span className="font-bold text-indigo-700 text-lg">{patient.name[0]}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-base font-bold text-gray-900">{patient.name}</p>
                                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{patient.age}y</span>
                                    </div>
                                    <p className="text-sm text-gray-600 truncate">{patient.reason}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs font-medium text-gray-500">
                                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> {patient.time}</span>
                                      <span className="flex items-center gap-1.5">{patient.mode === "video" ? <Video className="w-3.5 h-3.5 text-blue-500"/> : <MapPin className="w-3.5 h-3.5 text-emerald-500"/>} {patient.mode === "video" ? "Video" : "In-Clinic"}</span>
                                      {patient.abha && (
                                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">ABHA ✓</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col sm:items-end gap-3">
                                  <div className="flex items-center gap-2">
                                    {isPending && (
                                      <span className={cn("text-xs font-semibold bg-gray-100 px-2.5 py-1 rounded-full", patient.status === "checked-in" ? "text-indigo-600" : "text-gray-500")}>
                                        Wait: {patient.waitMins}m
                                      </span>
                                    )}
                                    <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold", statusConf.color)}>
                                      <div className={cn("w-1.5 h-1.5 rounded-full", statusConf.dot)} />
                                      {statusConf.label}
                                    </div>
                                  </div>

                                  {isPending && (
                                    <div className="flex gap-2">
                                      <Link href={`/pro/patient/${patient.id}`}>
                                        <button className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                                          Intake
                                        </button>
                                      </Link>
                                      <Link href={`/pro/emr?patient=${patient.id}`}>
                                        <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition-all active:scale-95">
                                          {patient.mode === "video" ? "Start Video" : "Consult"}
                                        </button>
                                      </Link>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Upcoming Appointments (Today + Future) ─────────── */}
                <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-[#F8FAFC]/50">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-500" /> Upcoming Appointments
                    </h2>
                    {/* Tab switch */}
                    <div className="flex gap-1 bg-gray-100 rounded-xl p-1 border border-gray-200">
                      {(["today", "future"] as const).map((tab) => (
                         <button
                           key={tab}
                           onClick={() => setUpcomingTab(tab)}
                           className={cn(
                             "px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize",
                             upcomingTab === tab
                               ? "bg-white text-indigo-700 shadow-sm"
                               : "text-gray-500 hover:text-gray-900"
                           )}
                         >
                           {tab === "today" ? `Today (${todayAppts.length})` : `Future (${futureAppts.length})`}
                         </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-6">
                    {upcomingLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 p-4 h-16 animate-pulse">
                            <div className="w-1/3 h-3 bg-gray-200 rounded mb-2" /><div className="w-1/2 h-2.5 bg-gray-200 rounded" />
                          </div>
                        ))}
                      </div>
                    ) : (upcomingTab === "today" ? todayAppts : futureAppts).length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                          <Calendar className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-gray-900 font-bold mb-1">
                          {upcomingTab === "today" ? "No more appointments today." : "No future appointments booked yet."}
                        </p>
                        <p className="text-sm text-gray-500">New patient bookings will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(upcomingTab === "today" ? todayAppts : futureAppts).map((appt: any) => (
                          <div
                            key={appt.appointmentId}
                            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4 hover:border-indigo-300 hover:shadow-md transition-all group"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 font-bold text-indigo-700 text-sm">
                                {appt.name?.[0] ?? "?"}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <p className="text-sm font-bold text-gray-900">{appt.name}</p>
                                  {appt.age > 0 && <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{appt.age}y</span>}
                                  {appt.gender && <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">{appt.gender}</span>}
                                </div>
                                <p className="text-xs text-gray-500 truncate">{appt.reason}</p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                               <span className={cn(
                                 "text-[10px] font-bold px-2.5 py-1 rounded-full border",
                                 appt.isToday
                                   ? "bg-amber-50 text-amber-700 border-amber-200"
                                   : "bg-indigo-50 text-indigo-700 border-indigo-200"
                               )}>
                                 {appt.dateLabel}
                               </span>
                               <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                                 {appt.mode === "video" ? <Video className="w-3 h-3 text-blue-500"/> : <MapPin className="w-3 h-3 text-emerald-500"/>}
                                 {appt.time}
                               </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════
                  RIGHT COLUMN — Quick Actions + Schedule + Summary
              ═══════════════════════════════════════════════════════ */}
              <div className="space-y-6">

                {/* Quick Actions */}
                <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <Link href="/pro/walk-in">
                      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group">
                        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <UserPlus className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">Walk-in Patient</p>
                          <p className="text-[11px] font-medium text-indigo-100 mt-0.5">Register &amp; consult instantly</p>
                        </div>
                      </div>
                    </Link>

                    <Link href="/pro/patients">
                      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer group">
                        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0 group-hover:border-indigo-300">
                          <Search className="w-5 h-5 text-gray-600 group-hover:text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-900">Patient Search</p>
                          <p className="text-[11px] font-medium text-gray-500 mt-0.5">Find any patient record</p>
                        </div>
                      </div>
                    </Link>

                    <Link href="/pro/prescribe">
                      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer group">
                        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0 group-hover:border-purple-300">
                          <PenTool className="w-5 h-5 text-gray-600 group-hover:text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900 group-hover:text-purple-900">Write Prescription</p>
                          <p className="text-[11px] font-medium text-gray-500 mt-0.5">Quick Rx for any patient</p>
                        </div>
                      </div>
                    </Link>

                    <Link href="/pro/emr">
                      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all cursor-pointer group">
                        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0 group-hover:border-emerald-300">
                          <FileText className="w-5 h-5 text-gray-600 group-hover:text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900 group-hover:text-emerald-900">Open EMR Builder</p>
                          <p className="text-[11px] font-medium text-gray-500 mt-0.5">Notes &amp; full templates</p>
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>

                {/* Today's full schedule (mini view) */}
                <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Today&apos;s Schedule</h3>
                    {!queueLoading && queuePatients.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                        {queuePatients.length} patient{queuePatients.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {queueLoading ? (
                    <div className="space-y-3">
                      <div className="h-8 bg-gray-50 rounded animate-pulse" />
                      <div className="h-8 bg-gray-50 rounded animate-pulse" />
                    </div>
                  ) : queuePatients.length === 0 ? (
                    <p className="text-xs font-medium text-gray-500 text-center py-4 bg-gray-50 rounded-lg">No appointments today.</p>
                  ) : (
                    <div className="space-y-1">
                      {queuePatients.map((s: any) => (
                        <div
                          key={s.appointmentId}
                          className={cn("flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-gray-50", s.status === "completed" && "opacity-50")}
                        >
                          <span className="text-xs font-bold text-gray-500 w-12 flex-shrink-0">{s.time}</span>
                          <span className={cn("text-xs flex-1 truncate", s.status === "in-session" ? "font-bold text-emerald-600" : "font-semibold text-gray-900")}>
                            {s.name}
                          </span>
                          {s.status === "completed"  && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Done</span>}
                          {s.status === "in-session" && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded animate-pulse">Now</span>}
                          {s.mode === "video" && s.status !== "completed" && (
                            <Video className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Monthly Summary */}
                <div className="bg-gradient-to-b from-gray-50 to-white rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <History className="w-4 h-4 text-gray-400"/>
                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Monthly Summary</h3>
                  </div>
                  <p className="text-sm font-bold text-gray-900 mb-4">
                    {new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })}
                  </p>
                  <div className="space-y-3">
                    {[
                      { label: "Consultations", value: analytics ? String(analytics.completedThisMonth) : "0" },
                      { label: "Prescriptions",  value: prescriptions ? String(prescriptions.length) : "0" },
                      { label: "Revenue",        value: analytics ? `₹${analytics.revenueThisMonth.toLocaleString()}` : "₹0" },
                      { label: "Upcoming",       value: String(upcomingAppointments.length) },
                    ].map((s) => (
                      <div key={s.label} className="flex justify-between items-center text-sm">
                        <span className="font-medium text-gray-600">{s.label}</span>
                        <span className="font-bold text-gray-900">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
