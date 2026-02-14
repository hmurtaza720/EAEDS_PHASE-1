"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shield, Users, Trophy, Code2, ArrowLeft } from "lucide-react";

export default function AboutPage() {
    const team = [
        { name: "Abdullah Shaikh", role: "Team Lead & AI Engineer", desc: "Led the project and developed the local AI pipelines, specializing in acoustic emotion recognition and LLM quantization." },
        { name: "Muhammad Baqar", role: "Frontend Developer", desc: "Crafted the responsive, high-performance dashboard UI with real-time WebSocket visualization." },
        { name: "Syed Murtaza Hassan", role: "Backend Architect", desc: "Designed the core asynchronous server architecture and orchestrated the full-stack integration." },
        { name: "Tahir Mehdi", role: "Database Engineer", desc: "Managed data persistence, schema design, and local deployment infrastructure." },
    ];

    return (
        <div className="min-h-screen bg-[#050B14] text-white selection:bg-blue-500/30">
            {/* Navbar */}
            <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#050B14]/80 backdrop-blur-md">
                <div className="container mx-auto flex h-16 items-center justify-between px-6">
                    <Link href="/" className="flex items-center space-x-2 hover:opacity-80">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                            <Shield className="h-5 w-5 text-white" fill="currentColor" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">EAEDS CONTROL</span>
                    </Link>
                    <Link href="/">
                        <Button variant="ghost" className="text-slate-400 hover:text-white">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                        </Button>
                    </Link>
                </div>
            </nav>

            {/* Content */}
            <div className="container mx-auto px-6 pt-32 pb-20">
                <div className="max-w-4xl mx-auto space-y-16">
                    {/* Mission */}
                    <section className="text-center space-y-6">
                        <div className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5">
                            <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Our Mission</span>
                        </div>
                        <h1 className="text-5xl font-bold leading-tight">
                            Saving Lives Through <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Intelligent Response</span>
                        </h1>
                        <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                            We are solving the critical bottleneck of emergency dispatch: <strong>Human Bandwidth.</strong>.
                            By offloading initial triage to a locally-hosted AI, we ensure that no call goes unanswered during mass-casualty events.
                        </p>
                    </section>

                    {/* Team */}
                    <section>
                        <div className="flex items-center mb-8">
                            <Users className="mr-3 h-6 w-6 text-blue-500" />
                            <h2 className="text-2xl font-bold text-white">Meet the Team</h2>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            {team.map((member, idx) => (
                                <div key={idx} className="p-6 rounded-2xl border border-slate-800 bg-[#0A101C] hover:border-blue-500/30 transition-all">
                                    <h3 className="text-lg font-bold text-white">{member.name}</h3>
                                    <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">{member.role}</div>
                                    <p className="text-slate-400 text-sm leading-relaxed">{member.desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Tech Stack */}
                    <section>
                        <div className="flex items-center mb-8">
                            <Code2 className="mr-3 h-6 w-6 text-purple-500" />
                            <h2 className="text-2xl font-bold text-white">Technical Architecture</h2>
                        </div>
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
                                <div className="text-white font-bold mb-2">Frontend</div>
                                <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
                                    <li>Next.js 14 (App Router)</li>
                                    <li>Tailwind CSS</li>
                                    <li>Lucide Icons</li>
                                    <li>Radix UI Primitives</li>
                                </ul>
                            </div>
                            <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
                                <div className="text-white font-bold mb-2">Backend</div>
                                <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
                                    <li>Python FastAPI (ASGI)</li>
                                    <li>WebSockets (Real-time)</li>
                                    <li>SQLite / SQLAlchemy</li>
                                    <li>AsyncIO</li>
                                </ul>
                            </div>
                            <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
                                <div className="text-white font-bold mb-2">Local AI (On-Prem)</div>
                                <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
                                    <li>Mistral-7B (Quantized)</li>
                                    <li>FastWhisper</li>
                                    <li>OpenSMILE (Acoustics)</li>
                                    <li>Edge Computing</li>
                                </ul>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
