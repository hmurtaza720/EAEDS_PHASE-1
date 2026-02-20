import { ChangeEvent, useState } from "react";
import { Call } from "@/app/live/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Filter, Search, ShieldCheck, Phone } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { US_STATES, EMOTIONS, EMERGENCY_TYPES } from "@/data/constants";

export interface FilterState {
    stateCode: string;
    city: string;
    emotion: string;
    type: string;
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
                {filters && (
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                            "h-10 w-10 border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-all",
                            isFiltersOpen && "border-blue-500 text-blue-400 bg-blue-500/10"
                        )}
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    >
                        <Filter size={18} />
                    </Button>
                )}
            </div>

            {/* Collapsible Filters */}
            {filters && onFilterChange && isFiltersOpen && (
                <div className="mb-6 px-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 gap-2">
                        {/* State Select */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">State</label>
                            <Select value={filters.stateCode} onValueChange={(val) => onFilterChange({ ...filters, stateCode: val, city: "ALL" })}>
                                <SelectTrigger className="h-8 border-slate-700 bg-slate-800 text-[10px] uppercase font-bold text-slate-300">
                                    <SelectValue placeholder="State" />
                                </SelectTrigger>
                                <SelectContent className="border-slate-700 bg-slate-900 text-slate-200">
                                    {US_STATES.map(s => (
                                        <SelectItem key={s.code} value={s.code} className="text-[10px] uppercase font-bold">{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* City Select */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">City</label>
                            <Select value={filters.city} onValueChange={(val) => onFilterChange({ ...filters, city: val })}>
                                <SelectTrigger className="h-8 border-slate-700 bg-slate-800 text-[10px] uppercase font-bold text-slate-300">
                                    <SelectValue placeholder="City" />
                                </SelectTrigger>
                                <SelectContent className="border-slate-700 bg-slate-900 text-slate-200">
                                    <SelectItem value="ALL" className="text-[10px] uppercase font-bold">All Cities</SelectItem>
                                    {US_STATES.find(s => s.code === filters.stateCode)?.cities.map(c => (
                                        <SelectItem key={c} value={c} className="text-[10px] uppercase font-bold">{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {/* Emotion Select */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Emotion</label>
                            <Select value={filters.emotion} onValueChange={(val) => onFilterChange({ ...filters, emotion: val })}>
                                <SelectTrigger className="h-8 border-slate-700 bg-slate-800 text-[10px] uppercase font-bold text-slate-300">
                                    <SelectValue placeholder="Emotion" />
                                </SelectTrigger>
                                <SelectContent className="border-slate-700 bg-slate-900 text-slate-200">
                                    <SelectItem value="ALL" className="text-[10px] uppercase font-bold">All Emotions</SelectItem>
                                    {EMOTIONS.map(e => (
                                        <SelectItem key={e} value={e} className="text-[10px] uppercase font-bold">{e}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Type Select */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Type</label>
                            <Select value={filters.type} onValueChange={(val) => onFilterChange({ ...filters, type: val })}>
                                <SelectTrigger className="h-8 border-slate-700 bg-slate-800 text-[10px] uppercase font-bold text-slate-300">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent className="border-slate-700 bg-slate-900 text-slate-200">
                                    <SelectItem value="ALL" className="text-[10px] uppercase font-bold">All Types</SelectItem>
                                    {EMERGENCY_TYPES.map(t => (
                                        <SelectItem key={t} value={t} className="text-[10px] uppercase font-bold">{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Separator className="bg-slate-800 mt-2" />
                </div>
            )}

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

            <div className="h-[calc(100vh-320px)] space-y-3 overflow-y-auto px-1 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-blue-800/80 hover:scrollbar-thumb-blue-800">
                {data &&
                    Object.entries(data)
                        .filter(([_, emergency]) =>
                            emergency.title?.includes(search),
                        )
                        .sort(([_, a], [__, b]) =>
                            new Date(a.time) < new Date(b.time) ? 1 : -1,
                        )
                        .map(([_, emergency]) => (
                            <Card
                                key={emergency.id}
                                className={cn(
                                    "relative m-1 flex cursor-pointer items-center border-l-4 p-4 transition-all hover:bg-slate-800",
                                    "bg-slate-900 border-y border-r border-slate-800",
                                    selectedId === emergency.id
                                        ? "border-l-blue-500 bg-slate-800 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]"
                                        : emergency.severity === "CRITICAL" ? "border-l-red-500" : "border-l-slate-600",
                                )}
                                onClick={() => handleSelect(emergency.id)}
                            >
                                {emergency.severity === "CRITICAL" && (
                                    <AlertCircle className="mr-4 h-6 w-6 text-red-500" />
                                )}
                                {emergency.severity === "MODERATE" && (
                                    <AlertTriangle className="mr-4 h-6 w-6 text-orange-500" />
                                )}
                                {emergency.severity === "UNRESOLVED" && (
                                    <AlertTriangle className="mr-4 h-6 w-6 text-orange-500" />
                                )}
                                <CardContent className="flex-grow p-0 space-y-1.5 mt-1">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col space-y-0.5">
                                            <div className={cn("text-sm font-bold uppercase tracking-wide leading-tight", selectedId === emergency.id ? "text-blue-400" : "text-slate-200")}>
                                                {emergency.title}
                                            </div>
                                            {emergency.phone && emergency.phone !== "Unknown" && (
                                                <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                                                    <Phone size={10} className="text-blue-500" />
                                                    <span className="opacity-90">{emergency.phone}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono shrink-0 ml-2" suppressHydrationWarning>
                                            {new Date(emergency.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </CardContent>
                                {emergency.severity ? (
                                    <Badge
                                        className={cn(
                                            "ml-2 min-w-fit rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-wider",
                                            emergency.severity === "CRITICAL"
                                                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                                : emergency.severity === "UNRESOLVED"
                                                    ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                                                    : "bg-green-500/10 text-green-500 border border-green-500/20"
                                        )}
                                    >
                                        {emergency.severity}
                                    </Badge>
                                ) : null}
                            </Card>
                        ))}
            </div>
        </div>
    );
};

export default EventPanel;
