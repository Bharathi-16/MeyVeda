"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { InboxThread, MessageRow } from "./type";
import { setNavContext } from "@/lib/nav-context-client";

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

async function sendMessage(consultationId: string, content: string): Promise<void> {
  const response = await fetch("/api/message", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consultationId, content }),
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

  async function loadInbox(): Promise<void> {
    try {
      setInboxLoading(true);
      const data = await fetchInbox();
      setThreads(data);
    } catch (err) {
      console.error("Failed to load inbox:", err);
    } finally {
      setInboxLoading(false);
    }
  }

  useEffect(() => {
    void loadInbox();
  }, []);

  // Default selection when threads load
  useEffect(() => {
    if (threads.length > 0 && !activeId) {
      setActiveId(threads[0].id);
    }
  }, [threads, activeId]);

  const activeThread = threads.find((t) => t.id === activeId) ?? (threads.length > 0 ? threads[0] : null);

  // Load messages for selected thread
  useEffect(() => {
    if (!activeThread?.consultationId) {
      setMessages([]);
      return;
    }
    fetchMessages(activeThread.consultationId)
      .then(setMessages)
      .catch((err) => console.error("Failed to load messages:", err));
  }, [activeThread?.consultationId]);

  async function handleSendMessage() {
    if (!message.trim() || !activeThread) return;
    try {
      await sendMessage(activeThread.consultationId, message.trim());
      setMessage("");
      const updated = await fetchMessages(activeThread.consultationId);
      setMessages(updated);
      await loadInbox();
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  }

  const totalUnread = threads.filter(t => t.unread).length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
      <div className="mb-5 flex items-center gap-3">
        <h1 className="font-display text-xl font-semibold text-foreground">Inbox</h1>
        {totalUnread > 0 && (
          <span className="w-5 h-5 rounded-full bg-herb-green text-white text-[10px] font-bold flex items-center justify-center">
            {totalUnread}
          </span>
        )}
        <p className="text-sm text-muted-foreground">· Bounded messaging · ABDM compliant</p>
      </div>

      {inboxLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-herb-green border-t-transparent animate-spin" />
        </div>
      ) : threads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-border p-12 text-center max-w-md mx-auto my-12">
          <span className="text-4xl">💬</span>
          <h2 className="font-semibold text-foreground mt-3">No conversations yet</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Secure post-consultation chat channels will appear here once you initiate messages or patients consult you.
          </p>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "280px 1fr", height: "calc(100vh - 14rem)" }}
        >
          {/* Thread list */}
          <div className="bg-white rounded-2xl border border-border overflow-y-auto flex flex-col">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setActiveId(thread.id)}
                className={cn(
                  "flex items-start gap-3 p-4 border-b border-border last:border-0 text-left transition-all",
                  activeThread?.id === thread.id ? "bg-herb-green/5" : "hover:bg-muted/50"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-sage text-xs">{thread.patientInitials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={cn("text-sm truncate", thread.unread ? "font-bold text-foreground" : "font-semibold text-foreground")}>
                      {thread.patientName}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      {thread.unread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-herb-green flex-shrink-0" />
                      )}
                      <span className="text-[10px] text-muted-foreground">{thread.lastMessageTime}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{thread.lastMessage}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Active thread */}
          {activeThread && (
            <div className="bg-white rounded-2xl border border-border flex flex-col overflow-hidden">
              {/* Thread header */}
              <div className="px-5 py-4 border-b border-border flex items-center gap-3 flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-sage text-xs">{activeThread.patientInitials}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{activeThread.patientName}</p>
                  <p className="text-[10px] text-muted-foreground">Active patient · Bounded channel · Encrypted</p>
                </div>
                <button
                  onClick={async () => {
                    await setNavContext("patient", { patientId: activeThread.patientId });
                    router.push("/pro/patient");
                  }}
                  className="text-xs text-herb-green font-medium hover:underline"
                >
                  View Intake
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="text-center py-2">
                  <span className="text-[10px] text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                    Messages are end-to-end encrypted and ABDM-compliant
                  </span>
                </div>
                {messages.map((msg, i) => {
                  const isDoctor = msg.direction === "doctor_to_patient";
                  return (
                    <div key={i} className={cn("flex", isDoctor ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[72%] rounded-2xl px-4 py-2.5",
                          isDoctor
                            ? "bg-herb-green text-white rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        )}
                      >
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <p className={cn("text-[10px] mt-1", isDoctor ? "text-white/60" : "text-muted-foreground")}>
                          {msg.sentAt}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Composer */}
              <div className="px-4 py-3 border-t border-border flex-shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                    className="flex-1 text-sm border border-border rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-herb-green/50 placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                    className="px-4 py-2.5 bg-herb-green text-white rounded-xl text-sm font-medium hover:bg-herb-green/90 transition-colors disabled:opacity-40 flex-shrink-0"
                  >
                    Send
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Visible to patient in their MeyVeda app · No attachments in beta
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
