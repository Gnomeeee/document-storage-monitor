import sys
import serial

port = sys.argv[1]
try:
    device = serial.Serial(baudrate=115200, timeout=1)
    device.port = port
    device.dtr = False
    device.rts = False
    with device:
        while True:
            line = device.read_until()
            if line.endswith(b"\n"):
                print(line.decode("ascii", errors="replace").rstrip(), flush=True)
except (serial.SerialException, OSError):
    print(
        f"Cannot read {port}. Close any serial monitor and check the USB connection.",
        file=sys.stderr,
    )
    sys.exit(1)
