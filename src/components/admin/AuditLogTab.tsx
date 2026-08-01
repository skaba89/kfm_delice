"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Search, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Pagination } from "@/components/Pagination";

interface AuditLogEntry {
  id: string;
  actorId: string;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string;
  before: string | null;
  after: string | null;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

const actionColors: Record<string, string> = {
  table_create: "bg-green-100 text-green-700",
  table_update: "bg-blue-100 text-blue-700",
  table_delete: "bg-red-100 text-red-700",
  table_qr_rotate: "bg-orange-100 text-orange-700",
  promocode_create: "bg-green-100 text-green-700",
  promocode_update: "bg-blue-100 text-blue-700",
  promocode_delete: "bg-red-100 text-red-700",
  order_create: "bg-green-100 text-green-700",
  table_order_create: "bg-green-100 text-green-700",
  table_qr_scan_invalid: "bg-red-100 text-red-700",
};

export function AuditLogTab() {
  const { apiFetch } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  const load = async (p: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (search) params.set("action", search);
      const res = await apiFetch(`/api/audit-logs?${params}`);
      if (res.ok) {
        const d = await res.json();
        setLogs(d.data || []);
        setTotalPages(d.pagination?.totalPages || 1);
        setTotal(d.pagination?.total || 0);
        setPage(p);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-orange-500" />
          Journal d'audit
          <Badge className="bg-gray-100 text-gray-600">{total} entrées</Badge>
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder="Filtrer par action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            className="w-48 dark:bg-gray-800 dark:border-gray-600"
          />
          <Button variant="outline" size="sm" onClick={() => load(page)}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
        </div>
      </div>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Aucune entrée d'audit</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge className={actionColors[log.action] || "bg-gray-100 text-gray-600"}>
                            {log.action}
                          </Badge>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {log.entityType} · {log.entityId.slice(-8).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">{log.actorType}</span> · {log.actorId.slice(-8).toUpperCase()}
                          {log.ipAddress && ` · IP: ${log.ipAddress}`}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">{formatTime(log.createdAt)}</p>
                      </div>
                      {(log.before || log.after) && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-orange-500 hover:text-orange-600">
                            Détails
                          </summary>
                          <div className="mt-2 space-y-1 max-w-md">
                            {log.before && (
                              <div>
                                <span className="text-red-500 font-bold">Avant:</span>
                                <pre className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-[10px] overflow-x-auto">
                                  {(() => { try { return JSON.stringify(JSON.parse(log.before), null, 2); } catch { return log.before; } })()}
                                </pre>
                              </div>
                            )}
                            {log.after && (
                              <div>
                                <span className="text-green-500 font-bold">Après:</span>
                                <pre className="bg-green-50 dark:bg-green-900/20 p-2 rounded text-[10px] overflow-x-auto">
                                  {(() => { try { return JSON.stringify(JSON.parse(log.after), null, 2); } catch { return log.after; } })()}
                                </pre>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={20}
          onPageChange={(p) => load(p)}
        />
      )}
    </div>
  );
}
