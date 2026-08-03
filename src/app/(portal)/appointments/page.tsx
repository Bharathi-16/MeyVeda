"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { AppointmentRow } from "@/features/appointments/appointments.type";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Video,
  MapPin,
  ShieldCheck,
  Award,
  Languages,
  Clock,
  Search,
  Filter,
  ChevronDown,
  Check,
  HelpCircle,
  CreditCard,
  Plus,
  Star,
  ChevronRight,
  FileText,
  Zap,
} from "lucide-react";

type Tab = "upcoming" | "past" | "cancelled";

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={11}
          className={cn(
            value >= s ? "fill-amber-500 text-amber-500" : "text-neutral-200"
          )}
        />
      ))}
    </div>
  );
}

// Helper to deterministically generate doctor meta details
function getDoctorMeta(doctorName: string, specialty: string) {
  const hash = doctorName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const exp = 5 + (hash % 12); // 5 to 16 years
  const qualifications = specialty.includes("Homeopathy") ? ["BHMS", "MD"] :
                         specialty.includes("Naturopathy") ? ["BNYS", "ND"] :
                         specialty.includes("Unani") ? ["BUMS"] :
                         specialty.includes("Siddha") ? ["BSMS"] : ["BAMS", "MD (Ayur)"];
  const languages = hash % 2 === 0 ? ["English", "Hindi"] : ["English", "Tamil", "Hindi"];
  return { exp, qualifications, languages };
}

async function fetchAppointments(): Promise<AppointmentRow[]> {
  const response = await fetch("/api/appointments", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Unable to load appointments");
  }

  return result.data as AppointmentRow[];
}

