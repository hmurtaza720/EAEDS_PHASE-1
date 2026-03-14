import { useEffect, useState } from "react";
import { Call } from "@/data/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
    Ambulance,
    CircleEllipsisIcon,
    FireExtinguisher,
    Siren,
} from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter } from "../ui/card";
import { Separator } from "../ui/separator";

const EmergencyInfoItem = ({
    label,
    value,
    side,
}: {
    label: string;
    value: string | React.ReactNode;
    side: "left" | "right";
}) => (
    <div
        className={cn(
            "line-clamp-3 space-y-1 px-3 pt-2",
            side === "left" ? "border-l border-slate-700" : "border-r border-slate-700",
        )}
    >
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {label}
        </p>
        {typeof value === "string" ? (
            <p className="text-lg font-bold leading-tight text-slate-200">{value}</p>
        ) : (
            value
        )}
    </div>
);

interface DetailsPanelProps {
    call: Call | undefined;
    handleResolve: (id: string) => void;
}

const DetailsPanel = ({ call, handleResolve }: DetailsPanelProps) => {
    const emergency = {
        title: "House Fire in Lincoln Ave.",
        status: "CRITICAL",
        distance: "22 miles",
        type: "Fire",
        time: "12:34 AM",
        location: "Lincoln Ave.",
        summary:
            "Qui consectetur labore voluptate ea voluptate commodo nostrud sint labore consectetur qui nulla reprehenderit ad. Ut mollit nisi officia laboris exercitation cillum sit non eiusmod consequat. Non proident proident ad Lorem. Qui ea tempor labore deserunt dolor ad proident sit id nisi proident dolore. Nostrud commodo minim fugiat pariatur minim irure labore aute. Adipisicing mollit consequat ut id excepteur labore laboris. In laborum nisi aute duis pariatur eu.",
    };

    const { toast } = useToast();
    const [clicked, setClicked] = useState<number>(1);

    if (!call) {
        return null;
    }

    return (
        <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeOut", delay: 0.2 }}
            className="h-full"
        >
            <Card className="h-full w-[380px] rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-2xl backdrop-blur-md overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-950/50 rounded-tl-lg">
                    <p className="text-sm font-bold uppercase tracking-wider text-slate-300">Case Details</p>
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                </div>
                <Separator className="bg-slate-700" />
                <CardContent className="space-y-4 p-4 text-slate-200">
                    <div className="space-y-2 px-1">
                        <div className="flex-between">
                            <p className="text-xl font-bold leading-tight">{call?.title}</p>
                            <CircleEllipsisIcon className="text-slate-500" />
                        </div>
                        {call?.severity ? (
                            <Badge
                                className={cn(
                                    "w-fit border",
                                    call.severity === "CRITICAL"
                                        ? "bg-red-500/10 text-red-500 border-red-500/50"
                                        : call.severity === "MODERATE"
                                            ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/50"
                                            : "bg-green-500/10 text-green-500 border-green-500/50",
                                )}
                            >
                                {call.severity}
                            </Badge>
                        ) : null}
                    </div>
                    {call && (
                        <div className="grid grid-cols-2 gap-4 rounded-md border border-slate-700 bg-slate-800/30 p-3">
                            <EmergencyInfoItem
                                label="Time of Call"
                                value={new Date(call.time).toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "numeric",
                                    second: "numeric"
                                })}
                                side="right"
                            />
                            <EmergencyInfoItem
                                label="Location"
                                value={call.location_name}
                                side="left"
                            />
                        </div>
                    )}
                    <Separator className="bg-slate-700" />
                    <div className="px-1">
                        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                            Summary
                        </p>
                        <ScrollArea
                            type="auto"
                            className="max-h-[80px] overflow-y-auto pr-2"
                        >
                            <p className="text-sm leading-relaxed text-slate-400">
                                {call?.summary || "Analyzing call transcript for summary..."}
                            </p>
                        </ScrollArea>
                    </div>
                </CardContent>
                <CardFooter className="px-4 pb-4 pt-2">
                    <div className="flex w-full flex-col space-y-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            Dispatch Units
                        </p>
                        <div className="mb-2 flex justify-between gap-2">
                            <Button
                                variant="outline"
                                className="flex-1 border-blue-900/50 bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 hover:text-blue-200"
                                onClick={() => {
                                    toast({
                                        title: "Dispatched: Police",
                                        description: `Units en route to ${call!.location_name}.`,
                                        className: "bg-slate-900 border-slate-700 text-slate-200"
                                    });
                                    handleResolve(call!.id);
                                    setClicked((prev) => prev * 2);
                                }}
                                disabled={clicked % 2 === 0}
                            >
                                <Siren className="mr-2 h-4 w-4" />
                                Police
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/40 hover:text-red-200"
                                onClick={() => {
                                    toast({
                                        title: "Dispatched: Fire",
                                        description: `Engine 1 en route.`,
                                        className: "bg-slate-900 border-slate-700 text-slate-200"
                                    });
                                    handleResolve(call!.id);
                                    setClicked((prev) => prev * 3);
                                }}
                                disabled={clicked % 3 === 0}
                            >
                                <FireExtinguisher className="mr-2 h-4 w-4" />
                                Fire
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 border-green-900/50 bg-green-900/20 text-green-400 hover:bg-green-900/40 hover:text-green-200"
                                onClick={() => {
                                    toast({
                                        title: "Dispatched: EMS",
                                        description: `Ambulance dispatched.`,
                                        className: "bg-slate-900 border-slate-700 text-slate-200"
                                    });
                                    handleResolve(call!.id);
                                    setClicked((prev) => prev * 5);
                                }}
                                disabled={clicked % 5 === 0}
                            >
                                <Ambulance className="mr-2 h-4 w-4" />
                                EMS
                            </Button>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </motion.div>
    );
};

export default DetailsPanel;
