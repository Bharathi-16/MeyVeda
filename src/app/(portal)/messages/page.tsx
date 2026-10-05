"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatInboxShell, type ChatThread, type ChatMessage } from "@/components/chat/ChatInboxShell";
import { uploadChatAttachment } from "@/lib/chat-attachments";
import type { PatientInboxThread, MessageRow } from "./type";
import { setNavContext } from "@/lib/nav-context-client";
import { useRealtimeSignal, useRealtimeTopics } from "@/hooks/use-realtime-signal";

// New messages arrive instantly via Realtime; polling is only a safety net.
const INBOX_POLL_MS = 60000;
const THREAD_POLL_MS = 60000;

async function fetchInbox(): Promise<PatientInboxThread[]> {
  const response = await fetch("/api/patient-inbox", { method: "GET", credentials: "include", cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Unable to load messages");
  }
  return result.data as PatientInboxThread[];
}

async function fetchMessages(consultationId: string): Promise<MessageRow[]> {
  const response = await fetch(`/api/message?consultationId=${consultationId}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Unable to load messages");
  }
  return result.data as MessageRow[];
}

async function sendMessage(
  consultationId: string,
  content: string,
  attachment?: { path: string; name: string; type: string; size: number },
  replyToId?: string | null
): Promise<void> {
  const response = await fetch("/api/message", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consultationId, content, attachment, replyToId }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Unable to send message");
  }
}

export default function MessagesPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<PatientInboxThread[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const activeThread = threads.find((t) => t.id === activeId) ?? null;

  const loadInbox = useCallback(async () => {
    try {
      const data = await fetchInbox();
      setThreads(data);
    } catch (err) {
      console.error("Failed to load messages inbox:", err);
    } finally {
      setInboxLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
    const interval = setInterval(loadInbox, INBOX_POLL_MS);
    return () => clearInterval(interval);
  }, [loadInbox]);

  const loadMessages = useCallback(async (consultationId: string) => {
    try {
      const data = await fetchMessages(consultationId);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }, []);

  useEffect(() => {
    if (!activeThread?.consultationId) {
      setMessages([]);
      return;
    }
    void loadMessages(activeThread.consultationId);
    const interval = setInterval(() => loadMessages(activeThread.consultationId), THREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [activeThread?.consultationId, loadMessages]);

  const activeConsultationRef = useRef<string | null>(null);
  activeConsultationRef.current = activeThread?.consultationId ?? null;

  const { inbox: inboxTopic } = useRealtimeTopics();
  useRealtimeSignal(
    inboxTopic,
    useCallback(() => {
      void loadInbox();
      if (activeConsultationRef.current) void loadMessages(activeConsultationRef.current);
    }, [loadInbox, loadMessages])
  );

  async function handleSend(e: React.FormEvent, file: File | null, replyToId: string | null): Promise<boolean> {
    e.preventDefault();
    if ((!inputText.trim() && !file) || !activeThread || sending) return false;
    const content = inputText.trim();
    setSendError(null);
    setSending(true);
    try {
      const attachment = file ? await uploadChatAttachment(activeThread.consultationId, file) : undefined;
      await sendMessage(activeThread.consultationId, content, attachment, replyToId);
      setInputText("");
      await loadMessages(activeThread.consultationId);
      await loadInbox();
      return true;
    } catch (err) {
      console.error("Failed to send message:", err);
      setSendError(err instanceof Error ? err.message : "Failed to send message");
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleViewDoctor() {
    if (!activeThread) return;
    await setNavContext("doctor", { doctorId: activeThread.practitionerId });
    router.push("/doctor");
  }

  const chatThreads: ChatThread[] = threads.map((t) => ({
    id: t.id,
    name: t.doctorName,
    initials: t.doctorInitials,
    lastMessage: t.lastMessage,
    lastMessageTime: t.lastMessageTime,
    unread: t.unread,
    unreadCount: t.unreadCount,
  }));

  const chatMessages: ChatMessage[] = messages.map((m) => ({
    id: m.id,
    content: m.content,
    sentAt: m.sentAt,
    attachment: m.attachment,
    isRead: m.isRead,
    senderName: m.direction === "patient_to_doctor" ? "You" : activeThread?.doctorName,
    replyTo: m.replyTo
      ? {
          senderName: m.replyTo.direction === "patient_to_doctor" ? "You" : activeThread?.doctorName ?? "Message",
          content: m.replyTo.content,
        }
      : null,
    isMine: m.direction === "patient_to_doctor",
  }));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5">
      <ChatInboxShell
        title="Messages"
        subtitle="Bounded messaging · ABDM compliant"
        threads={chatThreads}
        threadsLoading={inboxLoading}
        emptyThreadsTitle="No conversations yet"
        emptyThreadsSubtitle="Once you complete a consultation, you can chat with your doctor here."
        activeId={activeId}
        onSelectThread={(id) => setActiveId(id || null)}
        messages={chatMessages}
        inputValue={inputText}
        onInputChange={setInputText}
        onSend={handleSend}
        errorMessage={sendError}
        enableReply
        sending={sending}
        headerActionLabel="View Doctor"
        onHeaderAction={handleViewDoctor}
        composerHint="Visible to your doctor in their practitioner portal"
        statusLine="Encrypted · ABDM compliant"
      />
    </div>
  );
}
