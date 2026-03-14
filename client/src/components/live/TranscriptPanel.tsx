"use client";

import { useState } from "react";
import { CallProps } from "@/data/types";
import { cn } from "@/lib/utils";
import {
    ArrowLeftRightIcon,
    HeadsetIcon,
    Loader2Icon,
    History,
    Play,
    Volume2,
    Phone,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import ChatInterface from "./ChatInterface";

interface TranscriptPanelProps extends CallProps {
    handleTransfer: (id: string) => void;
    handleResolve: (id: string, dispatchType?: string) => void;
    mode?: "live" | "archive";
    toggleMute?: () => void;
    toggleHold?: () => void;
    handleHangup?: () => void;
    isMuted?: boolean;
    isOnHold?: boolean;
    relatedCalls?: { id: string; title: string; time: string }[];
    onSelectRelatedCall?: (id: string) => void;
    isManualMode?: boolean;
    isMapOverlayOpen?: boolean;
    onToggleMapOverlay?: () => void;
}

import { Mic, MicOff, Pause, PhoneOff } from "lucide-react"; // Import new icons

const TranscriptPanel = ({
    call,
    selectedId,
    handleTransfer,
    handleResolve,
    mode = "live",
    isManualMode = false,
    toggleMute,
    toggleHold,
    handleHangup,
    isMuted = false,
    isOnHold = false,
    relatedCalls = [],
    onSelectRelatedCall,
    isMapOverlayOpen,
    onToggleMapOverlay,
}: TranscriptPanelProps) => {
    const [loading, setLoading] = useState(false);

    if (!call) {
        return (
            <div className="flex h-full items-center justify-center bg-slate-900/50 text-slate-500 italic">
                Select an incident to view details
            </div>
        );
    }

    // Main Transfer Logic - Updates backend state via WebSocket
    const doTransfer = (id: string) => {
        handleTransfer(id);
    };

    return (
        <div className={cn("flex flex-col h-full bg-slate-900", isManualMode && "border-2 border-red-500/50")}>
            {/* 1. Header & Live Connection Status */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950/50">
                <div className="flex items-center space-x-2">
                    {onToggleMapOverlay && (
                        <button
                            onClick={onToggleMapOverlay}
                            title={isMapOverlayOpen ? "Collapse Map Details" : "Expand Map Details"}
                            className="flex h-5 w-5 items-center justify-center rounded-sm bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 mr-1"
                        >
                            {isMapOverlayOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </button>
                    )}
                    <History size={16} className="text-blue-400" />
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Action Sidebar</p>
                </div>
                {isManualMode ? (
                    <div className="flex items-center space-x-2 rounded-full bg-red-500/10 px-2 py-0.5 border border-red-500/20">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-red-500 uppercase">ON AIR</span>
                    </div>
                ) : (
                    mode === "live" && (
                        <div className="flex items-center space-x-2 rounded-full bg-green-500/10 px-2 py-0.5 border border-green-500/20">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-green-500 uppercase">Live Feed</span>
                        </div>
                    )
                )}
            </div>
            <Separator className="bg-slate-800" />

            <div className="flex flex-1 flex-col space-y-4 p-4 overflow-hidden">
                {/* 2. Live Voice Log (Fill Remaining) */}
                <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                    <div className="flex items-center justify-between bg-slate-900/80 px-4 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Voice Log Transcript</p>
                        <div className="flex items-center space-x-1.5">
                            {isManualMode ? (
                                <div className="flex items-center space-x-1 text-red-400">
                                    <HeadsetIcon size={10} />
                                    <span className="text-[9px] font-bold uppercase">Manual Override</span>
                                </div>
                            ) : (
                                mode === "live" && (
                                    <div className="flex items-center space-x-1 text-green-400">
                                        <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-[9px] font-bold uppercase">AI Active</span>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden p-1">
                        <ChatInterface call={call} selectedId={selectedId} />
                    </div>
                </div>

                {/* Related Calls Section (Archive Mode Only) */}
                {mode === "archive" && relatedCalls && relatedCalls.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-950/10 p-3">
                        <div className="flex items-center space-x-2">
                            <Phone size={12} className="text-amber-400" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                                Related Calls ({relatedCalls.length})
                            </p>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">Same caller has other calls on record:</p>
                        <div className="space-y-1.5">
                            {relatedCalls.map((rc) => (
                                <button
                                    key={rc.id}
                                    onClick={() => onSelectRelatedCall?.(rc.id)}
                                    className="w-full flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-left hover:bg-slate-700/50 hover:border-amber-500/30 transition-all group"
                                >
                                    <div>
                                        <p className="text-[11px] font-semibold text-slate-200 group-hover:text-amber-300 transition-colors">{rc.title}</p>
                                        <p className="text-[9px] text-slate-500 font-mono">
                                            {new Date(rc.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <ExternalLink size={12} className="text-slate-500 group-hover:text-amber-400 transition-colors" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 6. Call Recording (Archive Mode Only) */}
                {/* 6. Call Recording (Archive Mode Only) - REMOVED per user request */}
                {/* Audio player UI removed locally */}

                {/* 7. Critical Action Button (Bottom) */}
                {mode === "live" && (
                    <div className="space-y-3 pt-2">
                        {isManualMode ? (
                            <>
                                <div className="flex space-x-2">
                                    <Button
                                        onClick={toggleMute}
                                        variant="outline"
                                        className={cn(
                                            "flex-1 h-10 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-wider text-[10px]",
                                            isMuted && "bg-amber-500/20 border-amber-500/50 text-amber-500 hover:bg-amber-500/30"
                                        )}
                                    >
                                        {isMuted ? <MicOff size={14} className="mr-2" /> : <Mic size={14} className="mr-2" />}
                                        {isMuted ? "Unmute Mic" : "Mute Mic"}
                                    </Button>
                                    <Button
                                        onClick={toggleHold}
                                        variant="outline"
                                        className={cn(
                                            "flex-1 h-10 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-wider text-[10px]",
                                            isOnHold && "bg-blue-500/20 border-blue-500/50 text-blue-500 hover:bg-blue-500/30"
                                        )}
                                    >
                                        <Pause size={14} className="mr-2" />
                                        {isOnHold ? "Resume Call" : "Hold Call"}
                                    </Button>
                                </div>
                                <Button
                                    onClick={() => handleHangup && handleHangup()}
                                    className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest shadow-xl animate-pulse"
                                >
                                    {/* Critical Hangup Button (Manual Mode Only) */}
                                    <PhoneOff size={18} className="mr-2" /> End Live Call
                                </Button>
                            </>
                        ) : loading ? (
                            <Button className="w-full h-12 bg-slate-800 text-blue-400 gap-2 font-bold uppercase tracking-widest border border-blue-500/20">
                                <Loader2Icon className="animate-spin" size={18} />
                                <p>Connecting...</p>
                            </Button>
                        ) : (
                            <Button
                                onClick={() => doTransfer(call.id)}
                                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold uppercase tracking-widest shadow-xl hover:from-blue-500 hover:to-indigo-500 transition-all transform active:scale-95"
                            >
                                <ArrowLeftRightIcon size={18} /> <p className="ml-2">Transfer to Human</p>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TranscriptPanel;
