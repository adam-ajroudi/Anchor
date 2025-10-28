import asyncio
from bleak import BleakScanner, BleakClient

# The correct UUIDs discovered from the service scan
RING_NAME = "Zikr Ring Lite"
NOTIFY_UUID = "0000d002-0000-1000-8000-00805f9b34fb"

# The data we expect to receive when the button is pressed (from Wireshark)
BUTTON_PRESS_VALUE = b'\x01\x00\x00\x00'

def notification_handler(sender_uuid: str, data: bytearray):
    """This function is called every time the ring sends a notification."""
    if data == BUTTON_PRESS_VALUE:
        print("----> BUTTON PRESSED! <----")
        # --- ADD YOUR CUSTOM ACTION HERE ---
    else:
        # This will show you if the ring sends other data you might be interested in
        print(f"Received data from {sender_uuid}: {data.hex()}")

async def main():
    print(f"Scanning for '{RING_NAME}'...")
    device = await BleakScanner.find_device_by_name(RING_NAME)

    if device is None:
        print(f"Could not find a device named '{RING_NAME}'. Please make sure it's nearby and advertising.")
        return

    print(f"Found device: {device.address}. Connecting...")

    async with BleakClient(device) as client:
        if client.is_connected:
            print(f"Successfully connected to {device.address}")

            print(f"Enabling notifications for characteristic {NOTIFY_UUID}...")
            await client.start_notify(NOTIFY_UUID, notification_handler)
            print("Successfully subscribed to notifications.")
            
            print("Setup complete. Waiting for button clicks. Press Ctrl+C to stop.")
            await asyncio.Event().wait()
        else:
            print(f"Failed to connect to {device.address}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nScript stopped by user.")