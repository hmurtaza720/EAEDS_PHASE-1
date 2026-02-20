export type Call = {
    emotions?: {
        emotion: string;
        intensity: number;
    }[];
    id: string;
    location_name: string;
    city_state?: string;
    location_coords?: {
        lat: number;
        lng: number;
    };
    street_view?: string; // base 64
    name: string;
    phone: string;
    recommendation: string;
    severity?: "CRITICAL" | "MODERATE" | "RESOLVED" | "UNRESOLVED";
    summary: string;
    time: string; // ISO Date String
    title?: string;
    transcript: {
        role: "assistant" | "user" | "agent";
        content: string;
    }[];
    type: string;
    status?: "Connected" | "Disconnected";
    agent_name?: string;
    responder_type?: "AI" | "Human";
};
