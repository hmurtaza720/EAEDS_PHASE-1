"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import EventPanel from "@/components/live/EventPanel";
import Header from "@/components/live/Header";
import { FilterState } from "@/components/live/EventPanel";
import { US_STATES, CITY_COORDS } from "@/data/constants";
import { Call } from "@/data/types";
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
    event: "db_response" | "ai_response" | "incoming_call" | "audio_relay";
    data?: Record<string, Call>;
    text?: string;
    user_text?: string;
    emotion?: string;
    location?: [number, number];
    phone?: string;
    location_manual?: string;
    timestamp?: string;
    chunk?: string;
}

export interface CallProps {
    call?: Call;
    selectedId: string | undefined;
}

const getWsUrl = () => {
    // Explicitly use 127.0.0.1 to avoid Windows IPv6 resolution issues with localhost
    return "ws://127.0.0.1:8000/ws/call";
};

let wss: WebSocket | null = null;

const emptyCall: Call = {
    emotions: [],
    id: "",
    location_name: "",
    location_coords: {
        lat: 0,
        lng: 0,
    },
    street_view: "", // base 64
    name: "",
    phone: "",
    recommendation: "",
    severity: "RESOLVED",
    summary: "",
    time: "",
    title: "",
    transcript: [],
    type: "",
    status: "Disconnected",
    responder_type: "AI",
    agent_name: "Unknown"
};

