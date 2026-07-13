"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/lib/notifications";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: string;
}

// Role-based colors for message bubbles
const roleColors: Record<string, string> = {
  admin: "bg-orange-500",
  manager: "bg-blue-500",
  staff: "bg-green-500",
  cashier: "bg-purple-500",
  kitchen: "bg-red-500",
  delivery_manager: "bg-cyan-500",
  host: "bg-pink-500",
  accountant: "bg-indigo-500",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
  cashier: "Caissier",
  kitchen: "Cuisine",
  delivery_manager: "Resp. Livraison",
  host: "Hôte",
  accountant: "Comptable",
};

export function ChatTab() {
  const { admin, apiFetch } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/chat?limit=50");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          setMessages(data.data);
        }
      }
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Poll every 5s for new messages (same pattern as kitchen dashboard)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        load();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [load]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      });
      if (res.ok) {
        setNewMessage("");
        await load(); // refresh immediately
      } else {
        const data = await res.json().catch(() => ({}));
        notify.error(data.error || "Erreur d'envoi");
      }
    } catch {
      notify.error("Erreur réseau");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Chat interne
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({messages.length} messages)
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </div>

      {/* Chat container */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-0">
          {/* Messages */}
          <div className="h-[500px] overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50 rounded-t-xl">
            {loading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Aucun message pour le moment</p>
                <p className="text-xs">Soyez le premier à écrire dans le chat !</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === admin?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        isMe
                          ? "bg-orange-500 text-white rounded-br-sm"
                          : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      {!isMe && (
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${roleColors[msg.senderRole] || "bg-gray-400"}`}
                          />
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {msg.senderName}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {roleLabels[msg.senderRole] || msg.senderRole}
                          </span>
                        </div>
                      )}
                      <p className={`text-sm whitespace-pre-wrap break-words ${isMe ? "text-white" : "text-gray-800 dark:text-gray-200"}`}>
                        {msg.content}
                      </p>
                      <p className={`text-[10px] mt-1 ${isMe ? "text-white/70" : "text-gray-400"}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-xl">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Écrivez votre message..."
              maxLength={1000}
              disabled={sending}
              className="flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
            <Button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-400">
          <strong>Chat interne —</strong> Messages visibles par tous les utilisateurs
          du restaurant. Les messages sont stockés en base et synchronisés toutes les 5 secondes.
          Maximum 1000 caractères par message.
        </p>
      </div>
    </div>
  );
}
