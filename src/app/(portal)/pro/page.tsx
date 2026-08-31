"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { setNavContext } from "@/lib/nav-context-client";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListFilter,
  MapPin,
  UserPlus,
  Video,
  XCircle,
} from "lucide-react";

import { HPRBadge } from "@/components/Badges";
import { useAuth } from "@/contexts/auth-context";
import { usePractitionerUpcomingCalls } from "@/hooks/use-consultations";
import { usePractitioner } from "@/hooks/use-discover";
import { useQuery } from "@/hooks/useQuery";
import { cn } from "@/lib/utils";
import type { QueuePatient, QueueStatus } from "@/lib/types";
import { apiClient } from "@/shared/api/api-client";

type PractitionerUpcomingAppointment = {
  appointmentId: string;
  name: string;
  relationship?: string | null;
  age: number;
  gender?: string | null;
  reason?: string | null;
  mode: "video" | "clinic";
  date: string;
  dateLabel: string;
  time: string;
  isToday?: boolean;
};

function usePractitionerQueue(
  practitionerId: string | undefined,
  dateStr?: string,
) {
  return useQuery<QueuePatient[]>(
    () =>
      practitionerId
        ? apiClient<{ data: QueuePatient[] }>(
            `/api/queue/today${dateStr ? `?date=${encodeURIComponent(dateStr)}` : ""}`,
          ).then((response) => response.data ?? [])
        : Promise.resolve([]),
    [practitionerId, dateStr],
  );
}

function usePractitionerMonthCounts(
  practitionerId: string | undefined,
  year: number,
  month: number,
) {
  return useQuery<Record<string, number>>(
    () =>
      practitionerId
        ? apiClient<{ data: Record<string, number> }>(
            `/api/queue/month?year=${year}&month=${month}`,
          ).then((response) => response.data ?? {})
        : Promise.resolve({}),
    [practitionerId, year, month],
  );
}

function usePractitionerUpcomingAppointments(
  practitionerId: string | undefined,
) {
  return useQuery<PractitionerUpcomingAppointment[]>(
    () =>
      practitionerId
        ? apiClient<{
            data: PractitionerUpcomingAppointment[];
          }>("/api/queue/upcoming").then(
            (response) => response.data ?? [],
          )
        : Promise.resolve([]),
    [practitionerId],
  );
}

const STATUS_CONFIG: Record<
  QueueStatus,
  {
    label: string;
    color: string;
    dot: string;
  }
> = {
  waiting: {
    label: "Waiting",
    color:
      "bg-amber-50 text-amber-700 border border-amber-200",
    dot: "bg-amber-400",
  },
  "checked-in": {
    label: "Checked In",
    color:
      "bg-indigo-50 text-indigo-700 border border-indigo-200",
    dot: "bg-indigo-400",
  },
  "in-session": {
    label: "In Session",
    color:
      "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-500 animate-pulse",
  },
  completed: {
    label: "Completed",
    color:
      "bg-gray-100 text-gray-600 border border-gray-200",
    dot: "bg-gray-400",
  },
  missed: {
    label: "Missed",
    color:
      "bg-red-50 text-red-600 border border-red-200",
    dot: "bg-red-400",
  },
};

function isAppointmentTimePast(
  dateStr: string,
  timeStr: string,
): boolean {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return false;
  }

  const [, hourRaw, minuteRaw, meridiem] = match;
  let hour = Number(hourRaw) % 12;
  if (meridiem.toUpperCase() === "PM") {
    hour += 12;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const appointmentDate = new Date(
    year,
    month - 1,
    day,
    hour,
    Number(minuteRaw),
  );

  return appointmentDate.getTime() < Date.now();
}

