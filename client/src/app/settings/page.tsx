"use client";

import React, { useState, useEffect } from "react";
import { Settings as SettingsIcon, Volume2, Monitor, Bell, Moon, Sun, Laptop, MapPin, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { US_STATES } from "@/data/constants";
import { useToast } from "@/components/ui/use-toast";

// Helper Components
const SectionHeader = ({ title, description }: { title: string, description: string }) => (
    <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
    </div>
);

const Toggle = ({ label, sublabel, checked, onChange }: { label: string, sublabel?: string, checked: boolean, onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div>
            <div className="text-sm font-semibold text-white">{label}</div>
            {sublabel && <div className="text-xs text-slate-500">{sublabel}</div>}
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                checked ? "bg-blue-600" : "bg-slate-700"
            )}
        >
            <span className={cn(
                "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                checked ? "translate-x-5" : "translate-x-0"
            )} />
        </button>
    </div>
);

const SettingsPage = () => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<"general" | "dashboard" | "audio">("general");

    const categories = [
        { id: "general", label: "General", icon: SettingsIcon },
        { id: "dashboard", label: "Dashboard", icon: Monitor },
        { id: "audio", label: "Audio & Voice", icon: Volume2 },
    ];

    // Settings State
    const [settings, setSettings] = useState({
        theme: "dark",
        notifications: true,
        notification_enabled: true,
        soundEffects: true,
        defaultCity: "San Francisco",
        defaultState: "CA",
        default_state: "CA",
        autoConnect: true,
        auto_connect: true,
        micSensitivity: 75,
        mic_sensitivity: 75,
        speakerVolume: 90,
        speaker_volume: 90
    });

    const USER_ID = 1;
    const API_URL = "http://127.0.0.1:8000";

    // ------------------------------------------------------------------------
    // Device State & Logic (Re-introduced)
    // ------------------------------------------------------------------------
    const [devices, setDevices] = useState<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }>({ inputs: [], outputs: [] });
    const [selectedInput, setSelectedInput] = useState<string>("");
    const [selectedOutput, setSelectedOutput] = useState<string>("");

    const [micLevel, setMicLevel] = useState(0);
    const [isTestingMic, setIsTestingMic] = useState(false);

    // Fetch Settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch(`${API_URL}/settings/${USER_ID}`);
                if (res.ok) {
                    const data = await res.json();
                    setSettings(prev => ({
                        ...prev,
                        theme: data.theme,
                        notifications: data.notifications_enabled,
                        notification_enabled: data.notifications_enabled,
                        autoConnect: data.auto_connect,
                        auto_connect: data.auto_connect,
                        defaultState: data.default_state,
                        default_state: data.default_state,
                        micSensitivity: data.mic_sensitivity,
                        mic_sensitivity: data.mic_sensitivity,
                        speakerVolume: data.speaker_volume,
                        speaker_volume: data.speaker_volume
                    }));
                }
            } catch (error) {
                console.error("Failed to fetch settings", error);
                // toast({ title: "Error", description: "Could not load settings from server.", variant: "destructive" });
            }
        };
        fetchSettings();
    }, [toast]);

    // Fetch Audio Devices
    useEffect(() => {
        const getDevices = async () => {
            try {
                // Request permission to get device labels
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const inputs = allDevices.filter(d => d.kind === "audioinput");
                const outputs = allDevices.filter(d => d.kind === "audiooutput");

                setDevices({ inputs, outputs });

                // Set defaults
                if (inputs.length > 0 && !selectedInput) setSelectedInput(inputs[0].deviceId);
                if (outputs.length > 0 && !selectedOutput) setSelectedOutput(outputs[0].deviceId);

                // Stop stream
                stream.getTracks().forEach(track => track.stop());

            } catch (err) {
                console.error("Device enumeration failed", err);
                toast({ title: "Device Access Error", description: "Check microphone permissions.", variant: "destructive" });
            }
        };

        getDevices();
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, [selectedInput, selectedOutput, toast]);

    // Audio Test Functions
    const testSpeaker = async () => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

            if (selectedOutput && (audioCtx as any).setSinkId) {
                try {
                    await (audioCtx as any).setSinkId(selectedOutput);
                } catch (e) {
                    console.warn("setSinkId not supported", e);
                }
            }

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
            toast({ title: "Testing Speaker", description: "Playing test tone..." });
        } catch (e) {
            console.error(e);
            toast({ title: "Test Failed", description: "Could not play audio.", variant: "destructive" });
        }
    };

    const testMic = async () => {
        if (isTestingMic) return;
        setIsTestingMic(true);
        setMicLevel(0);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: selectedInput ? { exact: selectedInput } : undefined }
            });

            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateLevel = () => {
                if (audioContext.state === 'closed') return;
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
                setMicLevel(Math.min(100, average * 2));
                requestAnimationFrame(updateLevel);
            };
            updateLevel();

            setTimeout(() => {
                stream.getTracks().forEach(track => track.stop());
                audioContext.close();
                setIsTestingMic(false);
                setMicLevel(0);
            }, 3000);
        } catch (e) {
            console.error(e);
            setIsTestingMic(false);
            toast({ title: "Mic Test Failed", description: "Could not access microphone.", variant: "destructive" });
        }
    };

    const handleSave = async () => {
        try {
            const payload = {
                theme: settings.theme,
                notifications_enabled: settings.notifications,
                auto_connect: settings.autoConnect,
                default_state: settings.defaultState,
                mic_sensitivity: settings.micSensitivity,
                speaker_volume: settings.speakerVolume
            };

            const res = await fetch(`${API_URL}/settings/${USER_ID}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast({ title: "Settings Saved", description: "Your preferences have been updated." });
            } else {
                throw new Error("Failed to save");
            }
        } catch (error) {
            console.error("Failed to save settings", error);
            toast({ title: "Save Failed", description: "Could not update settings on server.", variant: "destructive" });
        }
    };

    return (
        <div className="flex h-full w-full flex-col bg-slate-950 text-slate-200">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/50 p-6 px-8">
                <h1 className="text-3xl font-black tracking-tight text-white mb-2">Settings</h1>
                <p className="text-slate-400 text-sm">Configure your workspace preferences.</p>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <div className="w-64 border-r border-slate-800 bg-slate-900/30 p-4 space-y-2">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id as any)}
                            className={cn(
                                "flex w-full items-center space-x-3 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                                activeTab === cat.id
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            )}
                        >
                            <cat.icon size={18} />
                            <span>{cat.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-2xl space-y-8">

                        {/* GENERAL SETTINGS */}
                        {activeTab === "general" && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* [Syed Murtaza Hassan]: Simplified Settings - Removed Theme Toggle to focus on core functionality */}
                                <SectionHeader title="Notifications" description="Manage alerts and system sounds." />
                                <div className="space-y-4">
                                    <Toggle
                                        label="Enable Desktop Notifications"
                                        sublabel="Receive pop-ups for critical emergencies."
                                        checked={settings.notifications}
                                        onChange={(v) => setSettings({ ...settings, notifications: v })}
                                    />
                                    <Toggle
                                        label="System Sound Effects"
                                        sublabel="Play sounds for new calls and alerts."
                                        checked={settings.soundEffects}
                                        onChange={(v) => setSettings({ ...settings, soundEffects: v })}
                                    />
                                </div>
                            </div>
                        )}

                        {/* DASHBOARD SETTINGS */}
                        {activeTab === "dashboard" && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <SectionHeader title="Default View" description="Set your primary monitoring region." />
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Default State</label>
                                    <select
                                        className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                                        value={settings.defaultState}
                                        onChange={(e) => setSettings({ ...settings, defaultState: e.target.value })}
                                    >
                                        {US_STATES.map(s => (
                                            <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bg-slate-800/1 h-[1px]" />
                                <SectionHeader title="Behavior" description="Configure automated system actions." />
                                <Toggle
                                    label="Auto-Connect WebSocket"
                                    sublabel="Automatically connect to dispatch server on load."
                                    checked={settings.autoConnect}
                                    onChange={(v) => setSettings({ ...settings, autoConnect: v })}
                                />
                            </div>
                        )}

                        {/* AUDIO SETTINGS */}
                        {activeTab === "audio" && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <SectionHeader title="Input & Output" description="Select your preferred audio devices." />

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Microphone Input</label>
                                            <Button
                                                onClick={testMic}
                                                disabled={isTestingMic}
                                                variant="outline"
                                                size="sm"
                                                className={cn("h-6 text-[10px]", isTestingMic ? "bg-red-500/20 text-red-400 border-red-500/50" : "bg-slate-800 border-slate-700")}
                                            >
                                                {isTestingMic ? "Listening..." : "Test Input"}
                                            </Button>
                                        </div>
                                        <select
                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                                            value={selectedInput}
                                            onChange={(e) => setSelectedInput(e.target.value)}
                                        >
                                            {devices.inputs.length === 0 && <option>Default Microphone</option>}
                                            {devices.inputs.map((device, idx) => (
                                                <option key={device.deviceId || idx} value={device.deviceId}>
                                                    {device.label || `Microphone ${idx + 1}`}
                                                </option>
                                            ))}
                                        </select>
                                        {/* Visual Mic Meter */}
                                        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                                            <div
                                                className="h-full bg-green-500 transition-all duration-75 ease-out"
                                                style={{ width: `${micLevel}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Speaker Output</label>
                                            <Button
                                                onClick={testSpeaker}
                                                variant="outline"
                                                size="sm"
                                                className="h-6 text-[10px] bg-slate-800 border-slate-700 hover:bg-slate-700"
                                            >
                                                Test Output
                                            </Button>
                                        </div>
                                        <select
                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                                            value={selectedOutput}
                                            onChange={(e) => setSelectedOutput(e.target.value)}
                                        >
                                            {devices.outputs.length === 0 && <option>Default Speakers</option>}
                                            {devices.outputs.map((device, idx) => (
                                                <option key={device.deviceId || idx} value={device.deviceId}>
                                                    {device.label || `Speaker ${idx + 1}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-slate-800/1 h-[1px]" />

                                <SectionHeader title="Levels" description="Adjust input sensitivity and volume." />

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium text-slate-400">
                                            <span>Mic Sensitivity</span>
                                            <span>{settings.micSensitivity}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0" max="100"
                                            value={settings.micSensitivity}
                                            onChange={(e) => setSettings({ ...settings, micSensitivity: parseInt(e.target.value) })}
                                            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-blue-500"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium text-slate-400">
                                            <span>Main Volume</span>
                                            <span>{settings.speakerVolume}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0" max="100"
                                            value={settings.speakerVolume}
                                            onChange={(e) => setSettings({ ...settings, speakerVolume: parseInt(e.target.value) })}
                                            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-4 pt-4">
                            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white w-full">
                                <Save className="mr-2 h-4 w-4" /> Save Changes
                            </Button>
                            <Button variant="outline" className="border-slate-700 text-slate-400 hover:text-white w-full">
                                <RotateCcw className="mr-2 h-4 w-4" /> Reset Defaults
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