async function cancelAppointment(appointmentId: string, reason: string): Promise<void> {
  const response = await fetch("/api/appointments", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appointmentId, reason }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Unable to cancel appointment");
  }
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("all");
  const [filterMode, setFilterMode] = useState<"all" | "video" | "clinic">("all");
  const [sortBy, setSortBy] = useState("date-desc");
  const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null);

  async function loadAppointments(): Promise<void> {
    try {
      setLoading(true);
      setError("");
      const data = await fetchAppointments();
      setAppointments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load appointments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAppointments();
  }, []);

  // Group appointments by status
  const upcoming = appointments.filter((a) => a.status === "upcoming");
  const past = appointments.filter((a) => a.status === "past");
  const cancelled = appointments.filter((a) => a.status === "cancelled");

  // Dynamically compute attendance stats
  const totalConcluded = past.length + cancelled.length;
  const attendanceRate = totalConcluded > 0 ? Math.round((past.length / totalConcluded) * 100) : 100;

  // Selected list of appointments based on active tab
  const baseList = activeTab === "upcoming" ? upcoming : activeTab === "past" ? past : cancelled;

  // Filter list by search & dropdowns
  const currentList = baseList.filter((appt) => {
    const matchesSearch = appt.doctor.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          appt.specialty.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSpecialty = filterSpecialty === "all" ||
                             appt.specialty.toLowerCase().includes(filterSpecialty.toLowerCase());

    const matchesMode = filterMode === "all" || appt.mode === filterMode;

    return matchesSearch && matchesSpecialty && matchesMode;
  });

  // Sort list
  if (sortBy === "date-desc") {
    currentList.sort((a, b) => new Date(b.dateRaw).getTime() - new Date(a.dateRaw).getTime());
  } else if (sortBy === "date-asc") {
    currentList.sort((a, b) => new Date(a.dateRaw).getTime() - new Date(b.dateRaw).getTime());
  } else if (sortBy === "fee-low-high") {
    const getFeeVal = (f: string) => Number(f.replace(/[^0-9]/g, "")) || 0;
    currentList.sort((a, b) => getFeeVal(a.fee) - getFeeVal(b.fee));
  }

  // Get dynamic specialties list for filtering
  const uniqueSpecialties = Array.from(
    new Set(
      appointments.map((a) => a.specialty.split(" · ")[0])
    )
  ).filter(Boolean);

  async function handleCancel(id: string) {
    try {
      await cancelAppointment(id, "Cancelled by patient");
      setCancellingId(null);
      await loadAppointments();
    } catch (err) {
      console.error(err);
      alert("Failed to cancel appointment");
    }
  }



  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-10">

      {/* ─── HEADER SECTION ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-100 pb-6.5">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-black tracking-tight text-foreground">
            Appointments
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium mt-1 select-none">
            Manage your consultations, join video clinics, and track prescriptions
          </p>
        </div>

        <Link href="/discover" className="flex-shrink-0">
          <button className="inline-flex items-center gap-1.5 px-5 py-3 bg-herb-green hover:bg-herb-green-light active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer">
            <Plus size={14} className="stroke-[3]" />
            <span>Book Consultation</span>
          </button>
        </Link>
      </div>

      {/* ─── STATISTICS SUMMARY CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        {/* Card 1: Upcoming */}
        <div className="bg-white rounded-2xl p-4.5 border border-neutral-150/70 shadow-2xs hover:shadow-xs transition-all duration-300 flex items-center gap-4 group">
          <div className="w-11 h-11 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
            <Calendar size={18} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Upcoming</p>
            <h3 className="text-xl font-black text-foreground mt-0.5 font-mono">{upcoming.length}</h3>
          </div>
        </div>

        {/* Card 2: Completed */}
        <div className="bg-white rounded-2xl p-4.5 border border-neutral-150/70 shadow-2xs hover:shadow-xs transition-all duration-300 flex items-center gap-4 group">
          <div className="w-11 h-11 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Completed</p>
            <h3 className="text-xl font-black text-foreground mt-0.5 font-mono">{past.length}</h3>
          </div>
        </div>

        {/* Card 3: Cancelled */}
        <div className="bg-white rounded-2xl p-4.5 border border-neutral-150/70 shadow-2xs hover:shadow-xs transition-all duration-300 flex items-center gap-4 group">
          <div className="w-11 h-11 bg-red-50 border border-red-100 text-red-500 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
            <XCircle size={18} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Cancelled</p>
            <h3 className="text-xl font-black text-foreground mt-0.5 font-mono">{cancelled.length}</h3>
          </div>
        </div>

        {/* Card 4: Attendance Rate */}
        <div className="bg-white rounded-2xl p-4.5 border border-neutral-150/70 shadow-2xs hover:shadow-xs transition-all duration-300 flex items-center gap-4 group">
          <div className="w-11 h-11 bg-amber-50 border border-amber-100 text-amber-600 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Attendance Rate</p>
            <h3 className="text-xl font-black text-foreground mt-0.5 font-mono">{attendanceRate}%</h3>
          </div>
        </div>
      </div>

      {/* ─── MAIN COLUMN & SIDEBAR GRID ─── */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">

        {/* LEFT COLUMN: LISTING AREA */}
        <div className="lg:col-span-8 space-y-6">

          {/* Filter Bar */}
          <div className="bg-white rounded-2.5xl p-4.5 border border-neutral-150/75 shadow-2xs flex flex-col md:flex-row gap-3.5 items-stretch md:items-center">

            {/* Search Input */}
            <div className="relative flex-1 group">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-herb-green transition-colors" />
              <input
                type="text"
                placeholder="Search by doctor or specialty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9.5 pr-4 py-2.5 bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-200/50 rounded-xl text-xs font-semibold placeholder:text-muted-foreground focus:outline-none focus:border-herb-green/50 focus:bg-white focus:ring-4 focus:ring-herb-green/5 transition-all text-foreground"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">

              {/* Specialty Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setOpenFilterDropdown(openFilterDropdown === "specialty" ? null : "specialty")}
                  className={cn(
                    "px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer",
                    filterSpecialty !== "all"
                      ? "bg-herb-green/5 border-herb-green text-herb-green ring-1 ring-herb-green/20"
                      : "bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600"
                  )}
                >
                  <Filter size={12} className="opacity-70" />
                  <span className="capitalize">{filterSpecialty === "all" ? "Specialties" : filterSpecialty}</span>
                  <ChevronDown size={11} className="opacity-70" />
                </button>

                {openFilterDropdown === "specialty" && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setOpenFilterDropdown(null)} />
                    <div className="absolute left-0 md:right-0 md:left-auto top-[calc(100%+6px)] z-35 bg-white border border-neutral-200/80 rounded-2xl shadow-xl min-w-[180px] py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      <button
                        onClick={() => { setFilterSpecialty("all"); setOpenFilterDropdown(null); }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-neutral-50 transition-colors flex items-center justify-between"
                      >
                        <span className={filterSpecialty === "all" ? "text-herb-green" : "text-neutral-600"}>All Specialties</span>
                        {filterSpecialty === "all" && <Check size={11} className="text-herb-green" />}
                      </button>
                      {uniqueSpecialties.map((spec) => (
                        <button
                          key={spec}
                          onClick={() => { setFilterSpecialty(spec); setOpenFilterDropdown(null); }}
                          className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-neutral-50 transition-colors flex items-center justify-between"
                        >
                          <span className={filterSpecialty === spec ? "text-herb-green" : "text-neutral-600"}>{spec}</span>
                          {filterSpecialty === spec && <Check size={11} className="text-herb-green" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Mode Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setOpenFilterDropdown(openFilterDropdown === "mode" ? null : "mode")}
                  className={cn(
                    "px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer",
                    filterMode !== "all"
                      ? "bg-herb-green/5 border-herb-green text-herb-green ring-1 ring-herb-green/20"
                      : "bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600"
                  )}
                >
                  <Video size={12} className="opacity-70" />
                  <span className="capitalize">{filterMode === "all" ? "All Modes" : filterMode === "video" ? "Video" : "Clinic"}</span>
                  <ChevronDown size={11} className="opacity-70" />
                </button>

                {openFilterDropdown === "mode" && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setOpenFilterDropdown(null)} />
                    <div className="absolute left-0 md:right-0 md:left-auto top-[calc(100%+6px)] z-35 bg-white border border-neutral-200/80 rounded-2xl shadow-xl min-w-[180px] py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      {([
                        { label: "All Modes", value: "all" },
                        { label: "Video Consultation", value: "video" },
                        { label: "In-Clinic Visit", value: "clinic" }
                      ] as { label: string; value: "all" | "video" | "clinic" }[]).map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => { setFilterMode(opt.value); setOpenFilterDropdown(null); }}
                          className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-neutral-50 transition-colors flex items-center justify-between"
                        >
                          <span className={filterMode === opt.value ? "text-herb-green" : "text-neutral-600"}>{opt.label}</span>
                          {filterMode === opt.value && <Check size={11} className="text-herb-green" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setOpenFilterDropdown(openFilterDropdown === "sort" ? null : "sort")}
                  className="px-3.5 py-2.5 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span className="capitalize">
                    {sortBy === "date-desc" ? "Date: Newest" : sortBy === "date-asc" ? "Date: Oldest" : "Fee: Low to High"}
                  </span>
                  <ChevronDown size={11} className="opacity-70" />
                </button>

                {openFilterDropdown === "sort" && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setOpenFilterDropdown(null)} />
                    <div className="absolute right-0 top-[calc(100%+6px)] z-35 bg-white border border-neutral-200/80 rounded-2xl shadow-xl min-w-[180px] py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      {[
                        { label: "Date: Newest first", value: "date-desc" },
                        { label: "Date: Oldest first", value: "date-asc" },
                        { label: "Fee: Low to High", value: "fee-low-high" }
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => { setSortBy(opt.value); setOpenFilterDropdown(null); }}
                          className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-neutral-50 transition-colors flex items-center justify-between"
                        >
                          <span className={sortBy === opt.value ? "text-herb-green" : "text-neutral-600"}>{opt.label}</span>
                          {sortBy === opt.value && <Check size={11} className="text-herb-green" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

            </div>
          </div>

          {/* Segmented Tab Control */}
          <div className="flex gap-1.5 bg-neutral-100/80 rounded-2xl p-1.5 w-fit select-none shadow-3xs">
            {(["upcoming", "past", "cancelled"] as Tab[]).map((tab) => {
              const active = activeTab === tab;
              const count = tab === "upcoming" ? upcoming.length : tab === "past" ? past.length : cancelled.length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-5 py-2.5 text-xs font-bold rounded-xl capitalize transition-all duration-200 cursor-pointer flex items-center gap-1.5 active:scale-[0.98]",
                    active
                      ? "bg-white text-herb-green shadow-xs"
                      : "text-muted-foreground/80 hover:text-foreground hover:bg-neutral-50/50"
                  )}
                >
                  <span>{tab}</span>
                  <span className={cn(
                    "text-[10px] font-extrabold px-1.5 py-0.5 rounded-md leading-none border transition-all",
                    active
                      ? "bg-herb-green/5 text-herb-green border-herb-green/15"
                      : "bg-neutral-200 text-neutral-600 border-transparent"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Loading Skeletal screens */}
          {loading && (
            <div className="space-y-4.5">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-3xl border border-neutral-150 p-6.5 h-44 animate-pulse space-y-4">
                  <div className="flex gap-5">
                    <div className="w-14 h-14 bg-neutral-100 rounded-2xl" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="w-1/3 h-4 bg-neutral-100 rounded-lg" />
                      <div className="w-1/4 h-3 bg-neutral-100 rounded-lg" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-24 h-8 bg-neutral-100 rounded-xl" />
                    <div className="w-24 h-8 bg-neutral-100 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-center">
              <p className="text-xs font-bold text-red-600">{error}</p>
            </div>
          )}

          {/* Empty States */}
          {!loading && !error && currentList.length === 0 && (
            <div className="bg-white rounded-3xl border border-neutral-150 p-12 text-center shadow-2xs space-y-4">
              <span className="text-5xl inline-block animate-bounce">
                {activeTab === "upcoming" ? "🗓️" : activeTab === "past" ? "✓" : "✕"}
              </span>
              <h3 className="text-base font-black text-foreground">
                No {activeTab} Appointments
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed font-medium">
                {activeTab === "upcoming"
                  ? "You have no upcoming consultations scheduled. Book a session to consult with verified AYUSH experts."
                  : `There are no ${activeTab} appointments to show on this tab.`}
              </p>
              {activeTab === "upcoming" && (
               <Link href="/discover" className="inline-block mt-2">
                  <button className="px-5 py-2.5 bg-herb-green hover:bg-herb-green-light active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer">
                    Browse Practitioners
                  </button>
                </Link>
              )}
            </div>
          )}

          {/* Appointment listing card stack */}
          {!loading && !error && currentList.length > 0 && (
            <div className="space-y-4.5">
              {currentList.map((appt: AppointmentRow) => {
                const { exp, qualifications, languages } = getDoctorMeta(appt.doctor, appt.specialty);
                const isUpcoming = appt.status === "upcoming";
                const isPast = appt.status === "past";
                const isCancelled = appt.status === "cancelled";

                return (
                  <div key={appt.id} className={cn(
                    "bg-white rounded-3xl border p-6.5 shadow-2xs hover:shadow-xs hover:border-herb-green/10 transition-all duration-300 relative overflow-hidden",
                    isUpcoming ? "border-herb-green/15" : "border-neutral-150/70",
                    isCancelled && "opacity-90 bg-neutral-50/20"
                  )}>

                    {/* Upper content zone */}
                    <div className="flex flex-col md:flex-row gap-5 justify-between items-start md:items-center border-b border-neutral-100 pb-5 mb-5">

                      {/* Left: Doctor Profile & Qualifications */}
                      <div className="flex gap-4.5 items-start">
                        <div className="relative">
                          <div className={cn(
                            "w-14 h-14 rounded-2xl bg-herb-gradient flex items-center justify-center text-white font-extrabold text-lg shadow-inner font-display tracking-wider",
                            isCancelled && "bg-neutral-100 text-neutral-400 border border-neutral-200"
                          )}>
                            {appt.initials}
                          </div>

                          {/* Live active ring (upcoming only) */}
                          {isUpcoming && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping opacity-75" />
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="font-display font-extrabold text-foreground text-sm leading-snug">
                              {appt.doctor}
                            </h3>
                            <span className="text-[10px] text-muted-foreground/80 font-bold">
                              {qualifications.join(", ")}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-[8.5px] font-extrabold uppercase tracking-widest bg-emerald-500/5 text-emerald-700 px-1.5 py-0.5 rounded-full border border-emerald-500/10 shadow-3xs leading-none">
                              <ShieldCheck size={9} /> Verified
                            </span>
                          </div>

                          <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                            {appt.specialty}
                          </p>

                          <div className="flex gap-2.5 items-center mt-2.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-md leading-none">
                              <Award size={10} className="text-neutral-500" />
                              {exp} yrs experience
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground font-semibold leading-none">
                              <Languages size={10} className="text-muted-foreground/75" />
                              {languages.join(", ")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Soft Badge Status */}
                      <span className={cn(
                        "text-[9px] font-extrabold tracking-widest uppercase px-3 py-1 rounded-full border flex-shrink-0 select-none",
                        isUpcoming ? "bg-emerald-500/8 border-emerald-500/15 text-emerald-700" :
                        isPast ? "bg-neutral-100 border-neutral-200 text-neutral-500" :
                        "bg-red-50 border-red-100 text-red-500"
                      )}>
                        {isUpcoming ? "Confirmed" : isPast ? "Completed" : "Cancelled"}
                      </span>
                    </div>

                    {/* Mid content zone (Appointment Info Chips & Reminders) */}
                    <div className="space-y-4">
                      {/* Chips strip */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {/* Chip 1: Date & Time */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-50 border border-neutral-200/50 text-foreground font-bold rounded-xl leading-none shadow-3xs">
                          <Calendar size={12} className="text-muted-foreground/60" />
                          <span>{appt.date}</span>
                        </div>

                        {/* Chip 2: Mode */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-50 border border-neutral-200/50 text-foreground font-bold rounded-xl leading-none shadow-3xs">
                          {appt.mode === "video" ? (
                            <>
                              <Video size={12} className="text-herb-green" />
                              <span>Video Consultation</span>
                            </>
                          ) : (
                            <>
                              <span>🏥</span>
                              <span>In-Clinic Visit</span>
                            </>
                          )}
                        </div>

                        {/* Chip 3: Fee */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-50 border border-neutral-200/50 text-foreground font-bold rounded-xl leading-none shadow-3xs">
                          <CreditCard size={12} className="text-muted-foreground/60" />
                          <span className="font-mono">{appt.fee}</span>
                        </div>

                        {/* Chip 4: Duration */}
                        {appt.duration && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-50 border border-neutral-200/50 text-foreground font-bold rounded-xl leading-none shadow-3xs">
                            <Clock size={12} className="text-muted-foreground/60" />
                            <span>{appt.duration}</span>
                          </div>
                        )}
                      </div>

                      {/* Display Clinic Address (if Mode is clinic) */}
                      {appt.mode === "clinic" && (
                        <p className="text-[11px] text-muted-foreground/90 font-semibold flex items-center gap-1 px-1">
                          <MapPin size={11} className="text-muted-foreground/60" />
                          <span>MeyVeda Clinic Center · Bengaluru Sector 4</span>
                        </p>
                      )}

                      {/* Completed Rating Stars */}
                      {isPast && appt.rating && (
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Your Rating:</span>
                          <StarRating value={appt.rating} />
                        </div>
                      )}

                      {/* Cancelled details */}
                      {isCancelled && appt.reason && (
                        <div className="p-3 bg-red-500/5 border border-red-500/10 text-red-700 text-xs rounded-xl">
                          <span className="font-bold">Cancellation Reason:</span> {appt.reason}
                          {appt.refunded && <p className="text-[10px] text-emerald-700 font-bold mt-1">✓ Full refund processed successfully.</p>}
                        </div>
                      )}

                      {/* Reminder Info Banner (Upcoming only) */}
                      {isUpcoming && (
                        <div className="flex items-center gap-2 p-3 bg-indigo-50/60 border border-indigo-100/50 text-indigo-900 rounded-xl leading-relaxed shadow-3xs select-none">
                          <HelpCircle size={13} className="text-indigo-500 flex-shrink-0" />
                          <p className="text-[10px] font-semibold">
                            You&apos;ll receive a digital consultation invite link 15 minutes before the scheduled time.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Lower content zone (CTA buttons panel) */}
                    <div className="mt-5.5 pt-4 border-t border-neutral-100 flex flex-wrap gap-2.5 items-center">

                      {/* Join consultation */}
                      {isUpcoming && appt.mode === "video" && (
                        <Link
                          href={`/waiting-room?appointmentId=${encodeURIComponent(appt.id)}`}
                          className="inline-flex items-center justify-center rounded-xl bg-herb-green px-4 py-3 font-semibold text-white transition-colors hover:bg-herb-green/90"
                        >
                          <Video size={15} />
                          <span className="ml-2">Join Consultation</span>
                        </Link>
                      )}

                      {/* Book again or replacement */}
                      {isPast && (
                        <Link href={`/doctor/${appt.practitionerId}`} className="flex-1 min-w-[120px]">
                          <button className="w-full py-2.5 px-4 bg-herb-green hover:bg-herb-green-light active:scale-98 font-bold text-xs text-white rounded-xl shadow-xs transition-all cursor-pointer">
                            Book Again
                          </button>
                        </Link>
                      )}

                      {isCancelled && (
                        <Link href="/discover" className="flex-1 min-w-[120px]">
                          <button className="w-full py-2.5 px-4 bg-herb-green hover:bg-herb-green-light active:scale-98 font-bold text-xs text-white rounded-xl shadow-xs transition-all cursor-pointer">
                            Book Replacement
                          </button>
                        </Link>
                      )}

                      {/* View Doctor Profile */}
                      <Link href={`/doctor/${appt.practitionerId}`}>
                        <button className="py-2.5 px-4.5 bg-white hover:bg-neutral-50 active:scale-98 border border-neutral-200 text-neutral-600 hover:text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer">
                          View Doctor
                        </button>
                      </Link>

                      {/* Cancel (Upcoming only) */}
                      {isUpcoming && (
                        <button
                          onClick={() => setCancellingId(cancellingId === appt.id ? null : appt.id)}
                          className="py-2.5 px-4.5 bg-white hover:bg-red-50 text-neutral-500 hover:text-red-500 hover:border-red-200 border border-neutral-200 rounded-xl text-xs font-bold transition-all active:scale-98 cursor-pointer ml-auto"
                        >
                          Cancel
                        </button>
                      )}

                      {/* View prescription */}
                      {isPast && appt.hasPrescription && (
                        <Link href="/prescription" className="ml-auto flex items-center gap-1 text-[11px] font-bold text-herb-green hover:underline">
                          <FileText size={13} />
                          <span>View Prescription</span>
                        </Link>
                      )}
                    </div>

                    {/* Cancellation confirmation widget */}
                    {cancellingId === appt.id && (
                      <div className="mt-4.5 p-4.5 bg-red-50/50 border border-red-200/80 rounded-2xl animate-in fade-in slide-in-from-top-1.5 duration-200">
                        <h4 className="text-xs font-bold text-red-800">Cancel this appointment?</h4>
                        <p className="text-[11px] text-red-700 mt-1 leading-relaxed font-semibold">
                          Free cancellation applies up to 24h prior to slot time. A full refund will be initiated to your source account within 3–5 business days.
                        </p>
                        <div className="flex gap-2.5 mt-3.5">
                          <button
                            onClick={() => setCancellingId(null)}
                            className="flex-1 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            Keep Appointment
                          </button>
                          <button
                            onClick={() => handleCancel(appt.id)}
                            className="flex-1 py-2 bg-red-500 hover:bg-red-650 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
                          >
                            Confirm Cancel
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SIDEBAR CONTENT */}
        <div className="lg:col-span-4 space-y-6">

          {/* Quick Actions List Widget */}
          <div className="bg-white rounded-3xl p-5 border border-neutral-150/70 shadow-2xs space-y-4">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={13} className="text-herb-green" />
              Quick Actions
            </h4>

            <div className="space-y-2 text-xs font-bold text-neutral-600">
              <Link href="/discover" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50 hover:text-foreground transition-all group">
                <span className="flex items-center gap-2">🔎 Find Practitioners</span>
                <ChevronRight size={12} className="text-muted-foreground/70 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/profile" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50 hover:text-foreground transition-all group">
                <span className="flex items-center gap-2">👤 Update Health Profile</span>
                <ChevronRight size={12} className="text-muted-foreground/70 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/records" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50 hover:text-foreground transition-all group">
                <span className="flex items-center gap-2">📁 Medical Reports & Rx</span>
                <ChevronRight size={12} className="text-muted-foreground/70 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/records?tab=invoices" className="flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50 hover:text-foreground transition-all group">
                <span className="flex items-center gap-2">💳 Payment & Invoices</span>
                <ChevronRight size={12} className="text-muted-foreground/70 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Widget 3: Emergency Support Card */}
          <div className="hidden bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-3xl p-5 border border-amber-500/10 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white border border-amber-200/50 flex items-center justify-center text-amber-600 shadow-3xs">
                <HelpCircle size={15} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900 leading-tight">MeyVeda Support</h4>
                <p className="text-[9px] text-amber-800/80 font-bold uppercase tracking-wider mt-0.5">Assistance Desk 24/7</p>
              </div>
            </div>

            <p className="text-[11px] text-amber-800 leading-relaxed font-semibold">
              Need help rescheduling, joining your waiting room, or connecting with support?
            </p>

            <div className="space-y-2 pt-1.5 text-xs font-bold">
              <a href="tel:+918047290000" className="flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-amber-100/50 border border-amber-200/60 text-amber-900 transition-all active:scale-[0.98]">
                <span>📞 Call Support</span>
                <span className="text-[10px] opacity-75 font-mono">+91 80 4729 0000</span>
              </a>
              <Link href="/ai-chat" className="flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-amber-100/50 border border-amber-200/60 text-amber-900 transition-all active:scale-[0.98]">
                <span>💬 Chat with Support</span>
                <ChevronRight size={12} className="text-amber-700/85" />
              </Link>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
