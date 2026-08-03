"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HPRBadge } from "@/components/Badges";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/shared/api/api-client";
import { useNewDoctorProfile } from "@/hooks/use-new-doctor";
import { usePractitioner } from "@/hooks/use-discover";
import { usePractitionerSlots, usePractitionerAvailableDates } from "@/hooks/use-availability";
import { useAppointments } from "@/hooks/use-appointments";
import { useAuth } from "@/contexts/auth-context";
import { formatCurrency, cn } from "@/lib/utils";

function useReviews(practId: string | undefined) {
  return useQuery<any[]>(
    () => (practId ? apiClient<{ data: any[] }>(`/api/discover/practitioners/${practId}/reviews`).then((r) => r.data) : Promise.resolve([])),
    [practId]
  );
}

function useNewDoctorSlots(doctorId: string | undefined, date: string) {
  return useQuery<any[]>(
    () =>
      doctorId && date
        ? apiClient<{ data: any[] }>("/api/discover/new-doctor-slots", { params: { doctorId, date } }).then((r) => r.data)
        : Promise.resolve([]),
    [doctorId, date]
  );
}

function useNewDoctorAvailableDates(doctorId: string | undefined) {
  return useQuery<string[]>(
    () =>
      doctorId
        ? apiClient<{ data: string[] }>("/api/discover/new-doctor-dates", { params: { doctorId } }).then((r) => r.data)
        : Promise.resolve([]),
    [doctorId]
  );
}
import {
  Star,
  ShieldCheck,
  Award,
  Languages,
  MapPin,
  Video,
  ChevronRight,
  ArrowLeft,
  User,
  BookOpen,
  Briefcase,
  Building,
  Calendar,
  Check,
  Heart,
  Share2,
  ExternalLink,
  CloudSun,
  Sun,
  Moon
} from "lucide-react";

function getPeriod(timeStr: string): "Morning" | "Afternoon" | "Evening" {
  const isPM = timeStr.toLowerCase().includes("pm");
  const hour = parseInt(timeStr.split(":")[0]);
  if (!isPM) {
    return "Morning";
  } else {
    if (hour === 12 || hour < 4) {
      return "Afternoon";
    }
    return "Evening";
  }
}

/**
 * Reliably parses a backend-formatted time string like "9:50 AM" or "12:05 PM"
 * combined with a YYYY-MM-DD date string into a local Date object.
 * `new Date("YYYY-MM-DD H:MM AM")` is non-standard and returns NaN in many
 * environments, so we parse manually instead.
 */
function parseSlotDateTime(dateStr: string, timeStr: string): Date | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

const disciplineStyles: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  Ayurveda: {
    bg: "bg-emerald-50 text-emerald-800 border-emerald-100",
    text: "text-emerald-700",
    border: "border-emerald-150",
    gradient: "from-emerald-500 to-teal-600",
  },
  Yoga: {
    bg: "bg-teal-50 text-teal-800 border-teal-100",
    text: "text-teal-700",
    border: "border-teal-150",
    gradient: "from-teal-500 to-cyan-600",
  },
  Naturopathy: {
    bg: "bg-amber-50 text-amber-850 border-amber-100",
    text: "text-amber-800",
    border: "border-amber-150",
    gradient: "from-amber-500 to-orange-500",
  },
  Unani: {
    bg: "bg-orange-50 text-orange-850 border-orange-100",
    text: "text-orange-800",
    border: "border-orange-150",
    gradient: "from-orange-500 to-red-500",
  },
  Siddha: {
    bg: "bg-purple-50 text-purple-800 border-purple-100",
    text: "text-purple-700",
    border: "border-purple-150",
    gradient: "from-purple-500 to-indigo-600",
  },
  Homeopathy: {
    bg: "bg-blue-50 text-blue-800 border-blue-100",
    text: "text-blue-700",
    border: "border-blue-150",
    gradient: "from-blue-500 to-indigo-600",
  },
};

