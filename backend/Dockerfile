FROM python:3.12-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
        smartmontools \
        nvme-cli \
        udev \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 6 -o disk 2>/dev/null || true \
    && useradd -r -u 1001 -G disk -s /bin/false appuser

WORKDIR /app
COPY --from=builder /install /usr/local
COPY . .
RUN mkdir -p /app/data && chown appuser:appuser /app/data

USER appuser
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