const Page = () => {
    const [connected, setConnected] = useState(false);
    const [data, setData] = useState<Record<string, Call>>({});
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const [resolvedIds, setResolvedIds] = useState<string[]>([]);
    const [city, setCity] = useState("ALL");
    const [liveClockTime, setLiveClockTime] = useState("");
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

    // WebSocket Ref
    const wsRef = React.useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Toast deduplication: prevent showing the same toast within 3 seconds
    const lastToastRef = React.useRef<Record<string, number>>({});
    const showDedupedToast = (key: string, toastArgs: Parameters<typeof toast>[0]) => {
        const now = Date.now();
        if (lastToastRef.current[key] && now - lastToastRef.current[key] < 10000) {
            return; // Skip duplicate
        }
        lastToastRef.current[key] = now;
        toast(toastArgs);
    };

    // Track what location_name was last geocoded per call, to detect changes
    const geocodedNamesRef = React.useRef<Record<string, string>>({});

    // Map phone numbers to backend-assigned call IDs (set once on incoming_call, reused on ai_response)
    const phoneToIdRef = React.useRef<Record<string, string>>({});

    // Effect to Geocode Textual Locations coming from the LLM
    useEffect(() => {
        const geocodeLocations = async () => {
            let updated = false;
            const newData = { ...data };

            for (const [id, call] of Object.entries(newData)) {
                // If we have a location name from the LLM...
                if (call.location_name && call.location_name !== "Unknown" && call.location_name !== "Detecting...") {
                    // Geocode if: no coords yet, coords are 0/0, OR the name changed since last geocode
                    const needsGeocode = !call.location_coords
                        || (call.location_coords.lat === 0 && call.location_coords.lng === 0)
                        || (geocodedNamesRef.current[id] !== call.location_name);

                    if (needsGeocode) {
                        let coords: { lat: number; lng: number } | null = null;

                        // 1. Try to resolve from pre-stored constants first
                        //    location_name for city-level is "City, ST" (e.g., "New York, NY")
                        const cityState = (call as any).city_state || call.location_name;
                        const isCityLevel = call.location_name === cityState;

                        if (isCityLevel && cityState && cityState !== "Unknown") {
                            // SKIP city-level geocoding entirely — wait for the actual address
                            // The LLM will provide a specific address shortly after
                            console.log(`📍 [Skip] City-level location '${cityState}' — waiting for specific address`);
                            geocodedNamesRef.current[id] = call.location_name;
                            continue;
                        }

                        // 2. Fallback to Nominatim API for specific addresses (not city-level)
                        if (!coords) {
                            try {
                                const geoHost = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
                                const res = await fetch(`http://${geoHost}:8000/api/geocode?q=${encodeURIComponent(call.location_name)}&limit=1`);
                                const geoData = await res.json();

                                if (geoData && geoData.length > 0) {
                                    coords = {
                                        lat: parseFloat(geoData[0].lat),
                                        lng: parseFloat(geoData[0].lon)
                                    };
                                    console.log(`📍 [Geocode API] ${call.location_name} → ${coords.lat}, ${coords.lng}`);
                                }
                            } catch (err) {
                                console.error("Failed to geocode LLM location:", err);
                            }
                        }

                        // Apply coordinates if found
                        if (coords) {
                            newData[id] = {
                                ...call,
                                location_coords: coords
                            };
                            geocodedNamesRef.current[id] = call.location_name;
                            updated = true;
                        }
                    }
                }
            }
            if (updated) {
                setData(newData);
            }
        };

        // Adding a slight debounce to avoid slamming the Nominatim API
        const timeoutId = setTimeout(geocodeLocations, 500);
        return () => clearTimeout(timeoutId);
    }, [data]);

    // Persist dispatched_services to sessionStorage whenever data changes
    useEffect(() => {
        const dispatchMap: Record<string, string[]> = {};
        for (const [id, call] of Object.entries(data)) {
            const services = (call as any).dispatched_services;
            if (services && services.length > 0) {
                dispatchMap[id] = services;
            }
        }
        if (Object.keys(dispatchMap).length > 0) {
            sessionStorage.setItem('eaeds_dispatched', JSON.stringify(dispatchMap));
        }
    }, [data]);

    // Live clock for the selected call's timezone
    useEffect(() => {
        const updateClock = () => {
            if (!selectedId || !data[selectedId]) { setLiveClockTime(""); return; }
            const call = data[selectedId];
            const locationStr = (call as any).city_state || call.location_name || "";
            const matched = US_STATES.find(s =>
                s.code !== "ALL" && (
                    locationStr.includes(`, ${s.code}`) ||
                    locationStr.includes(` ${s.code}`) ||
                    locationStr.toLowerCase().includes(s.name.toLowerCase())
                )
            );
            if (matched) {
                try {
                    setLiveClockTime(new Date().toLocaleTimeString("en-US", {
                        timeZone: matched.tz,
                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                    }));
                } catch { setLiveClockTime(""); }
            } else {
                setLiveClockTime("");
            }
        };
        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, [selectedId, data]);

    // Manual Reconnect Function
    const forceReconnect = () => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        setConnected(false);
        toast({ title: "Reconnecting...", description: "Attempting to reach server." });
        connectWs();
    };

    // Reset System Function
    const handleResetSystem = async () => {
        if (!confirm("⚠️ RESET SYSTEM?\n\nThis will clear ALL active calls from the live dashboard.\n(Database history will be preserved).")) return;

        try {
            const res = await fetch("http://127.0.0.1:8000/api/reset-system", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wipe_db: false })
            });
            if (res.ok) {
                toast({ title: "System Reset", description: "All active calls cleared." });
                window.location.reload();
            } else {
                alert("Reset failed");
            }
        } catch (e) {
            console.error(e);
            alert("Error resetting system");
        }
    };

    // Filter data based on selected city
    const filteredData = Object.entries(data).reduce((acc, [key, call]) => {
        // ALWAYS exclude historical/archived calls from the live feed
        if ((call as any).is_archived) {
            return acc;
        }

        let match = true;
        const activeSeverityFilter = filters.severity && filters.severity !== "ALL" ? filters.severity : null;

        // 1. If an explicit severity is selected from EventPanel, enforce it strictly
        if (activeSeverityFilter) {
            if (call.severity !== activeSeverityFilter) match = false;
        }
        else {
            // Default "ALL" view logic:
            // Show all live calls including RESOLVED ones — they should NOT vanish
            if (call.severity === "UNRESOLVED") {
                // Auto-expire UNRESOLVED ones after 2 mins from main feed
                const endedAt = new Date(call.time).getTime();
                const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
                if (endedAt < twoMinutesAgo) {
                    match = false;
                }
            }
        }

        // 2. Additional Dropdown filters (State, City, Status, TimeRange)
        if (match && filters.stateCode !== "ALL") {
            const loc = call.location_name || "";
            const stateInfo = US_STATES.find(s => s.code === filters.stateCode);
            if (stateInfo) {
                const stateMatch = loc.includes(` ${stateInfo.code}`) ||
                    loc.includes(`, ${stateInfo.code}`) ||
                    loc.toLowerCase().includes(stateInfo.name.toLowerCase());
                if (!stateMatch) match = false;
            }
        }

        if (match && filters.city !== "ALL") {
            const loc = call.location_name?.toLowerCase() || "";
            if (!loc.includes(filters.city.toLowerCase())) match = false;
        }

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

        if (match && filters.status !== "ALL") {
            if (call.severity !== filters.status) match = false;
        }

        if (match) acc[key] = call;
        return acc;
    }, {} as Record<string, Call>);

    // Auto-expire UNRESOLVED calls: re-evaluate every 30 seconds
    React.useEffect(() => {
        const interval = setInterval(() => {
            setData(prev => ({ ...prev })); // Trigger re-render to re-evaluate filteredData
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const { center, zoom } = useMemo(() => {
        if (selectedId && data[selectedId]) {
            const call = data[selectedId];
            if (call.location_coords) {
                // Determine if this is city-level or precise address
                const cs = (call as any).city_state || "";
                const ln = call.location_name || "";
                const isPrecise = ln !== "" && ln !== "Unknown" && ln !== "Detecting..." && ln !== cs;
                return { center: call.location_coords, zoom: isPrecise ? 15 : 10 };
            }
        }

        if (filters.city !== "ALL") {
            const firstCallInCity = Object.values(filteredData).find(c =>
                c.location_name?.toLowerCase().includes(filters.city.toLowerCase()) && c.location_coords
            );
            if (firstCallInCity) {
                return { center: firstCallInCity.location_coords!, zoom: 10 };
            }
            if (CITY_COORDS[filters.city]) {
                return { center: CITY_COORDS[filters.city], zoom: 10 };
            }
        }

        const stateObj = US_STATES.find(s => s.code === filters.stateCode);
        if (stateObj && stateObj.coords) {
            return {
                center: stateObj.coords,
                zoom: filters.stateCode === "ALL" ? 4 : 6
            };
        }

        return { center: { lat: 39.8283, lng: -98.5795 }, zoom: 4 };
    }, [filters.stateCode, filters.city, selectedId, data, filteredData]);


    const handleFilterChange = (newFilters: FilterState) => {
        setFilters(newFilters);
        setCity(newFilters.stateCode);
    };

    const handleHeaderCityChange = (newCity: string) => {
        setCity(newCity);
        setFilters(prev => ({ ...prev, stateCode: newCity, city: "ALL" }));
    };


    const handleSelect = (id: string) => {
        setSelectedId(id === selectedId ? undefined : id);
    };

    const handleDispatch = (id: string, dispatchType?: string) => {
        if (!dispatchType) return;

        // Guard: don't dispatch on ended calls
        const call = data[id];
        if (call?.severity === "RESOLVED" || call?.severity === "UNRESOLVED" || call?.status === "Disconnected") {
            console.log(`Dispatch blocked — call ${id} has already ended.`);
            return;
        }

        // Send dispatch event — marks the call as dispatched but does NOT end it
        const phoneToSend = call?.phone || "";
        if (phoneToSend && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                event: "dispatch",
                phone: phoneToSend,
                dispatch_type: dispatchType
            }));
            console.log(`Sent dispatch event (${dispatchType}) for:`, phoneToSend);
        }

        // Update local state: track which services have been dispatched
        setData(prev => {
            const updated = { ...prev };
            if (updated[id]) {
                const existing = (updated[id] as any).dispatched_services || [];
                updated[id] = {
                    ...updated[id],
                    responder_type: dispatchType + " Dispatched",
                    dispatched_services: [...existing, dispatchType]
                } as any;
            }
            return updated;
        });
    };

    const [isManualMode, setIsManualMode] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isOnHold, setIsOnHold] = useState(false);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);

    const startStreaming = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = (reader.result as string).split(',')[1];
                        wsRef.current!.send(JSON.stringify({
                            event: "audio_relay",
                            chunk: base64data
                        }));
                    };
                    reader.readAsDataURL(event.data);
                }
            };

            mediaRecorder.start(250); // 250ms chunks
        } catch (err) {
            console.error("Error accessing microphone:", err);
            toast({ title: "Microphone Error", description: "Could not access microphone." });
        }
    };

    const stopStreaming = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            mediaRecorderRef.current = null;
        }
    };

    const toggleMute = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getAudioTracks().forEach(track => {
                track.enabled = isMuted; // If currently muted (true), enable track (true)
            });
            setIsMuted(!isMuted);
            toast({
                title: isMuted ? "Microphone Unmuted" : "Microphone Muted",
                description: isMuted ? "Caller can hear you." : "Caller cannot hear you."
            });
        }
    };

    const toggleHold = () => {
        setIsOnHold(!isOnHold);
        // In a real app, send "hold" event to server
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                event: "hold_toggle",
                active: !isOnHold
            }));
        }
        toast({
            title: !isOnHold ? "Call Placed on Hold" : "Call Resumed",
            description: !isOnHold ? "Music on hold active." : "You are live again."
        });
    };

    const handleTransfer = (id: string) => {
        const newState = !isManualMode;
        setIsManualMode(newState);

        // Reset states on toggle
        setIsMuted(false);
        setIsOnHold(false);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                event: "manual_mode_toggle",
                active: newState
            }));
        }

        if (newState) {
            startStreaming();
            toast({ title: "Manual Mode Active", description: "You are now live with the caller." });
        } else {
            stopStreaming();
            toast({ title: "AI Resumed", description: "Returned to automated dispatch." });
        }
    };

    const handleHangup = () => {
        stopStreaming();
        setIsManualMode(false);
        setIsMuted(false);
        setIsOnHold(false);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                event: "hangup"
            }));
        }

        // Update local state to disconnected
        if (selectedId && data[selectedId]) {
            setData(prev => ({
                ...prev,
                [selectedId]: {
                    ...prev[selectedId],
                    status: "Disconnected",
                    severity: "RESOLVED"
                }
            }));
        }

        // Toast is handled by the WebSocket end_call event handler — no duplicate here
    };

    // Removed redundant useEffect causing 'setCenter' error - useMemo handles this logic.

    // Sync state dropdown with selected call location
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

    // WebSocket Connection Logic
    const connectWs = () => {
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const url = getWsUrl();
        console.log("Connecting to WebSocket:", url);
        const socket = new WebSocket(url);
        wsRef.current = socket;

        socket.onopen = () => {
            console.log("WebSocket connected");
            setConnected(true);
            // toast({ title: "System Online", description: "Connected to Server" });
            socket.send(JSON.stringify({ event: "get_db" }));
        };

        socket.onmessage = (event: MessageEvent) => {
            const message = JSON.parse(event.data) as ServerMessage;

            if (message.event === "ai_response") {
                console.log("Received AI response", message);
                setData(prevData => {
                    // DYNAMIC ID: Use the backend-generated call ID






                    const phone = (message as any).phone;
                    // Use backend-generated ID first, then stored phone mapping, then phone-derived fallback
                    let liveCallId = (message as any).id
                        || (phone && phone !== "Unknown" && phoneToIdRef.current[phone])
                        || "unknown_call";

                    const currentCall = prevData[liveCallId] || {
                        ...emptyCall,
                        id: liveCallId,
                        title: "Live Incoming Call",
                        name: phone ? `Caller ${phone}` : "Caller (Unknown)",
                        phone: phone || "",
                        severity: "CRITICAL",
                        location_name: "Detecting...",
                        type: "Emergency",
                        time: new Date().toISOString(),
                        transcript: []
                    };

                    // 1. Handle Full Transcript Replacement (State Recovery)
                    if ((message as any).full_transcript) {
                        const recoveredTranscript = (message as any).full_transcript;
                        return {
                            ...prevData,
                            [liveCallId]: {
                                ...currentCall,
                                transcript: recoveredTranscript,
                                emotions: currentCall.emotions, // Keep existing or update if emotion provided
                                location_coords: currentCall.location_coords,
                                location_name: currentCall.location_name
                            }
                        };
                    }

                    // 2. Incremental Update with Strict Deduplication
                    const newEntries = [];

                    // Create a Set of existing message signatures to prevent dupes
                    const existingSignatures = new Set(
                        currentCall.transcript.map(t => `${t.role}:${t.content.trim()}`)
                    );

                    // Check User Text
                    if (message.user_text) {
                        const signature = `user:${message.user_text.trim()}`;
                        if (!existingSignatures.has(signature)) {
                            newEntries.push({ role: "user" as const, content: message.user_text });
                            existingSignatures.add(signature);
                        }
                    }

                    // Check AI Text
                    if (message.text) {
                        const signature = `assistant:${message.text.trim()}`;

                        // Filter out any system/debug messages if they leak
                        // Also proactively filter out "Resetting simulation" type messages if they exist
                        const isSystemDump = message.text.includes("<ACTION>") || message.text.includes("Simulation Reset");

                        if (!existingSignatures.has(signature) && !isSystemDump) {
                            newEntries.push({ role: "assistant" as const, content: message.text });
                            existingSignatures.add(signature);
                        }
                    }

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
                    if (message.location && typeof message.location === "string" && message.location !== "Unknown") {
                        // Optimistically set the name. The coords will be geocoded by a separate effect.
                        newLocationName = message.location;
                    } else if (message.location && Array.isArray(message.location)) {
                        newLocation = { lat: message.location[0], lng: message.location[1] };
                        newLocationName = "Detected Location";
                    }

                    let newCityState = currentCall.city_state;
                    if ((message as any).city_state) {
                        newCityState = (message as any).city_state;
                    }

                    let newStatus = currentCall.status;
                    let newSeverity = currentCall.severity;

                    if ((message as any).end_call) {
                        newStatus = "Disconnected";
                        newSeverity = "RESOLVED";
                        // Optionally trigger toast here or outside
                    }

                    // Handle dispatched_services from LLM
                    let newDispatchedServices = currentCall.dispatched_services || [];
                    const incomingServices = (message as any).dispatched_services;
                    if (incomingServices && Array.isArray(incomingServices) && incomingServices.length > 0) {
                        const merged = new Set([...newDispatchedServices, ...incomingServices]);
                        newDispatchedServices = Array.from(merged);
                        // Mark as RESOLVED once any service is dispatched
                        newSeverity = "RESOLVED";
                    }

                    return {
                        ...prevData,
                        [liveCallId]: {
                            ...currentCall,
                            transcript: newTranscript,
                            emotions: newEmotions,
                            location_coords: newLocation,
                            location_name: newLocationName,
                            city_state: newCityState,
                            status: newStatus,
                            severity: newSeverity,
                            dispatched_services: newDispatchedServices
                        }
                    };
                });


                const phone = (message as any).phone;
                let liveCallId = (message as any).id
                    || (phone && phone !== "Unknown" && phoneToIdRef.current[phone])
                    || "unknown_call";

                if (!selectedId) {
                    setSelectedId(liveCallId);
                }

                if ((message as any).end_call) {
                    const severity = (message as any).severity || "UNRESOLVED";
                    const wasResolved = severity === "RESOLVED";
                    showDedupedToast(`call_ended_${liveCallId}`, {
                        title: "Call Ended",
                        description: wasResolved
                            ? "The call has been resolved and archived."
                            : "The call has been archived as unresolved.",
                        variant: "default"
                    });
                }

                // Notify when LLM dispatches services
                const dispatchedNow = (message as any).dispatched_services;
                if (dispatchedNow && Array.isArray(dispatchedNow) && dispatchedNow.length > 0) {
                    showDedupedToast(`dispatch_${liveCallId}_${dispatchedNow.join(',')}`, {
                        title: "🚨 Units Dispatched",
                        description: `AI dispatched: ${dispatchedNow.join(', ')}`,
                        variant: "default"
                    });
                }
            } else if (message.event === "incoming_call") {
                console.log("Incoming Call Received:", message);
                // FORCE RESET: When a new call comes in, we must wipe the previous state.
                setData(prevData => {
                    const phone = (message as any).phone;
                    // Use backend-generated ID — no live_session_ fallback
                    let liveCallId = (message as any).id
                        || (phone && phone !== "Unknown" && phoneToIdRef.current[phone])
                        || "unknown_call";

                    // Store the phone → ID mapping so all future messages use this ID
                    if (phone && phone !== "Unknown") {
                        phoneToIdRef.current[phone] = liveCallId;
                    }

                    const cityStateStr = (message as any).city_state || "Unknown";
                    let initialCoords = { lat: 0, lng: 0 };

                    if (cityStateStr !== "Unknown") {
                        const parts = cityStateStr.split(",").map((s: string) => s.trim());
                        const cityName = parts[0];
                        const stateCode = parts.length > 1 ? parts[1] : null;

                        if (CITY_COORDS[cityName]) {
                            initialCoords = CITY_COORDS[cityName];
                        } else if (stateCode) {
                            const stateObj = US_STATES.find(s => s.code === stateCode);
                            if (stateObj?.coords) {
                                initialCoords = stateObj.coords;
                            }
                        }
                    }

                    // Create a FRESH object, do not merge with old transcript
                    const newCallData: Call = {
                        ...emptyCall,
                        id: liveCallId,
                        phone: (message as any).phone,
                        title: "Incoming 911 Call",
                        name: `Caller ${(message as any).phone || "Unknown"}`,
                        severity: "CRITICAL",
                        location_name: (message as any).location_manual,
                        location_coords: initialCoords,
                        city_state: cityStateStr,
                        type: "Emergency",
                        time: (message as any).timestamp || new Date().toISOString(),
                        transcript: [],
                        status: "Connected",
                        responder_type: "AI",
                        emotions: (message as any).emotion ? [{
                            emotion: (message as any).emotion,
                            intensity: 0.9
                        }] : []
                    };

                    // Restore dispatched_services from sessionStorage if this is a recovery
                    try {
                        const saved = sessionStorage.getItem('eaeds_dispatched');
                        if (saved) {
                            const dispatchMap = JSON.parse(saved);
                            if (dispatchMap[liveCallId]) {
                                (newCallData as any).dispatched_services = dispatchMap[liveCallId];
                                // If services were dispatched, mark as resolved
                                newCallData.severity = "RESOLVED";
                            }
                        }
                    } catch { /* ignore parse errors */ }

                    return {
                        ...prevData,
                        [liveCallId]: newCallData
                    };
                });

                // Calculate ID again to set selection (needs to match the one inside setData)
                const phone = (message as any).phone;
                let liveCallId = (message as any).id
                    || (phone && phone !== "Unknown" && phoneToIdRef.current[phone])
                    || "unknown_call";
                setSelectedId(liveCallId);

                // Only show toast if NOT a recovery message, with deduplication
                if (!(message as any).is_recovery) {
                    showDedupedToast(`incoming_call_${liveCallId}`, {
                        title: "Incoming Emergency Call",
                        description: `Call from ${(message as any).location_manual}`,
                        variant: "destructive"
                    });
                }
            } else if ((message as any).event === "dispatch_update") {
                // Dispatch update: mark the call as dispatched (services sent)
                const phone = (message as any).phone;
                const dispatchType = (message as any).dispatch_type || "Emergency Services";
                const liveCallId = (message as any).id || (phone && phoneToIdRef.current[phone]) || "unknown_call";

                setData(prev => {
                    if (prev[liveCallId]) {
                        return {
                            ...prev,
                            [liveCallId]: {
                                ...prev[liveCallId],
                                responder_type: dispatchType + " Dispatched"
                            }
                        };
                    }
                    return prev;
                });
            } else if (message.data) {
                // DB Response: Contains Historical/Resolved calls.
                setData(prevData => {
                    // We only want to pull in the history to `data`
                    // Live sessions are handled by incoming_call, ai_response, and end_call events.

                    const historicalData = { ...message.data };
                    Object.keys(historicalData).forEach(key => {
                        historicalData[key].is_archived = true;
                    });

                    return {
                        ...prevData,
                        ...historicalData
                    };
                });
            } else if (message.event === "audio_relay" && (message as any).chunk) {
                try {
                    const audio = new Audio("data:audio/webm;base64," + (message as any).chunk);
                    audio.play().catch(e => console.error("Audio Playback Error:", e));
                } catch (e) {
                    console.error("Audio Init Error:", e);
                }
            }
        };

        socket.onclose = () => {
            console.log("WebSocket Disconnected. Reconnecting in 3s...");
            setConnected(false);
            wsRef.current = null;
            reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error:", error);
            socket.close(); // Force close to trigger simple reconnect logic
        };
    };

    useEffect(() => {
        connectWs();
        return () => {
            if (wsRef.current) wsRef.current.close();
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        };
    }, []);

    return (
        <div className="flex h-full flex-col space-y-1 selection:bg-blue-500/30">
            <div className="rounded-xl border border-slate-800 bg-slate-900 shadow-xl flex justify-between items-center pr-4 relative z-[2000] drop-shadow-2xl">
                <Header connected={connected} city={city} setCity={handleHeaderCityChange} filters={filters} onLocationSearch={setSearchedLocation} onFilterChange={handleFilterChange} />
                <div className="flex space-x-2">
                    <Button
                        onClick={handleResetSystem}
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                    >
                        Reset System
                    </Button>
                    {!connected && (
                        <Button onClick={forceReconnect} variant="outline" size="sm" className="h-8 text-[10px] bg-red-900/20 text-red-500 border-red-900/50">
                            Reconnect
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-1 space-x-1 overflow-hidden">
                {/* Column 1: Emergency Feed */}
                <div className="w-[360px] flex-shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-xl">
                    <EventPanel
                        data={filteredData}
                        selectedId={selectedId || undefined}
                        handleSelect={handleSelect}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        countersData={data}
                        showSearchAndFilters={false}
                    />
                </div>

                {/* Column 2: Map Workspace */}
                <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/20 shadow-2xl z-[10]">
                    {(() => {
                        // Determine if the selected call has a precise address or just city/state
                        const selectedCall = selectedId ? data[selectedId] : null;
                        const cityState = (selectedCall as any)?.city_state || "";
                        const locationName = selectedCall?.location_name || "";
                        const hasPreciseAddress = selectedCall?.location_coords
                            && locationName !== ""
                            && locationName !== "Unknown"
                            && locationName !== "Detecting..."
                            && locationName !== cityState;

                        return (
                            <Map
                                center={center}
                                zoom={zoom}
                                searchedLocation={searchedLocation}
                                cityCircle={
                                    selectedCall?.location_coords && !hasPreciseAddress
                                        ? { lat: selectedCall.location_coords.lat, lng: selectedCall.location_coords.lng, label: cityState || locationName }
                                        : null
                                }
                                selectedCoordinates={
                                    hasPreciseAddress && selectedCall?.location_coords
                                        ? [selectedCall.location_coords.lat, selectedCall.location_coords.lng]
                                        : undefined
                                }
                                pins={
                                    Object.entries(filteredData)
                                        .filter(([_, call]) => {
                                            // Only show pins for calls with precise addresses
                                            const cs = (call as any).city_state || "";
                                            const ln = call.location_name || "";
                                            return call.location_coords && ln && ln !== "Unknown" && ln !== "Detecting..." && ln !== cs;
                                        })
                                        .map(([_, call]) => ({
                                            coordinates: [
                                                call.location_coords?.lat as number,
                                                call.location_coords?.lng as number,
                                            ],
                                            popupHtml: `<b>${call.title}</b><br>Location: ${call.location_name}`,
                                        }))
                                }
                            />
                        );
                    })()}

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
                                                    <p className="text-[10px] text-slate-500 font-medium">{data[selectedId].city_state && data[selectedId].city_state !== "Unknown" ? data[selectedId].city_state : data[selectedId].location_name}</p>
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
                                                <div className="flex items-center gap-2">
                                                    {liveClockTime && (
                                                        <span className="text-[10px] font-mono text-blue-400/80" suppressHydrationWarning>
                                                            {liveClockTime}
                                                        </span>
                                                    )}
                                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                                </div>
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
                                            <ScrollArea className="max-h-60 pr-2">
                                                <p className="text-xs leading-relaxed text-slate-300">
                                                    {data[selectedId]?.summary || "AI is generating summary from live transcript flows..."}
                                                </p>
                                            </ScrollArea>
                                        </div>

                                        <Separator className="bg-slate-800/50" />

                                        {/* Rapid Dispatch Section */}
                                        {(() => {
                                            const call = data[selectedId];
                                            const isCallEnded = call?.status === "Disconnected";
                                            const dispatched = (call as any)?.dispatched_services || [];

                                            if (isCallEnded) {
                                                // Call ended — show read-only dispatched services badges
                                                return (
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Dispatched Services</p>
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
                                                        {dispatched.length === 0 && (
                                                            <p className="text-[10px] text-slate-600 italic text-center">No services dispatched</p>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            // Call is live — show active dispatch buttons
                                            return (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rapid Dispatch</p>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <Button
                                                            variant="outline"
                                                            disabled={dispatched.includes("Police")}
                                                            className={cn(
                                                                "h-9 px-2 text-[10px] gap-1.5",
                                                                dispatched.includes("Police")
                                                                    ? "border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed"
                                                                    : "border-blue-900/30 bg-blue-950/20 text-blue-400 hover:bg-blue-900/30"
                                                            )}
                                                            onClick={() => {
                                                                toast({
                                                                    title: "Police Dispatched",
                                                                    description: `Units en route to ${data[selectedId].location_name}`
                                                                });
                                                                handleDispatch(selectedId, "Police");
                                                            }}
                                                        >
                                                            <Siren size={12} /> {dispatched.includes("Police") ? "✓ Police" : "Police"}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            disabled={dispatched.includes("Fire")}
                                                            className={cn(
                                                                "h-9 px-2 text-[10px] gap-1.5",
                                                                dispatched.includes("Fire")
                                                                    ? "border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed"
                                                                    : "border-red-900/30 bg-red-950/20 text-red-400 hover:bg-red-900/30"
                                                            )}
                                                            onClick={() => {
                                                                toast({
                                                                    title: "Fire Dispatched",
                                                                    description: "Engine units responding."
                                                                });
                                                                handleDispatch(selectedId, "Fire");
                                                            }}
                                                        >
                                                            <FireExtinguisher size={12} /> {dispatched.includes("Fire") ? "✓ Fire" : "Fire"}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            disabled={dispatched.includes("EMS")}
                                                            className={cn(
                                                                "h-9 px-2 text-[10px] gap-1.5",
                                                                dispatched.includes("EMS")
                                                                    ? "border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed"
                                                                    : "border-green-900/30 bg-green-950/20 text-green-400 hover:bg-green-900/30"
                                                            )}
                                                            onClick={() => {
                                                                toast({
                                                                    title: "EMS Dispatched",
                                                                    description: "Paramedics en route."
                                                                });
                                                                handleDispatch(selectedId, "EMS");
                                                            }}
                                                        >
                                                            <Ambulance size={12} /> {dispatched.includes("EMS") ? "✓ EMS" : "EMS"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
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
                        handleResolve={handleDispatch} // Passing dispatch handler to unified sidebar
                        isManualMode={isManualMode}
                        toggleMute={toggleMute}
                        toggleHold={toggleHold}
                        isMuted={isMuted}
                        isOnHold={isOnHold}
                        handleHangup={handleHangup}
                        isMapOverlayOpen={isOverlayOpen}
                        onToggleMapOverlay={() => setIsOverlayOpen(!isOverlayOpen)}
                    />
                </div>
            </div>
        </div>
    );
};

export default Page;
