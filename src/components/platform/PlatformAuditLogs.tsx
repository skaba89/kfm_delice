"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  actorId: string;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string;
  accountId: string | null;
  restaurantId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

const actionLabels: Record<string, string> = {
  platform_login_success: "Connexion platform",
  admin_login_success: "Connexion admin",
  account_create: "Création compte",
  quota_change: "Modification quota",
  account_over_quota: "Quota dépassé",
  restaurant_main_create: "Création restaurant principal",
  restaurant_secondary_create: "Création restaurant secondaire",
};

const actionColors: Record<string, string> = {
  platform_login_success: "border-blue-500/30 text-blue-400 bg-blue-500/10",
  admin_login_success: "border-blue-500/30 text-blue-400 bg-blue-500/10",
  account_create: "border-green-500/30 text-green-400 bg-green-500/10",
  quota_change: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  account_over_quota: "border-red-500/30 text-red-400 bg-red-500/10",
  restaurant_main_create: "border-purple-500/30 text-purple-400 bg-purple-500/10",
  restaurant_secondary_create: "border-purple-500/30 text-purple-400 bg-purple-500/10",
};

const actorTypeColors: Record<string, string> = {
  platform_admin: "border-orange-500/30 text-orange-400",
  admin: "border-blue-500/30 text-blue-400",
  customer: "border-green-500/30 text-green-400",
  driver: "border-purple-500/30 text-purple-400",
};

export function PlatformAuditLogs({ token }: { token: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actorTypeFilter, setActorTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (actorTypeFilter !== "all") params.set("actorType", actorTypeFilter);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/platform/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLogs(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 0);
    } catch {
      toast.error("Erreur lors du chargement des logs");
    } finally {
      setLoading(false);
    }
  }, [token, search, actorTypeFilter, page]);

  useEffect(() => {
    const timer = setTimeout(fetchLogs, 300); // debounce search
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Rechercher dans les logs..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-gray-900 border-white/10 text-white placeholder:text-gray-500 rounded-xl"
          />
        </div>
        <Select
          value={actorTypeFilter}
          onValueChange={(v) => {
            setActorTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44 bg-gray-900 border-white/10 text-white rounded-xl">
            <SelectValue placeholder="Type d'acteur" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-white/10">
            <SelectItem value="all">Tous les acteurs</SelectItem>
            <SelectItem value="platform_admin">Platform Admin</SelectItem>
            <SelectItem value="admin">Admin restaurant</SelectItem>
            <SelectItem value="customer">Client</SelectItem>
            <SelectItem value="driver">Livreur</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={fetchLogs} className="text-gray-400 hover:text-white">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="text-xs text-gray-500">
        {total} entrée(s) trouvée(s) · Page {page} sur {totalPages || 1}
      </div>

      {/* Timeline */}
      <Card className="bg-gray-900 border-white/10">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Chargement...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              Aucun log trouvé
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={`text-xs ${actionColors[log.action] || "border-gray-500/30 text-gray-400"}`}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                        <Badge variant="outline" className={`text-xs capitalize ${actorTypeColors[log.actorType] || "border-gray-500/30 text-gray-400"}`}>
                          {log.actorType.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">
                        <span className="text-gray-500">Entité:</span>{" "}
                        <span className="text-white">{log.entityType}</span> ·{" "}
                        <code className="text-xs text-gray-400">{log.entityId.slice(-12)}</code>
                      </p>
                      {log.ipAddress && (
                        <p className="text-xs text-gray-500 mt-1">
                          IP: {log.ipAddress}
                          {log.userAgent && ` · ${log.userAgent.slice(0, 50)}...`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="bg-gray-900 border-white/10 text-gray-400 hover:text-white"
          >
            Précédent
          </Button>
          <span className="text-sm text-gray-400">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="bg-gray-900 border-white/10 text-gray-400 hover:text-white"
          >
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}
