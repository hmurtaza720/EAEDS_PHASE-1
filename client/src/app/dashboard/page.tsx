"use client";

import React, { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/live/Sidebar";
import { Activity, Phone, User, Bot, Siren, Archive as ArchiveIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Call } from "@/data/types";

interface ServerMessage {
    event: "db_response" | "ai_response" | "incoming_call" | "audio_relay";
    data?: Record<string, Call>;
    text?: string;
    user_text?: string;
    emotion?: string;
    location?: [number, number];
}

const getWsUrl = () => {
    return "ws://127.0.0.1:8000/ws/call";
};

export default function Dashboard() {
    const [data, setData] = useState<Record<string, Call>>({});
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const connect = () => {
            const ws = new WebSocket(getWsUrl());
            wsRef.current = ws;

            ws.onopen = () => {
                ws.send(JSON.stringify({ event: "get_db" }));
            };

            ws.onmessage = (event: MessageEvent) => {
                const message = JSON.parse(event.data) as ServerMessage;
                if (message.event === "db_response" && message.data) {
                    setData(prevData => ({ ...prevData, ...message.data }));
                } else if (message.event === "ai_response") {
                    // Update live session specifically if it's currently active
                    setData(prevData => {
                        const phone = (message as any).phone;
                        const liveCallId = (message as any).id || "unknown_call";
                        if (!prevData[liveCallId]) return prevData;

                        const currentCall = prevData[liveCallId];
                        return {
                            ...prevData,
                            [liveCallId]: {
                                ...currentCall,
                                severity: "CRITICAL",
                                type: "Emergency",
                            }
                        };
                    });
                }
            };
        };

        connect();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    // Split data into active and archived purely based on severity/status
    const calls = Object.values(data);
    const activeCalls = calls.filter(c => c.severity === "CRITICAL" || c.severity === "MODERATE" || c.status === "Connected");
    const archivedCalls = calls.filter(c => c.severity === "RESOLVED" || c.severity === "UNRESOLVED");

    const stats = {
        totalReceived: calls.length,
        aiHandled: calls.filter(c => c.responder_type === 'AI' || !c.responder_type).length,
        humanHandled: calls.filter(c => c.responder_type === 'Human').length,
        criticalActive: activeCalls.filter(c => c.severity === 'CRITICAL' || c.status === "Connected").length,
        resolvedArchived: archivedCalls.length
    };

    // Sort calls by most recent
    const recentCalls = [...calls].sort((a, b) => {
        const timeA = a.time ? new Date(a.time).getTime() : 0;
        const timeB = b.time ? new Date(b.time).getTime() : 0;
        return timeB - timeA;
    }).slice(0, 5); // display up to 5 recent calls

    const StatCard = ({ title, value, icon: Icon, color, subtext }: { title: string, value: number, icon: any, color: string, subtext: string }) => (
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl transition-all hover:bg-slate-900/80 hover:scale-[1.02] group">
            <div className={cn("absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-xl transition-all group-hover:opacity-20", color)} />
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</h3>
                    <div className="mt-2 flex items-baseline space-x-2">
                        <span className="text-4xl font-bold text-white tracking-tight">{value}</span>
                        <span className="text-xs font-medium text-slate-400">{subtext}</span>
                    </div>
                </div>
                <div className={cn("rounded-xl p-3 bg-slate-950/50 border border-slate-800", color.replace("bg-", "text-"))}>
                    <Icon size={24} />
                </div>
            </div>
            <div className="mt-4 h-1 w-full rounded-full bg-slate-800">
                <div className={cn("h-full rounded-full transition-all duration-1000 ease-out w-[70%]", color)} />
            </div>
        </div>
    );

    return (
        <div className="flex h-screen w-full bg-slate-950 text-slate-200 selection:bg-blue-500/30 font-sans">
            <div className="flex h-full w-full p-2">
                <Sidebar />

                <div className="flex flex-1 flex-col space-y-1 ml-1 overflow-hidden">
                    {/* Header */}
                    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-xl shrink-0">
                        <header className="flex h-16 items-center px-6 backdrop-blur">
                            <h1 className="text-xl font-bold uppercase tracking-wider text-blue-400">Command Dashboard</h1>
                            <div className="ml-auto flex items-center space-x-4">
                                <span className="text-xs font-mono text-slate-500">
                                    {new Date().toLocaleDateString('en-GB', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </span>
                            </div>
                        </header>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/20 p-8 shadow-inner">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-white mb-2">System Overview</h2>
                            <p className="text-slate-400">Real-time metrics for emergency dispatch operations.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <StatCard
                                title="Total Calls Received"
                                value={stats.totalReceived}
                                icon={Phone}
                                color="bg-blue-500"
                                subtext="All time"
                            />

                            <StatCard
                                title="Active Critical"
                                value={stats.criticalActive}
                                icon={Siren}
                                color="bg-red-600"
                                subtext="Requires Immediate Action"
                            />

                            <StatCard
                                title="Resolved & Archived"
                                value={stats.resolvedArchived}
                                icon={ArchiveIcon}
                                color="bg-purple-600"
                                subtext="Stored in database"
                            />

                            <StatCard
                                title="AI Handled"
                                value={stats.aiHandled}
                                icon={Bot}
                                color="bg-indigo-500"
                                subtext="Autonomous Dispatch"
                            />

                            <StatCard
                                title="Human Operated"
                                value={stats.humanHandled}
                                icon={User}
                                color="bg-orange-500"
                                subtext="Manual Intervention"
                            />

                            <StatCard
                                title="System Status"
                                value={98}
                                icon={Activity}
                                color="bg-green-500"
                                subtext="% Uptime"
                            />
                        </div>

                        {/* Recent Activity Log */}
                        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-white">Recent Activity</h3>
                                <Link href="/archive" className="text-xs text-blue-400 hover:text-blue-300">
                                    View All Log
                                </Link>
                            </div>
                            <div className="space-y-4">
                                {recentCalls.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic">No recent activity detected.</p>
                                ) : recentCalls.map((call) => (
                                    <Link key={call.id} href={`/archive?id=${call.id}`} className="flex items-center justify-between p-4 rounded-lg bg-slate-950/50 border border-slate-800/50 transition-all hover:bg-slate-900 cursor-pointer">
                                        <div className="flex items-center space-x-4">
                                            <div className={cn("h-2 w-2 rounded-full", call.severity === "CRITICAL" ? "bg-red-500 animate-pulse" : (call.severity === "RESOLVED" ? "bg-green-500" : "bg-slate-500"))} />
                                            <div>
                                                <p className="font-medium text-slate-200">{call.title || "Emergency Call"}</p>
                                                <p className="text-xs text-slate-500">{call.location_name || "Unknown Location"}</p>
                                            </div>
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded",
                                            call.severity === "CRITICAL" ? "bg-red-500/10 text-red-500" : (call.severity === "RESOLVED" ? "bg-green-500/10 text-green-500" : "bg-slate-800 text-slate-400")
                                        )}>
                                            {call.severity || "MODERATE"}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
