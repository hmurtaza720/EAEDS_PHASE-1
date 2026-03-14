import json
import os

input_file = r"d:\Emotion-Aware-Emergency-Dispatch\calls.jsonl"
output_file = r"d:\Emotion-Aware-Emergency-Dispatch\extracted_calls.json"

def get_severity(transcript):
    text = " ".join([m["content"].lower() for m in transcript])
    if any(word in text for word in ["shot", "gun", "weapon", "kill", "stab", "homicide", "plane down"]):
        return "CRITICAL"
    if any(word in text for word in ["assault", "accident", "fight", "broken into", "stolen", "harassed"]):
        return "MODERATE"
    return "LOW"

def get_title(transcript):
    text = " ".join([m["content"].lower() for m in transcript])
    if "gun" in text: return "Firearm Emergency"
    if "shot" in text: return "Shooting Incident"
    if "car" in text or "accident" in text: return "Vehicle Emergency"
    if "broke into" in text: return "Break-in Report"
    if "stab" in text: return "Stabbing Incident"
    if "plane" in text: return "Aircraft Emergency"
    if "nuggets" in text: return "Disturbance Complaint"
    if "killed" in text or "homicide" in text: return "Homicide Report"
    return "Emergency Call"

def get_location(transcript):
    # Simple search for common location prefixes
    for m in transcript:
        content = m["content"]
        if "at " in content:
            return content.split("at ")[1].split(".")[0].strip()
        if "on " in content:
            return content.split("on ")[1].split(".")[0].strip()
    return "Unknown Location"

print(f"Opening input file: {input_file}")
if not os.path.exists(input_file):
    print(f"ERROR: Input file not found at {input_file}")
    exit(1)

calls = []
with open(input_file, "r", encoding="utf-8") as f:
    for i, line in enumerate(f):
        if i >= 20: break
        try:
            data = json.loads(line)
            transcript = data["messages"]
            severity = get_severity(transcript)
            title = get_title(transcript)
            location = get_location(transcript)
            
            # Format transcript for frontend
            formatted_transcript = []
            for m in transcript:
                role = "user" if m["role"] == "user" else "assistant"
                formatted_transcript.append({"role": role, "content": m["content"]})
                
            call = {
                "id": f"archived_{i+1}",
                "title": title.upper(),
                "severity": severity,
                "time": f"{10+i%2}:{max(0, 10-i)}:{min(59, 30+i)} PM", # Mock time
                "location_name": location[:40] if location else "Dispatch Center",
                "location_coords": {"lat": 37.7749 + (0.01 * i), "lng": -122.4194 + (0.01 * i)}, # Mock coords
                "status": "Resolved",
                "transcript": formatted_transcript,
                "emotions": [
                    {"emotion": "Anxiety" if severity == "CRITICAL" else "Confusion", "intensity": 0.8},
                    {"emotion": "Fear" if severity == "CRITICAL" else "Calm", "intensity": 0.4}
                ],
                "summary": "Historical call record extracted from archives."
            }
            calls.append(call)
            print(f"Processed call {i+1}")
        except Exception as e:
            print(f"Error processing line {i+1}: {e}")

ts_output_file = r"d:\Emotion-Aware-Emergency-Dispatch\client\src\data\archiveMessages.ts"

ts_content = "import { Call } from \"@/app/archive/page\";\n\n"
ts_content += "export const ARCHIVE_MESSAGES: Record<string, Call> = "
ts_content += json.dumps({c["id"]: c for c in calls}, indent=4)
ts_content += ";\n"

print(f"Writing {len(calls)} calls to {ts_output_file}")
with open(ts_output_file, "w", encoding="utf-8") as f:
    f.write(ts_content)

if os.path.exists(ts_output_file):
    print("Successfully created TypeScript output file.")
else:
    print("FAILED to create TypeScript output file.")
