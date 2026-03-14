"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, MapPin, Delete, PhoneOff, Mic, MicOff, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// State → Cities mapping (matches the chat page at localhost:8000/chat)
const STATE_CITIES: Record<string, string[]> = {
    'AL': ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa'],
    'AK': ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka'],
    'AZ': ['Phoenix', 'Tucson', 'Mesa', 'Scottsdale', 'Tempe'],
    'AR': ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale'],
    'CA': ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'San Jose'],
    'CO': ['Denver', 'Colorado Springs', 'Aurora', 'Boulder', 'Fort Collins'],
    'CT': ['Hartford', 'New Haven', 'Stamford', 'Bridgeport', 'Waterbury'],
    'DE': ['Wilmington', 'Dover', 'Newark', 'Middletown'],
    'FL': ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale'],
    'GA': ['Atlanta', 'Savannah', 'Augusta', 'Macon', 'Athens'],
    'HI': ['Honolulu', 'Hilo', 'Kailua', 'Pearl City'],
    'ID': ['Boise', 'Meridian', 'Nampa', 'Idaho Falls'],
    'IL': ['Chicago', 'Springfield', 'Naperville', 'Aurora', 'Peoria'],
    'IN': ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel'],
    'IA': ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City'],
    'KS': ['Wichita', 'Overland Park', 'Kansas City', 'Topeka', 'Olathe'],
    'KY': ['Louisville', 'Lexington', 'Bowling Green', 'Frankfort'],
    'LA': ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette'],
    'ME': ['Portland', 'Lewiston', 'Bangor', 'Augusta'],
    'MD': ['Baltimore', 'Annapolis', 'Frederick', 'Rockville', 'Bethesda'],
    'MA': ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell'],
    'MI': ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Lansing', 'Flint'],
    'MN': ['Minneapolis', 'Saint Paul', 'Rochester', 'Duluth', 'Bloomington'],
    'MS': ['Jackson', 'Gulfport', 'Hattiesburg', 'Biloxi'],
    'MO': ['Kansas City', 'Saint Louis', 'Springfield', 'Columbia', 'Jefferson City'],
    'MT': ['Billings', 'Missoula', 'Great Falls', 'Helena'],
    'NE': ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island'],
    'NV': ['Las Vegas', 'Reno', 'Henderson', 'North Las Vegas', 'Sparks'],
    'NH': ['Manchester', 'Nashua', 'Concord', 'Dover'],
    'NJ': ['Newark', 'Jersey City', 'Trenton', 'Paterson', 'Elizabeth'],
    'NM': ['Albuquerque', 'Santa Fe', 'Las Cruces', 'Rio Rancho'],
    'NY': ['New York', 'Buffalo', 'Albany', 'Rochester', 'Syracuse'],
    'NC': ['Charlotte', 'Raleigh', 'Durham', 'Greensboro', 'Winston-Salem'],
    'ND': ['Fargo', 'Bismarck', 'Grand Forks', 'Minot'],
    'OH': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron'],
    'OK': ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond'],
    'OR': ['Portland', 'Salem', 'Eugene', 'Bend', 'Medford'],
    'PA': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Harrisburg', 'Erie'],
    'RI': ['Providence', 'Warwick', 'Cranston', 'Pawtucket'],
    'SC': ['Charleston', 'Columbia', 'Greenville', 'Myrtle Beach'],
    'SD': ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Pierre'],
    'TN': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'],
    'TX': ['Houston', 'Austin', 'Dallas', 'San Antonio', 'Fort Worth'],
    'UT': ['Salt Lake City', 'Provo', 'West Valley City', 'Ogden', 'St. George'],
    'VT': ['Burlington', 'Montpelier', 'Rutland', 'South Burlington'],
    'VA': ['Virginia Beach', 'Richmond', 'Norfolk', 'Arlington', 'Alexandria'],
    'WA': ['Seattle', 'Tacoma', 'Spokane', 'Bellevue', 'Olympia'],
    'WV': ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg'],
    'WI': ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine'],
    'WY': ['Cheyenne', 'Casper', 'Laramie', 'Gillette'],
};

const ALL_STATES = Object.keys(STATE_CITIES).sort();

