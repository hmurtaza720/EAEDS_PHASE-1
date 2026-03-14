"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Call } from "@/data/types";
import Sidebar from "@/components/live/Sidebar";
import { MoreHorizontal, MessageSquare, Monitor, X, Phone, User, Bot, Clock, Siren, FireExtinguisher, Ambulance, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { US_STATES, CITY_COORDS } from "@/data/constants";

// Dynamic import for Map to avoid SSR issues
const Map = dynamic(() => import("@/components/live/map/Map"), {
    loading: () => <div className="h-full w-full animate-pulse bg-slate-800" />,
    ssr: false,
});

const TrafficPage = () => {
    const [calls, setCalls] = useState<Call[]>([]);
    const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

    useEffect(() => {
        // Fetch calls from backend API (traffic endpoint: active + recently disconnected only)
        const fetchCalls = async () => {
            try {
                const res = await fetch("http://127.0.0.1:8000/calls/traffic");
                if (res.ok) {
                    const rawData = await res.json();
                    // Geocode coords from city_state if not already present
                    const enriched = rawData.map((call: any) => {
                        if (!call.location_coords && call.city_state && call.city_state !== "Unknown") {
                            const parts = call.city_state.split(",").map((s: string) => s.trim());
                            const cityName = parts[0];
                            const stateCode = parts.length > 1 ? parts[1] : null;
                            if (CITY_COORDS[cityName]) {
                                call.location_coords = CITY_COORDS[cityName];
                            } else if (stateCode) {
                                const stateObj = US_STATES.find(s => s.code === stateCode);
                                if (stateObj?.coords) call.location_coords = stateObj.coords;
                            }
                        }
                        return call;
                    });
                    setCalls(enriched);
                    if (enriched.length > 0 && !selectedCallId) setSelectedCallId(enriched[0].id);
                }
            } catch (e) {
                console.error("Failed to fetch calls:", e);
            }
        };
        fetchCalls();

        // Auto-refresh every 10 seconds for live feel
        const interval = setInterval(fetchCalls, 10000);
        return () => clearInterval(interval);
    }, []);

    const selectedCall = selectedCallId ? calls.find(c => c.id === selectedCallId) : null;

    // Helper to format time
    const formatTime = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZone: "America/Los_Angeles",
                timeZoneName: "short"
            });
        } catch (e) {
            return "Unknown";
        }
    };

    // Severity counts
    const criticalCount = calls.filter(c => c.severity === "CRITICAL").length;
    const unresolvedCount = calls.filter(c => c.severity === "UNRESOLVED").length;
    const resolvedCount = calls.filter(c => c.severity === "RESOLVED").length;

    return (
        <div className="flex h-full flex-col space-y-1 text-slate-200 selection:bg-blue-500/30">
            {/* Header */}
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-xl">
                <header className="flex h-16 items-center px-6 backdrop-blur">
                    <h1 className="text-xl font-bold uppercase tracking-wider text-blue-400">Traffic Control</h1>
                    <div className="ml-auto flex items-center space-x-4">
                        {/* Severity Counters */}
                        <div className="flex items-center gap-3 mr-4">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20">
                                <AlertTriangle size={12} className="text-red-400" />
                                <span className="text-xs font-bold text-red-400">{criticalCount}</span>
                                <span className="text-[9px] uppercase tracking-wider text-red-400/70 font-semibold">Critical</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/10 border border-orange-500/20">
                                <AlertCircle size={12} className="text-orange-400" />
                                <span className="text-xs font-bold text-orange-400">{unresolvedCount}</span>
                                <span className="text-[9px] uppercase tracking-wider text-orange-400/70 font-semibold">Unresolved</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20">
                                <CheckCircle2 size={12} className="text-green-400" />
                                <span className="text-xs font-bold text-green-400">{resolvedCount}</span>
                                <span className="text-[9px] uppercase tracking-wider text-green-400/70 font-semibold">Resolved</span>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 text-xs font-mono text-slate-500">
                            <span>LIVE FEED</span>
                            <div className="h-4 w-4 rounded-full bg-green-500/20 p-1">
                                <div className="h-full w-full rounded-full bg-green-500 animate-pulse" />
                            </div>
                            <span className="font-bold text-slate-300 ml-1">{calls.length} Active</span>
                        </div>
                    </div>
                </header>
            </div>

            <div className="flex flex-1 space-x-1 overflow-hidden">
                {/* Main Content Area (Table) */}
                <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 shadow-xl scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-blue-800/80 hover:scrollbar-thumb-blue-800">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/95 text-[10px] uppercase font-bold tracking-widest text-slate-500 sticky top-0 z-10 backdrop-blur-md shadow-sm border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4">Caller Name</th>
                                <th className="px-6 py-4">Location</th>
                                <th className="px-6 py-4">Severity</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">On Call With</th>
                                <th className="px-6 py-4">Time Initiated</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {calls.map((call) => (
                                <tr
                                    key={call.id}
                                    onClick={() => setSelectedCallId(call.id)}
                                    className={cn(
                                        "group cursor-pointer transition-all duration-200 hover:bg-slate-800 border-l-4",
                                        selectedCallId === call.id
                                            ? "bg-slate-800/80 border-l-blue-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]"
                                            : call.severity === "CRITICAL"
                                                ? "border-l-red-500 hover:border-l-red-400"
                                                : call.severity === "UNRESOLVED"
                                                    ? "border-l-orange-500 hover:border-l-orange-400"
                                                    : call.status === "Connected"
                                                        ? "border-l-green-500 hover:border-l-green-400"
                                                        : "border-l-slate-700 hover:border-l-slate-600"
                                    )}
                                >
                                    {/* Name & Phone */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className={cn(
                                                "flex h-8 w-8 items-center justify-center rounded-lg font-bold text-xs transition-colors",
                                                selectedCallId === call.id ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200"
                                            )}>
                                                {call.name ? call.name.charAt(0) : "?"}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={cn(
                                                    "font-bold uppercase tracking-wide text-xs",
                                                    selectedCallId === call.id ? "text-blue-400" : "text-slate-300 group-hover:text-white"
                                                )}>
                                                    {call.name || "Unknown Caller"}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                    {call.phone || "Unknown Number"}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Location */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2 text-slate-300">
                                            <span className="text-xs font-bold uppercase tracking-wide">
                                                {call.city_state && call.city_state !== "Unknown" ? call.city_state : call.location_name}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Severity */}
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border",
                                            call.severity === "CRITICAL"
                                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                                : call.severity === "UNRESOLVED"
                                                    ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                                    : "bg-green-500/10 text-green-400 border-green-500/20"
                                        )}>
                                            {call.severity || "UNKNOWN"}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2">
                                            <div className={cn(
                                                "h-1.5 w-1.5 rounded-full",
                                                call.status === "Connected" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" : "bg-slate-600"
                                            )} />
                                            <span className={cn(
                                                "text-[10px] uppercase font-bold tracking-wider",
                                                call.status === "Connected" ? "text-green-400" : "text-slate-500"
                                            )}>
                                                {call.status}
                                            </span>
                                        </div>
                                    </td>

                                    {/* On Call With */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2 text-slate-400 group-hover:text-slate-300 transition-colors">
                                            {call.responder_type === "AI" ? (
                                                <Bot size={14} className="text-purple-400" />
                                            ) : (
                                                <User size={14} className="text-orange-400" />
                                            )}
                                            <span className="text-xs font-medium">
                                                {call.responder_type === "AI" ? "AI Dispatcher" : (call.agent_name || "Human Agent")}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Time */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2 text-slate-500 group-hover:text-slate-400">
                                            <Clock size={14} />
                                            <span className="font-mono text-xs">{formatTime(call.time)}</span>
                                        </div>
                                    </td>


                                    {/* Actions */}
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            href={`/live?callId=${call.id}`}
                                            className={cn(
                                                "inline-flex items-center px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg",
                                                selectedCallId === call.id
                                                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20"
                                                    : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700"
                                            )}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Monitor size={12} className="mr-1.5" />
                                            Supervise
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Details Sidebar (Right) */}
                {selectedCall && (
                    <div className="w-80 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-md animate-in slide-in-from-right-10 duration-200 relative">

                        <h2 className="text-lg font-bold text-white mb-1">Call Details</h2>
                        <p className="text-sm text-slate-400 mb-6 font-mono">ID: #{selectedCall.id}</p>

                        {/* Mini Map */}
                        <div className="mb-6 h-48 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 relative shadow-inner">
                            {selectedCall.location_coords ? (
                                <Map
                                    center={selectedCall.location_coords}
                                    zoom={13}
                                    pins={[{
                                        coordinates: [selectedCall.location_coords.lat, selectedCall.location_coords.lng],
                                        popupHtml: `<b>${selectedCall.name}</b><br>${selectedCall.location_name}`
                                    }]}
                                />
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center text-slate-500 text-xs italic space-y-1">
                                    <span>📍</span>
                                    <span className="font-bold text-slate-400 not-italic uppercase text-[10px] tracking-wider">
                                        {selectedCall.city_state && selectedCall.city_state !== "Unknown"
                                            ? selectedCall.city_state
                                            : selectedCall.location_name && selectedCall.location_name !== "Unknown"
                                                ? selectedCall.location_name
                                                : "Location Pending..."}
                                    </span>
                                </div>
                            )}
                        </div>


                        <div className="space-y-4">
                            <div>
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">Subject</h3>
                                <p className="text-sm font-medium text-slate-200">{selectedCall.title}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">Location</h3>
                                <p className="text-sm text-slate-300">{selectedCall.location_name}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">Caller Phone</h3>
                                <div className="flex items-center space-x-2 text-sm text-slate-300">
                                    <Phone size={14} />
                                    <span>{selectedCall.phone}</span>
                                </div>
                            </div>

                            {/* Dispatched Services Section (replaces Summary) */}
                            <div>
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Dispatched Services</h3>
                                {(() => {
                                    const dispatched: string[] = (selectedCall as any)?.dispatched_services || [];
                                    return (
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className={cn(
                                                "flex items-center justify-center gap-1.5 h-9 px-2 rounded-md border text-[10px] font-medium",
                                                dispatched.includes("Police")
                                                    ? "border-blue-500/40 bg-blue-950/30 text-blue-400"
                                                    : "border-slate-700/50 bg-slate-800/30 text-slate-600"
                                            )}>
                                                <Siren size={12} />
                                                {dispatched.includes("Police") ? "✓ Police" : "Police"}
                                            </div>
                                            <div className={cn(
                                                "flex items-center justify-center gap-1.5 h-9 px-2 rounded-md border text-[10px] font-medium",
                                                dispatched.includes("Fire")
                                                    ? "border-red-500/40 bg-red-950/30 text-red-400"
                                                    : "border-slate-700/50 bg-slate-800/30 text-slate-600"
                                            )}>
                                                <FireExtinguisher size={12} />
                                                {dispatched.includes("Fire") ? "✓ Fire" : "Fire"}
                                            </div>
                                            <div className={cn(
                                                "flex items-center justify-center gap-1.5 h-9 px-2 rounded-md border text-[10px] font-medium",
                                                dispatched.includes("EMS")
                                                    ? "border-green-500/40 bg-green-950/30 text-green-400"
                                                    : "border-slate-700/50 bg-slate-800/30 text-slate-600"
                                            )}>
                                                <Ambulance size={12} />
                                                {dispatched.includes("EMS") ? "✓ EMS" : "EMS"}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrafficPage;
