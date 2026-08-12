"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, LogOut, RefreshCw, UtensilsCrossed, ScrollText, LayoutDashboard, Lock, Building2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PlatformAccounts } from "@/components/platform/PlatformAccounts";
import { PlatformRestaurants } from "@/components/platform/PlatformRestaurants";
import { PlatformAuditLogs } from "@/components/platform/PlatformAuditLogs";
import { PlatformOverview } from "@/components/platform/PlatformOverview";
import { PlatformTwoFactor } from "@/components/platform/PlatformTwoFactor";
import { PlatformBilling } from "@/components/platform/PlatformBilling";

interface PlatformUser {
  id: string;
  email: string;
  name: string;
  role: string;
  token: string;
}

export default function PlatformPage() {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("platform_token");
      const storedUser = localStorage.getItem("platform_user");
      if (stored && storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch {}
    setLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const body = twoFactorRequired
        ? { tempToken, twoFactorCode }
        : { email: loginForm.email, password: loginForm.password };
      const res = await fetch("/api/platform-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Identifiants incorrects");
        return;
      }
      if (data.requiresTwoFactor) {
        setTempToken(data.tempToken);
        setTwoFactorRequired(true);
        setLoginError("");
        return;
      }
      localStorage.setItem("platform_token", data.token);
      localStorage.setItem("platform_user", JSON.stringify(data));
      setUser(data);
      toast.success(`Bienvenue, ${data.name}`);
    } catch {
      setLoginError("Erreur de connexion au serveur");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("platform_token");
    localStorage.removeItem("platform_user");
    setUser(null);
    toast.info("Déconnecté");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black flex items-center justify-center p-4">
        <div className="absolute top-20 right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-red-500/10 rounded-full blur-3xl" />
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md relative">
          <Card className="bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">Platform Admin</h1>
                <p className="text-gray-400 text-sm mt-1">KFM Delice SaaS — Super Admin</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{loginError}</div>
                )}
                {twoFactorRequired ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 text-center">Entrez le code à 6 chiffres de votre app d'authentification</p>
                    <input type="text" value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 text-center text-2xl tracking-widest" placeholder="123456" maxLength={6} required autoFocus />
                    <button type="submit" disabled={loginLoading || twoFactorCode.length !== 6} className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50">{loginLoading ? "Vérification..." : "Vérifier le code"}</button>
                    <button type="button" onClick={() => { setTwoFactorRequired(false); setTempToken(""); setTwoFactorCode(""); }} className="w-full text-sm text-gray-500 hover:text-gray-700">← Retour</button>
                  </div>
                ) : (
                  <>
                    <input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500" placeholder="Email administrateur plateforme" required />
                    <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500" placeholder="Mot de passe" required />
                    <button type="submit" disabled={loginLoading} className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50">{loginLoading ? "Connexion..." : "Se connecter"}</button>
                  </>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">KFM Delice Platform</h1>
              <p className="text-xs text-gray-400">{user.name} · {user.role === "super_admin" ? "Super Admin" : "Support"}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-white hover:bg-white/5">
            <LogOut className="w-4 h-4 mr-2" /> Déconnexion
          </Button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-gray-900 border border-white/10 p-1 rounded-xl flex flex-wrap">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white text-gray-400 rounded-lg">
              <LayoutDashboard className="w-4 h-4 mr-2" /> Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="accounts" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white text-gray-400 rounded-lg">
              <Building2 className="w-4 h-4 mr-2" /> Comptes
            </TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white text-gray-400 rounded-lg">
              <CreditCard className="w-4 h-4 mr-2" /> Facturation
            </TabsTrigger>
            <TabsTrigger value="restaurants" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white text-gray-400 rounded-lg">
              <UtensilsCrossed className="w-4 h-4 mr-2" /> Restaurants
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white text-gray-400 rounded-lg">
              <ScrollText className="w-4 h-4 mr-2" /> Audit
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white text-gray-400 rounded-lg">
              <Lock className="w-4 h-4 mr-2" /> Sécurité
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <PlatformOverview token={user.token} />
          </TabsContent>
          <TabsContent value="accounts">
            <PlatformAccounts token={user.token} />
          </TabsContent>
          <TabsContent value="billing">
            <PlatformBilling token={user.token} />
          </TabsContent>
          <TabsContent value="restaurants">
            <PlatformRestaurants token={user.token} />
          </TabsContent>
          <TabsContent value="audit">
            <PlatformAuditLogs token={user.token} />
          </TabsContent>
          <TabsContent value="security">
            <div className="max-w-2xl">
              <PlatformTwoFactor token={user.token} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
