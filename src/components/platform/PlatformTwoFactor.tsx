"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, ShieldCheck, ShieldAlert, Copy, Check, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function PlatformTwoFactor({ token }: { token: string }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  // Check 2FA status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/platform/2fa/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled);
      }
    } catch {
      // Status endpoint may not exist yet — default to disabled
    }
  };

  return (
    <Card className="bg-gray-900 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="w-5 h-5 text-green-500" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-orange-500" />
          )}
          Authentification à deux facteurs (2FA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-300">
              {enabled
                ? "2FA activée — votre compte est protégé"
                : "2FA désactivée — activez-la pour sécuriser votre compte"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Utilise Google Authenticator, Authy ou toute app TOTP
            </p>
          </div>
          <Button
            onClick={() => (enabled ? setShowDisable(true) : setShowSetup(true))}
            className={
              enabled
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-gradient-to-r from-orange-500 to-red-600 text-white"
            }
          >
            {enabled ? "Désactiver" : "Activer 2FA"}
          </Button>
        </div>
      </CardContent>

      <SetupDialog
        open={showSetup}
        onClose={() => setShowSetup(false)}
        token={token}
        onSuccess={() => {
          setEnabled(true);
          setShowSetup(false);
        }}
      />
      <DisableDialog
        open={showDisable}
        onClose={() => setShowDisable(false)}
        token={token}
        onSuccess={() => {
          setEnabled(false);
          setShowDisable(false);
        }}
      />
    </Card>
  );
}

// ── Setup Dialog ───────────────────────────────────────────────
function SetupDialog({
  open,
  onClose,
  token,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"qr" | "verify" | "backup">("qr");
  const [secret, setSecret] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/2fa/setup", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }
      setSecret(data.secret);
      setQrCode(data.qrCode);
      setStep("verify");
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ secret, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Code invalide");
        return;
      }
      setBackupCodes(data.backupCodes || []);
      setStep("backup");
      toast.success("2FA activée !");
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            Configuration 2FA
          </DialogTitle>
        </DialogHeader>

        {step === "qr" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Scannez ce QR code avec votre app d'authentification (Google Authenticator, Authy, etc.)
            </p>
            <Button
              onClick={startSetup}
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
              Générer le QR code
            </Button>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4">
            {qrCode && (
              <div className="flex justify-center bg-white p-4 rounded-xl">
                <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48" />
              </div>
            )}
            <div>
              <Label className="text-gray-300">Clé secrète (si scan impossible)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={secret}
                  readOnly
                  className="bg-gray-800 border-white/10 text-white text-xs font-mono"
                />
                <Button size="icon" variant="outline" onClick={copySecret} className="border-white/10">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-gray-300">Code à 6 chiffres</Label>
              <Input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="bg-gray-800 border-white/10 text-white text-center text-2xl tracking-widest mt-1"
              />
            </div>
            <Button
              onClick={verifyCode}
              disabled={loading || code.length !== 6}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Vérifier et activer
            </Button>
          </div>
        )}

        {step === "backup" && (
          <div className="space-y-4">
            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg flex gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-sm text-orange-400 font-medium">Conservez ces codes en lieu sûr !</p>
                <p className="text-xs text-gray-400 mt-1">
                  Si vous perdez votre téléphone, utilisez un code de secours pour vous connecter.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((c, i) => (
                <div
                  key={i}
                  className="p-2 bg-gray-800 rounded-lg text-center font-mono text-sm text-white"
                >
                  {c}
                </div>
              ))}
            </div>
            <Button
              onClick={onSuccess}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white"
            >
              <Check className="w-4 h-4 mr-2" /> J'ai sauvegardé mes codes
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Disable Dialog ─────────────────────────────────────────────
function DisableDialog({
  open,
  onClose,
  token,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDisable = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Code invalide");
        return;
      }
      toast.success("2FA désactivée");
      setCode("");
      onSuccess();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            Désactiver 2FA
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Entrez un code TOTP ou un code de secours pour confirmer.
          </p>
          <div>
            <Label className="text-gray-300">Code</Label>
            <Input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456 ou code de secours"
              className="bg-gray-800 border-white/10 text-white mt-1"
            />
          </div>
          <Button
            onClick={handleDisable}
            disabled={loading || !code}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
            Désactiver 2FA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