export default function PhonePage() {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [selectedState, setSelectedState] = useState("NY");
    const [selectedCity, setSelectedCity] = useState("New York");
    const [regLocation, setRegLocation] = useState<string | null>(null);
    const [status, setStatus] = useState<"IDLE" | "CALLING" | "CONNECTED" | "ENDED">("IDLE");
    const [callPhase, setCallPhase] = useState<"LISTENING" | "PROCESSING" | "SPEAKING">("LISTENING");
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [transcript, setTranscript] = useState<string[]>([]);

    // Update cities when state changes
    useEffect(() => {
        const cities = STATE_CITIES[selectedState] || [];
        if (cities.length > 0) {
            setSelectedCity(cities[0]);
        }
    }, [selectedState]);

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
                if (phoneNumber && selectedCity) handleCall();
            }
        };

        // Allow paste (Ctrl+V / Cmd+V)
        const handlePaste = (e: ClipboardEvent) => {
            if (status !== "IDLE") return;
            const pasted = e.clipboardData?.getData("text") || "";
            const digits = pasted.replace(/[^0-9*#]/g, "").slice(0, 10);
            if (digits) {
                setPhoneNumber(prev => (prev + digits).slice(0, 10));
                if (digits.length >= 3) {
                    lookupLocation(digits.substring(0, 3));
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("paste", handlePaste);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("paste", handlePaste);
        };
    }, [phoneNumber, selectedCity, status]);

    // Keypad Logic
    const handleKeyPress = (key: string) => {
        if (phoneNumber.length < 10) {
            const newNum = phoneNumber + key;
            setPhoneNumber(newNum);
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
            const areaCodes = require('area-codes');
            const data = areaCodes.get(areaCode);
            if (data) {
                setRegLocation(typeof data === 'string' ? data : `${data.city || ''} ${data.state || ''}`);
            } else {
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
        if (!phoneNumber || !selectedCity) return;
        setStatus("CALLING");

        // Connect WS
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host.split(":")[0];
        const socket = new WebSocket(`${protocol}//${host}:8000/ws/call`);

        socket.onopen = () => {
            console.log("Connected to Dispatch");
            setWs(socket);
            setStatus("CONNECTED");
            setCallPhase("LISTENING");

            // Send Initial Payload with Location Meta-Data (City, State separately)
            socket.send(JSON.stringify({
                event: "start_call",
                phone: phoneNumber,
                location_manual: `${selectedCity}, ${selectedState}`,
                location_reg: regLocation
            }));

            // Start Audio
            startAudio(socket);
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            // Handle TTS audio from AI dispatcher
            if (msg.event === "tts_audio" && msg.chunk) {
                setCallPhase("SPEAKING");
                playAudioChunk(msg.chunk);
                // After playing, go back to listening (estimate ~3s for short responses)
                setTimeout(() => setCallPhase("LISTENING"), 3000);
            }
            // Handle AI response transcript
            if (msg.event === "ai_response") {
                if (msg.user_text) {
                    setTranscript(prev => [...prev, `You: ${msg.user_text}`]);
                    setCallPhase("PROCESSING");
                }
                if (msg.text) {
                    setTranscript(prev => [...prev, `911: ${msg.text}`]);
                }
            }
            // Legacy audio relay (manual mode)
            if (msg.event === "audio_relay" && msg.chunk) {
                playAudioChunk(msg.chunk);
            }
        };

        socket.onclose = () => {
            setStatus("ENDED");
            setWs(null);
            stopAudio();
            setTranscript([]);
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

    const cities = STATE_CITIES[selectedState] || [];

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
                                    <div className={cn(
                                        "mx-auto h-16 w-16 rounded-full flex items-center justify-center transition-all",
                                        callPhase === "LISTENING" && "bg-green-500/20 animate-pulse",
                                        callPhase === "PROCESSING" && "bg-yellow-500/20 animate-spin",
                                        callPhase === "SPEAKING" && "bg-blue-500/20 animate-pulse"
                                    )}>
                                        <Phone className={cn(
                                            "h-8 w-8",
                                            callPhase === "LISTENING" && "text-green-500",
                                            callPhase === "PROCESSING" && "text-yellow-500",
                                            callPhase === "SPEAKING" && "text-blue-500"
                                        )} />
                                    </div>
                                    <h2 className="text-xl font-bold text-white">
                                        {status === "CALLING" ? "Calling 911..." :
                                            callPhase === "LISTENING" ? "Listening..." :
                                                callPhase === "PROCESSING" ? "Processing..." :
                                                    "AI Speaking..."}
                                    </h2>
                                    <p className="text-sm text-slate-400">{regLocation || `${selectedCity}, ${selectedState}` || "Connected"}</p>
                                    {/* Live transcript */}
                                    {transcript.length > 0 && (
                                        <div className="mt-2 max-h-20 overflow-y-auto text-left px-2">
                                            {transcript.slice(-3).map((line, i) => (
                                                <p key={i} className={cn(
                                                    "text-xs truncate",
                                                    line.startsWith("You:") ? "text-slate-400" : "text-blue-400"
                                                )}>{line}</p>
                                            ))}
                                        </div>
                                    )}
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
                            {/* Emergency Location — City + State Dropdowns (matches chat page) */}
                            <div className="mb-6 space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Emergency Location</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={selectedState}
                                        onChange={(e) => setSelectedState(e.target.value)}
                                    >
                                        {ALL_STATES.map(st => (
                                            <option key={st} value={st}>{st}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={selectedCity}
                                        onChange={(e) => setSelectedCity(e.target.value)}
                                    >
                                        {cities.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
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
                                    disabled={!phoneNumber || !selectedCity}
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
