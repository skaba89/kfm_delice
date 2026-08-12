"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, FilePlus2, RefreshCw, ReceiptText, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PlatformAccountSummary {
  id: string;
  name: string;
  plan: string;
  status: string;
}

interface BillingSubscription {
  id: string;
  plan: string;
  billingCycle: string;
  status: string;
  currency: string;
  unitAmount: number;
  nextBillingAt?: string | null;
  provider: string;
}

interface BillingPayment {
  id: string;
  amount: number;
  method: string;
  provider: string;
  status: string;
  paidAt?: string | null;
}

interface BillingInvoice {
  id: string;
  number: string;
  total: number;
  amountPaid: number;
  status: string;
  dueAt: string;
  createdAt: string;
  payments: BillingPayment[];
}

interface BillingSnapshot {
  account: PlatformAccountSummary;
  subscription: BillingSubscription | null;
  invoices: BillingInvoice[];
  metrics: {
    outstanding: number;
    overdueCount: number;
    totalCollected: number;
  };
}

function formatGnf(value: number | undefined | null) {
  return `${new Intl.NumberFormat("fr-FR").format(value || 0)} GNF`;
}

function toIsoEndOfDay(date: string) {
  return date ? `${date}T23:59:59.000Z` : "";
}

export function PlatformBilling({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<PlatformAccountSummary[]>([]);
  const [accountId, setAccountId] = useState("");
  const [snapshot, setSnapshot] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [issuingInvoice, setIssuingInvoice] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [subscriptionStatus, setSubscriptionStatus] = useState("active");
  const [customAmount, setCustomAmount] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [paymentMethods, setPaymentMethods] = useState<Record<string, string>>({});
  const [payingInvoiceId, setPayingInvoiceId] = useState("");

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) || null,
    [accounts, accountId],
  );

  const fetchAccounts = useCallback(async () => {
    const response = await fetch("/api/platform/accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Impossible de charger les comptes");
    const items: PlatformAccountSummary[] = body.data || [];
    setAccounts(items);
    setAccountId((current) => current || items[0]?.id || "");
  }, [token]);

  const fetchBilling = useCallback(async (id: string) => {
    if (!id) {
      setSnapshot(null);
      return;
    }
    const response = await fetch(`/api/platform/accounts/${id}/billing`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Impossible de charger la facturation");
    setSnapshot(body);
    if (body.subscription) {
      setBillingCycle(body.subscription.billingCycle === "annual" ? "annual" : "monthly");
      setSubscriptionStatus(body.subscription.status || "active");
      if (body.account?.plan === "custom") setCustomAmount(String(body.subscription.unitAmount || ""));
    } else {
      setBillingCycle("monthly");
      setSubscriptionStatus(body.account?.status === "trial" ? "trialing" : "active");
      setCustomAmount("");
    }
  }, [token]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetchAccounts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [fetchAccounts]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetchBilling(accountId)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Erreur de facturation"))
      .finally(() => setLoading(false));
  }, [accountId, fetchBilling]);

  const saveSubscription = async () => {
    if (!accountId || !selectedAccount) return;
    if (selectedAccount.plan === "custom" && !customAmount.trim()) {
      toast.error("Le plan custom exige un montant contractuel explicite.");
      return;
    }
    setSavingSubscription(true);
    try {
      const payload: Record<string, unknown> = {
        billingCycle,
        status: subscriptionStatus,
      };
      if (selectedAccount.plan === "custom") payload.customUnitAmount = customAmount.trim();
      const response = await fetch(`/api/platform/accounts/${accountId}/billing/subscription`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer l’abonnement");
      toast.success("Abonnement de facturation enregistré");
      await fetchBilling(accountId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur d’enregistrement");
    } finally {
      setSavingSubscription(false);
    }
  };

  const issueInvoice = async () => {
    if (!accountId || !invoiceDueDate) {
      toast.error("Renseignez la date d’échéance de la facture.");
      return;
    }
    setIssuingInvoice(true);
    try {
      const response = await fetch(`/api/platform/accounts/${accountId}/billing/invoices`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dueAt: toIsoEndOfDay(invoiceDueDate),
          idempotencyKey: `invoice-${accountId}-${crypto.randomUUID()}`,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Impossible d’émettre la facture");
      toast.success(body.replay ? `Facture ${body.number} déjà créée` : `Facture ${body.number} créée`);
      setInvoiceDueDate("");
      await fetchBilling(accountId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de facturation");
    } finally {
      setIssuingInvoice(false);
    }
  };

  const recordPayment = async (invoice: BillingInvoice) => {
    const amount = paymentAmounts[invoice.id]?.trim() || "";
    if (!amount || Number(amount) <= 0) {
      toast.error("Renseignez un montant de paiement positif.");
      return;
    }
    setPayingInvoiceId(invoice.id);
    try {
      const response = await fetch(`/api/platform/accounts/${accountId}/billing/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount,
          method: paymentMethods[invoice.id] || "bank_transfer",
          provider: "manual",
          idempotencyKey: `platform-${invoice.id}-${crypto.randomUUID()}`,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer le paiement");
      toast.success(body.replay ? "Paiement déjà enregistré" : "Paiement enregistré");
      setPaymentAmounts((current) => ({ ...current, [invoice.id]: "" }));
      await fetchBilling(accountId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur d’encaissement");
    } finally {
      setPayingInvoiceId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-72 flex-1">
          <Label className="text-gray-300">Compte à facturer</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="mt-1 bg-gray-900 border-white/10 text-white rounded-xl">
              <SelectValue placeholder="Sélectionner un compte" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-white/10">
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} · {account.plan}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => accountId && fetchBilling(accountId)} className="border-white/10 text-gray-300">
          <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
        </Button>
      </div>

      {loading ? (
        <Card className="bg-gray-900 border-white/10"><CardContent className="p-8 text-center text-gray-500"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />Chargement...</CardContent></Card>
      ) : !selectedAccount ? (
        <Card className="bg-gray-900 border-white/10"><CardContent className="p-8 text-center text-gray-500">Aucun compte disponible.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gray-900 border-white/10"><CardContent className="p-5"><p className="text-xs uppercase text-gray-500">Encours</p><p className="text-2xl font-bold text-white mt-1">{formatGnf(snapshot?.metrics.outstanding)}</p></CardContent></Card>
            <Card className="bg-gray-900 border-white/10"><CardContent className="p-5"><p className="text-xs uppercase text-gray-500">Factures échues</p><p className="text-2xl font-bold text-white mt-1">{snapshot?.metrics.overdueCount || 0}</p></CardContent></Card>
            <Card className="bg-gray-900 border-white/10"><CardContent className="p-5"><p className="text-xs uppercase text-gray-500">Total encaissé</p><p className="text-2xl font-bold text-white mt-1">{formatGnf(snapshot?.metrics.totalCollected)}</p></CardContent></Card>
          </div>

          <Card className="bg-gray-900 border-white/10">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="font-semibold text-white">Abonnement SaaS</p><p className="text-xs text-gray-500">Le plan commercial vient du compte. Aucun prélèvement automatique n’est activé par cet écran.</p></div>
                <Badge variant="outline" className="capitalize border-orange-500/30 text-orange-400">{selectedAccount.plan}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div><Label className="text-gray-300">Cycle</Label><Select value={billingCycle} onValueChange={(value) => setBillingCycle(value as "monthly" | "annual")}><SelectTrigger className="mt-1 bg-gray-800 border-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-gray-900 border-white/10"><SelectItem value="monthly">Mensuel</SelectItem><SelectItem value="annual">Annuel</SelectItem></SelectContent></Select></div>
                <div><Label className="text-gray-300">Statut billing</Label><Select value={subscriptionStatus} onValueChange={setSubscriptionStatus}><SelectTrigger className="mt-1 bg-gray-800 border-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-gray-900 border-white/10"><SelectItem value="trialing">Essai</SelectItem><SelectItem value="active">Actif</SelectItem><SelectItem value="past_due">Impayé</SelectItem><SelectItem value="paused">En pause</SelectItem><SelectItem value="cancelled">Annulé</SelectItem></SelectContent></Select></div>
                {selectedAccount.plan === "custom" && <div><Label className="text-gray-300">Montant contractuel GNF</Label><Input inputMode="numeric" value={customAmount} onChange={(event) => setCustomAmount(event.target.value.replace(/\D/g, ""))} className="mt-1 bg-gray-800 border-white/10 text-white" /></div>}
                <div className="flex items-end"><Button onClick={saveSubscription} disabled={savingSubscription} className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white">{savingSubscription ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}Enregistrer</Button></div>
              </div>
              {snapshot?.subscription && <div className="text-sm text-gray-400 flex flex-wrap gap-x-6 gap-y-1"><span>Montant du cycle : <strong className="text-white">{formatGnf(snapshot.subscription.unitAmount)}</strong></span><span>Provider : <strong className="text-white">{snapshot.subscription.provider}</strong></span><span>Statut : <strong className="text-white">{snapshot.subscription.status}</strong></span></div>}
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-white/10">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2"><FilePlus2 className="w-5 h-5 text-orange-400" /><div><p className="font-semibold text-white">Émettre une facture</p><p className="text-xs text-gray-500">Le montant est copié depuis l’abonnement stocké côté serveur.</p></div></div>
              <div className="flex flex-wrap items-end gap-3"><div><Label className="text-gray-300">Date d’échéance</Label><Input type="date" value={invoiceDueDate} onChange={(event) => setInvoiceDueDate(event.target.value)} className="mt-1 bg-gray-800 border-white/10 text-white" /></div><Button onClick={issueInvoice} disabled={issuingInvoice || !snapshot?.subscription} className="bg-white text-gray-950 hover:bg-gray-200">{issuingInvoice ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ReceiptText className="w-4 h-4 mr-2" />}Créer la facture</Button></div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-white/10">
            <CardContent className="p-0">
              <div className="p-5 border-b border-white/10"><div className="flex items-center gap-2"><WalletCards className="w-5 h-5 text-orange-400" /><p className="font-semibold text-white">Factures et encaissements</p></div></div>
              {!snapshot?.invoices.length ? <div className="p-8 text-center text-gray-500">Aucune facture SaaS.</div> : <div className="divide-y divide-white/5">{snapshot.invoices.map((invoice) => {
                const remaining = Math.max(0, invoice.total - invoice.amountPaid);
                const payable = invoice.status !== "paid" && invoice.status !== "void" && remaining > 0;
                return <div key={invoice.id} className="p-5 space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-white">{invoice.number}</p><p className="text-xs text-gray-500">Échéance {new Date(invoice.dueAt).toLocaleDateString("fr-FR")} · créée {new Date(invoice.createdAt).toLocaleDateString("fr-FR")}</p></div><div className="text-right"><Badge variant="outline" className="capitalize border-white/10 text-gray-300">{invoice.status}</Badge><p className="text-sm text-white mt-1">{formatGnf(invoice.amountPaid)} / {formatGnf(invoice.total)}</p><p className="text-xs text-gray-500">Reste {formatGnf(remaining)}</p></div></div>{payable && <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-2 items-end"><div><Label className="text-xs text-gray-400">Montant encaissé</Label><Input inputMode="numeric" value={paymentAmounts[invoice.id] || ""} onChange={(event) => setPaymentAmounts((current) => ({ ...current, [invoice.id]: event.target.value.replace(/\D/g, "" ) }))} className="mt-1 bg-gray-800 border-white/10 text-white" placeholder={String(remaining)} /></div><div><Label className="text-xs text-gray-400">Méthode</Label><Select value={paymentMethods[invoice.id] || "bank_transfer"} onValueChange={(value) => setPaymentMethods((current) => ({ ...current, [invoice.id]: value }))}><SelectTrigger className="mt-1 bg-gray-800 border-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-gray-900 border-white/10"><SelectItem value="bank_transfer">Virement</SelectItem><SelectItem value="cash">Espèces</SelectItem><SelectItem value="mobile_money">Mobile Money</SelectItem><SelectItem value="card">Carte (preuve externe)</SelectItem><SelectItem value="external">Autre externe</SelectItem></SelectContent></Select></div><Button onClick={() => recordPayment(invoice)} disabled={payingInvoiceId === invoice.id} className="bg-green-600 hover:bg-green-700 text-white">{payingInvoiceId === invoice.id ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}Enregistrer paiement</Button></div>}</div>;
              })}</div>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
