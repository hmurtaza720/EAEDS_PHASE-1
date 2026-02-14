"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    HeartPulseIcon,
    Home,
    Radio,
    User2Icon,
    Archive,
    Activity,
    Settings,
    LogOut,
    Bell,
    Mic,
    User,
    ChevronRight,
    Play
} from "lucide-react";

import { Separator } from "../ui/separator";

const Sidebar = () => {
    const pathname = usePathname();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const [activeSubmenu, setActiveSubmenu] = useState<"audio" | "notifications" | null>(null);
    const [settings, setSettings] = useState({
        notifications: true,
        soundEffects: true,
        criticalAlerts: true,
        micVol: 75,
        speakerVol: 90
    });
    const [devices, setDevices] = useState<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }>({ inputs: [], outputs: [] });

    // Handling click outside to close the profile dropdown
    // This provides a better UX than finding the close button
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };

        if (isProfileOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isProfileOpen]);

    // Fetch available media devices when the audio menu is opened
    useEffect(() => {
        if (isProfileOpen && activeSubmenu === "audio") {
            navigator.mediaDevices.enumerateDevices().then(devs => {
                setDevices({
                    inputs: devs.filter(d => d.kind === "audioinput"),
                    outputs: devs.filter(d => d.kind === "audiooutput")
                });
            }).catch(e => console.error("Device Error", e));
        }
    }, [isProfileOpen, activeSubmenu]);

    return (
        <div className="relative flex h-full w-16 flex-col items-center rounded-xl border border-slate-700/50 bg-slate-950 pt-4 pb-8 shadow-2xl z-50 mr-1">
            <div className="flex flex-col space-y-6 text-slate-400">
                <Link
                    href="/dashboard"
                    className={cn(
                        "group flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/50 text-slate-400 transition-all hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-900/20 active:scale-95",
                        pathname === "/" && "bg-blue-600 text-white shadow-lg shadow-blue-900/20",
                    )}
                >
                    <Home size={20} />
                </Link>

                <Link
                    href="/traffic"
                    className={cn(
                        "group flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/50 text-slate-400 transition-all hover:bg-orange-600 hover:text-white hover:shadow-lg hover:shadow-orange-900/20 active:scale-95",
                        pathname === "/traffic" && "bg-orange-600 text-white shadow-lg shadow-orange-900/20",
                    )}
                >
                    <Activity size={20} />
                </Link>

                <Link
                    href="/live"
                    className={cn(
                        "group flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/50 text-slate-400 transition-all hover:bg-red-600 hover:text-white hover:shadow-lg hover:shadow-red-900/20 active:scale-95",
                        pathname === "/live" && "bg-red-600 text-white shadow-lg shadow-red-900/20",
                    )}
                >
                    <Radio size={20} className={cn(pathname === "/live" && "animate-pulse")} />
                </Link>

                <Link
                    href="/archive"
                    className={cn(
                        "group flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/50 text-slate-400 transition-all hover:bg-purple-600 hover:text-white hover:shadow-lg hover:shadow-purple-900/20 active:scale-95",
                        pathname === "/archive" && "bg-purple-600 text-white shadow-lg shadow-purple-900/20",
                    )}
                >
                    <Archive size={20} />
                </Link>
            </div>

            <div className="mt-auto relative" ref={profileRef}>
                <div
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl cursor-pointer transition-all",
                        isProfileOpen ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                    )}
                >
                    <User2Icon size={20} />
                </div>

                {/* Profile Popover */}
                {isProfileOpen && (
                    <div className="absolute left-14 bottom-0 w-64 origin-bottom-left animate-in slide-in-from-left-5 zoom-in-95 duration-200">
                        <div className="rounded-2xl border border-slate-700 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-md ring-1 ring-black/5">

                            {/* User Header */}
                            <div className="flex items-center space-x-3 rounded-xl bg-slate-800/50 p-3 mb-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 font-bold text-white shadow-lg shadow-blue-500/25">
                                    <User size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white">Dispatcher Account</span>
                                    <span className="text-[10px] text-green-400 font-medium uppercase tracking-wider flex items-center">
                                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                                        Online
                                    </span>
                                </div>
                            </div>

                            <Separator className="bg-slate-800 mb-2" />

                            <div className="space-y-1 relative" onMouseLeave={() => setActiveSubmenu(null)}>
                                <Link
                                    href="/profile"
                                    onClick={() => setIsProfileOpen(false)}
                                    className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                                >
                                    <div className="flex items-center">
                                        <User size={16} className="mr-3 text-slate-500 transition-colors group-hover:text-blue-400" />
                                        Profile
                                    </div>
                                </Link>
                                <Link
                                    href="/settings"
                                    onClick={() => setIsProfileOpen(false)}
                                    className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                                >
                                    <div className="flex items-center">
                                        <Settings size={16} className="mr-3 text-slate-500 transition-colors group-hover:text-blue-400" />
                                        Settings
                                    </div>
                                </Link>

                                {/* Audio Submenu Trigger */}
                                <div
                                    className="relative"
                                    onMouseEnter={() => setActiveSubmenu("audio")}
                                >
                                    <button
                                        className={cn(
                                            "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                            activeSubmenu === "audio" ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                        )}
                                    >
                                        <div className="flex items-center">
                                            <Mic size={16} className={cn("mr-3 transition-colors", activeSubmenu === "audio" ? "text-blue-400" : "text-slate-500 group-hover:text-blue-400")} />
                                            Audio & Voice
                                        </div>
                                        <ChevronRight size={14} className="text-slate-600" />
                                    </button>

                                    {/* Audio Popup */}
                                    {activeSubmenu === "audio" && (
                                        <div className="absolute left-[calc(100%+0.5rem)] bottom-[-80px] w-64 rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-left-2 zoom-in-95 duration-100 z-[60]">
                                            <div className="flex items-center space-x-2 mb-3">
                                                <Mic size={14} className="text-blue-400" />
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Audio Settings</span>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-semibold text-slate-500">Input Device</label>
                                                    <select className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500">
                                                        {devices.inputs.length ? devices.inputs.map((d, i) => <option key={i}>{d.label || "Microphone " + (i + 1)}</option>) : <option>Default Mic</option>}
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-semibold text-slate-500">Output Device</label>
                                                    <select className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500">
                                                        {devices.outputs.length ? devices.outputs.map((d, i) => <option key={i}>{d.label || "Speaker " + (i + 1)}</option>) : <option>Default Speaker</option>}
                                                    </select>
                                                </div>
                                                <Separator className="bg-slate-800" />
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] text-slate-400">
                                                        <span>Mic Volume</span>
                                                        <span>{settings.micVol}%</span>
                                                    </div>
                                                    <input
                                                        type="range" min="0" max="100"
                                                        value={settings.micVol}
                                                        onChange={(e) => setSettings({ ...settings, micVol: parseInt(e.target.value) })}
                                                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-blue-500"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] text-slate-400">
                                                        <span>Speaker Volume</span>
                                                        <span>{settings.speakerVol}%</span>
                                                    </div>
                                                    <input
                                                        type="range" min="0" max="100"
                                                        value={settings.speakerVol}
                                                        onChange={(e) => setSettings({ ...settings, speakerVol: parseInt(e.target.value) })}
                                                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Notifications Submenu Trigger */}
                                <div
                                    className="relative"
                                    onMouseEnter={() => setActiveSubmenu("notifications")}
                                >
                                    <button
                                        className={cn(
                                            "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                            activeSubmenu === "notifications" ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                        )}
                                    >
                                        <div className="flex items-center">
                                            <Bell size={16} className={cn("mr-3 transition-colors", activeSubmenu === "notifications" ? "text-blue-400" : "text-slate-500 group-hover:text-blue-400")} />
                                            Notification Prefs
                                        </div>
                                        <ChevronRight size={14} className="text-slate-600" />
                                    </button>

                                    {/* Notification Popup */}
                                    {activeSubmenu === "notifications" && (
                                        <div className="absolute left-[calc(100%+0.5rem)] bottom-[-20px] w-60 rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-left-2 zoom-in-95 duration-100 z-[60]">
                                            <div className="flex items-center space-x-2 mb-3">
                                                <Bell size={14} className="text-blue-400" />
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Alert Prefs</span>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-slate-300">Push Notifications</span>
                                                    <button
                                                        onClick={() => setSettings(s => ({ ...s, notifications: !s.notifications }))}
                                                        className={cn("h-4 w-8 rounded-full relative transition-colors", settings.notifications ? "bg-blue-600" : "bg-slate-700")}
                                                    >
                                                        <div className={cn("absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform", settings.notifications ? "translate-x-4" : "translate-x-0")} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-slate-300">Sound Effects</span>
                                                    <button
                                                        onClick={() => setSettings(s => ({ ...s, soundEffects: !s.soundEffects }))}
                                                        className={cn("h-4 w-8 rounded-full relative transition-colors", settings.soundEffects ? "bg-blue-600" : "bg-slate-700")}
                                                    >
                                                        <div className={cn("absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform", settings.soundEffects ? "translate-x-4" : "translate-x-0")} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-slate-300">Critical Alerts</span>
                                                    <button
                                                        onClick={() => setSettings(s => ({ ...s, criticalAlerts: !s.criticalAlerts }))}
                                                        className={cn("h-4 w-8 rounded-full relative transition-colors", settings.criticalAlerts ? "bg-red-600" : "bg-slate-700")}
                                                    >
                                                        <div className={cn("absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform", settings.criticalAlerts ? "translate-x-4" : "translate-x-0")} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Separator className="bg-slate-800 my-2" />

                            <Link href="/">
                                <button className="group flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300">
                                    <LogOut size={16} className="mr-3" />
                                    Sign Out
                                </button>
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

export default Sidebar;