export default function DoctorProfileClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [wishlisted, setWishlisted] = useState(false);

  // Fetch current patient's appointments to detect their booked slots
  const { data: myAppointments } = useAppointments(user?.id);

  // Fetch legacy doctor
  const { data: legacyDoc, loading: legacyDocLoading } = usePractitioner(id);

  // Fetch new doctor profile
  const { data: newDoc, loading: newDocLoading } = useNewDoctorProfile(id);

  const isLegacy = !!legacyDoc;

  // Resolve Doctor summary
  const doctor = legacyDoc
    ? legacyDoc
    : newDoc
    ? {
        id: newDoc.id,
        name: newDoc.full_name,
        specialty: newDoc.specializations?.[0] || "Ayurveda",
        rating: 4.9,
        reviews: 1284,
        experience: 15,
        location: "Online",
        isVerified: true,
        fee: Math.round((newDoc.consultation_fee ?? 0) / 100),
        nextAvailable: "Today",
        languages: newDoc.languages || ["English", "Hindi", "Kannada"],
        about: `${newDoc.full_name} is a dedicated AYUSH practitioner specializing in Classical Ayurveda.`,
        qualifications: ["BAMS", "MD Ayurveda", "PG Panchakarma"],
        hprId: newDoc.verifications?.[0]?.hpr_id || "HPR-4902-8822",
        avatar: newDoc.full_name?.split(" ").filter(Boolean).map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "DA",
        isNewDoctor: true,
        discipline: "Ayurveda",
      }
    : null;

  const style = doctor
    ? disciplineStyles[doctor.discipline] || {
        bg: "bg-neutral-50 text-neutral-850 border-neutral-200",
        text: "text-neutral-700",
        border: "border-neutral-200",
        gradient: "from-neutral-500 to-neutral-600",
      }
    : { bg: "", text: "", border: "", gradient: "" };

  const [selectedDateState, setSelectedDateState] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<{ id: string; startTime: string; timeValue: string; modes: ("video" | "clinic")[]; } | null>(null);

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Live clock — refreshes every 60 s so past slots auto-disappear
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Available dates queries
  const { data: legacyDates, loading: legacyDatesLoading } = usePractitionerAvailableDates(id);
  const { data: newDates, loading: newDatesLoading } = useNewDoctorAvailableDates(id);

  const rawAvailableDates = isLegacy ? legacyDates : newDates;
  const datesLoading = isLegacy ? legacyDatesLoading : newDatesLoading;

  const selectedDate = selectedDateState || rawAvailableDates?.[0] || "";

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    let startDayOfWeek = firstDay.getDay();
    // Monday = 0, ..., Sunday = 6
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= totalDays; day++) {
      const yearStr = currentYear;
      const monthStr = String(currentMonth + 1).padStart(2, "0");
      const dayStr = String(day).padStart(2, "0");
      const dateStr = `${yearStr}-${monthStr}-${dayStr}`;

      days.push({
        day,
        dateStr,
      });
    }

    return days;
  }, [currentMonth, currentYear]);

  const monthName = new Date(currentYear, currentMonth).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const prevMonth = () => {
    const today = new Date();
    if (currentYear > today.getFullYear() || (currentYear === today.getFullYear() && currentMonth > today.getMonth())) {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    }
  };

  // Fetch slots and reviews dynamically
  const legacySlotsQuery = usePractitionerSlots(id, selectedDate);
  const newSlotsQuery = useNewDoctorSlots(id, selectedDate);

  // Deduplicate legacy slots by startTime as well (safety)
  const rawSlots = isLegacy ? (legacySlotsQuery.data ?? []) : (newSlotsQuery.data ?? []);
  const slotMap = new Map<string, any>();
  for (const s of rawSlots) {
    const key = s.timeValue || s.startTime;
    if (slotMap.has(key)) {
      const ex = slotMap.get(key);
      const mode = s.mode || s.consultMode;
      if (mode && !ex.modes.includes(mode)) ex.modes.push(mode);
    } else {
      const mode = s.mode || s.consultMode;
      slotMap.set(key, { ...s, modes: s.modes || (mode ? [mode] : []) });
    }
  }
  const slots = Array.from(slotMap.values());
  const slotsLoading = isLegacy ? legacySlotsQuery.loading : newSlotsQuery.loading;

  const { data: rawReviews, loading: reviewsLoading } = useReviews(id);
  const reviews = rawReviews ?? [];

  // Derive the current patient's booked slot for this doctor + selected date
  // Must be declared BEFORE any early returns to satisfy Rules of Hooks.
  const myBookedSlotForThisDate = useMemo(() => {
    if (!myAppointments || !selectedDate) return null;
    return myAppointments.find((appt) => {
      const isSameDoctor = appt.practitionerId === id;
      const isSameDate = appt.dateRaw === selectedDate;
      const isActive = appt.status === "upcoming";
      return isSameDoctor && isSameDate && isActive;
    }) ?? null;
  }, [myAppointments, selectedDate, id]);

  if (legacyDocLoading && newDocLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 rounded-full border-3 border-herb-green border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-neutral-150 shadow-sm max-w-md mx-auto my-12 space-y-4">
        <span className="text-6xl inline-block animate-bounce">🌿</span>
        <h3 className="text-base font-black text-foreground">Practitioner Not Found</h3>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
          We couldn&apos;t find this healthcare practitioner in our registry database.
        </p>
        <Link href="/discover" className="inline-block mt-2">
          <button className="px-5 py-2.5 bg-herb-green hover:bg-herb-green-light active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer">
            Back to Discover
          </button>
        </Link>
      </div>
    );
  }

  // Filter out slots whose time has already passed (runs live every 60 s)
  const validSlots = slots.filter(slot => {
    const slotTimeStr = slot.timeValue || slot.startTime;
    const slotDateTime = parseSlotDateTime(selectedDate, slotTimeStr);
    if (slotDateTime) {
      return slotDateTime.getTime() > now.getTime();
    }
    // If we can't parse the time, keep the slot visible (safe default)
    return true;
  });


  // Group slots by Morning, Afternoon, Evening
  const groupedSlots: Record<"Morning" | "Afternoon" | "Evening", typeof validSlots> = {
    Morning: [],
    Afternoon: [],
    Evening: [],
  };

  validSlots.forEach((slot) => {
    const period = getPeriod(slot.startTime);
    groupedSlots[period].push(slot);
  });

  const totalSlotsCount = validSlots.length;
  const canBook = selectedSlot !== null;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-8">
      
      {/* ─── BREADCRUMB & METADATA ACTIONS ─── */}
      <div className="flex items-center justify-between gap-4 text-xs font-semibold select-none flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer text-neutral-600 flex items-center justify-center shadow-sm"
            title="Go Home"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="flex items-center gap-2 text-muted-foreground/80">
            <Link href="/discover" className="hover:text-foreground transition-colors">Discover</Link>
            <ChevronRight size={10} className="stroke-[2.5]" />
            <span className="text-foreground font-bold">{doctor.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWishlisted(!wishlisted)}
            className="p-2.5 rounded-xl border border-neutral-200 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            title="Wishlist"
          >
            <Heart size={14} className={cn("transition-colors duration-200", wishlisted ? "fill-red-500 text-red-500" : "text-neutral-500")} />
            <span className="hidden sm:inline text-neutral-600">Save Doctor</span>
          </button>
          
          <button className="p-2.5 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 text-neutral-600">
            <Share2 size={14} />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* ─── PROFILE BODY LAYOUT ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
        
        {/* LEFT COLUMN: HERO DETAILS & TABS */}
        <div className="space-y-6">
          
          {/* Overhauled Doctor Profile Hero Card */}
          <div className="bg-white rounded-3xl border border-neutral-150/70 p-6.5 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden">
            {/* Glowing aura */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-herb-green/5 rounded-full blur-3xl opacity-0 hover:opacity-100 transition-opacity duration-300 -mr-12 -mt-12 pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5 mb-6">
              {/* Profile Image Avatar Grid */}
              <div className="relative flex-shrink-0">
                <div className={cn(
                  "w-22 h-22 rounded-2.5xl bg-gradient-to-br flex items-center justify-center text-white font-extrabold text-2xl font-display shadow-md tracking-wider relative transition-transform duration-300 hover:scale-103",
                  style.gradient
                )}>
                  {doctor.avatar}
                </div>
                
                {/* Live Online status dot indicator */}
                <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 border-3 border-white flex items-center justify-center shadow-md select-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping opacity-75" />
                </span>
              </div>

              {/* Identity details */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h1 className="font-display text-2xl font-black text-foreground tracking-tight leading-none">
                    {doctor.name}
                  </h1>
                  {doctor.isVerified && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-emerald-500/5 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-500/15 shadow-3xs leading-none select-none">
                      <ShieldCheck size={10} className="stroke-[2.5]" />
                      HPR Verified
                    </span>
                  )}
                </div>

                <p className="text-xs font-bold text-herb-green uppercase tracking-widest leading-none">
                  {doctor.specialty}
                </p>

                <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 flex-wrap select-none">
                  <HPRBadge hprId={doctor.hprId} showId className="shadow-3xs bg-herb-green text-white font-extrabold" />
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-4 mt-2.5 text-xs text-muted-foreground font-semibold flex-wrap">
                  <span className="flex items-center gap-1 text-amber-600">
                    <Star size={13} className="fill-amber-500 text-amber-500" />
                    <span className="font-bold text-foreground font-mono">{doctor.rating}</span> 
                    <span className="opacity-75">({doctor.reviews} Patient Reviews)</span>
                  </span>
                  <span className="opacity-40">·</span>
                  <span className="flex items-center gap-1">
                    <Briefcase size={12} className="text-neutral-400" />
                    <span>{doctor.experience} yrs exp</span>
                  </span>
                  <span className="opacity-40">·</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-neutral-400" />
                    <span>MeyVeda Center · {doctor.location || "Online"}</span>
                  </span>
                </div>
              </div>

              {/* Consultation Fee Callout */}
              <div className="hidden lg:flex flex-col items-end gap-1 flex-shrink-0 select-none bg-neutral-50/50 p-4 border border-neutral-150/70 rounded-2xl">
                <p className="text-[10px] text-muted-foreground uppercase font-extrabold tracking-widest">Consultation Fee</p>
                <p className="font-display text-2xl font-black text-foreground tracking-tight mt-1 leading-none font-mono">
                  {formatCurrency(doctor.fee)}
                </p>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded mt-2.5 leading-none">
                  Slots available: {doctor.nextAvailable}
                </span>
              </div>
            </div>

            {/* Redesigned Info Widgets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-6 border-t border-neutral-100 pt-5 select-none">
              {/* Stat 1: Experience */}
              <div className="bg-neutral-50/60 border border-neutral-150/50 rounded-2xl p-3 flex items-center gap-3.5 transition-colors hover:bg-neutral-50">
                <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200/60 flex items-center justify-center text-herb-green shadow-3xs flex-shrink-0">
                  <Award size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-foreground">{doctor.experience} Years</h4>
                  <p className="text-[10px] text-muted-foreground leading-none mt-0.5 font-semibold">Clinical Practice</p>
                </div>
              </div>

              {/* Stat 2: Consultations */}
              <div className="bg-neutral-50/60 border border-neutral-150/50 rounded-2xl p-3 flex items-center gap-3.5 transition-colors hover:bg-neutral-50">
                <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200/60 flex items-center justify-center text-herb-green shadow-3xs flex-shrink-0">
                  <BookOpen size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-foreground">1,280+</h4>
                  <p className="text-[10px] text-muted-foreground leading-none mt-0.5 font-semibold">Successful Consults</p>
                </div>
              </div>

              {/* Stat 3: Languages */}
              <div className="bg-neutral-50/60 border border-neutral-150/50 rounded-2xl p-3 flex items-center gap-3.5 transition-colors hover:bg-neutral-50">
                <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200/60 flex items-center justify-center text-herb-green shadow-3xs flex-shrink-0">
                  <Languages size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-extrabold text-foreground truncate">{doctor.languages.slice(0, 2).join(", ")}</h4>
                  <p className="text-[10px] text-muted-foreground leading-none mt-0.5 font-semibold">Spoken Languages</p>
                </div>
              </div>
            </div>
          </div>

          {/* Redesigned Segmented Control Tabs */}
          <Tabs defaultValue="about">
            <TabsList className="bg-neutral-100/70 p-1.5 rounded-2xl flex gap-1.5 border border-neutral-200/30 w-fit select-none shadow-3xs mb-6">
              <TabsTrigger value="about" className="py-2.5 px-6 text-xs font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-herb-green data-[state=active]:shadow-xs hover:bg-white/20 transition-all cursor-pointer">
                About
              </TabsTrigger>
              <TabsTrigger value="reviews" className="py-2.5 px-6 text-xs font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-herb-green data-[state=active]:shadow-xs hover:bg-white/20 transition-all cursor-pointer">
                Patient Reviews ({reviews.length})
              </TabsTrigger>
              <TabsTrigger value="clinic" className="py-2.5 px-6 text-xs font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-herb-green data-[state=active]:shadow-xs hover:bg-white/20 transition-all cursor-pointer">
                Clinic Location
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: ABOUT */}
            <TabsContent value="about" className="space-y-4 outline-none">
              <div className="bg-white rounded-3xl p-6.5 border border-neutral-150/70 shadow-2xs">
                <h3 className="text-[10px] font-extrabold text-muted-foreground/80 uppercase tracking-widest mb-3.5 flex items-center gap-1.5 select-none">
                  <User size={13} className="text-herb-green" />
                  Professional Summary
                </h3>
                <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed font-semibold">
                  {doctor.about}
                </p>
              </div>
              
              <div className="bg-white rounded-3xl p-6.5 border border-neutral-150/70 shadow-2xs">
                <h3 className="text-[10px] font-extrabold text-muted-foreground/80 uppercase tracking-widest mb-4.5 flex items-center gap-1.5 select-none">
                  <Award size={13} className="text-herb-green" />
                  Credentials & Qualifications
                </h3>
                <div className="flex flex-wrap gap-2 select-none">
                  {doctor.qualifications.map((q) => (
                    <span key={q} className="inline-flex items-center gap-1 text-xs bg-herb-green/5 text-herb-green border border-herb-green/12 px-3 py-2 rounded-xl font-bold shadow-3xs">
                      <Check size={11} className="stroke-[2.5]" />
                      {q}
                    </span>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: REVIEWS */}
            <TabsContent value="reviews" className="space-y-4 outline-none">
              {reviewsLoading ? (
                <div className="text-center text-xs text-muted-foreground py-10 bg-white rounded-3xl border border-neutral-150">
                  <div className="w-6 h-6 rounded-full border-2 border-herb-green border-t-transparent animate-spin mx-auto mb-2" />
                  Loading feedback reviews...
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-12 bg-white rounded-3xl border border-neutral-150 shadow-2xs select-none">
                  ⭐ No patient reviews submitted yet.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Reviews Summary Stats Card */}
                  <div className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 rounded-3xl p-5 border border-amber-500/10 flex items-center gap-5 select-none">
                    <div className="text-center bg-white border border-amber-200/80 rounded-2xl p-4.5 shadow-3xs flex-shrink-0">
                      <h4 className="text-3xl font-black text-amber-600 font-mono tracking-tight">{doctor.rating}</h4>
                      <p className="text-[9px] text-muted-foreground uppercase font-extrabold tracking-wider mt-1">Rating Average</p>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-foreground">Verified Consultation Reviews</h4>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        Feedback is collected from patients who booked and successfully concluded consultations with {doctor.name}.
                      </p>
                    </div>
                  </div>

                  {/* Reviews Cards List */}
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-white rounded-3xl p-5 border border-neutral-150/70 shadow-2xs hover:border-neutral-200 transition-colors">
                      <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-3.5 mb-3.5 select-none flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center font-display text-xs font-extrabold text-neutral-600">
                            {review.patientName[0]}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-foreground">{review.patientName}</span>
                            <p className="text-[9px] text-muted-foreground leading-none mt-0.5">Verified Patient</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {Array.from({ length: review.stars }).map((_, j) => (
                              <Star key={j} size={11} className="fill-amber-500 text-amber-500" />
                            ))}
                          </div>
                          <span className="text-[9px] text-muted-foreground font-bold font-mono">{new Date(review.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-700 leading-relaxed font-semibold">{review.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: CLINIC */}
            <TabsContent value="clinic" className="outline-none">
              <div className="bg-white rounded-3xl p-6.5 border border-neutral-150/70 shadow-2xs space-y-5">
                <div className="flex gap-4 items-start select-none">
                  <div className="w-10 h-10 rounded-xl bg-herb-green/10 flex items-center justify-center text-herb-green shadow-3xs flex-shrink-0">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Primary Consultation Center</h3>
                    <p className="text-sm font-extrabold text-foreground mt-1">{doctor.location || "Online Consultations"}</p>
                    <p className="text-xs text-muted-foreground leading-normal mt-0.5">MeyVeda Wellness Clinics, Sector 4 Block C, Bengaluru</p>
                  </div>
                </div>

                {/* Vector Map Mockup Placeholder Card */}
                <div className="relative h-44 rounded-2xl bg-neutral-50 border border-neutral-200 overflow-hidden flex items-center justify-center shadow-3xs select-none">
                  {/* Mock Map Vector Graphics */}
                  <svg className="absolute inset-0 w-full h-full text-neutral-200/70" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 40H400M0 100H400M0 160H400" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M60 0V200M180 0V200M320 0V200" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M0 0L400 200M400 0L0 200" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center gap-2 bg-white/95 border border-neutral-200 p-3 rounded-2xl shadow-md max-w-[200px] text-center">
                    <MapPin size={16} className="text-red-500 fill-red-500 animate-bounce" />
                    <span className="text-[10px] font-bold text-foreground">Clinic Address Link</span>
                    <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="text-[9px] text-herb-green font-extrabold flex items-center gap-0.5 hover:underline">
                      <span>Google Maps</span>
                      <ExternalLink size={8} />
                    </a>
                  </div>
                </div>

                <div className="bg-indigo-50/50 p-4 border border-indigo-100 text-indigo-900 rounded-2xl text-xs flex gap-2.5 items-start shadow-3xs select-none">
                  <Video size={14} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="font-bold text-[11px]">Telehealth Consultation Available</h5>
                    <p className="text-[10px] leading-normal font-semibold">
                      This doctor also provides HIPAA-compliant encrypted video consultations from the comfort of your home.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT COLUMN: SLOT BOOKING SIDEBAR CARD */}
        <div>
          <div className="bg-white rounded-3xl border border-neutral-150 p-5.5 shadow-2xs top-24 sticky hover:shadow-xs transition-shadow duration-300 space-y-5 select-none">
            <h3 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={13} className="text-herb-green" />
              Select Date & Slot
            </h3>

            {/* Premium Monthly Calendar Component */}
            {datesLoading ? (
              <div className="text-center w-full py-4 text-xs text-muted-foreground">
                <div className="w-5 h-5 rounded-full border-2 border-herb-green border-t-transparent animate-spin mx-auto mb-2" />
                Loading calendar availability...
              </div>
            ) : !rawAvailableDates || rawAvailableDates.length === 0 ? (
              <div className="text-center w-full py-3 text-xs text-muted-foreground">No available booking dates.</div>
            ) : (
              <div className="bg-neutral-50/50 border border-neutral-150 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2 select-none">
                  <span className="text-xs font-bold text-foreground font-display">{monthName}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={prevMonth}
                      className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:scale-90 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                      disabled={currentYear === new Date().getFullYear() && currentMonth === new Date().getMonth()}
                    >
                      <ChevronRight size={12} className="rotate-180" />
                    </button>
                    <button
                      onClick={nextMonth}
                      className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:scale-90 transition-all cursor-pointer"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>

                {/* Days Header */}
                <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-extrabold text-muted-foreground uppercase tracking-widest">
                  <span>M</span>
                  <span>T</span>
                  <span>W</span>
                  <span>T</span>
                  <span>F</span>
                  <span>S</span>
                  <span>S</span>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {calendarDays.map((d, index) => {
                    if (d === null) {
                      return <div key={`empty-${index}`} className="aspect-square" />;
                    }

                    const dateAvailable = rawAvailableDates.includes(d.dateStr);
                    const isSelected = selectedDate === d.dateStr;
                    const isToday = d.dateStr === new Date().toISOString().split("T")[0];

                    return (
                      <button
                        key={d.dateStr}
                        disabled={!dateAvailable}
                        onClick={() => {
                          setSelectedDateState(d.dateStr);
                          setSelectedSlot(null);
                        }}
                        className={cn(
                          "aspect-square flex flex-col items-center justify-center text-xs rounded-xl font-bold transition-all relative cursor-pointer active:scale-90",
                          isSelected
                            ? "bg-herb-green text-white shadow-xs scale-103"
                            : dateAvailable
                            ? "hover:bg-herb-green/10 border border-neutral-200 hover:border-herb-green/30 text-foreground"
                            : "text-muted-foreground/45 cursor-not-allowed opacity-35",
                          isToday && !isSelected && "border-herb-green/30 text-herb-green bg-herb-green/5"
                        )}
                      >
                        <span>{d.day}</span>
                        {dateAvailable && !isSelected && (
                          <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grouped slots block */}
            <div className="space-y-4">
              {/* My booked slot for this date — always shown at the top if exists */}
              {myBookedSlotForThisDate && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                    <Check size={14} className="text-amber-600" strokeWidth={3} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider">Your Booking</p>
                    <p className="text-xs font-bold text-amber-900 mt-0.5">
                      {myBookedSlotForThisDate.date.split(/ · |, /)[1] || myBookedSlotForThisDate.date.split("T")[0]}
                    </p>
                  </div>
                  <span className="text-[10px] bg-amber-400/30 text-amber-800 font-bold px-2 py-1 rounded-lg border border-amber-300/60 flex-shrink-0">
                    ✓ Confirmed
                  </span>
                </div>
              )}

              {slotsLoading ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  <div className="w-5 h-5 rounded-full border-2 border-herb-green border-t-transparent animate-spin mx-auto mb-2" />
                  Loading available slots...
                </div>
              ) : totalSlotsCount === 0 && !myBookedSlotForThisDate ? (
                <div className="text-center text-xs text-amber-600 bg-amber-50 rounded-xl p-4 border border-amber-100 font-semibold leading-relaxed">
                  ⚠️ No open consultation slots found on this date.
                </div>
              ) : totalSlotsCount === 0 && myBookedSlotForThisDate ? (
                <div className="text-center text-xs text-muted-foreground bg-neutral-50 rounded-xl p-3 border border-neutral-200 font-medium">
                  All other slots are filled for this date.
                </div>
              ) : (
                Object.entries(groupedSlots).map(([period, periodSlots]) => {
                  // Extract my booked time string for this period comparison
                  const myBookedTimeStr = myBookedSlotForThisDate
                    ? (myBookedSlotForThisDate.date.split(/ · |, /)[1] || "").trim()
                    : null;
                  const myBookedPeriodForSlot = myBookedTimeStr ? getPeriod(myBookedTimeStr) : null;
                  const showMySlotInThisPeriod = myBookedPeriodForSlot === period && myBookedSlotForThisDate;

                  if (periodSlots.length === 0 && !showMySlotInThisPeriod) return null;
                  
                  const periodIcon = period === "Morning" ? <CloudSun size={15} className="text-blue-900" /> :
                                     period === "Afternoon" ? <Sun size={14} className="text-blue-900" /> :
                                     <Moon size={14} className="text-blue-900" />;

                  return (
                    <div key={period} className="space-y-2">
                      <p className="text-[11px] text-blue-900 font-extrabold uppercase tracking-widest flex items-center gap-1.5 border-b border-neutral-50 pb-1">
                        {periodIcon}
                        <span>{period}</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {/* Render my booked slot in amber within its time period group */}
                        {showMySlotInThisPeriod && myBookedSlotForThisDate && (
                          <div
                            className="text-[11px] px-3 py-1.5 rounded-xl border border-amber-400 bg-amber-400/20 text-amber-800 font-bold shadow-sm flex items-center gap-1 cursor-default select-none"
                            title="You have booked this slot"
                          >
                            <Check size={11} className="text-amber-600" strokeWidth={3} />
                            <span>{myBookedSlotForThisDate.date.split(/ · |, /)[1] || "—"}</span>
                          </div>
                        )}

                        {periodSlots.map((slot) => {
                          const isActiveSlot = selectedSlot?.id === slot.id;
                          const slotModes: ("video" | "clinic")[] = slot.modes || (slot.mode ? [slot.mode] : []);

                          const baseClass = isActiveSlot
                            ? "bg-black text-white border-black font-bold shadow-3xs"
                            : "bg-white hover:bg-neutral-100 border-neutral-300 text-black font-bold";

                          // Build booking URL — pass modes so booking page configures itself
                          const modesParam = slotModes.join(",");
                          const bookingUrl = `/booking?doctor=${doctor.id}&slot=${slot.startTime}&slotId=${slot.id}&date=${selectedDate}&mode=${slotModes[0]}&availableModes=${modesParam}`;

                          return (
                            <Link key={slot.id} href={bookingUrl}>
                              <button
                                onClick={() => setSelectedSlot(slot)}
                                className={cn(
                                  "text-[11px] px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer active:scale-95",
                                  baseClass
                                )}
                              >
                                <span className="flex items-center justify-center font-bold">
                                  {slot.startTime}
                                </span>
                              </button>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Booking action panel */}
            <div className="pt-4 border-t border-neutral-100 select-none">
              <div className="w-full py-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-neutral-100 text-neutral-400 border border-neutral-200/60">
                <span>Select a Time Slot</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
