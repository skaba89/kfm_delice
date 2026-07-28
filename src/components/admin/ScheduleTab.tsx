"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Square, RefreshCw, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/lib/notifications";

interface StaffSchedule {
  id: string; name: string; role: string; status: string;
  shifts: Array<{ day: number; startHour: number; endHour: number }>;
  weeklyHours: number; totalHours: number;
}

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const roleColors: Record<string, string> = { cuisinier: "bg-red-100 text-red-700", serveur: "bg-blue-100 text-blue-700", gerant: "bg-orange-100 text-orange-700", caissier: "bg-purple-100 text-purple-700", plongeur: "bg-gray-100 text-gray-700" };

export function ScheduleTab() {
  const { apiFetch } = useAuth();
  const [schedule, setSchedule] = useState<StaffSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [clockedIn, setClockedIn] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/staff/schedule");
      if (res.ok) { const d = await res.json(); setSchedule(d.data || []); }
    } catch { notify.error("Erreur"); }
    finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const toggleShift = async (staffId: string, day: number) => {
    const staff = schedule.find(s => s.id === staffId);
    if (!staff) return;
    const hasShift = staff.shifts.some(s => s.day === day);
    let newShifts;
    if (hasShift) {
      newShifts = staff.shifts.filter(s => s.day !== day);
    } else {
      newShifts = [...staff.shifts, { day, startHour: 9, endHour: 17 }];
    }
    try {
      const res = await apiFetch("/api/staff/schedule", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId, shifts: newShifts }) });
      if (res.ok) { notify.success(hasShift ? "Shift retiré" : "Shift ajouté"); load(); }
    } catch { notify.error("Erreur"); }
  };

  const updateHours = async (staffId: string, day: number, field: "startHour" | "endHour", value: number) => {
    const staff = schedule.find(s => s.id === staffId);
    if (!staff) return;
    const newShifts = staff.shifts.map(s => s.day === day ? { ...s, [field]: value } : s);
    try { await apiFetch("/api/staff/schedule", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId, shifts: newShifts }) }); load(); }
    catch { /* silent */ }
  };

  const clockInOut = async (staffId: string) => {
    const isClockedIn = clockedIn[staffId];
    setClockedIn(prev => ({ ...prev, [staffId]: !isClockedIn }));
    if (isClockedIn) {
      try {
        await apiFetch("/api/staff/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId, action: "clockOut", hours: 4 }) });
        notify.success("Pointage de sortie enregistré (4h)");
        load();
      } catch { notify.error("Erreur pointage"); }
    } else {
      try {
        await apiFetch("/api/staff/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId, action: "clockIn" }) });
        notify.success("Pointage d'entrée enregistré");
      } catch { notify.error("Erreur pointage"); }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Calendar className="w-5 h-5 text-orange-500" /> Planning & Pointeuse</h2>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />Rafraîchir</Button>
      </div>
      {loading ? <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 text-orange-500 animate-spin" /></div> :
       schedule.length === 0 ? <Card className="dark:bg-gray-800"><CardContent className="py-8 text-center text-gray-400">Aucun employé. Ajoutez du personnel dans l'onglet Personnel.</CardContent></Card> :
       <div className="space-y-3">
         {schedule.map(s => (
           <Card key={s.id} className="dark:bg-gray-800 dark:border-gray-700">
             <CardContent className="p-4">
               <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                   <h3 className="font-bold text-gray-900 dark:text-white">{s.name}</h3>
                   <Badge className={roleColors[s.role] || roleColors.plongeur}>{s.role}</Badge>
                   {s.status !== "active" && <Badge className="bg-red-100 text-red-700">{s.status}</Badge>}
                 </div>
                 <div className="flex items-center gap-3">
                   <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {s.weeklyHours}h/sem · Total: {Math.round(s.totalHours)}h</span>
                   <Button size="sm" variant={clockedIn[s.id] ? "destructive" : "outline"} onClick={() => clockInOut(s.id)} className="text-xs">
                     {clockedIn[s.id] ? <><Square className="w-3 h-3 mr-1" /> Sortie</> : <><Play className="w-3 h-3 mr-1" /> Entrée</>}
                   </Button>
                 </div>
               </div>
               <div className="grid grid-cols-7 gap-1">
                 {DAYS.map((day, dayIdx) => {
                   const shift = s.shifts.find(sh => sh.day === dayIdx);
                   return (
                     <div key={dayIdx} className="text-center">
                       <button onClick={() => toggleShift(s.id, dayIdx)} className={`w-full text-xs py-1 rounded ${shift ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200"}`}>{day}</button>
                       {shift && <div className="flex gap-0.5 mt-0.5">
                         <input type="number" min={0} max={23} value={shift.startHour} onChange={e => updateHours(s.id, dayIdx, "startHour", parseInt(e.target.value) || 0)} className="w-8 text-[10px] text-center rounded border dark:bg-gray-700 dark:border-gray-600" />
                         <span className="text-[10px] text-gray-400">-</span>
                         <input type="number" min={0} max={23} value={shift.endHour} onChange={e => updateHours(s.id, dayIdx, "endHour", parseInt(e.target.value) || 0)} className="w-8 text-[10px] text-center rounded border dark:bg-gray-700 dark:border-gray-600" />
                       </div>}
                     </div>
                   );
                 })}
               </div>
             </CardContent>
           </Card>
         ))}
       </div>}
    </div>
  );
}
