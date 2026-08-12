"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeDollarSign,
  CalendarClock,
  MailWarning,
  RefreshCw,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface OverdueAccount {
  accountId: string;
  accountName: string;
  plan: string | null;
  accountStatus: string | null;
  invoiceCount: number;
  outstanding: number;
  oldestDueAt: string | null;
}

interface DunningIssue {
  id: string;
  accountId: string;
  accountName: string;
  ownerEmail: string;
  invoiceId: string;
  invoiceNumber: string;
  stage: string;
  recipient: string;
  status: string;
  provider: string;
  errorMessage: string;
  attemptedAt: string | null;
  updatedAt: string;
}

interface BillingOperationsSnapshot {
  generatedAt: string;
  runRate: {
    mrr: number;
    arr: number;
    activeSubscriptions: number;
    pastDueSubscriptions: number;
    trialingSubscriptions: number;
    pausedSubscriptions: number;
    totalSubscriptions: number;
  };
  receivables: {
    outstanding: number;
    openInvoiceCount: number;
    overdueAccountCount: number;
    topOverdueAccounts: OverdueAccount[];
  };
  collection: {
    collected30d: number;
    paymentCount30d: number;
    invoiced90d: number;
    collectedAgainstInvoices90d: number;
    invoiceCount90d: number;
    collectionRate90dPct: number | null;
  };
  operations: {
    accessEnforcementEnabled: boolean;
    dunningEnabled: boolean;
    emailProvider: "resend" | "smtp" | "console";
    emailDeliveryConfigured: boolean;
    dunningIssuesCount: number;
    dunningSent30d: number;
    recentDunningIssues: DunningIssue[];
  };
}

function formatGnf(value: number | null | undefined) {
  return `${new Intl.NumberFormat("fr-FR").format(value || 0)} GNF`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("fr-FR");
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof TrendingUp;
}) {
  return (
    <Card className="bg-gray-900 border-white/10">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-2 text-xl font-bold text-white">{value}</p>
            <p className="mt-1 text-xs text-gray-500">{detail}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-2.5 text-orange-400">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StateBadge({ active, activeLabel, inactiveLabel }: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <Badge
      variant="outline"
      className={active
        ? "border-green-500/30 bg-green-500/10 text-green-300"
        : "border-amber-500/30 bg-amber-500/10 text-amber-300"}
    >
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}

export function PlatformBillingOperations({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<BillingOperationsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/platform/billing/overview", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Impossible de charger le pilotage financier");
      setSnapshot(body);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de pilotage financier");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading && !snapshot) {
    return (
      <Card className="bg-gray-900 border-white/10">
        <CardContent className="p-8 text-center text-gray-500">
          <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Chargement du pilotage financier...
        </CardContent>
      </Card>
    );
  }

  if (!snapshot) return null;

  const collectionRate = snapshot.collection.collectionRate90dPct === null
    ? "—"
    : `${snapshot.collection.collectionRate90dPct.toFixed(2)} %`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Pilotage financier SaaS</h2>
          <p className="text-sm text-gray-500">
            Run-rate, recouvrement et santé opérationnelle · actualisé le {new Date(snapshot.generatedAt).toLocaleString("fr-FR")}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="text-gray-400 hover:text-white">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="MRR normalisé"
          value={formatGnf(snapshot.runRate.mrr)}
          detail={`${snapshot.runRate.activeSubscriptions} actifs · ${snapshot.runRate.pastDueSubscriptions} past_due`}
          icon={TrendingUp}
        />
        <MetricCard
          label="ARR normalisé"
          value={formatGnf(snapshot.runRate.arr)}
          detail={`${snapshot.runRate.totalSubscriptions} abonnements au total`}
          icon={BadgeDollarSign}
        />
        <MetricCard
          label="Encours"
          value={formatGnf(snapshot.receivables.outstanding)}
          detail={`${snapshot.receivables.openInvoiceCount} factures ouvertes/overdue`}
          icon={WalletCards}
        />
        <MetricCard
          label="Comptes overdue"
          value={String(snapshot.receivables.overdueAccountCount)}
          detail="Comptes avec au moins une facture overdue"
          icon={AlertTriangle}
        />
        <MetricCard
          label="Encaissé 30 jours"
          value={formatGnf(snapshot.collection.collected30d)}
          detail={`${snapshot.collection.paymentCount30d} paiements confirmés`}
          icon={Activity}
        />
        <MetricCard
          label="Recouvrement 90 jours"
          value={collectionRate}
          detail={`${snapshot.collection.invoiceCount90d} factures émises sur la période`}
          icon={CalendarClock}
        />
      </div>

      <Card className="bg-gray-900 border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-white mr-2">État opérationnel</span>
            <StateBadge
              active={snapshot.operations.dunningEnabled}
              activeLabel="Relances activées"
              inactiveLabel="Relances désactivées"
            />
            <StateBadge
              active={snapshot.operations.emailDeliveryConfigured}
              activeLabel={`Email ${snapshot.operations.emailProvider} opérationnel`}
              inactiveLabel="Provider email réel non configuré"
            />
            <StateBadge
              active={snapshot.operations.accessEnforcementEnabled}
              activeLabel="Recouvrement appliqué aux accès"
              inactiveLabel="Coupure pour impayé désactivée"
            />
            <Badge variant="outline" className="border-white/10 text-gray-300">
              {snapshot.operations.dunningSent30d} relances envoyées / 30j
            </Badge>
            {snapshot.operations.dunningIssuesCount > 0 && (
              <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-300">
                {snapshot.operations.dunningIssuesCount} relances à traiter
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="bg-gray-900 border-white/10">
          <CardContent className="p-0">
            <div className="border-b border-white/10 p-4">
              <h3 className="font-semibold text-white">Comptes à risque</h3>
              <p className="text-xs text-gray-500">Top encours sur factures overdue</p>
            </div>
            {snapshot.receivables.topOverdueAccounts.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">Aucun compte overdue.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {snapshot.receivables.topOverdueAccounts.map((account) => (
                  <div key={account.accountId} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{account.accountName}</p>
                      <p className="text-xs text-gray-500">
                        {account.invoiceCount} facture(s) · plus ancienne échéance {formatDate(account.oldestDueAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-orange-300">{formatGnf(account.outstanding)}</p>
                      <p className="text-xs text-gray-500">{account.plan || "plan inconnu"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-white/10">
          <CardContent className="p-0">
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center gap-2">
                <MailWarning className="h-4 w-4 text-orange-400" />
                <h3 className="font-semibold text-white">Relances à traiter</h3>
              </div>
              <p className="text-xs text-gray-500">Échecs ou configuration email incomplète</p>
            </div>
            {snapshot.operations.recentDunningIssues.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">Aucune anomalie de relance.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {snapshot.operations.recentDunningIssues.map((issue) => (
                  <div key={issue.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{issue.accountName}</p>
                        <p className="text-xs text-gray-500">
                          {issue.invoiceNumber} · {issue.stage.replaceAll("_", " ")}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-red-500/30 text-red-300">
                        {issue.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-2 break-words text-xs text-gray-400">
                      {issue.errorMessage || "Aucun détail disponible"}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-600">
                      {issue.recipient || issue.ownerEmail || "email absent"} · {issue.provider || "provider inconnu"} · {formatDate(issue.updatedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
