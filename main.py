import asyncio
import signal
import sys
from bleak import BleakScanner, BleakClient

# The correct UUIDs discovered from the service scan
RING_NAME = "Zikr Ring Lite"
NOTIFY_UUID = "0000d002-0000-1000-8000-00805f9b34fb"

# The data we expect to receive when the button is pressed (from Wireshark)
BUTTON_PRESS_VALUE = b'\x01\x00\x00\x00'

# Global client reference for cleanup
current_client = None
shutdown_event = None

def notification_handler(sender_uuid: str, data: bytearray):
    """This function is called every time the ring sends a notification."""
    # Show detailed data format for debugging
    data_hex = data.hex()
    data_bytes = bytes(data)
    data_str = data_bytes.decode('utf-8', errors='ignore')
    
    print(f"[DATA] Hex: {data_hex} | Bytes: {data_bytes} | Length: {len(data)}")
    
    # Detect button press: Q07 messages with non-zero third parameter
    # Format: Q07,XXXX,YYYYY,0,0 where YYYYY > 0 means button pressed
    if data_str.startswith('Q07,'):
        parts = data_str.split(',')
        if len(parts) >= 3:
            try:
                third_value = int(parts[2])
                if third_value > 0:
                    print("----> BUTTON PRESSED! <----")
            except ValueError:
                pass
    
    # Also detect Q05 messages (another button indicator)
    if data_str.startswith('Q05,'):
        print("----> BUTTON PRESSED! <----")
    
    # Old detection method (keep for compatibility)
    if data == BUTTON_PRESS_VALUE:
        print("----> BUTTON PRESSED! <----")

async def cleanup_connection():
    """Properly disconnect from the Bluetooth device."""
    global current_client
    if current_client and current_client.is_connected:
        try:
            print("\nDisconnecting from Bluetooth device...")
            await current_client.stop_notify(NOTIFY_UUID)
            await current_client.disconnect()
            print("Bluetooth device disconnected successfully.")
        except Exception as e:
            print(f"Error during disconnect: {e}")

def signal_handler(signum, frame):
    """Handle termination signals gracefully."""
    global shutdown_event
    print(f"\nReceived signal {signum}, initiating shutdown...")
    if shutdown_event:
        shutdown_event.set()

async def main():
    global current_client, shutdown_event
    shutdown_event = asyncio.Event()
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print(f"Scanning for '{RING_NAME}'...")
    device = await BleakScanner.find_device_by_name(RING_NAME, timeout=10.0)

    if device is None:
        print(f"Could not find a device named '{RING_NAME}'. Please make sure it's nearby and advertising.")
        return

    print(f"Found device: {device.address}. Connecting...")

    try:
        client = BleakClient(device)
        current_client = client
        
        await client.connect()
        
        if client.is_connected:
            print(f"Successfully connected to {device.address}")

            print(f"Enabling notifications for characteristic {NOTIFY_UUID}...")
            await client.start_notify(NOTIFY_UUID, notification_handler)
            print("Successfully subscribed to notifications.")
            
            print("Setup complete. Waiting for button clicks. Press Ctrl+C to stop.")
            
            # Wait for shutdown signal
            await shutdown_event.wait()
        else:
            print(f"Failed to connect to {device.address}")
    
    except Exception as e:
        print(f"Error during connection: {e}")
    
    finally:
        # Always disconnect before exiting
        await cleanup_connection()
        current_client = None

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nScript stopped by user.")
    except Exception as e:
        print(f"\nUnexpected error: {e}")
    finally:
        print("Cleanup complete. Exiting.")
        sys.exit(0)