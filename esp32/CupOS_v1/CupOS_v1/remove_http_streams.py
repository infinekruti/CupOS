import os

files_to_remove = [
    ".pio/libdeps/esp32dev/ESP8266Audio/src/AudioFileSourceHTTPStream.cpp",
    ".pio/libdeps/esp32dev/ESP8266Audio/src/AudioFileSourceICYStream.cpp"
]

for f in files_to_remove:
    if os.path.exists(f):
        try:
            os.remove(f)
            print(f"Removed: {f}")
        except Exception as e:
            print(f"Error removing {f}: {e}")
