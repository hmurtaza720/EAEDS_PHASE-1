"use client";

import React, { useState } from "react";
import { User, Mail, Shield, Phone, Clock, Award, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ProfilePage = () => {
    const [isEditing, setIsEditing] = useState(false);
    const [user, setUser] = useState({
        name: "Officer Murtaza",
        email: "murtaza.dispatch@eaeds.gov",
        role: "Senior Dispatcher",
        badge: "8944-TX",
        phone: "+1 (555) 019-2834"
    });

    // Mock Statistics
    const stats = [
        { label: "Calls Handled", value: "1,248", icon: Phone, color: "text-blue-400" },
        { label: "Avg. Response", value: "4s", icon: Clock, color: "text-green-400" },
        { label: "Lives Saved", value: "14", icon: HeartPulseIcon, color: "text-red-400" },
        { label: "Shift Rank", value: "#1", icon: Award, color: "text-yellow-400" },
    ];

    const handleSave = () => {
        setIsEditing(false);
        // In a real app, this would save to backend
    };

    return (
        <div className="flex flex-col h-full w-full bg-slate-950 p-6 space-y-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white/90">Dispatcher Profile</h1>
                    <p className="text-slate-400 text-sm mt-1">Manage your account and view performance metrics.</p>
                </div>
                {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)} variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-300">
                        <Edit2 className="h-4 w-4 mr-2" /> Edit Profile
                    </Button>
                ) : (
                    <div className="flex space-x-2">
                        <Button onClick={() => setIsEditing(false)} variant="ghost" className="hover:bg-red-500/10 hover:text-red-400 text-slate-400">
                            <X className="h-4 w-4 mr-2" /> Cancel
                        </Button>
                        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white">
                            <Save className="h-4 w-4 mr-2" /> Save Changes
                        </Button>
                    </div>
                )}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: ID Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col items-center text-center shadow-xl">
                        <div className="relative mb-4">
                            <div className="h-32 w-32 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <span className="text-4xl font-black text-white">{user.name.charAt(0)}</span>
                            </div>
                            <div className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-slate-900 border-4 border-slate-900 flex items-center justify-center">
                                <div className="h-4 w-4 rounded-full bg-green-500 animate-pulse" title="Online"></div>
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 mt-2 border border-blue-500/20">
                            {user.role}
                        </span>

                        <div className="w-full mt-6 space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800">
                                <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Badge ID</span>
                                <span className="font-mono text-slate-200">{user.badge}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800">
                                <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Status</span>
                                <span className="text-green-400 font-bold flex items-center">
                                    <span className="h-2 w-2 rounded-full bg-green-400 mr-2" />
                                    Active Duty
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Details & Stats */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Input Form */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        disabled={!isEditing}
                                        value={user.name}
                                        onChange={(e) => setUser({ ...user, name: e.target.value })}
                                        className="pl-9 bg-slate-950 border-slate-800 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        disabled={!isEditing}
                                        value={user.email}
                                        onChange={(e) => setUser({ ...user, email: e.target.value })}
                                        className="pl-9 bg-slate-950 border-slate-800 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500">Role / Title</label>
                                <div className="relative">
                                    <Shield className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        disabled={!isEditing}
                                        value={user.role}
                                        onChange={(e) => setUser({ ...user, role: e.target.value })}
                                        className="pl-9 bg-slate-950 border-slate-800 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500">Contact Phone</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        disabled={!isEditing}
                                        value={user.phone}
                                        onChange={(e) => setUser({ ...user, phone: e.target.value })}
                                        className="pl-9 bg-slate-950 border-slate-800 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {stats.map((stat, i) => (
                            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-all hover:bg-slate-800/80">
                                <stat.icon className={cn("h-6 w-6 mb-2", stat.color)} />
                                <div className="text-2xl font-black text-white">{stat.value}</div>
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{stat.label}</div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
};

// Simple Icon Component for the Stats array (since HeartPulseIcon is named export in lucide-react, I'll allow the generic Import to handle it, but I need to make sure I import it correctly at top)
// Re-checking imports.. HeartPulseIcon IS imported.
import { HeartPulse as HeartPulseIcon } from "lucide-react";

export default ProfilePage;
