"use client";

import { useEffect, useState, useRef } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search, MapPin, X } from "lucide-react";

import { US_STATES } from "@/data/constants";
import { FilterState } from "./EventPanel";

const Header = ({
    connected,
    city,
    setCity,
    filters,
    onLocationSearch,
    onFilterChange
}: {
    connected: boolean;
    city: string;
    setCity: (city: string) => void;
    filters?: FilterState;
    onLocationSearch?: (loc: { lat: number; lng: number; name: string }) => void;
    onFilterChange?: (filters: FilterState) => void;
}) => {
    const [time, setTime] = useState("");

    const selectedState = US_STATES.find(s => s.code === (filters?.stateCode || city)) || US_STATES[4]; // Default to CA

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString("en-US", {
                timeZone: selectedState.tz,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }));
        };
        updateTime();
        const intervalId = setInterval(updateTime, 1000);
        return () => clearInterval(intervalId);
    }, [selectedState]);

    const tzName = new Intl.DateTimeFormat('en-US', {
        timeZone: selectedState.tz,
        timeZoneName: 'short'
    }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value;

    // Handle Search outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
            const res = await fetch(`http://${host}:8000/api/geocode?q=${encodeURIComponent(searchQuery)}&limit=5`);
            const data = await res.json();
            setSearchResults(data);
            setShowResults(true);
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectResult = (result: any) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        if (!isNaN(lat) && !isNaN(lon) && onLocationSearch) {
            onLocationSearch({ lat, lng: lon, name: result.display_name });
        }

        setShowResults(false);
        setSearchQuery(result.display_name);
    };

    return (
        <div className="relative z-[2000] flex h-[60px] w-full items-center bg-transparent px-6 text-white">
            <div className="flex w-full items-center justify-between">
                <div className="flex items-center space-x-4 min-w-[280px]">
                    <span className="text-xl font-black tracking-tighter text-blue-400">EAEDS CONTROL</span>
                    <div className="flex items-center space-x-2 rounded-full bg-slate-800/50 px-3 py-1 border border-slate-700">
                        <div
                            className={cn(
                                "h-2 w-2 rounded-full",
                                connected
                                    ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                                    : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
                            )}
                        />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {connected ? "System Online" : "Offline"}
                        </span>
                    </div>
                </div>

                <div className="flex flex-1 justify-center px-8 z-[1000]">
                    <div className="relative w-full max-w-[500px]" ref={searchRef}>
                        <form onSubmit={handleSearch} className="relative flex items-center w-full">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <Input
                                className="h-9 w-full rounded-full border-slate-700 bg-slate-800/50 pl-10 pr-10 text-sm text-slate-200 placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-slate-800"
                                placeholder="Search emergencies or map..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                            />
                            {isSearching ? (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="w-4 h-4 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
                                </div>
                            ) : searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setShowResults(false);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors bg-slate-800 rounded-full p-0.5"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </form>

                        {/* Autocomplete Results */}
                        {showResults && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden z-[1001]">
                                {searchResults.map((result, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => handleSelectResult(result)}
                                        className="flex items-start gap-3 p-3 hover:bg-slate-800 cursor-pointer border-b border-slate-800/50 last:border-0 transition-colors"
                                    >
                                        <MapPin size={16} className="text-blue-500 mt-0.5 shrink-0" />
                                        <div className="text-sm text-slate-300 leading-tight">
                                            <span className="text-white font-medium block mb-0.5">{result.name || result.display_name.split(",")[0]}</span>
                                            <span className="text-xs text-slate-500 line-clamp-1">{result.display_name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-6 min-w-[320px] justify-end">
                    <div className="flex flex-col items-end">
                        <span className="text-lg font-mono font-medium text-blue-200 tracking-tight leading-none">
                            {time}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                            {tzName} — {filters?.city !== "ALL" ? `${filters?.city}, ` : ""}{selectedState.name}
                        </span>
                    </div>
                    <div className="h-8 w-[1px] bg-slate-700" />

                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1.5">Supervised Sector</span>
                        <div className="flex items-center gap-1.5">
                            {filters && onFilterChange ? (
                                <>
                                    <Select value={filters.stateCode} onValueChange={(val) => onFilterChange({ ...filters, stateCode: val, city: "ALL" })}>
                                        <SelectTrigger className="h-6 min-w-[90px] max-w-[120px] rounded-md border-slate-700/50 bg-slate-800/40 text-[10px] font-bold text-blue-400 uppercase tracking-tight px-2 py-0 gap-1 hover:bg-slate-800 transition-colors">
                                            <SelectValue placeholder="All States" />
                                        </SelectTrigger>
                                        <SelectContent position="popper" side="bottom" className="border-slate-700 bg-slate-900 text-slate-200 z-[2001] w-[var(--radix-select-trigger-width)]">
                                            <div className="max-h-[250px] overflow-y-auto">
                                                {US_STATES.map(s => (
                                                    <SelectItem key={s.code} value={s.code} className="text-xs font-medium cursor-pointer">{s.name}</SelectItem>
                                                ))}
                                            </div>
                                        </SelectContent>
                                    </Select>
                                    {filters.stateCode !== "ALL" && (
                                        <Select value={filters.city} onValueChange={(val) => onFilterChange({ ...filters, city: val })}>
                                            <SelectTrigger className="h-6 min-w-[80px] max-w-[110px] rounded-md border-slate-700/50 bg-slate-800/40 text-[10px] font-bold text-blue-400 uppercase tracking-tight px-2 py-0 gap-1 hover:bg-slate-800 transition-colors">
                                                <SelectValue placeholder="All Cities" />
                                            </SelectTrigger>
                                            <SelectContent position="popper" side="bottom" className="border-slate-700 bg-slate-900 text-slate-200 z-[2001] w-[var(--radix-select-trigger-width)]">
                                                <div className="max-h-[250px] overflow-y-auto">
                                                    <SelectItem value="ALL" className="text-xs font-medium cursor-pointer">All Cities</SelectItem>
                                                    {US_STATES.find(s => s.code === filters.stateCode)?.cities.map(c => (
                                                        <SelectItem key={c} value={c} className="text-xs font-medium cursor-pointer">{c}</SelectItem>
                                                    ))}
                                                </div>
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)] shrink-0" />
                                </>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <span className="text-xs font-black text-blue-400 uppercase tracking-tight">
                                        {filters?.city !== "ALL" ? `${filters?.city}, ` : ""}{selectedState.name}
                                    </span>
                                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Header;
