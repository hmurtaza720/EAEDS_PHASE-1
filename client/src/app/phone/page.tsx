"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, MapPin, Delete, PhoneOff, Mic, MicOff, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { US_STATES } from "@/data/constants";
// import { areaCodes } from "area-codes"; // Types might be missing, so we'll use a safer approach or ignore ts

export default function PhonePage() {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [selectedLocation, setSelectedLocation] = useState("");
    const [regLocation, setRegLocation] = useState<string | null>(null);
    const [status, setStatus] = useState<"IDLE" | "CALLING" | "CONNECTED" | "ENDED">("IDLE");
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);

    // Keyboard Input Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (status !== "IDLE") return;

            // Allow numbers, *, #
            if (/^[0-9*#]$/.test(e.key)) {
                handleKeyPress(e.key);
            } else if (e.key === "Backspace") {
                handleDelete();
            } else if (e.key === "Enter") {
                if (phoneNumber && selectedLocation) handleCall();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [phoneNumber, selectedLocation, status]);

    // Keypad Logic
    const handleKeyPress = (key: string) => {
        if (phoneNumber.length < 10) {
            const newNum = phoneNumber + key;
            setPhoneNumber(newNum);
            // Trigger partial lookup logic here if needed
            if (newNum.length >= 3) {
                lookupLocation(newNum);
            }
        }
    };

    const handleDelete = () => {
        setPhoneNumber(prev => prev.slice(0, -1));
        if (phoneNumber.length <= 3) setRegLocation(null);
    };

    const lookupLocation = async (num: string) => {
        const areaCode = num.substring(0, 3);
        try {
            // Dynamically import to avoid SSR issues or type errors if lib is finicky
            const areaCodes = require('area-codes');
            const data = areaCodes.get(areaCode);
            if (data) {
                // area-codes returns string like "New York, NY" or object? 
                // Usually it returns location string or state.
                // Let's assume text for now based on common libs, or check if it's an object
                setRegLocation(typeof data === 'string' ? data : `${data.city || ''} ${data.state || ''}`);
            } else {
                // Fallback
                fallbackLookup(areaCode);
            }
        } catch (e) {
            fallbackLookup(areaCode);
        }
    };

    const fallbackLookup = (areaCode: string) => {
        if (areaCode === "415") setRegLocation("San Francisco, CA");
        else if (areaCode === "212") setRegLocation("New York, NY");
        else if (areaCode === "312") setRegLocation("Chicago, IL");
        else if (areaCode === "512") setRegLocation("Austin, TX");
        else setRegLocation("United States");
    }

    const handleCall = () => {
        if (!phoneNumber || !selectedLocation) return;
        setStatus("CALLING");

        // Connect WS
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host.split(":")[0];
        const socket = new WebSocket(`${protocol}//${host}:8000/ws/call`);

        socket.onopen = () => {
            console.log("Connected to Dispatch");
            setWs(socket);
            setStatus("CONNECTED");

            // Send Initial Payload with Location Meta-Data
            socket.send(JSON.stringify({
                event: "start_call",
                phone: phoneNumber,
                location_manual: selectedLocation,
                location_reg: regLocation
            }));

            // Start Audio
            startAudio(socket);
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.event === "audio_relay" && msg.chunk) {
                playAudioChunk(msg.chunk);
            }
        };

        socket.onclose = () => {
            setStatus("ENDED");
            setWs(null);
            stopAudio();
            setTimeout(() => setStatus("IDLE"), 2000);
        };
    };

    const handleEndCall = () => {
        if (ws) ws.close();
        setStatus("ENDED");
    };

    // Audio Logic
    const startAudio = async (socket: WebSocket) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setAudioStream(stream);

            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        socket.send(JSON.stringify({
                            event: "audio_relay",
                            chunk: base64
                        }));
                    };
                    reader.readAsDataURL(e.data);
                }
            };
            mediaRecorder.start(250);
        } catch (err) {
            console.error("Mic Access Denied", err);
        }
    };

    const stopAudio = () => {
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            setAudioStream(null);
        }
    };

    const playAudioChunk = (base64: string) => {
        try {
            const audio = new Audio("data:audio/webm;base64," + base64);
            audio.play().catch(e => console.error(e));
        } catch (e) { }
    };

    // Mock Cities for Dropdown
    const MOCK_CITIES = [
        { city: "San Francisco", state: "CA", zip: "94105" },
        { city: "New York", state: "NY", zip: "10001" },
        { city: "Chicago", state: "IL", zip: "60601" },
        { city: "Austin", state: "TX", zip: "73301" },
        { city: "Miami", state: "FL", zip: "33101" },
        { city: "Seattle", state: "WA", zip: "98101" },
    ];

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-200 relative">
            <div className="absolute top-4 right-4 sm:top-8 sm:right-8">
                <Link href="/">
                    <Button variant="ghost" className="text-slate-400 hover:text-white">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                    </Button>
                </Link>
            </div>
            <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
                {/* Status Bar Mock */}
                <div className="flex justify-between px-6 py-3 text-[10px] font-bold text-slate-500">
                    <span>9:41</span>
                    <div className="flex space-x-1">
                        <span className="h-3 w-3 rounded-full bg-slate-800 border border-slate-700" />
                        <span className="h-3 w-3 rounded-full bg-slate-800 border border-slate-700" />
                        <span className="h-3 w-3 rounded-full bg-green-500" />
                    </div>
                </div>

                {/* Screen Content */}
                <div className="px-6 pb-8 pt-4">

                    {/* Display */}
                    <div className="mb-8 text-center space-y-1">
                        <div className="h-20 flex items-center justify-center">
                            {status === "IDLE" ? (
                                <h1 className="text-4xl font-bold tracking-wider text-white transition-all">
                                    {phoneNumber || <span className="text-slate-700">Enter Number</span>}
                                </h1>
                            ) : (
                                <div className="space-y-2">
                                    <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-red-500/20 flex items-center justify-center">
                                        <Phone className="h-8 w-8 text-red-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-white">Calling 911...</h2>
                                    <p className="text-sm text-slate-400">{regLocation || "Connecting..."}</p>
                                </div>
                            )}
                        </div>
                        {status === "IDLE" && regLocation && (
                            <p className="text-xs font-medium text-blue-400 animate-in fade-in slide-in-from-top-1">
                                <MapPin className="inline mr-1 h-3 w-3" />
                                Est. Location: {regLocation}
                            </p>
                        )}
                    </div>

                    {status === "IDLE" && (
                        <>
                            {/* Emergency Location Dropdown */}
                            <div className="mb-6 space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Emergency Location</label>
                                <select
                                    className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={selectedLocation}
                                    onChange={(e) => setSelectedLocation(e.target.value)}
                                >
                                    <option value="">Select precise location...</option>
                                    {MOCK_CITIES.map(c => (
                                        <option key={c.city} value={`${c.city}, ${c.state}`}>{c.city}, {c.state} ({c.zip})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Keypad */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, "*", 0, "#"].map((key) => (
                                    <button
                                        key={key}
                                        onClick={() => handleKeyPress(key.toString())}
                                        className="flex h-16 w-full items-center justify-center rounded-2xl bg-slate-800/50 text-2xl font-medium text-white transition-all hover:bg-slate-700 active:scale-95 active:bg-blue-600/20"
                                    >
                                        {key}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-center space-x-6">
                        {status === "IDLE" ? (
                            <>
                                <button className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-all hover:text-white" onClick={handleDelete}>
                                    <Delete size={24} />
                                </button>
                                <button
                                    className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-900/30 transition-all hover:bg-green-400 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={handleCall}
                                    disabled={!phoneNumber || !selectedLocation}
                                >
                                    <Phone size={32} fill="currentColor" />
                                </button>
                                <div className="w-16" /> {/* Spacer */}
                            </>
                        ) : (
                            <>
                                <button
                                    className={cn("flex h-16 w-16 items-center justify-center rounded-full transition-all", isMuted ? "bg-white text-slate-900" : "bg-slate-800 text-white")}
                                    onClick={() => setIsMuted(!isMuted)}
                                >
                                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                                </button>
                                <button
                                    className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-900/30 transition-all hover:bg-red-400 hover:scale-105 active:scale-95"
                                    onClick={handleEndCall}
                                >
                                    <PhoneOff size={32} fill="currentColor" />
                                </button>
                                <button className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                                    <MapPin size={24} />
                                </button>
                            </>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
