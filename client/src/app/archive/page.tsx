"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import EventPanel from "@/components/live/EventPanel";
import Header from "@/components/live/Header";
import { FilterState } from "@/components/live/EventPanel";
import { Call, CallProps } from "@/data/types";
import { US_STATES, CITY_COORDS } from "@/data/constants";
import TranscriptPanel from "@/components/live/TranscriptPanel";
import { ChevronRight, ChevronLeft, Info, BrainCircuit, Siren, FireExtinguisher, Ambulance, Phone } from "lucide-react";
import EmotionCard from "@/components/live/EmotionCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Map from "@/components/live/map/Map";


interface ServerMessage {
    event: "db_response" | "ai_response";
    data?: Record<string, Call>;
    text?: string;
    user_text?: string;
    emotion?: string;
    location?: [number, number];
}

const getWsUrl = () => {
    if (typeof window === "undefined") return "ws://127.0.0.1:8000/ws/call";
    const host = window.location.hostname;
    return `ws://${host}:8000/ws/call`;
};

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
        timeRange: "ALL",
        status: "ALL",
        severity: "ALL"
    });
    const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
    const [isOverlayOpen, setIsOverlayOpen] = useState(true);
    const { toast } = useToast();
    const wsRef = React.useRef<WebSocket | null>(null);

    const [center, setCenter] = useState<{ lat: number; lng: number }>({
        lat: 37.867989,
        lng: -122.271507,
    });
    const [zoom, setZoom] = useState(4);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const idParam = params.get("id");
            if (idParam) {
                setSelectedId(idParam);
            }
        }
    }, []);

    const filteredData = Object.entries(data).reduce((acc, [key, call]) => {
        // Archive constraint first: Only show ended calls (RESOLVED or UNRESOLVED)
        if (call.severity !== "RESOLVED" && call.severity !== "UNRESOLVED") {
            return acc;
        }

        let match = true;

        // State Filter — check both location_name and city_state
        if (filters.stateCode !== "ALL") {
            const loc = call.location_name || "";
            const cityState = (call as any).city_state || "";
            const stateInfo = US_STATES.find(s => s.code === filters.stateCode);
            if (stateInfo) {
                const stateMatch =
                    loc.includes(` ${stateInfo.code}`) ||
                    loc.includes(`, ${stateInfo.code}`) ||
                    loc.toLowerCase().includes(stateInfo.name.toLowerCase()) ||
                    cityState.includes(` ${stateInfo.code}`) ||
                    cityState.includes(`, ${stateInfo.code}`) ||
                    cityState.toLowerCase().includes(stateInfo.name.toLowerCase());
                if (!stateMatch) match = false;
            }
        }

        // City Filter — check both location_name and city_state
        if (match && filters.city !== "ALL") {
            const loc = call.location_name?.toLowerCase() || "";
            const cityState = ((call as any).city_state || "").toLowerCase();
            if (!loc.includes(filters.city.toLowerCase()) && !cityState.includes(filters.city.toLowerCase())) {
                match = false;
            }
        }

        // Time Range Filter
        if (match && filters.timeRange !== "ALL") {
            const callTime = new Date(call.time).getTime();
            const now = Date.now();
            let cutoff = now;
            switch (filters.timeRange) {
                case "1d": cutoff = now - 24 * 60 * 60 * 1000; break;
                case "3d": cutoff = now - 3 * 24 * 60 * 60 * 1000; break;
                case "1w": cutoff = now - 7 * 24 * 60 * 60 * 1000; break;
                case "1m": cutoff = now - 30 * 24 * 60 * 60 * 1000; break;
                case "1y": cutoff = now - 365 * 24 * 60 * 60 * 1000; break;
            }
            if (callTime < cutoff) match = false;
        }

        // Status Filter (RESOLVED / UNRESOLVED)
        if (match && filters.status !== "ALL") {
            if (call.severity !== filters.status) match = false;
        }

        if (match) acc[key] = call;
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
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ event: "transfer", id: id }));
        }
    };

    const lastGeocodedIdRef = React.useRef<string | null>(null);

    useEffect(() => {
        if (!selectedId || !data[selectedId]) return;
        const call = data[selectedId];

        // Determine if this is a precise street-level address or just city-level
        const cs = (call as any).city_state || "";
        const ln = call.location_name || "";
        const isPrecise = ln !== "" && ln !== "Unknown" && ln !== "Detecting..." && ln !== cs;

        // If coords already exist and are valid, just center the map based on precision
        if (call.location_coords && call.location_coords.lat !== 0 && call.location_coords.lng !== 0) {
            setCenter(call.location_coords);
            setZoom(isPrecise ? 15 : 10);
            return;
        }

        // Don't re-geocode the same call
        if (lastGeocodedIdRef.current === selectedId) return;

        // Determine what to geocode: prefer location_name, fallback to city_state
        const locationQuery = (call.location_name && call.location_name !== "Unknown" && call.location_name !== "Detecting...")
            ? call.location_name
            : ((call as any).city_state && (call as any).city_state !== "Unknown")
                ? (call as any).city_state
                : null;

        if (!locationQuery) return;

        lastGeocodedIdRef.current = selectedId;

        const geocode = async () => {
            let coords: { lat: number; lng: number } | null = null;

            // 1. Try to resolve from pre-stored constants first for city-level
            const cityState = (call as any).city_state || call.location_name;
            const isCityLevel = call.location_name === cityState;

            if (isCityLevel && cityState && cityState !== "Unknown") {
                const parts = cityState.split(",").map((s: string) => s.trim());
                const cityName = parts[0];
                const stateCode = parts.length > 1 ? parts[1] : null;

                if (CITY_COORDS[cityName]) {
                    coords = CITY_COORDS[cityName];
                } else if (stateCode) {
                    const stateObj = US_STATES.find(s => s.code === stateCode);
                    if (stateObj?.coords) {
                        coords = stateObj.coords;
                    }
                }
            }

            // 2. Fallback to Nominatim API for specific addresses
            if (!coords) {
                try {
                    const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
                    const res = await fetch(
                        `http://${host}:8000/api/geocode?q=${encodeURIComponent(locationQuery)}&limit=1`
                    );
                    const geoData = await res.json();
                    if (geoData && geoData.length > 0) {
                        coords = {
                            lat: parseFloat(geoData[0].lat),
                            lng: parseFloat(geoData[0].lon)
                        };
                    }
                } catch (err) {
                    console.error("Failed to geocode archive location:", err);
                }
            }

            if (coords) {
                // Update the call data with coords
                setData(prev => ({
                    ...prev,
                    [selectedId]: {
                        ...prev[selectedId],
                        location_coords: coords!
                    }
                }));
                setCenter(coords);
                setZoom(isPrecise ? 15 : 10);
            }
        };
        geocode();
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
        const connect = () => {
            const ws = new WebSocket(getWsUrl());
            wsRef.current = ws;

            ws.onopen = () => {
                setConnected(true);
                ws.send(JSON.stringify({ event: "get_db" }));
            };

            ws.onmessage = (event: MessageEvent) => {
                const message = JSON.parse(event.data) as ServerMessage;
                if (message.event === "ai_response") {
                    setData(prevData => {
                        const phone = (message as any).phone;
                        const liveCallId = (message as any).id || "unknown_call";
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
                    const phone = (message as any).phone;
                    const liveCallId = (message as any).id || "unknown_call";
                    if (selectedId !== liveCallId) setSelectedId(liveCallId);
                } else if (message.data) {
                    setData(prevData => ({ ...prevData, ...message.data }));
                }
            };

            ws.onclose = () => setConnected(false);
            ws.onerror = (error) => console.error("WebSocket Error:", error);
        };

        connect();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    // Determine the map props similar to live page
    const selectedCall = selectedId ? data[selectedId] : null;
    const isPreciseAddress = selectedCall &&
        selectedCall.location_name !== "" &&
        selectedCall.location_name !== "Unknown" &&
        selectedCall.location_name !== "Detecting..." &&
        selectedCall.location_name !== ((selectedCall as any).city_state || "");

    return (
        <div className="flex h-full flex-col space-y-1 selection:bg-blue-500/30">
            <div className="rounded-xl border border-slate-800 bg-slate-900 shadow-xl relative z-[2000] drop-shadow-2xl">
                <Header connected={connected} city={city} setCity={handleHeaderCityChange} filters={filters} onLocationSearch={setSearchedLocation} />
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
                <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/20 shadow-2xl z-[10]">
                    <Map
                        center={center}
                        zoom={zoom}
                        searchedLocation={searchedLocation}
                        cityCircle={
                            selectedCall && !isPreciseAddress && selectedCall.location_coords
                                ? {
                                    lat: selectedCall.location_coords.lat,
                                    lng: selectedCall.location_coords.lng,
                                    label: selectedCall.location_name || (selectedCall as any).city_state || ""
                                }
                                : undefined
                        }
                        pins={
                            isPreciseAddress && selectedCall?.location_coords
                                ? [{
                                    coordinates: [
                                        selectedCall.location_coords!.lat,
                                        selectedCall.location_coords!.lng,
                                    ],
                                    popupHtml: `<b>${selectedCall.title || "Emergency Call"}</b><br>Location: ${selectedCall.location_name}`,
                                }]
                                : []
                        }
                    />

                    {/* Collapsible Overlay */}
                    {selectedId && data[selectedId] && (
                        <div className={cn(
                            "absolute right-[-8px] top-4 z-[1000] flex items-center transition-all duration-300 ease-in-out",
                            isOverlayOpen ? "translate-x-0" : "translate-x-[calc(100%+20px)]"
                        )}>
                            <div className="flex flex-row items-center space-x-1">
                                {isOverlayOpen && (
                                    <div className="flex w-80 flex-col space-y-3 rounded-2xl border border-slate-700/50 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-right-4">
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
                                                    {data[selectedId].id && (
                                                        <div className="flex items-center space-x-1 text-[10px] text-slate-500/80 pt-0.5">
                                                            <span className="font-mono bg-slate-800/50 px-1.5 py-0.5 rounded text-[9px] border border-slate-700/50">{data[selectedId].id}</span>
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
                        isMapOverlayOpen={isOverlayOpen}
                        onToggleMapOverlay={() => setIsOverlayOpen(!isOverlayOpen)}
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
