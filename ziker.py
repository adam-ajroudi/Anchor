import asyncio
from bleak import BleakScanner, BleakClient

RING_NAME = "Zikr Ring Lite"

async def main():
    print(f"Scanning for '{RING_NAME}'...")
    device = await BleakScanner.find_device_by_name(RING_NAME)

    if device is None:
        print(f"Could not find a device named '{RING_NAME}'.")
        return

    print(f"Found device: {device.address}. Connecting and discovering services...")

    async with BleakClient(device) as client:
        if client.is_connected:
            print(f"Connected to {device.address}. Services found:")
            
            for service in client.services:
                print(f"\n[Service] {service.uuid}: {service.description}")
                for char in service.characteristics:
                    print(f"  [Characteristic] {char.uuid}: {char.description}, Properties: {char.properties}")
                    for descriptor in char.descriptors:
                        print(f"    [Descriptor] {descriptor.uuid}: {descriptor.description}")
        else:
            print(f"Failed to connect.")

if __name__ == "__main__":
    asyncio.run(main())