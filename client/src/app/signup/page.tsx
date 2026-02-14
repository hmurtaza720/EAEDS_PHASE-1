"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function SignupPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSignup = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            router.push("/dashboard");
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-[#050B14] flex flex-col justify-center items-center p-4 relative">
            <div className="absolute top-4 right-4 sm:top-8 sm:right-8">
                <Link href="/">
                    <Button variant="ghost" className="text-slate-400 hover:text-white">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                    </Button>
                </Link>
            </div>
            <Link href="/" className="flex items-center space-x-2 mb-8 hover:opacity-80 transition-opacity">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                    <Shield className="h-6 w-6 text-white" fill="currentColor" />
                </div>
                <span className="text-2xl font-bold text-white tracking-tight">EAEDS CONTROL</span>
            </Link>

            <div className="w-full max-w-md bg-[#0A101C] border border-slate-800 rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-white">Create Account</h1>
                    <p className="text-slate-400 text-sm mt-2">Register your agency for the DispatchAI platform.</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label htmlFor="firstName" className="text-sm font-medium leading-none text-white">First Name</label>
                            <Input id="firstName" placeholder="John" className="bg-slate-900 border-slate-700 text-white" required />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="lastName" className="text-sm font-medium leading-none text-white">Last Name</label>
                            <Input id="lastName" placeholder="Doe" className="bg-slate-900 border-slate-700 text-white" required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="agency" className="text-sm font-medium leading-none text-white">Agency ID</label>
                        <Input id="agency" placeholder="NYPD-001" className="bg-slate-900 border-slate-700 text-white" required />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium leading-none text-white">Official Email</label>
                        <Input id="email" type="email" placeholder="officer@agency.gov" className="bg-slate-900 border-slate-700 text-white" required />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium leading-none text-white">Password</label>
                        <Input id="password" type="password" placeholder="••••••••" className="bg-slate-900 border-slate-700 text-white" required />
                    </div>

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white h-11 font-medium" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...
                            </>
                        ) : (
                            "Register Agency"
                        )}
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-400">
                    Already have an account?{" "}
                    <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
