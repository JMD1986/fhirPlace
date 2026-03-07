# ── Build stage: restore & publish the .NET API ──────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
WORKDIR /src
COPY server/ ./server/
RUN dotnet publish server/FhirPlace.Server.csproj -c Release -o /app/publish --no-self-contained

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine
WORKDIR /app

COPY --from=build /app/publish ./

# Synthea FHIR data expected at /app/public/synthea/fhir/ at runtime.
# Mount this volume or bake it in below.
COPY public/synthea ./public/synthea

EXPOSE 5001

# Tighten permissions — run as non-root for HIPAA/SOC 2 hardening
USER $APP_UID

ENTRYPOINT ["dotnet", "FhirPlace.Server.dll"]
