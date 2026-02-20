"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import EventPanel from "@/components/live/EventPanel";
import Header from "@/components/live/Header";
import { FilterState } from "@/components/live/EventPanel";
import { US_STATES } from "@/data/constants";
import TranscriptPanel from "@/components/live/TranscriptPanel";
import { ChevronRight, ChevronLeft, Info, BrainCircuit, Siren, FireExtinguisher, Ambulance, Phone } from "lucide-react";
import EmotionCard from "@/components/live/EmotionCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";


const Map = dynamic(() => import("@/components/live/map/Map"), {
    loading: () => <p>Rendering Map...</p>,
    ssr: false,
});

interface ServerMessage {
    event: "db_response" | "ai_response";
    data?: Record<string, Call>;
    text?: string;
    user_text?: string;
    emotion?: string;
    location?: [number, number];
}

export type Call = {
    emotions?: {
        emotion: string;
        intensity: number;
    }[];
    id: string;
    location_name: string;
    location_coords?: {
        lat: number;
        lng: number;
    };
    street_view?: string; // base 64
    name: string;
    phone: string;
    recommendation: string;
    severity?: "CRITICAL" | "MODERATE" | "RESOLVED" | "UNRESOLVED";
    summary: string;
    time: string; // ISO Date String
    title?: string;
    transcript: {
        role: "assistant" | "user" | "agent";
        content: string;
    }[];
    type: string;
};

export interface CallProps {
    call?: Call;
    selectedId: string | undefined;
}

const getWsUrl = () => {
    if (typeof window === "undefined") return "ws://127.0.0.1:8000/ws/call";
    const host = window.location.hostname;
    return `ws://${host}:8000/ws/call`;
};

let wss: WebSocket | null = null;

const emptyCall: Call = {
    emotions: [],
    id: "",
    location_name: "",
    location_coords: { lat: 0, lng: 0 },
    street_view: "",
    name: "",
    phone: "",
    recommendation: "",
    severity: "RESOLVED",
    summary: "",
    time: "",
    title: "",
    transcript: [],
    type: "",
};

