import React from "react";
import WhatsAppNav from "../components/WhatsAppNav";
import WhatsAppInteractiveReminders from "../components/WhatsAppInteractiveReminders";
import { Bell, Sparkles } from "lucide-react";

export default function WhatsAppReminders() {
  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      {/* WhatsApp Subsystem Navigation Bar */}
      <WhatsAppNav />

      {/* Header Banner */}
      <div className="mb-6 bg-gradient-to-r from-amber-600 via-amber-700 to-orange-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm flex items-center gap-1.5">
                <Sparkles size={12} />
                2-Way Multi-Gated Confirmations
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              <Bell className="p-1.5 bg-white/20 rounded-xl" size={36} />
              <span>Interactive WhatsApp Reminders</span>
            </h1>
            <p className="text-amber-100 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Automate scheduled WhatsApp reminders with native interactive response buttons. Automatically update CRM appointment statuses, collect invoice payments, follow up on quotations, and renew AMC contracts.
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Reminders & Settings Workspace */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <WhatsAppInteractiveReminders />
      </div>
    </div>
  );
}
