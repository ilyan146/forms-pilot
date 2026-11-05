FROM python:3.13-slim

RUN pip install --no-cache-dir "uv>=0.13,<0.14"
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_NO_DEV=1 PYTHONUNBUFFERED=1

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project
COPY src ./src
RUN uv sync --frozen

RUN useradd --create-home app
USER app
EXPOSE 8000
# --proxy-headers: the API is expected to run behind an HTTPS proxy or platform ingress.
CMD ["/app/.venv/bin/uvicorn", "forms_pilot.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
