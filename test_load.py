import asyncio
import websockets
import json
import time

# Configuration
NUM_CALLS = 50  # Number of concurrent connections to simulate
WEBSOCKET_URL = "ws://localhost:8000/ws/call"

# Statistics tracking
stats = {
    "successful_connections": 0,
    "failed_connections": 0,
    "completed_calls": 0,
    "latencies": []
}

async def simulate_call(call_index):
    phone_number = f"555000{call_index:04d}"
    
    try:
        async with websockets.connect(WEBSOCKET_URL) as ws:
            stats["successful_connections"] += 1
            
            # 1. Initialize the call
            start_payload = {
                "event": "start_call",
                "phone": phone_number,
                "location_manual": f"LoadTestCity_{call_index}, NY"
            }
            await ws.send(json.dumps(start_payload))
            
            # Give the backend a tiny moment to register the call
            await asyncio.sleep(0.5)
            
            # 2. Send the text utterance (bypasses STT GPU bottleneck)
            text_payload = {
                "event": "text_utterance",
                "text": f"Help! There is a huge fire in building {call_index}!"
            }
            start_time = time.time()
            await ws.send(json.dumps(text_payload))
            
            # 3. Wait for the AI's response
            received_response = False
            first_response_latency = 0
            full_response = ""
            
            while True:
                try:
                    response_raw = await asyncio.wait_for(ws.recv(), timeout=30.0)
                    response_data = json.loads(response_raw)
                    
                    event_type = response_data.get("event")
                    
                    # Track first token latency
                    if event_type == "ai_streaming_chunk" and not received_response:
                        received_response = True
                        first_response_latency = time.time() - start_time
                        stats["latencies"].append(first_response_latency)
                    
                    # Accumulate full text for logging
                    if event_type == "ai_streaming_chunk":
                        full_response += response_data.get("text_chunk", "")
                    
                    # Stop when final meta is received
                    if event_type == "ai_response" and "severity" in response_data:
                        break
                        
                except asyncio.TimeoutError:
                    print(f"[Call {phone_number}] Timeout waiting for response.")
                    break
                except Exception as e:
                    print(f"[Call {phone_number}] WebSocket Error: {e}")
                    break
            
            if received_response:
                print(f"[Call {phone_number}] Success | Latency: {first_response_latency:.2f}s | Response: {full_response[:50]}...")
                stats["completed_calls"] += 1
            else:
                print(f"[Call {phone_number}] Failed to get response")
                
    except Exception as e:
        stats["failed_connections"] += 1
        print(f"[Call {phone_number}] Connection failed: {e}")

async def main():
    print(f"Starting Load Test with {NUM_CALLS} concurrent calls to {WEBSOCKET_URL}")
    print("-" * 60)
    
    start_test_time = time.time()
    
    # Spawn all tasks concurrently
    tasks = [simulate_call(i) for i in range(1, NUM_CALLS + 1)]
    await asyncio.gather(*tasks)
    
    total_time = time.time() - start_test_time
    
    print("-" * 60)
    print("LOAD TEST RESULTS:")
    print(f"Total Time Taken:        {total_time:.2f} seconds")
    print(f"Successful Connections:  {stats['successful_connections']}/{NUM_CALLS}")
    print(f"Failed Connections:      {stats['failed_connections']}")
    print(f"Completed Turnarounds:   {stats['completed_calls']}/{NUM_CALLS}")
    
    if stats["latencies"]:
        avg_latency = sum(stats["latencies"]) / len(stats["latencies"])
        max_latency = max(stats["latencies"])
        min_latency = min(stats["latencies"])
        print(f"Average Response Time:   {avg_latency:.2f} seconds")
        print(f"Min Response Time:       {min_latency:.2f} seconds")
        print(f"Max Response Time:       {max_latency:.2f} seconds")
    print("-" * 60)

if __name__ == "__main__":
    asyncio.run(main())
