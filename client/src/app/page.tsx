"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shield, Activity, Zap, MapPin, Mic, Play, CheckCircle2 } from "lucide-react";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#050B14] text-white font-sans selection:bg-blue-500/30">
            {/* Navbar */}
            <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#050B14]/80 backdrop-blur-md">
                <div className="container mx-auto flex h-16 items-center justify-between px-6">
                    <div className="flex items-center space-x-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                            <Shield className="h-5 w-5 text-white" fill="currentColor" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">EAEDS CONTROL</span>
                    </div>

                    <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-400">
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <Link href="/about" className="hover:text-white transition-colors">About</Link>
                    </div>

                    <div className="flex items-center space-x-4">
                        <Link href="/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                            Log in
                        </Link>
                        <Link href="/signup">
                            <Button className="bg-blue-600 hover:bg-blue-500 text-white border-0 font-medium">
                                Sign up
                            </Button>
                        </Link>
                        <Link href="/dashboard">
                            <Button variant="outline" className="border-blue-900/50 bg-blue-950/30 text-blue-400 hover:bg-blue-900/50 hover:text-blue-300">
                                Launch Dashboard
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col lg:flex-row items-center gap-16">
                        {/* Hero Text */}
                        <div className="flex-1 space-y-8 z-10">
                            <div className="inline-flex items-center space-x-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-green-500">System Online</span>
                            </div>

                            <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight text-white">
                                Emotion-Aware <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Emergency Dispatch</span>
                            </h1>

                            <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
                                AI-powered emergency response system that understands caller emotions, processes speech in real-time, and coordinates with human dispatchers to save lives faster.
                            </p>

                            <div className="flex items-center space-x-4">
                                <Link href="/dashboard">
                                    <Button className="h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white text-base font-semibold shadow-lg shadow-blue-500/25">
                                        <Activity className="mr-2 h-5 w-5" />
                                        Live Dashboard
                                    </Button>
                                </Link>
                                <Link href="/phone">
                                    <Button variant="outline" className="h-12 px-8 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white">
                                        <Play className="mr-2 h-4 w-4" />
                                        Test Call
                                    </Button>
                                </Link>
                            </div>

                            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-slate-800/50">
                                <div>
                                    <div className="text-3xl font-bold text-white">2.5s</div>
                                    <div className="text-sm text-slate-500 font-medium">Response Time</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-white">95%</div>
                                    <div className="text-sm text-slate-500 font-medium">Accuracy</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-white">24/7</div>
                                    <div className="text-sm text-slate-500 font-medium">Availability</div>
                                </div>
                            </div>
                        </div>

                        {/* Hero Visualization */}
                        <div className="flex-1 w-full max-w-lg lg:max-w-none">
                            <div className="relative rounded-2xl border border-slate-800 bg-[#0A101C] p-6 shadow-2xl">
                                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl -z-10" />

                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Active Emergencies</h3>
                                    <div className="flex items-center space-x-2">
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                        </span>
                                        <span className="text-[10px] font-bold text-red-500">CRITICAL</span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="font-bold text-white text-lg">Medical Emergency</h4>
                                                <p className="text-sm text-slate-400 mt-1">Golden Gate Bridge, San Francisco</p>
                                            </div>
                                            <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-wide border border-red-500/20">
                                                Critical
                                            </span>
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-500 font-medium">Emotion Detected</span>
                                                <span className="text-orange-400 font-bold">Fear (85%)</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 w-[85%]" />
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2 text-xs text-slate-400">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                                            <span>Location confirmed • EMS dispatched</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-3 text-center">
                                            <div className="text-xl font-bold text-white">12</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Active</div>
                                        </div>
                                        <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-3 text-center">
                                            <div className="text-xl font-bold text-green-400">34</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Resolved</div>
                                        </div>
                                        <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-3 text-center">
                                            <div className="text-xl font-bold text-blue-400">3</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Pending</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Crisis Stats Section */}
            <section className="py-24 bg-[#0A101C]">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row gap-16 items-center">
                        <div className="flex-1 space-y-6">
                            <div className="inline-block rounded bg-red-500/10 px-3 py-1 border border-red-500/20">
                                <span className="text-xs font-bold uppercase tracking-widest text-red-400">The Crisis</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                                82% of 911 Centers are <br />
                                <span className="text-red-400">Critically Understaffed</span>
                            </h2>
                            <p className="text-lg text-slate-400 leading-relaxed max-w-md">
                                Emergency call centers face unprecedented staffing shortages, leading to delayed response times and potentially preventable casualties. Traditional hiring can't keep pace with demand.
                            </p>
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-6 w-full">
                            <div className="p-6 rounded-xl border border-slate-800 bg-[#050B14] hover:bg-slate-900/50 transition-colors">
                                <div className="text-3xl font-bold text-red-400 mb-1">45s</div>
                                <div className="text-sm text-slate-500">Average Wait Time</div>
                            </div>
                            <div className="p-6 rounded-xl border border-slate-800 bg-[#050B14] hover:bg-slate-900/50 transition-colors">
                                <div className="text-3xl font-bold text-orange-400 mb-1">18%</div>
                                <div className="text-sm text-slate-500">Staffing Level</div>
                            </div>
                            <div className="p-6 rounded-xl border border-slate-800 bg-[#050B14] hover:bg-slate-900/50 transition-colors">
                                <div className="text-3xl font-bold text-yellow-400 mb-1">240M</div>
                                <div className="text-sm text-slate-500">Annual Calls</div>
                            </div>
                            <div className="p-6 rounded-xl border border-slate-800 bg-[#050B14] hover:bg-slate-900/50 transition-colors">
                                <div className="text-3xl font-bold text-red-500 mb-1">82%</div>
                                <div className="text-sm text-slate-500">Understaffed</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Capabilities Section */}
            <section id="features" className="py-24 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />

                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
                        <div className="inline-block rounded-full border border-slate-800 bg-slate-900/50 px-4 py-1.5 mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Capabilities</span>
                        </div>
                        <h2 className="text-4xl font-bold text-white">AI-Powered Emergency Response</h2>
                        <p className="text-slate-400 text-lg">Combining cutting-edge AI with human oversight for faster, more effective emergency dispatch.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="group rounded-2xl border border-slate-800 bg-[#0A101C] p-8 hover:border-blue-500/30 transition-all hover:bg-[#0F1623]">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                                <Activity className="h-6 w-6 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Real-Time Emotion Detection</h3>
                            <p className="text-slate-400 text-sm leading-relaxed mb-8">
                                Advanced acoustic analysis detects caller emotions (Fear, Panic, Calm) to prioritize emergencies and provide appropriate responses.
                            </p>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-slate-500">Accuracy</span>
                                    <span className="text-blue-400">92%</span>
                                </div>
                                <div className="h-1 w-full bg-slate-800 rounded-full">
                                    <div className="h-full bg-blue-500 w-[92%] rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                </div>
                            </div>
                        </div>

                        {/* Feature 2 */}
                        <div className="group rounded-2xl border border-slate-800 bg-[#0A101C] p-8 hover:border-purple-500/30 transition-all hover:bg-[#0F1623]">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:bg-purple-500/20 transition-colors">
                                <Mic className="h-6 w-6 text-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Speech-to-Text Processing</h3>
                            <p className="text-slate-400 text-sm leading-relaxed mb-8">
                                Whisper AI converts emergency calls to text in real-time, enabling instant analysis and automated protocol adherence.
                            </p>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-slate-500">Speed</span>
                                    <span className="text-purple-400">2.5s</span>
                                </div>
                                <div className="h-1 w-full bg-slate-800 rounded-full">
                                    <div className="h-full bg-purple-500 w-[95%] rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                                </div>
                            </div>
                        </div>

                        {/* Feature 3 */}
                        <div className="group rounded-2xl border border-slate-800 bg-[#0A101C] p-8 hover:border-green-500/30 transition-all hover:bg-[#0F1623]">
                            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-6 group-hover:bg-green-500/20 transition-colors">
                                <MapPin className="h-6 w-6 text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Live Location Tracking</h3>
                            <p className="text-slate-400 text-sm leading-relaxed mb-8">
                                Automatic location extraction and real-time mapping ensure emergency services reach the right place, every time.
                            </p>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-slate-500">Precision</span>
                                    <span className="text-green-400">98%</span>
                                </div>
                                <div className="h-1 w-full bg-slate-800 rounded-full">
                                    <div className="h-full bg-green-500 w-[98%] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 bg-[#0A101C]">
                <div className="container mx-auto px-6">
                    <div className="relative rounded-3xl border border-slate-800 bg-[#0F1623] p-12 md:p-20 text-center overflow-hidden">
                        <div className="absolute top-0 right-0 h-64 w-64 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none" />
                        <div className="absolute bottom-0 left-0 h-64 w-64 bg-purple-600/10 blur-[80px] rounded-full pointer-events-none" />

                        <div className="relative z-10 max-w-3xl mx-auto space-y-8">
                            <h2 className="text-4xl md:text-5xl font-bold text-white">
                                Ready to Transform Emergency <br /> Response?
                            </h2>
                            <p className="text-lg text-slate-400">
                                Experience the future of 911 dispatch with our live demonstration.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Link href="/dashboard">
                                    <Button className="h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white font-semibold w-full sm:w-auto">
                                        <Zap className="mr-2 h-4 w-4" />
                                        Launch Dashboard
                                    </Button>
                                </Link>
                                <Link href="/phone">
                                    <Button variant="outline" className="h-12 px-8 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 w-full sm:w-auto">
                                        Try Emergency Call
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-slate-800 bg-[#050B14]">
                <div className="container mx-auto px-6 text-center">
                    <div className="flex items-center justify-center mb-6">
                        <Shield className="h-6 w-6 text-blue-600 mr-2" />
                        <span className="text-xl font-bold text-white">EAEDS CONTROL</span>
                    </div>
                    <p className="text-slate-500 text-sm">
                        © 2026 EAEDS Control. Emotion-Aware Emergency Dispatch System. <br />
                        Powered by Local Edge AI • Built for saving lives
                    </p>
                </div>
            </footer>

            {/* Short Button / Quick Action Menu (Floating) */}
            <div className="fixed bottom-6 right-6 z-50 group">
                <div className="absolute bottom-16 right-0 w-48 space-y-2 origin-bottom-right scale-0 transition-transform duration-200 group-hover:scale-100 flex flex-col items-end">
                    <Link href="/dashboard" className="flex items-center justify-center w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg text-sm">
                        <Activity className="mr-2 h-4 w-4" /> Live Dashboard
                    </Link>
                    <Link href="/phone" className="flex items-center justify-center w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg border border-slate-700 text-sm">
                        <Play className="mr-2 h-4 w-4" /> Test Mock Call
                    </Link>
                    <Link href="/signup" className="flex items-center justify-center w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg border border-slate-700 text-sm">
                        <Shield className="mr-2 h-4 w-4" /> Agency Sign Up
                    </Link>
                    <Link href="/about" className="flex items-center justify-center w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg border border-slate-700 text-sm">
                        About Team
                    </Link>
                </div>
                <button className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-xl shadow-blue-600/30 hover:bg-blue-500 transition-colors group-hover:rotate-45 duration-300">
                    <Zap className="h-6 w-6 text-white" fill="currentColor" />
                </button>
            </div>
        </div >
    );
}
