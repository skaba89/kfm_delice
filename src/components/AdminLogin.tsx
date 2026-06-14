"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Eye, EyeOff, AlertCircle, RefreshCw, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/lib/notifications";

export function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const { loginAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsSeed, setNeedsSeed] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Check if database needs seeding
  useEffect(() => {
    fetch("/api/seed")
      .then(r => r.json())
      .then(data => {
        if (data.needsSeed) setNeedsSeed(true);
      })
      .catch(() => {});
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setNeedsSeed(false);
        notify.success("Base initialisée avec succès !");
      } else {
        setError("Erreur lors de l'initialisation : " + (data.error || "Erreur inconnue"));
      }
    } catch {
      setError("Impossible de joindre le serveur pour l'initialisation");
    } finally {
      setSeeding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // If 401, check if DB needs seeding
        if (res.status === 401) {
          const seedCheck = await fetch("/api/seed").then(r => r.json()).catch(() => ({ needsSeed: false }));
          if (seedCheck.needsSeed) {
            setNeedsSeed(true);
            setError("La base de données est vide. Cliquez sur 'Initialiser' ci-dessous.");
            return;
          }
        }
        setError(data.error || "Email ou mot de passe incorrect");
        return;
      }
      const data = await res.json();
      loginAdmin({ token: data.token, id: data.id, email: data.email, name: data.name, role: data.role });
      notify.loginSuccess(data.name);
      // Use a small delay to ensure React state is updated before navigation
      // This prevents the ProtectedRoute from showing a spinner
      setTimeout(() => onLogin(), 100);
    } catch { setError("Erreur de connexion au serveur"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-4">
      <div className="absolute top-20 right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-red-500/10 rounded-full blur-3xl" />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md relative">
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
                <LayoutDashboard className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Admin KFM Delice</h1>
              <p className="text-gray-400 text-sm mt-1">Accédez au tableau de bord</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Email</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 rounded-xl" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Mot de passe</label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 rounded-xl pr-10" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl py-6">
                {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : "Se Connecter"}
              </Button>
            </form>
            {needsSeed && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p className="text-yellow-400 text-sm mb-3">La base de données est vide. Initialisez-la pour créer les comptes par défaut.</p>
                <Button onClick={handleSeed} disabled={seeding} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl" variant="default">
                  {seeding ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
                  {seeding ? "Initialisation en cours..." : "Initialiser la base de données"}
                </Button>
              </div>
            )}
            <div className="mt-6 p-3 bg-white/5 rounded-xl border border-white/10">
              <p className="text-xs text-gray-400 text-center">Identifiants : <span className="text-orange-400">admin@kfm-delice.com</span> / <span className="text-orange-400">kfm2024</span></p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
