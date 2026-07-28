"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
  attachmentName?: string | null;
  attachmentKind?: "pdf" | "text" | "image" | "audio" | null;
  pending?: boolean;
  created_at?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
export default function ChatClient({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0); // recording timer
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Group user messages for the sidebar by date
  const getGroupLabel = (dateString?: string) => {
    if (!dateString) return "Today";
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays <= 7) return "Previous 7 Days";
    return "Older";
  };

  const historyGroups = messages
    .filter((m) => m.role === "user")
    .reduce((groups, m) => {
      const label = getGroupLabel(m.created_at);
      if (!groups[label]) groups[label] = [];
      groups[label].push(m);
      return groups;
    }, {} as Record<string, ChatMessage[]>);

  const scrollToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setIsSidebarOpen(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setIsSidebarOpen(false);
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getAttachmentKind = (file: File | null): ChatMessage["attachmentKind"] => {
    if (!file) return null;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
    if (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) return "text";
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("audio/")) return "audio";
    return null;
  };

  const renderAttachmentCard = (message: ChatMessage) => {
    const kind =
      message.attachmentKind ??
      (message.image_url?.startsWith("data:application/pdf")
        ? "pdf"
        : message.image_url?.startsWith("data:text/plain")
        ? "text"
        : message.image_url?.startsWith("data:audio")
        ? "audio"
        : message.image_url?.startsWith("data:image")
        ? "image"
        : null);

    if (kind !== "pdf" && kind !== "text") return null;

    const title =
      message.attachmentName ??
      (kind === "pdf" ? "uploaded.pdf" : kind === "text" ? "uploaded.txt" : "attachment");

    const label = kind === "text" ? "TXT" : kind.toUpperCase();
    const downloadable = kind === "pdf" || kind === "text";

    return (
      <div className="mb-2 flex items-center gap-3 rounded-2xl border border-[var(--color-grid)] bg-[var(--color-paper)] px-3 py-2 text-[var(--color-ink)]">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-ink)] text-[var(--color-paper)]">
          {kind === "pdf" ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          ) : kind === "text" ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="8" y1="13" x2="16" y2="13"></line>
              <line x1="8" y1="17" x2="16" y2="17"></line>
            </svg>
          ) : kind === "audio" ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"></path>
              <path d="M19 12a7 7 0 0 1-14 0"></path>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">{label}</p>
        </div>

        {downloadable && message.image_url && (
          <a
            href={message.image_url}
            download={title}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full border border-[var(--color-grid)] px-3 py-1 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-paper-card)]"
          >
            Open
          </a>
        )}
      </div>
    );
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDownload = (text: string) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SSC-Tutor-Answer-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `SSC-Tutor-Diagram-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      // Fallback if fetch fails (e.g. CORS)
      const a = document.createElement("a");
      a.href = url;
      a.download = `SSC-Tutor-Diagram-${Date.now()}.png`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleEdit = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const handleRetry = async (text: string) => {
    if (isSending) return;

    const tempId = `temp-${crypto.randomUUID()}`;

    // Add the user message again to the bottom
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: text,
        attachmentName: null,
        attachmentKind: null,
        created_at: new Date().toISOString(),
      },
    ]);

    const formData = new FormData();
    formData.append("message", text);

    setIsSending(true);

    try {
      const res = await fetch("/api/chat", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: `${tempId}-err`, role: "assistant", content: data.error ?? "Something went wrong. Try again." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `${tempId}-resp`, role: "assistant", content: data.text, image_url: data.imageUrl },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `${tempId}-err`, role: "assistant", content: "Couldn't reach the server. Check your connection and try again." },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    fetch("/api/messages")
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) setMessages(data.messages);
      })
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
      alert("PDF files are no longer supported as chat attachments. Please upload an image, text file, or audio clip.");
      e.target.value = "";
      setAttachedFile(null);
      return;
    }
    setAttachedFile(file ?? null);
  }

  async function toggleRecording() {
    // --- STOP ---
    if (isRecording) {
      mediaRecorderRef.current?.stop(); // triggers ondataavailable → onstop
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
      setRecordingSeconds(0);
      return;
    }

    // --- START ---
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        alert("Microphone access was denied. Please allow it in your browser settings.");
      } else {
        alert(`Could not access the microphone: ${err?.message ?? err}`);
      }
      return;
    }

    const mimeType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());

      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";
      const audioFile = new File([audioBlob], `voice-question.${ext}`, { type: mimeType || "audio/webm" });

      setIsTranscribing(true);

      const formData = new FormData();
      formData.append("audio", audioFile);

      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.transcript) {
          setInput((prev) => (prev ? prev + " " + data.transcript : data.transcript));
        } else {
          alert(data.error || "Failed to transcribe audio.");
        }
      } catch (err) {
        alert("Transcription failed. Check your connection.");
      } finally {
        setIsTranscribing(false);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250);
    setIsRecording(true);
    setRecordingSeconds(0);

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() && !attachedFile) return;

    const tempId = `temp-${crypto.randomUUID()}`;
    const localImagePreview =
      attachedFile && (attachedFile.type.startsWith("image/") || attachedFile.type.startsWith("audio/"))
        ? URL.createObjectURL(attachedFile)
        : null;
    const attachmentKind = getAttachmentKind(attachedFile);

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: input || `Attached: ${attachedFile?.name}`,
        image_url: localImagePreview,
        attachmentName: attachedFile?.name ?? null,
        attachmentKind,
        created_at: new Date().toISOString(),
      },
    ]);

    const formData = new FormData();
    formData.append("message", input);
    if (attachedFile) formData.append("file", attachedFile);

    setInput("");
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: `${tempId}-err`, role: "assistant", content: data.error ?? "Something went wrong. Try again." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `${tempId}-resp`, role: "assistant", content: data.text, image_url: data.imageUrl },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `${tempId}-err`, role: "assistant", content: "Couldn't reach the server. Check your connection and try again." },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden grid-paper">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[var(--color-paper-card)] border-r border-[var(--color-grid)] transform transition-transform duration-300 ease-in-out flex flex-col lg:translate-x-0 lg:static lg:z-30 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-[var(--color-grid)] flex items-center justify-between lg:hidden">
          <span className="font-semibold text-sm">Chat History</span>
          <button onClick={() => setIsSidebarOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-lg">
            ✕
          </button>
        </div>
        <div className="p-4 border-b border-[var(--color-grid)] hidden lg:block">
          <span className="font-semibold text-sm">Chat History</span>
        </div>
        <div className="p-4 border-b border-[var(--color-grid)]">
          <button
            onClick={startNewChat}
            className="w-full py-2 px-4 rounded-md bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-semibold hover:bg-[var(--color-chalkboard)] transition flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {Object.entries(historyGroups).map(([label, msgs]) => (
            <div key={label}>
              <h3 className="text-[10px] font-bold text-[var(--color-muted)] mb-2 uppercase tracking-wider">{label}</h3>
              <ul className="space-y-1">
                {msgs.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => scrollToMessage(m.id)}
                      className="w-full text-left text-sm truncate px-2 py-1.5 rounded-md hover:bg-[var(--color-paper)] text-[var(--color-ink)] transition-colors"
                      title={m.content}
                    >
                      {m.content}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {Object.keys(historyGroups).length === 0 && !loadingHistory && (
            <p className="text-xs text-[var(--color-muted)]">No previous questions yet.</p>
          )}
        </div>
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative">
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 md:px-8 py-4 border-b border-[var(--color-grid)] bg-[var(--color-paper-card)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1 -ml-1 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors lg:hidden"
              title="Open chat history"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <Link href="/" className="font-display text-base">
              SSC-Tutor
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--color-muted)] hidden sm:inline">{displayName}</span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium px-3 py-1.5 rounded-md border border-[var(--color-grid)] hover:bg-[var(--color-paper)] transition"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-0">
          <div className="max-w-2xl mx-auto py-8 space-y-6">
            {loadingHistory && (
              <p className="text-sm text-[var(--color-muted)] text-center">Loading your chat history…</p>
            )}

            {!loadingHistory && messages.length === 0 && (
              <div className="margin-rule">
                <p className="font-accent text-lg text-[var(--color-beaker-ink)]">
                  Ask your first question —
                </p>
                <p className="text-sm text-[var(--color-muted)] mt-1">
                  Try something like &ldquo;explain the difference between a chemical and physical change&rdquo;
                  or &ldquo;solve x² − 5x + 6 = 0&rdquo;.
                </p>
              </div>
            )}

            {messages.map((m, index) => {
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const showDivider = !prevMessage || 
                new Date(m.created_at || new Date()).toDateString() !== new Date(prevMessage.created_at || new Date()).toDateString();

              const formatDateDivider = (dateStr?: string) => {
                if (!dateStr) return "Today";
                const date = new Date(dateStr);
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
                if (diffDays === 0) return "Today";
                if (diffDays === 1) return "Yesterday";
                return date.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });
              };

              return (
                <div key={m.id}>
                  {showDivider && (
                    <div className="flex items-center justify-center my-6">
                      <div className="border-t border-[var(--color-grid)] flex-grow max-w-[80px]"></div>
                      <span className="mx-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                        {formatDateDivider(m.created_at)}
                      </span>
                      <div className="border-t border-[var(--color-grid)] flex-grow max-w-[80px]"></div>
                    </div>
                  )}
                  <div
                    id={`msg-${m.id}`}
                    className={`flex flex-col mb-4 ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--color-ink)] text-[var(--color-paper)] px-4 py-3"
                      : "max-w-[85%] rounded-2xl rounded-tl-sm bg-[var(--color-paper-card)] border border-[var(--color-grid)] px-4 py-3 margin-rule"
                  }
                >
                  {m.role === "user" ? renderAttachmentCard(m) : null}
                  {m.image_url && m.image_url.startsWith('data:audio') ? (
                    // Audio preview for uploaded audio files
                    <audio controls src={m.image_url} className="rounded-lg mb-2 max-w-full max-h-72 object-contain" />
                  ) : (
                    // Image preview for uploaded images
                    m.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.image_url}
                        alt={m.role === "user" ? "Your attached file" : "Generated diagram"}
                        className="rounded-lg mb-2 max-w-full max-h-72 object-contain"
                      />
                    )
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>

                {m.role === "user" && (
                  <div className="flex items-center gap-3 mt-1.5 mr-1 text-[var(--color-muted)]">
                    <span className="text-xs">{formatTime(m.created_at)}</span>

                    <button onClick={() => handleRetry(m.content)} title="Retry" className="hover:text-[var(--color-ink)] transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2v6h-6"></path>
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                      </svg>
                    </button>

                    <button onClick={() => handleEdit(m.content)} title="Edit" className="hover:text-[var(--color-ink)] transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    </button>

                    <button onClick={() => handleCopy(m.content)} title="Copy" className="hover:text-[var(--color-ink)] transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                )}

                {m.role === "assistant" && (
                  <div className="flex items-center gap-3 mt-1.5 ml-1 text-[var(--color-muted)]">
                    <button onClick={() => handleCopy(m.content)} title="Copy" className="hover:text-[var(--color-ink)] transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <button onClick={() => handleDownload(m.content)} title="Download" className="hover:text-[var(--color-ink)] transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </button>

                    {m.image_url && (
                      <button onClick={() => handleDownloadImage(m.image_url!)} title="Download Image" className="hover:text-[var(--color-ink)] transition-colors flex items-center gap-1 ml-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        <span className="text-xs">Download Image</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-[var(--color-paper-card)] border border-[var(--color-grid)] px-4 py-3 text-sm text-[var(--color-muted)]">
                  Thinking through the syllabus…
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <form
          id="chat-form"
          onSubmit={handleSend}
          className="border-t border-[var(--color-grid)] bg-[var(--color-paper-card)] px-4 md:px-0 py-4"
        >
          <div className="max-w-2xl mx-auto">
            {attachedFile && (
              <div className="flex items-center gap-2 mb-2 text-xs text-[var(--color-muted)]">
                <span className="px-2 py-1 rounded bg-[var(--color-paper)] border border-[var(--color-grid)]">
                  {attachedFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAttachedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-[var(--color-margin)]"
                >
                  remove
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,.txt,text/plain,audio/*"
                onChange={handleFilePick}
                className="hidden"
                id="file-upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach an image, text file, or audio clip"
                className="shrink-0 w-10 h-10 rounded-full border border-[var(--color-grid)] flex items-center justify-center hover:bg-[var(--color-paper)] transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.44 11.05 12 20.5a6 6 0 0 1-8.49-8.49l9.45-9.44a4 4 0 1 1 5.66 5.66L9.17 17.68a2 2 0 0 1-2.83-2.83l8.38-8.38"></path>
                </svg>
              </button>

              <button
                type="button"
                onClick={toggleRecording}
                title={isRecording ? `Stop recording (${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")})` : "Record a voice question"}
                className={`shrink-0 h-10 rounded-full border flex items-center justify-center gap-1.5 transition px-3 ${
                  isRecording
                    ? "border-red-500 bg-red-500 text-white animate-pulse min-w-[4rem]"
                    : "border-[var(--color-grid)] hover:bg-[var(--color-paper)] w-10"
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"></path>
                  <path d="M19 12a7 7 0 0 1-14 0"></path>
                  <path d="M12 19v3"></path>
                  <path d="M8 22h8"></path>
                </svg>
                {isRecording && (
                  <span className="text-xs font-mono tabular-nums">
                    {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}
                  </span>
                )}
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                disabled={isRecording || isTranscribing}
                placeholder={isRecording ? "🎤 Recording… click 🎤 again to stop" : isTranscribing ? "⏳ Transcribing..." : "Ask a Science or Math question…"}
                rows={1}
                className={`flex-1 resize-none rounded-2xl border px-4 py-2.5 text-sm outline-none max-h-32 transition-colors ${
                  isRecording
                    ? "border-red-400 bg-red-50 text-red-400 cursor-not-allowed"
                    : isTranscribing
                    ? "border-[var(--color-margin)] bg-gray-50 text-gray-400 cursor-wait"
                    : "border-[var(--color-grid)] focus:border-[var(--color-beaker)]"
                }`}
              />

              <button
                type="submit"
                disabled={isSending || (!input.trim() && !attachedFile)}
                className="shrink-0 px-5 py-2.5 rounded-2xl bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-semibold disabled:opacity-40 hover:bg-[var(--color-chalkboard)] transition"
              >
                Send
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