const Page = () => {
    const [connected, setConnected] = useState(false);
    const [data, setData] = useState<Record<string, Call>>({});
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const [resolvedIds, setResolvedIds] = useState<string[]>([]);
    const [city, setCity] = useState("ALL");
    const [filters, setFilters] = useState<FilterState>({
        stateCode: "ALL",
        city: "ALL",
        emotion: "ALL",
        type: "ALL"
    });
    const [isOverlayOpen, setIsOverlayOpen] = useState(true);
    const { toast } = useToast();

    const [center, setCenter] = useState<{ lat: number; lng: number }>({
        lat: 37.867989,
        lng: -122.271507,
    });

    const filteredData = Object.entries(data).reduce((acc, [key, call]) => {
        // 1. Text Search (Local Search in EventPanel) - handled by EventPanel filter prop passing if needed,
        // but EventPanel handles its own internal search state for the list.
        // Wait, EventPanel maps over the 'data' passed to it.
        // So this reduction should handle the shared filters (State, City, Emotion, Type).

        let match = true;

        // State Filter
        if (filters.stateCode !== "ALL") {
            const loc = call.location_name || "";
            const stateInfo = US_STATES.find(s => s.code === filters.stateCode);
            if (stateInfo) {
                const stateMatch = loc.includes(` ${stateInfo.code}`) ||
                    loc.includes(`, ${stateInfo.code}`) ||
                    loc.toLowerCase().includes(stateInfo.name.toLowerCase());
                if (!stateMatch) match = false;
            }
        }

        // City Filter
        if (match && filters.city !== "ALL") {
            const loc = call.location_name?.toLowerCase() || "";
            if (!loc.includes(filters.city.toLowerCase())) match = false;
        }

        // Emotion Filter
        if (match && filters.emotion !== "ALL") {
            const hasEmotion = call.emotions?.some(e => e.emotion === filters.emotion);
            if (!hasEmotion) match = false;
        }

        // Type Filter
        if (match && filters.type !== "ALL") {
            const typeMatch = (call.type?.toLowerCase() === filters.type.toLowerCase()) ||
                (call.title?.toLowerCase().includes(filters.type.toLowerCase()));
            if (!typeMatch) match = false;
        }

        // Archive constraint: Only show ended calls (RESOLVED or UNRESOLVED)
        if (match) {
            if (call.severity === "RESOLVED" || call.severity === "UNRESOLVED") {
                acc[key] = call;
            }
        }
        return acc;
    }, {} as Record<string, Call>);

    const handleFilterChange = (newFilters: FilterState) => {
        setFilters(newFilters);
        setCity(newFilters.stateCode);
    };

    // Override setCity from Header to also update filters
    const handleHeaderCityChange = (newCity: string) => {
        setCity(newCity);
        setFilters(prev => ({ ...prev, stateCode: newCity, city: "ALL" }));
    };

    useEffect(() => {
        const firstCallWithCoords = Object.entries(filteredData).find(([_, c]) => c.location_coords)?.[1];
        if (firstCallWithCoords && firstCallWithCoords.location_coords && !selectedId) {
            setCenter(firstCallWithCoords.location_coords);
        }
    }, [city, filteredData, selectedId]);

    const handleSelect = (id: string) => {
        setSelectedId(id === selectedId ? undefined : id);
    };

    const handleResolve = (id: string) => {
        setResolvedIds((prev) => {
            const newResolvedIds = [...prev, id];
            const newData = { ...data };
            Object.keys(newData).forEach((key) => {
                if (newResolvedIds.includes(newData[key].id)) {
                    newData[key].severity = "RESOLVED";
                }
            });
            setData(newData);
            return newResolvedIds;
        });
    };

    const handleTransfer = (id: string) => {
        if (wss) {
            wss.send(JSON.stringify({ event: "transfer", id: id }));
        }
    };

    useEffect(() => {
        if (!selectedId || !data[selectedId]?.location_coords) return;
        setCenter(data[selectedId].location_coords as { lat: number; lng: number });
    }, [selectedId, data]);

    useEffect(() => {
        if (selectedId && data[selectedId]) {
            const locName = data[selectedId].location_name;
            if (locName) {
                const matchedState = US_STATES.find(s =>
                    locName.includes(` ${s.code}`) ||
                    locName.includes(`, ${s.code}`) ||
                    locName.toLowerCase().includes(s.name.toLowerCase())
                );
                if (matchedState && matchedState.code !== city) {
                    setCity(matchedState.code);
                }
            }
        }
    }, [selectedId, data, city]);

    useEffect(() => {
        if (!wss) {
            wss = new WebSocket(getWsUrl());
        }
        wss.onopen = () => {
            setConnected(true);
            wss!.send(JSON.stringify({ event: "get_db" }));
            wss!.onmessage = (event: MessageEvent) => {
                const message = JSON.parse(event.data) as ServerMessage;
                if (message.event === "ai_response") {
                    setData(prevData => {
                        const liveCallId = "live_session_1";
                        const currentCall = prevData[liveCallId] || {
                            ...emptyCall,
                            id: liveCallId,
                            title: "Live Incoming Call",
                            name: "Caller (Unknown)",
                            severity: "CRITICAL",
                            location_name: "Detecting...",
                            type: "Emergency",
                            time: new Date().toISOString(),
                            transcript: []
                        };
                        const newEntries = [];
                        if (message.user_text) newEntries.push({ role: "user" as const, content: message.user_text });
                        if (message.text) newEntries.push({ role: "assistant" as const, content: message.text });
                        const newTranscript = [...currentCall.transcript, ...newEntries];
                        let newEmotions = currentCall.emotions || [];
                        if (message.emotion) {
                            let intensity = 0.5;
                            if (message.emotion === "Panic" || message.emotion === "Fear") intensity = 0.9;
                            if (message.emotion === "Calm" || message.emotion === "Neutral") intensity = 0.2;
                            newEmotions = [
                                { emotion: message.emotion, intensity: intensity },
                                { emotion: "Confidence", intensity: 1.0 - intensity }
                            ];
                        }
                        let newLocation = currentCall.location_coords;
                        let newLocationName = currentCall.location_name;
                        if (message.location && Array.isArray(message.location)) {
                            newLocation = { lat: message.location[0], lng: message.location[1] };
                            newLocationName = "Detected Location";
                        }
                        return {
                            ...prevData,
                            [liveCallId]: {
                                ...currentCall,
                                transcript: newTranscript,
                                emotions: newEmotions,
                                location_coords: newLocation,
                                location_name: newLocationName
                            }
                        };
                    });
                    if (selectedId !== "live_session_1") setSelectedId("live_session_1");
                } else if (message.data) {
                    setData(prevData => ({ ...prevData, ...message.data }));
                }
            };
            if (wss) {
                wss.onclose = () => setConnected(false);
                wss.onerror = (error) => console.error("WebSocket Error:", error);
            }
        };
    }, []);

    return (
        <div className="flex h-full flex-col space-y-1 selection:bg-blue-500/30">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
                <Header connected={connected} city={city} setCity={handleHeaderCityChange} />
            </div>

            <div className="flex flex-1 space-x-1 overflow-hidden">
                {/* Column 1: Emergency Feed */}
                <div className="w-[360px] flex-shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-xl">
                    <EventPanel
                        data={filteredData}
                        selectedId={selectedId || undefined}
                        handleSelect={handleSelect}
                        title="Archive"
                        showCounters={false}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                    />
                </div>

                {/* Column 2: Map Workspace */}
                <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/20 shadow-2xl">
                    <Map
                        center={center}
                        pins={
                            Object.entries(filteredData)
                                .filter(
                                    ([_, call]) =>
                                        call.location_coords && call.location_name,
                                )
                                .map(([_, call]) => {
                                    return {
                                        coordinates: [
                                            call.location_coords?.lat as number,
                                            call.location_coords?.lng as number,
                                        ],
                                        popupHtml: `<b>${call.title}</b><br>Location: ${call.location_name}`,
                                    };
                                })
                        }
                    />

                    {/* Collapsible Overlay */}
                    {selectedId && data[selectedId] && (
                        <div className={cn(
                            "absolute right-0 top-4 z-[1000] flex items-center transition-all duration-300 ease-in-out",
                            isOverlayOpen ? "translate-x-0" : "translate-x-[calc(100%-44px)]"
                        )}>
                            <div className="flex flex-row items-center space-x-1">
                                {isOverlayOpen && (
                                    <div className="flex w-80 flex-col space-y-3 rounded-2xl border border-slate-800 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-right-4">
                                        {/* Incident Header */}
                                        <div className="space-y-1">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-0.5">
                                                    <h3 className="text-base font-bold leading-tight text-white">{data[selectedId].title || "Untiled Case"}</h3>
                                                    <p className="text-[10px] text-slate-500 font-medium">{data[selectedId].location_name}</p>
                                                    {data[selectedId].phone && data[selectedId].phone !== "Unknown" && (
                                                        <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                                                            <Phone size={10} className="text-blue-400" />
                                                            <span className="font-mono">{data[selectedId].phone}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={cn(
                                                    "rounded p-1",
                                                    data[selectedId].severity === "CRITICAL" ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                                                )}>
                                                    <Info size={14} />
                                                </div>
                                            </div>
                                        </div>

                                        <Separator className="bg-slate-800/50" />

                                        {/* Emotions Section */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <BrainCircuit size={14} className="text-blue-400" />
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Emotion Intel</p>
                                                </div>
                                                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                            </div>
                                            <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-hide">
                                                {data[selectedId]?.emotions?.map((em, idx) => (
                                                    <EmotionCard
                                                        key={idx}
                                                        emotion={em.emotion}
                                                        percentage={em.intensity * 100}
                                                        color={idx === 0 ? "bg-blue-500" : "bg-slate-700"}
                                                    />
                                                ))}
                                                {(!data[selectedId]?.emotions || data[selectedId].emotions.length === 0) && (
                                                    <p className="text-[10px] text-slate-600 italic">Analyzing voice patterns...</p>
                                                )}
                                            </div>
                                        </div>

                                        <Separator className="bg-slate-800/50" />

                                        {/* Summary Section */}
                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <Info size={14} className="text-blue-400" />
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Incident Summary</p>
                                            </div>
                                            <ScrollArea className="max-h-68 pr-2">
                                                <p className="text-xs leading-relaxed text-slate-300">
                                                    {data[selectedId]?.summary || "AI is generating summary from live transcript flows..."}
                                                </p>
                                            </ScrollArea>
                                        </div>

                                        <Separator className="bg-slate-800/50" />

                                        {/* Dispatched Services Section */}
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Dispatched Services</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(() => {
                                                    const services = (data[selectedId] as any)?.dispatched_services || [];
                                                    return (
                                                        <>
                                                            <div className={cn(
                                                                "flex items-center justify-center gap-1.5 h-9 px-2 rounded-md border text-[10px] font-medium",
                                                                services.includes("Police")
                                                                    ? "border-blue-500/40 bg-blue-950/30 text-blue-400"
                                                                    : "border-slate-700/50 bg-slate-800/30 text-slate-600"
                                                            )}>
                                                                <Siren size={12} />
                                                                {services.includes("Police") ? "✓ Police" : "Police"}
                                                            </div>
                                                            <div className={cn(
                                                                "flex items-center justify-center gap-1.5 h-9 px-2 rounded-md border text-[10px] font-medium",
                                                                services.includes("Fire")
                                                                    ? "border-red-500/40 bg-red-950/30 text-red-400"
                                                                    : "border-slate-700/50 bg-slate-800/30 text-slate-600"
                                                            )}>
                                                                <FireExtinguisher size={12} />
                                                                {services.includes("Fire") ? "✓ Fire" : "Fire"}
                                                            </div>
                                                            <div className={cn(
                                                                "flex items-center justify-center gap-1.5 h-9 px-2 rounded-md border text-[10px] font-medium",
                                                                services.includes("EMS")
                                                                    ? "border-green-500/40 bg-green-950/30 text-green-400"
                                                                    : "border-slate-700/50 bg-slate-800/30 text-slate-600"
                                                            )}>
                                                                <Ambulance size={12} />
                                                                {services.includes("EMS") ? "✓ EMS" : "EMS"}
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            {((data[selectedId] as any)?.dispatched_services || []).length === 0 && (
                                                <p className="text-[10px] text-slate-600 italic text-center">No services dispatched</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => setIsOverlayOpen(!isOverlayOpen)}
                                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-900/90 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white shadow-lg transition-all"
                                >
                                    {isOverlayOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Column 3: Action Sidebar */}
                <div className="w-[400px] flex-shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
                    <TranscriptPanel
                        call={selectedId ? data[selectedId] : emptyCall}
                        selectedId={selectedId || undefined}
                        handleTransfer={handleTransfer}
                        handleResolve={handleResolve}
                        mode="archive"
                        relatedCalls={
                            selectedId && data[selectedId]?.phone && data[selectedId].phone !== "Unknown"
                                ? Object.entries(data)
                                    .filter(([key, call]) =>
                                        key !== selectedId &&
                                        call.phone === data[selectedId].phone
                                    )
                                    .map(([key, call]) => ({ id: key, title: call.title || "Emergency Call", time: call.time }))
                                : []
                        }
                        onSelectRelatedCall={(id: string) => setSelectedId(id)}
                    />
                </div>
            </div>
        </div>
    );
};

export default Page;
