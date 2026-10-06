"use client";

import { SITE_NAME } from "@/shared/config/site";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatInboxShell, type ChatThread, type ChatMessage } from "@/components/chat/ChatInboxShell";
import { uploadChatAttachment } from "@/lib/chat-attachments";
import type { InboxThread, MessageRow } from "./type";
import { setNavContext } from "@/lib/nav-context-client";
import { useRealtimeSignal, useRealtimeTopics } from "@/hooks/use-realtime-signal";

// New messages arrive instantly via Realtime; polling is only a safety net.
const INBOX_POLL_MS = 60000;
const THREAD_POLL_MS = 60000;

async function fetchInbox(): Promise<InboxThread[]> {
  const response = await fetch("/api/pro-inbox", { method: "GET", credentials: "include", cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Unable to load inbox");
  }
  return result.data as InboxThread[];
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

export default function InboxPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const loadInbox = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchInbox();
      setThreads(data);
    } catch (err) {
      console.error("Failed to load inbox:", err);
    } finally {
      setInboxLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
    const interval = setInterval(loadInbox, INBOX_POLL_MS);
    return () => clearInterval(interval);
  }, [loadInbox]);

  const activeThread = threads.find((t) => t.id === activeId) ?? null;

  const loadMessages = useCallback(async (consultationId: string): Promise<void> => {
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
    if ((!message.trim() && !file) || !activeThread || sending) return false;
    const content = message.trim();
    setSendError(null);
    setSending(true);
    try {
      const attachment = file ? await uploadChatAttachment(activeThread.consultationId, file) : undefined;
      await sendMessage(activeThread.consultationId, content, attachment, replyToId);
      setMessage("");
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

  async function handleViewIntake() {
    if (!activeThread) return;
    await setNavContext("patient", { patientId: activeThread.patientId });
    router.push("/pro/patient");
  }

  const chatThreads: ChatThread[] = threads.map((t) => ({
    id: t.id,
    name: t.patientName,
    initials: t.patientInitials,
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
    senderName: m.direction === "doctor_to_patient" ? "You" : activeThread?.patientName,
    replyTo: m.replyTo
      ? {
          senderName: m.replyTo.direction === "doctor_to_patient" ? "You" : activeThread?.patientName ?? "Message",
          content: m.replyTo.content,
        }
      : null,
    isMine: m.direction === "doctor_to_patient",
  }));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5">
      <ChatInboxShell
        title="Inbox"
        subtitle="Bounded messaging · ABDM compliant"
        threads={chatThreads}
        threadsLoading={inboxLoading}
        emptyThreadsTitle="No conversations yet"
        emptyThreadsSubtitle="Secure post-consultation chat channels will appear here once you initiate messages or patients consult you."
        activeId={activeId}
        onSelectThread={(id) => setActiveId(id || null)}
        messages={chatMessages}
        inputValue={message}
        onInputChange={setMessage}
        onSend={handleSend}
        errorMessage={sendError}
        enableReply
        sending={sending}
        headerActionLabel="View Intake"
        onHeaderAction={handleViewIntake}
        composerHint={`Visible to patient in their ${SITE_NAME} app`}
        statusLine="Active patient · Bounded channel · Encrypted"
      />
    </div>
  );
}