export default function ProDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  // ── Core practitioner data ──────────────────────────────────────────────────
  const { data: practitioner, loading: practLoading } = usePractitioner(user?.id);
  const { data: upcomingCalls } = usePractitionerUpcomingCalls(user?.id);

  const doctorName     = practitioner?.name ?? user?.name ?? "Practitioner";
  const doctorInitials = doctorName.split(" ").filter((w: string) => w).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const [isOnline, setIsOnline] = useState(true);
  const [upcomingTab, setUpcomingTab] =
    useState<"today" | "future">("today");
  const [queueFilter, setQueueFilter] =
    useState<"all" | "completed" | "missed">("all");
  const [queueFilterOpen, setQueueFilterOpen] = useState(false);
  const queueFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!queueFilterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (queueFilterRef.current && !queueFilterRef.current.contains(e.target as Node)) {
        setQueueFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [queueFilterOpen]);

  // ── Calendar and date selection ─────────────────────────────────────────────
  const todayStr = new Date().toLocaleDateString("en-CA");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const now = new Date();
  const [calendarYear, setCalendarYear] = useState<number>(
    now.getFullYear(),
  );
  const [calendarMonth, setCalendarMonth] = useState<number>(
    now.getMonth() + 1,
  );

  // ── Queue for selected date ─────────────────────────────────────────────────
  // usePractitionerQueue expects the practitioners table PK (practitioner?.id).
  const { data: rawQueuePatients, loading: queueLoading } =
    usePractitionerQueue(practitioner?.id, selectedDate);
  const queuePatients: QueuePatient[] = rawQueuePatients ?? [];

  // Status (waiting/checked-in/in-session/completed/missed) is decided
  // server-side — a booked slot stays "Waiting" until the next slot's start
  // time, at which point the backend flips it to "missed" on the next fetch.
  // No separate client-side time cutoff here; just sort completed to the end.
  const visibleQueuePatients: QueuePatient[] = queuePatients
    .slice()
    .sort((a, b) => {
      const aCompleted = a.status === "completed" ? 1 : 0;
      const bCompleted = b.status === "completed" ? 1 : 0;
      return aCompleted - bCompleted;
    });

  // ── Calendar month appointment counts ───────────────────────────────────────
  const { data: monthCounts } = usePractitionerMonthCounts(
    practitioner?.id,
    calendarYear,
    calendarMonth,
  );

  // ── Upcoming appointments (today + future) ──────────────────────────────────
  const { data: rawUpcoming, loading: upcomingLoading } =
    usePractitionerUpcomingAppointments(practitioner?.id);
  const upcomingAppointments: PractitionerUpcomingAppointment[] = (
    rawUpcoming ?? []
  ).filter(
    (appointment) => !isAppointmentTimePast(appointment.date, appointment.time),
  );

  // Split into today vs future.
  const todayAppts = upcomingAppointments.filter(
    (appointment) => appointment.date === todayStr,
  );
  const futureAppts = upcomingAppointments.filter(
    (appointment) => appointment.date !== todayStr,
  );

  // ── Stats (scoped to the selected day only) ─────────────────────────────────
  const selectedDateStats = {
    completed: queuePatients.filter(
      (patient) => patient.status === "completed",
    ).length,
    missed: queuePatients.filter(
      (patient) => patient.status === "missed",
    ).length,
  };

  // ── Queue filter (drives both the list and the container heading) ──────────
  const QUEUE_FILTER_LABELS: Record<"all" | "completed" | "missed", string> = {
    all: "Today's Queue",
    completed: "Completed",
    missed: "Missed",
  };
  const displayedQueuePatients =
    queueFilter === "all"
      ? visibleQueuePatients.filter(
          (patient) => patient.status !== "completed" && patient.status !== "missed",
        )
      : visibleQueuePatients.filter((patient) => patient.status === queueFilter);

  const isLoading = practLoading || queueLoading;

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((year) => year - 1);
      return;
    }

    setCalendarMonth((month) => month - 1);
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((year) => year + 1);
      return;
    }

    setCalendarMonth((month) => month + 1);
  };

  const handleGoToday = () => {
    const currentDate = new Date();
    setCalendarYear(currentDate.getFullYear());
    setCalendarMonth(currentDate.getMonth() + 1);
    setSelectedDate(todayStr);
  };

  const getDateLabel = (dateStr: string) => {
    if (dateStr === todayStr) {
      return "Today";
    }

    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  const calendarMonthName = new Date(
    calendarYear,
    calendarMonth - 1,
    1,
  ).toLocaleString("en-US", { month: "long" });

  const renderCalendarGrid = () => {
    const monthIndex = calendarMonth - 1;
    const firstDay = new Date(calendarYear, monthIndex, 1);
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(
      calendarYear,
      calendarMonth,
      0,
    ).getDate();
    const previousMonthDays = new Date(
      calendarYear,
      monthIndex,
      0,
    ).getDate();
    const cells = [];

    for (let index = startDayOfWeek - 1; index >= 0; index -= 1) {
      const day = previousMonthDays - index;
      cells.push(
        <div
          key={`previous-${day}`}
          className="h-8 flex items-center justify-center text-xs font-medium text-gray-300 select-none"
        >
          {day}
        </div>,
      );
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = `${calendarYear}-${String(calendarMonth).padStart(
        2,
        "0",
      )}-${String(day).padStart(2, "0")}`;
      const isSelected = dateStr === selectedDate;
      const isToday = dateStr === todayStr;
      const count = monthCounts?.[dateStr] ?? 0;

      cells.push(
        <button
          key={`current-${day}`}
          type="button"
          onClick={() => setSelectedDate(dateStr)}
          className={cn(
            "relative h-8 w-full rounded-full flex flex-col items-center justify-center text-xs font-semibold transition-all",
            isSelected
              ? "bg-[#4F46E5] text-white font-bold shadow-sm"
              : isToday
                ? "border border-indigo-500 text-indigo-600 font-bold hover:bg-indigo-50"
                : "text-gray-700 hover:bg-indigo-50/80 hover:text-indigo-600",
          )}
          aria-label={`${dateStr}: ${count} scheduled patient${count === 1 ? "" : "s"}`}
          aria-pressed={isSelected}
        >
          <span>{day}</span>
          {count > 0 && (
            <span
              className={cn(
                "absolute bottom-0.5 h-1 w-1 rounded-full",
                isSelected ? "bg-white" : "bg-indigo-600",
              )}
            />
          )}
        </button>,
      );
    }

    const remainingSlots = (7 - (cells.length % 7)) % 7;

    for (let day = 1; day <= remainingSlots; day += 1) {
      cells.push(
        <div
          key={`next-${day}`}
          className="h-8 flex items-center justify-center text-xs font-medium text-gray-300 select-none"
        >
          {day}
        </div>,
      );
    }

    return cells;
  };

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
                  ? `${practitioner.discipline} · ${
                      practitioner.specialties && practitioner.specialties.length > 0
                        ? practitioner.specialties.join(", ")
                        : practitioner.specialty || "Holistic Clinic"
                    }`
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

          <div className="flex items-center gap-3">
            <Link
              href="/pro/availability"
              className="inline-flex items-center px-3.5 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold text-sm rounded-xl transition-colors"
            >
              Edit Schedule
            </Link>

            {/* Online toggle */}
            <div className="flex items-center gap-3 bg-[#F8FAFC] px-4 py-3 rounded-[12px] border border-gray-100">
              <span className="text-sm font-semibold text-gray-600">{isOnline ? "Online" : "Offline"}</span>
              <button
                type="button"
                onClick={() => setIsOnline((online) => !online)}
                className={cn("relative w-12 h-6 rounded-full transition-all shadow-inner", isOnline ? "bg-emerald-500" : "bg-gray-300")}
                aria-label={isOnline ? "Go offline" : "Go online"}
                aria-pressed={isOnline}
              >
                <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all", isOnline ? "left-7" : "left-1")} />
              </button>
            </div>
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
            {/* ── Stats cards (scoped to the selected day) ────────────── */}
            <div className="grid grid-cols-2 gap-5 mb-8">
              {[
                { label: "Completed", value: selectedDateStats.completed, color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle2 },
                { label: "Missed", value: selectedDateStats.missed, color: "text-red-600", bg: "bg-red-50", icon: XCircle },
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
                  <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F8FAFC]/50">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-500" />
                        {QUEUE_FILTER_LABELS[queueFilter]} · {getDateLabel(selectedDate)}
                      </h2>
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/80 px-3 py-1 rounded-full">
                        Count: {displayedQueuePatients.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Link
                        href="/pro/walk-in"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#635BFF] hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all active:scale-95"
                      >
                        <UserPlus className="w-4 h-4" />
                        Walk-in Patient
                      </Link>
                      <div className="relative" ref={queueFilterRef}>
                        <button
                          type="button"
                          onClick={() => setQueueFilterOpen((open) => !open)}
                          className="inline-flex items-center gap-2 pl-3.5 pr-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-sm rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          aria-haspopup="listbox"
                          aria-expanded={queueFilterOpen}
                        >
                          <ListFilter className="w-3.5 h-3.5" />
                          {QUEUE_FILTER_LABELS[queueFilter]}
                          <ChevronDown className={cn("w-4 h-4 transition-transform", queueFilterOpen && "rotate-180")} />
                        </button>

                        {queueFilterOpen && (
                          <div
                            role="listbox"
                            className="absolute right-0 z-20 mt-2 w-48 py-1.5 bg-white rounded-2xl border border-gray-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150"
                          >
                            {(["all", "completed", "missed"] as const).map((option) => (
                              <button
                                key={option}
                                type="button"
                                role="option"
                                aria-selected={queueFilter === option}
                                onClick={() => {
                                  setQueueFilter(option);
                                  setQueueFilterOpen(false);
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-left transition-colors",
                                  queueFilter === option
                                    ? "text-indigo-700 bg-indigo-50/80"
                                    : "text-gray-600 hover:bg-gray-50",
                                )}
                              >
                                {QUEUE_FILTER_LABELS[option]}
                                {queueFilter === option && <Check className="w-4 h-4 text-indigo-600" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
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
                    ) : displayedQueuePatients.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                          <UserPlus className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-gray-900 font-bold mb-1">
                          No {queueFilter === "all" ? "patients in queue" : QUEUE_FILTER_LABELS[queueFilter].toLowerCase() + " patients"} for {getDateLabel(selectedDate)}.
                        </p>
                        <p className="text-sm text-gray-500">New bookings will appear here automatically.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {displayedQueuePatients.map((patient: QueuePatient) => {
                          const statusConf = STATUS_CONFIG[patient.status] || STATUS_CONFIG.waiting;
                          const isPending  = patient.status === "checked-in" || patient.status === "waiting";
                          return (
                            <div
                              key={patient.appointmentId}
                              className={cn(
                                "bg-white rounded-2xl border p-5 transition-all hover:shadow-md",
                                patient.status === "checked-in" ? "border-indigo-200 ring-1 ring-indigo-50" : "border-gray-200",
                                (patient.status === "completed" || patient.status === "missed") && "opacity-60 bg-gray-50"
                              )}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-4 flex-1">
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0 border border-white shadow-sm">
                                    <span className="font-bold text-indigo-700 text-lg">{patient.name?.charAt(0).toUpperCase() || "P"}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-base font-bold text-gray-900">{patient.name}</p>
                                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{patient.age}y</span>
                                    </div>
                                    <p className="text-sm text-gray-600 truncate">{patient.reason || "No specific reason provided"}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs font-medium text-gray-500">
                                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> {patient.time}</span>
                                      {patient.abha && (
                                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">ABHA ✓</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col sm:items-end gap-3">
                                  <div className="flex items-center gap-2">
                                    <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold", statusConf.color)}>
                                      <div className={cn("w-1.5 h-1.5 rounded-full", statusConf.dot)} />
                                      {statusConf.label}
                                    </div>
                                  </div>

                                  {patient.status === "missed" && (
                                    <div className="flex gap-2">
                                      <span
                                        className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-400 bg-gray-50 cursor-not-allowed"
                                        aria-disabled="true"
                                        title="This appointment was missed. Rescheduling is not yet available."
                                      >
                                        Reschedule
                                      </span>
                                    </div>
                                  )}

                                  {isPending && (
                                      <div className="flex gap-2">
                                        {selectedDate !== todayStr ? (
                                          <span
                                            className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-400 bg-gray-50 cursor-not-allowed"
                                            aria-disabled="true"
                                          >
                                            Consult
                                          </span>
                                        ) : (
                                          <button
                                            onClick={async () => {
                                              await setNavContext("patient", {
                                                patientId: patient.id,
                                                appointmentId: patient.appointmentId,
                                              });
                                              router.push("/pro/patient");
                                            }}
                                            className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                                          >
                                            Consult
                                          </button>
                                        )}

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
                        {(upcomingTab === "today" ? todayAppts : futureAppts).map((appt) => (
                          <div
                            key={appt.appointmentId}
                            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4 hover:border-indigo-300 hover:shadow-md transition-all group"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 font-bold text-indigo-700 text-sm">
                                {appt.name?.charAt(0).toUpperCase() || "P"}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <p className="text-sm font-bold text-gray-900">{appt.name}</p>
                                  {appt.age > 0 && <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{appt.age}y</span>}
                                  {appt.gender && <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">{appt.gender}</span>}
                                  {appt.relationship && (
                                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full capitalize">{appt.relationship}</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 truncate">{appt.reason || "No specific reason provided"}</p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[10px] font-bold",
                              (appt.isToday ?? appt.date === todayStr)
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-indigo-200 bg-indigo-50 text-indigo-700",
                            )}
                          >
                            {appt.dateLabel}
                          </span>

                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                              {appt.mode === "video" ? (
                                <Video className="h-3 w-3 text-blue-500" />
                              ) : (
                                <MapPin className="h-3 w-3 text-emerald-500" />
                              )}

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
                  RIGHT COLUMN — Calendar
              ═══════════════════════════════════════════════════════ */}
              <div className="space-y-6">

                {/* Interactive Calendar */}
                <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900">
                      {calendarMonthName} {calendarYear}
                    </h3>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGoToday}
                        className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                        aria-label="Previous month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                        aria-label="Next month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center my-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    {["MO", "TU", "WE", "TH", "FR", "SA", "SU"].map(
                      (day) => (
                        <div key={day}>{day}</div>
                      ),
                    )}
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {renderCalendarGrid()}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-medium text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      <span>Scheduled Patients</span>
                    </div>
                    <span className="font-bold text-indigo-600">
                      {getDateLabel(selectedDate)}
                    </span>
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