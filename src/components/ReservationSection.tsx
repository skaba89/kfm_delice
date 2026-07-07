"use client";

import { useState } from "react";
import { CalendarCheck, RefreshCw, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedSection } from "@/components/AnimatedSection";
import { publicApiFetch } from "@/lib/public-api";

export function ReservationSection() {
  const [form, setForm] = useState({ customerName: "", phone: "", date: "", time: "", guests: 2, zone: "interieur", notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError("");
    try {
      const res = await publicApiFetch("/api/reservations", {
        method: "POST",
        body: JSON.stringify({ ...form, status: "pending", loyaltyPoint: 50 }),
      });
      if (res.ok) setSubmitted(true);
      else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Erreur lors de la réservation");
      }
    } catch { setError("Erreur de connexion"); }
    finally { setSubmitting(false); }
  };
  return (
    <section id="reservation" className="py-20 bg-gradient-to-br from-gray-50 to-orange-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-orange-100 text-orange-700 mb-4">Réservation</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Réservez Votre <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">Table</span></h2>
          <p className="text-gray-500 max-w-2xl mx-auto">Réservez en ligne et profitez de 50 points de fidélité offerts</p>
        </AnimatedSection>
        <AnimatedSection>
          <Card className="max-w-2xl mx-auto shadow-xl">
            <CardContent className="p-6 sm:p-8">
              {submitted ? (
                <div className="text-center py-8"><CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Réservation Confirmée !</h3><p className="text-gray-500">Nous vous contacterons pour confirmer votre réservation.</p><Button onClick={() => { setSubmitted(false); setForm({ customerName: "", phone: "", date: "", time: "", guests: 2, zone: "interieur", notes: "" }); }} className="mt-4 bg-gradient-to-r from-orange-500 to-red-500 text-white">Nouvelle réservation</Button></div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Nom complet *</label><Input required value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="Votre nom" /></div>
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Téléphone *</label><Input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+224 6XX XX XX XX" /></div>
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Date *</label><Input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Heure *</label><Input required type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Nombre de personnes</label><Input type="number" min={1} max={20} value={form.guests} onChange={e => setForm({ ...form, guests: parseInt(e.target.value) || 2 })} /></div>
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Zone</label>
                      <select value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                        <option value="interieur">Intérieur</option><option value="terrasse">Terrasse</option><option value="vip">VIP</option>
                      </select>
                    </div>
                  </div>
                  <div><label className="text-sm font-medium text-gray-700 mb-1 block">Notes spéciales</label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Allergies, occasions spéciales..." rows={3} /></div>
                  {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
                  <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl py-6 text-lg">
                    {submitting ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : <><CalendarCheck className="mr-2 w-5 h-5" />Réserver</>}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}
