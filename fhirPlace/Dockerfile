# ── Build stage: restore & publish the .NET API ──────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
WORKDIR /src
COPY server/ ./server/
RUN dotnet publish server/FhirPlace.Server.csproj -c Release -o /app/publish --no-self-contained

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine
WORKDIR /app

COPY --from=build /app/publish ./

# Synthea FHIR seed files — the seeder resolves ContentRootPath/../public/synthea/fhir
# which maps to /public/synthea/fhir inside the container.
COPY public/synthea/fhir /public/synthea/fhir

# SQLite DB is written to /data/fhir.db so it can be mounted as a named volume.
# This keeps the DB across container restarts and avoids re-seeding every start.
# Usage: docker run -v fhirplace_db:/data ...
ENV FHIRPLACE_DB_PATH=/data/fhir.db

# Override the hardcoded UseUrls("http://localhost:5001") in Program.cs so Kestrel
# listens on all interfaces inside the container (required for Docker port mapping).
ENV ASPNETCORE_URLS=http://+:5001

RUN mkdir -p /data && chown $APP_UID /data

EXPOSE 5001

# Run as non-root (HIPAA/SOC 2 hardening)
USER $APP_UID

ENTRYPOINT ["dotnet", "FhirPlace.Server.dll"]
