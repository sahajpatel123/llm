"use client";

import { useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  email: string;
  plan?: string | null;
  status?: string | null;
};

type Thread = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

type AuthMode = "login" | "signup";

type ApiError = {
  ok: false;
  error: string;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [mode, setMode] = useState<"exploration" | "verified">("exploration");
  const [uiError, setUiError] = useState<string | null>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  async function loadMe() {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = (await res.json()) as { authenticated: boolean; user?: User };
    if (data.authenticated && data.user) {
      setUser(data.user);
      return data.user;
    }
    setUser(null);
    return null;
  }

  async function loadThreads() {
    const res = await fetch("/api/threads", { credentials: "include" });
    if (res.status === 401) {
      setUser(null);
      setThreads([]);
      return;
    }
    const data = (await res.json()) as { ok: boolean; threads?: Thread[] } | ApiError;
    if ("threads" in data && Array.isArray(data.threads)) {
      setThreads(data.threads);
    }
  }

  async function loadMessages(threadId: string) {
    setMessagesLoading(true);
    const res = await fetch(`/api/threads/${threadId}/messages`, { credentials: "include" });
    if (res.status === 401) {
      setMessages([]);
      setAuthOpen(true);
      setMessagesLoading(false);
      return;
    }
    const data = (await res.json()) as { ok: boolean; messages?: Message[] } | ApiError;
    if ("messages" in data && Array.isArray(data.messages)) {
      setMessages(data.messages);
    }
    setMessagesLoading(false);
  }

  async function handleAuthSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: authEmail, password: authPassword }),
    });

    const data = (await res.json()) as { ok: boolean; user?: User; error?: string };
    if (!res.ok) {
      setAuthError(data.error ?? "Something went wrong");
      setAuthLoading(false);
      return;
    }

    setUser(data.user ?? null);
    setAuthOpen(false);
    setAuthEmail("");
    setAuthPassword("");
    setAuthLoading(false);
    await loadThreads();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setThreads([]);
    setSelectedThreadId(null);
    setMessages([]);
  }

  async function handleNewChat() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setUiError(null);
    const res = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });

    if (res.status === 401) {
      setAuthOpen(true);
      return;
    }

    const data = (await res.json()) as { ok: boolean; thread?: Thread } | ApiError;
    if ("thread" in data && data.thread) {
      setThreads((prev) => [data.thread as Thread, ...prev]);
      setSelectedThreadId(data.thread.id);
      setMessages([]);
    }
  }

  async function handleThreadSelect(threadId: string) {
    setSelectedThreadId(threadId);
    await loadMessages(threadId);
  }

  async function handleThreadDelete(threadId: string) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const confirmed = window.confirm("Delete this chat?");
    if (!confirmed) return;

    const res = await fetch(`/api/threads/${threadId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (res.status === 401) {
      setAuthOpen(true);
      return;
    }

    setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
    if (selectedThreadId === threadId) {
      setSelectedThreadId(null);
      setMessages([]);
    }
  }

  async function handleSend() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!selectedThreadId) {
      setUiError("Select or create a chat first.");
      return;
    }
    const content = messageInput.trim();
    if (!content) return;

    setUiError(null);

    const res = await fetch(`/api/threads/${selectedThreadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    });

    if (res.status === 401) {
      setAuthOpen(true);
      return;
    }

    const data = (await res.json()) as { ok: boolean; message?: Message } | ApiError;
    if ("message" in data && data.message) {
      setMessages((prev) => [...prev, data.message as Message]);
      setMessageInput("");
      await loadThreads();
    } else if ("error" in data) {
      setUiError("Message failed to send.");
    }
  }

  useEffect(() => {
    loadMe().then((activeUser) => {
      if (activeUser) {
        loadThreads();
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedThreadId) return;
    loadMessages(selectedThreadId);
  }, [selectedThreadId]);

  return (
    <div className="flex h-screen bg-white text-black">
      <aside
        className={classNames(
          sidebarOpen ? "block" : "hidden",
          "sm:block w-[280px] border-r border-gray-200 bg-white",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold">
            History
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-3 text-sm">
            {!user ? (
              <div className="px-2 text-gray-600">
                <button
                  type="button"
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                  onClick={() => setAuthOpen(true)}
                >
                  Sign in
                </button>
              </div>
            ) : threads.length === 0 ? (
              <div className="px-2 text-gray-500">No chats yet</div>
            ) : (
              <ul className="space-y-1">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <div
                      className={classNames(
                        "flex items-center justify-between rounded border border-transparent px-2 py-2",
                        selectedThreadId === thread.id
                          ? "border-gray-300 bg-gray-50"
                          : "hover:bg-gray-50",
                      )}
                    >
                      <button
                        type="button"
                        className="flex-1 text-left text-xs"
                        onClick={() => handleThreadSelect(thread.id)}
                      >
                        {thread.title}
                      </button>
                      <button
                        type="button"
                        className="ml-2 text-[10px] text-gray-500"
                        onClick={() => handleThreadDelete(thread.id)}
                        aria-label="Delete chat"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {user ? (
            <div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-600">
              <div className="truncate">{user.email}</div>
              <button
                type="button"
                className="mt-2 rounded border border-gray-300 px-2 py-1 text-[10px]"
                onClick={handleLogout}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="relative flex-1">
        <div className="flex items-start justify-between px-4 py-3">
          <button
            type="button"
            className="sm:hidden rounded border border-gray-300 px-2 py-1 text-xs"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle history"
          >
            Menu
          </button>
          <div className="ml-auto">
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              onClick={handleNewChat}
            >
              New chat
            </button>
          </div>
        </div>

        <div className="px-6 pb-28 pt-6 text-sm">
          {!selectedThread ? (
            <div className="text-gray-500">Start a chat...</div>
          ) : messagesLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="text-gray-500">No messages yet.</div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="rounded border border-gray-200 px-3 py-2">
                  <div className="text-xs text-gray-500">
                    {message.role === "user" ? "You" : message.role}
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-black">
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          )}
          {uiError ? <div className="mt-4 text-xs text-red-600">{uiError}</div> : null}
        </div>

        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex w-full flex-1 items-center gap-2">
              <textarea
                rows={2}
                placeholder="Type a message"
                className="w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm outline-none"
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded border border-gray-300 p-1 text-xs">
                <button
                  type="button"
                  className={classNames(
                    "rounded px-2 py-1",
                    mode === "exploration" ? "bg-black text-white" : "text-black",
                  )}
                  onClick={() => setMode("exploration")}
                >
                  Exploration
                </button>
                <button
                  type="button"
                  className={classNames(
                    "rounded px-2 py-1",
                    mode === "verified" ? "bg-black text-white" : "text-black",
                  )}
                  onClick={() => setMode("verified")}
                >
                  Verified
                </button>
              </div>
              <button
                type="button"
                className={classNames(
                  "rounded border border-gray-300 px-3 py-2 text-sm",
                  !messageInput.trim() || !selectedThreadId ? "text-gray-400" : "text-black",
                )}
                disabled={!messageInput.trim() || !selectedThreadId}
                onClick={handleSend}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </main>

      {authOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/90 px-4">
          <div className="w-full max-w-sm rounded border border-gray-300 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Sign in</div>
              <button
                type="button"
                className="text-xs text-gray-500"
                onClick={() => setAuthOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-3 flex gap-2 text-xs">
              <button
                type="button"
                className={classNames(
                  "rounded border px-2 py-1",
                  authMode === "login" ? "border-black" : "border-gray-300",
                )}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={classNames(
                  "rounded border px-2 py-1",
                  authMode === "signup" ? "border-black" : "border-gray-300",
                )}
                onClick={() => setAuthMode("signup")}
              >
                Sign up
              </button>
            </div>
            <form className="mt-4 space-y-3" onSubmit={handleAuthSubmit}>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Email</label>
                <input
                  type="email"
                  className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Password</label>
                <input
                  type="password"
                  className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  required
                />
              </div>
              {authError ? <div className="text-xs text-red-600">{authError}</div> : null}
              <button
                type="submit"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                disabled={authLoading}
              >
                {authMode === "login" ? "Login" : "Sign up"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
