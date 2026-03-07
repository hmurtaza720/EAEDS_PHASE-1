import { ChangeEvent, useState } from "react";
import { Call } from "@/data/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, ChevronDown, Filter, Search, ShieldCheck, Phone, MapPin, MessageSquare, X, Clock, Shield } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { US_STATES } from "@/data/constants";

export interface FilterState {
    stateCode: string;
    city: string;
    timeRange: string;
    status: string;
    severity: string;
}

interface EventPanelProps {
    data: Record<string, Call> | undefined;
    selectedId: string | undefined;
    handleSelect: (id: string) => void;
    title?: string;
    showCounters?: boolean;
    filters?: FilterState;
    onFilterChange?: (filters: FilterState) => void;
    countersData?: Record<string, Call>;
}

const EventPanel = ({
    data,
    selectedId,
    handleSelect,
    title = "Emergencies",
    showCounters = true,
    filters,
    onFilterChange,
    countersData
}: EventPanelProps) => {
    const [search, setSearch] = useState("");
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

    // Helper: relative time
    const getRelativeTime = (isoDate: string) => {
        if (!isoDate) return "";
        const now = new Date();
        const then = new Date(isoDate);
        const diffMs = now.getTime() - then.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return "Just now";
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin} min ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay === 1) return "Yesterday";
        return `${diffDay}d ago`;
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setSearch(e.currentTarget.value);
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 px-3 py-4">
            <div className="mb-4 mt-2 flex items-center justify-between px-3">
                <h2 className="text-xl font-bold uppercase tracking-wider text-blue-400">{title}</h2>
                {showCounters && (
                    <div className="flex space-x-2 text-xs font-mono text-slate-500">
                        <span>LIVE FEED</span>
                        <div className="h-4 w-4 rounded-full bg-red-500/20 p-1">
                            <div className="h-full w-full animate-ping rounded-full bg-red-500" />
                        </div>
                    </div>
                )}
            </div>

            <div className="mb-4 px-2 flex items-center space-x-2">
                <div className="relative flex-1">
                    <Input
                        className="w-full border-slate-700 bg-slate-800 text-slate-200 placeholder:text-slate-500 focus-visible:ring-blue-500 rounded-lg pr-10"
                        placeholder="Refine Sector Search..."
                        startIcon={Search}
                        onChange={handleChange}
                    />
                </div>
                {filters && onFilterChange && (
                    <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className={cn(
                                    "h-10 w-10 border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-all",
                                    isFiltersOpen && "border-blue-500 text-blue-400 bg-blue-500/10"
                                )}
                            >
                                <Filter size={18} />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent side="right" align="start" sideOffset={16} avoidCollisions={false} className="z-[60] w-[260px] rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-md text-slate-200 shadow-2xl p-0 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Filters</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={() => setIsFiltersOpen(false)}>
                                    <X size={14} />
                                </Button>
                            </div>
                            <div className="px-4 pb-4 flex flex-col gap-4">
                                {/* State */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1.5 font-medium">
                                        <MapPin size={12} className="text-slate-500" /> State
                                    </label>
                                    <Select value={filters.stateCode} onValueChange={(val) => onFilterChange({ ...filters, stateCode: val, city: "ALL" })}>
                                        <SelectTrigger className="h-9 rounded-lg border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300">
                                            <SelectValue placeholder="State" />
                                        </SelectTrigger>
                                        <SelectContent position="popper" side="bottom" avoidCollisions={false} className="border-slate-700 bg-slate-900 text-slate-200 z-[70] w-[var(--radix-select-trigger-width)]">
                                            <div className="max-h-[200px] overflow-y-auto">
                                                {US_STATES.map(s => (
                                                    <SelectItem key={s.code} value={s.code} className="text-xs font-medium cursor-pointer">{s.name}</SelectItem>
                                                ))}
                                            </div>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* City */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1.5 font-medium">
                                        <MapPin size={12} className="text-slate-500" /> City
                                    </label>
                                    <Select value={filters.city} onValueChange={(val) => onFilterChange({ ...filters, city: val })}>
                                        <SelectTrigger className="h-9 rounded-lg border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300">
                                            <SelectValue placeholder="City" />
                                        </SelectTrigger>
                                        <SelectContent position="popper" side="bottom" avoidCollisions={false} className="border-slate-700 bg-slate-900 text-slate-200 z-[70] w-[var(--radix-select-trigger-width)]">
                                            <div className="max-h-[200px] overflow-y-auto">
                                                <SelectItem value="ALL" className="text-xs font-medium cursor-pointer">All Cities</SelectItem>
                                                {US_STATES.find(s => s.code === filters.stateCode)?.cities.map(c => (
                                                    <SelectItem key={c} value={c} className="text-xs font-medium cursor-pointer">{c}</SelectItem>
                                                ))}
                                            </div>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Time Range - Only show on Archive page */}
                                {title !== "Emergencies" && (
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1.5 font-medium">
                                            <Clock size={12} className="text-slate-500" /> Time Range
                                        </label>
                                        <Select value={filters.timeRange} onValueChange={(val) => onFilterChange({ ...filters, timeRange: val })}>
                                            <SelectTrigger className="h-9 rounded-lg border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300">
                                                <SelectValue placeholder="Time" />
                                            </SelectTrigger>
                                            <SelectContent position="popper" side="bottom" avoidCollisions={false} className="border-slate-700 bg-slate-900 text-slate-200 z-[70] w-[var(--radix-select-trigger-width)]">
                                                <SelectItem value="ALL" className="text-xs font-medium cursor-pointer">All Time</SelectItem>
                                                <SelectItem value="1d" className="text-xs font-medium cursor-pointer">Last 1 Day</SelectItem>
                                                <SelectItem value="3d" className="text-xs font-medium cursor-pointer">Last 3 Days</SelectItem>
                                                <SelectItem value="1w" className="text-xs font-medium cursor-pointer">Last 1 Week</SelectItem>
                                                <SelectItem value="1m" className="text-xs font-medium cursor-pointer">Last 1 Month</SelectItem>
                                                <SelectItem value="1y" className="text-xs font-medium cursor-pointer">Last 1 Year</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Status */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1.5 font-medium">
                                        <Shield size={12} className="text-slate-500" /> Status
                                    </label>
                                    <Select value={filters.status} onValueChange={(val) => onFilterChange({ ...filters, status: val })}>
                                        <SelectTrigger className="h-9 rounded-lg border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent position="popper" side="bottom" avoidCollisions={false} className="border-slate-700 bg-slate-900 text-slate-200 z-[70] w-[var(--radix-select-trigger-width)]">
                                            <SelectItem value="ALL" className="text-xs font-medium cursor-pointer">All Statuses</SelectItem>
                                            <SelectItem value="CRITICAL" className="text-xs font-medium cursor-pointer">🔴 Critical</SelectItem>
                                            <SelectItem value="RESOLVED" className="text-xs font-medium cursor-pointer">🟢 Resolved</SelectItem>
                                            <SelectItem value="UNRESOLVED" className="text-xs font-medium cursor-pointer">🟡 Unresolved</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="px-4 py-3 flex items-center justify-between pb-4">
                                <button
                                    className="text-xs text-slate-400 hover:text-white font-medium"
                                    onClick={() => onFilterChange({ stateCode: "ALL", city: "ALL", timeRange: "ALL", status: "ALL", severity: "ALL" })}
                                >
                                    Reset
                                </button>
                                <Button
                                    size="sm"
                                    className="h-8 rounded-[8px] bg-blue-600 hover:bg-blue-700 text-white px-5 text-xs font-semibold tracking-wide"
                                    onClick={() => setIsFiltersOpen(false)}
                                >
                                    Apply
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>

            {showCounters && (
                <div className="mb-6 flex justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-4 mx-2">
                    <div className="text-center">
                        <div className="text-2xl font-black text-slate-200">
                            {(countersData || data) ? Object.keys(countersData || data!).length : "-"}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total</div>
                    </div>
                    <div className="h-10 w-[1px] bg-slate-700" />
                    <div
                        className={cn(
                            "text-center cursor-pointer hover:bg-slate-700/50 rounded-lg p-1 transition-all",
                            filters?.severity === "CRITICAL" && "bg-blue-500/10 border border-blue-500/30"
                        )}
                        onClick={() => {
                            if (onFilterChange && filters) {
                                onFilterChange({
                                    ...filters,
                                    severity: filters.severity === "CRITICAL" ? "ALL" : "CRITICAL"
                                });
                            }
                        }}
                    >
                        <div className="text-2xl font-black text-red-500 animate-pulse">
                            {(countersData || data)
                                ? Object.entries(countersData || data!).filter(
                                    ([_, value]) => value.severity === "CRITICAL",
                                ).length
                                : "-"}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Critical</div>
                    </div>
                    <div className="h-10 w-[1px] bg-slate-700" />
                    <div
                        className={cn(
                            "text-center cursor-pointer hover:bg-slate-700/50 rounded-lg p-1 transition-all",
                            filters?.severity === "UNRESOLVED" && "bg-orange-500/10 border border-orange-500/30"
                        )}
                        onClick={() => {
                            if (onFilterChange && filters) {
                                onFilterChange({
                                    ...filters,
                                    severity: filters.severity === "UNRESOLVED" ? "ALL" : "UNRESOLVED"
                                });
                            }
                        }}
                    >
                        <div className="text-2xl font-black text-orange-500">
                            {(countersData || data)
                                ? Object.entries(countersData || data!).filter(
                                    ([_, value]) => value.severity === "UNRESOLVED",
                                ).length
                                : "-"}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Unresolved</div>
                    </div>
                </div>
            )}

            {/* Total count + Sort toggle */}
            {data && title !== "Emergencies" && (
                <div className="flex items-center justify-between px-3 mb-2">
                    <span className="text-xs text-slate-400 font-medium">
                        {Object.entries(data).filter(([key, e]) =>
                            e.title?.toLowerCase().includes(search.toLowerCase()) ||
                            e.phone?.includes(search) ||
                            e.location_name?.toLowerCase().includes(search.toLowerCase()) ||
                            key.toLowerCase().includes(search.toLowerCase()) ||
                            e.id?.toLowerCase().includes(search.toLowerCase())
                        ).length} calls
                    </span>
                    <button
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white font-medium transition-colors"
                        onClick={() => setSortOrder(prev => prev === "newest" ? "oldest" : "newest")}
                    >
                        {sortOrder === "newest" ? "Newest" : "Oldest"}
                        <ChevronDown size={14} className={cn("transition-transform", sortOrder === "oldest" && "rotate-180")} />
                    </button>
                </div>
            )}

            <div className="h-[calc(100vh-200px)] space-y-1 overflow-y-auto px-1 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-blue-800/80 hover:scrollbar-thumb-blue-800">
                {data &&
                    Object.entries(data)
                        .filter(([key, emergency]) =>
                            emergency.title?.toLowerCase().includes(search.toLowerCase()) ||
                            emergency.phone?.includes(search) ||
                            emergency.location_name?.toLowerCase().includes(search.toLowerCase()) ||
                            key.toLowerCase().includes(search.toLowerCase()) ||
                            emergency.id?.toLowerCase().includes(search.toLowerCase()),
                        )
                        .sort(([_, a], [__, b]) =>
                            sortOrder === "newest"
                                ? (new Date(a.time) < new Date(b.time) ? 1 : -1)
                                : (new Date(a.time) > new Date(b.time) ? 1 : -1),
                        )
                        .map(([_, emergency]) => {
                            const lastMsg = emergency.transcript?.length > 0
                                ? emergency.transcript[emergency.transcript.length - 1]
                                : null;
                            const msgCount = emergency.transcript?.length || 0;
                            const previewPrefix = lastMsg?.role === "assistant" ? "D: " : lastMsg?.role === "user" ? "C: " : "";
                            const previewText = lastMsg ? `${previewPrefix}${lastMsg.content}` : "No transcript available";
                            const cityState = (emergency as any).city_state || emergency.location_name || "Unknown";

                            return (
                                <div
                                    key={emergency.id}
                                    className={cn(
                                        "relative cursor-pointer border-l-4 px-4 py-3 transition-all hover:bg-slate-800/60",
                                        "border-b border-slate-800/60",
                                        selectedId === emergency.id
                                            ? "border-l-blue-500 bg-slate-800/50"
                                            : emergency.severity === "CRITICAL"
                                                ? "border-l-red-500"
                                                : emergency.severity === "UNRESOLVED"
                                                    ? "border-l-orange-500"
                                                    : "border-l-emerald-500",
                                    )}
                                    onClick={() => handleSelect(emergency.id)}
                                >
                                    {/* Row 1: Title + Relative Time */}
                                    <div className="flex items-start justify-between mb-1">
                                        <h4 className={cn(
                                            "text-sm font-bold leading-tight",
                                            selectedId === emergency.id ? "text-blue-400" : "text-slate-200"
                                        )}>
                                            {emergency.title || "Emergency Call"}
                                        </h4>
                                        <span className="text-[10px] text-slate-500 font-medium shrink-0 ml-2 mt-0.5" suppressHydrationWarning>
                                            {getRelativeTime(emergency.time)}
                                        </span>
                                    </div>

                                    {/* Row 2: Agent + Location */}
                                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-1.5">
                                        <span>Dispatcher: AI</span>
                                        {cityState !== "Unknown" && (
                                            <span className="flex items-center gap-0.5">
                                                <MapPin size={10} className="text-slate-500" />
                                                {cityState}
                                            </span>
                                        )}
                                        {emergency.phone && emergency.phone !== "Unknown" && (
                                            <span className="flex items-center gap-0.5 font-mono">
                                                <Phone size={9} className="text-blue-500" />
                                                {emergency.phone}
                                            </span>
                                        )}
                                    </div>

                                    {/* Row 3: Last Message Preview + Count */}
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs text-slate-500 truncate flex-1 leading-snug">
                                            {previewText}
                                        </p>
                                        {msgCount > 0 && (
                                            <span className="flex items-center gap-0.5 shrink-0 text-[10px] font-bold text-slate-400 bg-slate-800 rounded-full px-1.5 py-0.5">
                                                <MessageSquare size={9} />
                                                {msgCount}
                                            </span>
                                        )}
                                    </div>

                                    {/* Row 4: Severity Tag (only for non-resolved) */}
                                    {emergency.severity && emergency.severity !== "RESOLVED" && (
                                        <div className="mt-1.5">
                                            <span className={cn(
                                                "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                                                emergency.severity === "CRITICAL"
                                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                                    : emergency.severity === "UNRESOLVED"
                                                        ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                                        : "bg-slate-700/50 text-slate-400"
                                            )}>
                                                {emergency.severity}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
            </div>
        </div>
    );
};

export default EventPanel;
