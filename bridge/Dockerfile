# Mock telemetry bridge image for local/dev environments.
#
# This ships the MOCK bridge on purpose: the real bridge (bridge.py) only works
# on Windows against iRacing's shared memory via pyirsdk, which cannot run in a
# Linux container. The mock speaks the exact same WebSocket protocol.
FROM python:3.11-slim

WORKDIR /app

COPY requirements-mock.txt ./
RUN pip install --no-cache-dir -r requirements-mock.txt

COPY mock_bridge.py ./
COPY telemetrylab ./telemetrylab

# WebSocket server port (mock_bridge.py binds 0.0.0.0:8765).
EXPOSE 8765

# -u keeps stdout unbuffered so `docker compose logs` shows frames live.
CMD ["python", "-u", "mock_bridge.py"]
