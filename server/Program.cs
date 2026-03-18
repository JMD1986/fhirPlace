using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using FhirPlace.Server;
using Microsoft.EntityFrameworkCore;

// â”€â”€ Builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var builder = WebApplication.CreateBuilder(args);

// FHIRPLACE_DB_PATH env var lets Docker mount a persistent volume (e.g. /data/fhir.db).
// Falls back to fhir.db in the working directory for local dev.
var dbPath = Environment.GetEnvironmentVariable("FHIRPLACE_DB_PATH")
             ?? builder.Configuration.GetConnectionString("FhirDb")
             ?? "fhir.db";
builder.Services.AddDbContext<FhirDbContext>(opts =>
    opts.UseSqlite($"Data Source={dbPath}"));

builder.Services.ConfigureHttpJsonOptions(opts =>
{
  opts.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
  opts.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
  opts.SerializerOptions.PropertyNameCaseInsensitive = true;
});
builder.Services.AddHttpClient();
// ALLOWED_ORIGINS env var lets production deployments (e.g. Fly.io) add extra
// origins without code changes. Comma-separated, e.g.:
//   ALLOWED_ORIGINS=https://fhirplace.fly.dev,https://my-frontend.fly.dev
var extraOrigins = (Environment.GetEnvironmentVariable("ALLOWED_ORIGINS") ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
var allowedOrigins = new[] { "http://localhost:5173", "http://localhost:3000" }
    .Concat(extraOrigins)
    .ToArray();

builder.Services.AddCors(opts =>
    opts.AddDefaultPolicy(p =>
        p.WithOrigins(allowedOrigins)
         .AllowCredentials()
         .AllowAnyHeader()
         .AllowAnyMethod()));

// In production (Docker/Fly.io) ASPNETCORE_URLS env var controls the listen
// address (http://+:5001).  In local dev the default (http://localhost:5001)
// is fine — do NOT call UseUrls() here as it would override the env var.

// â”€â”€ App pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var app = builder.Build();

app.UseCors();

app.Use(async (ctx, next) =>
{
  var h = ctx.Response.Headers;
  h["X-Content-Type-Options"] = "nosniff";
  h["X-Frame-Options"] = "DENY";
  h["Referrer-Policy"] = "strict-origin-when-cross-origin";
  h["Content-Security-Policy"] =
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; connect-src 'self' https:; font-src 'self' data:; " +
      "object-src 'none'; frame-ancestors 'none'";
  await next();
});

// ── ONC §170.315(d)(2) — Audit logging middleware ─────────────────────────────
// Records who accessed EHI, what was accessed, when, and the outcome.
// Runs after security headers so it can capture response status codes.
app.Use(async (ctx, next) =>
{
  var path = ctx.Request.Path.Value ?? "";

  if (!AuditService.ShouldAudit(path))
  {
    await next();
    return;
  }

  await next(); // Let the request complete so we capture the status code

  // Fire-and-forget audit write using a new scope (original may be disposed)
  var scopeFactory = ctx.RequestServices.GetRequiredService<IServiceScopeFactory>();
  var (action, resourceType, resourceId, patientId) =
      AuditService.ParseRequest(path, ctx.Request.QueryString.ToString());
  var (userId, userName, userRole) = AuditService.ExtractUser(ctx.Request);

  var evt = new AuditEvent
  {
    Timestamp = DateTime.UtcNow.ToString("o"),
    Action = action,
    ResourceType = resourceType,
    ResourceId = resourceId,
    PatientId = patientId,
    UserId = userId,
    UserName = userName,
    UserRole = userRole,
    HttpMethod = ctx.Request.Method,
    RequestPath = path,
    QueryString = ctx.Request.QueryString.ToString().TrimStart('?'),
    StatusCode = ctx.Response.StatusCode,
    ClientIp = ctx.Connection.RemoteIpAddress?.ToString(),
    Outcome = ctx.Response.StatusCode < 400 ? "success" : "failure",
  };

  // Write in background so latency isn't added to the response
  _ = Task.Run(async () =>
  {
    using var scope = scopeFactory.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<FhirDbContext>();
    try
    {
      await AuditService.LogAsync(db, evt);
    }
    catch (OperationCanceledException)
    {
      // Ignore cancellation: background audit task was cancelled, not a real failure.
    }
    catch (Exception ex)
    {
      Console.Error.WriteLine($"[Audit] write failed: {ex}");
    }
      await AuditService.LogAsync(db, evt);
    }
    catch (OperationCanceledException)
    {
      // Ignore cancellation: background audit task was cancelled, not a real failure.
    }
    catch (Exception ex)
    {
      Console.Error.WriteLine($"[Audit] write failed: {ex}");
    }
  });
});

// â”€â”€ Startup: seed DB from Synthea files (no-op on subsequent restarts) â”€â”€â”€â”€â”€â”€â”€â”€
using (var scope = app.Services.CreateScope())
{
  var db = scope.ServiceProvider.GetRequiredService<FhirDbContext>();
  var fhirDir = Path.GetFullPath(
      Path.Combine(builder.Environment.ContentRootPath, "..", "public", "synthea", "fhir"));
  await FhirSeeder.SeedAsync(db, fhirDir);
}

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const string FhirContentType = "application/fhir+json";
const string BaseUrl = "http://localhost:5001";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// <summary>Deserialise a stored JSON string to JsonObject.</summary>
static JsonObject J(string json) => JsonNode.Parse(json)!.AsObject();

/// <summary>Build a FHIR searchset Bundle and return it with the correct content-type.</summary>
static IResult SearchSetBundle(
    string resourceType,
    IEnumerable<JsonObject> page,
    int total,
    string selfUrl,
    IEnumerable<object>? extraLinks = null)
{
  var links = new List<object> { new { relation = "self", url = selfUrl } };
  if (extraLinks is not null) links.AddRange(extraLinks);

  return Results.Json(new
  {
    resourceType = "Bundle",
    type = "searchset",
    total,
    link = links,
    entry = page.Select(r => new
    {
      fullUrl = $"{BaseUrl}/fhir/{resourceType}/{r["id"]?.GetValue<string>()}",
      resource = r,
      search = new { mode = "match" },
    }),
  }, contentType: FhirContentType);
}

/// <summary>
/// Generic encounter/patient/_id search against the FhirResources table.
/// Handles all resource types except Encounter, DocumentReference, Claim, and EOB
/// (those have dedicated helpers for their multi-encounter joins).
/// </summary>
static async Task<IResult> SimpleResourceSearch(
    FhirDbContext db,
    string resourceType,
    string? encounter,
    string? patient,
    string? _id,
    int count,
    int offset,
    string selfUrl)
{
  var q = db.Resources
            .Where(r => r.ResourceType == resourceType)
            .AsNoTracking();

  if (encounter is not null)
  {
    var encId = encounter.Replace("Encounter/", "").Replace("urn:uuid:", "");
    q = q.Where(r => r.EncounterId == encId);
  }
  else if (patient is not null)
  {
    var patId = patient.Replace("Patient/", "").Replace("urn:uuid:", "");
    q = q.Where(r => r.PatientId == patId);
  }
  else if (_id is not null)
  {
    q = q.Where(r => r.Id == _id);
  }

  var total = await q.CountAsync();
  var records = await q.Skip(offset).Take(count).Select(r => r.ResourceJson).ToListAsync();
  return SearchSetBundle(resourceType, records.Select(J), total, selfUrl);
}

// â”€â”€ Routes: utility â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.MapGet("/", () => Results.Json(new { status = "ok", service = "FhirPlace .NET API" }));
app.MapGet("/api/health", () => Results.Json(new { status = "ok" }));

// â”€â”€ Routes: /api/patients â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.MapGet("/api/patients-count", async (FhirDbContext db) =>
    Results.Json(new { count = await db.Patients.CountAsync() }));

app.MapGet("/api/patients", async (
    FhirDbContext db,
    string? name, string? family, string? given,
    string? gender, string? birthDate, string? phone, string? address) =>
{
  var q = db.Patients.AsNoTracking().AsQueryable();

  if (name is not null) q = q.Where(p => p.Name.Contains(name));
  if (family is not null) q = q.Where(p => p.Family.Contains(family));
  if (given is not null) q = q.Where(p => p.Given.Contains(given));
  if (gender is not null) q = q.Where(p => p.Gender == gender);
  if (birthDate is not null) q = q.Where(p => p.BirthDate == birthDate);
  if (phone is not null) q = q.Where(p => p.Phone.Contains(phone));
  if (address is not null) q = q.Where(p => p.Address.Contains(address));

  var results = await q.Select(p => new
  {
    p.Id,
    p.Name,
    p.Family,
    p.Given,
    p.Gender,
    p.BirthDate,
    p.MaritalStatus,
    p.Phone,
    p.Address,
    p.Race,
    p.Ethnicity,
    p.BirthPlace,
    p.Language,
    p.Ssn,
    p.Mrn,
    p.Filename,
    resourceType = "Patient",
  }).ToListAsync();

  return Results.Json(results);
});

app.MapGet("/api/patients/{id}", async (FhirDbContext db, string id) =>
{
  var bundleJson = await db.Patients
      .Where(p => p.Id == id)
      .Select(p => p.BundleJson)
      .FirstOrDefaultAsync();

  return bundleJson is null
      ? Results.Json(new { error = "Patient not found" }, statusCode: 404)
      : Results.Json(J(bundleJson));
});

// â”€â”€ Routes: NPPES proxy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.MapGet("/api/nppes", async (HttpRequest req) =>
{
  try
  {
    var qs = string.Join("&", req.Query.Select(kv =>
        $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value.ToString())}"));
    using var http = new HttpClient();
    return Results.Text(await http.GetStringAsync(
        $"https://npiregistry.cms.hhs.gov/api/?{qs}"), "application/json");
  }
  catch (Exception ex)
  {
    return Results.Json(new { error = "NPPES proxy error", detail = ex.Message }, statusCode: 502);
  }
});

// â”€â”€ Routes: /fhir/Patient â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.MapGet("/fhir/Patient", async (
    FhirDbContext db, HttpRequest req,
    string? family, string? given, string? name, string? gender,
    string? birthdate, string? _id, string? address, string? phone,
    int _count = 20, int _offset = 0) =>
{
  var q = db.Patients.AsNoTracking().AsQueryable();

  if (_id is not null) q = q.Where(p => p.Id == _id);
  if (family is not null) q = q.Where(p => p.Family.Contains(family));
  if (given is not null) q = q.Where(p => p.Given.Contains(given));
  if (name is not null) q = q.Where(p => p.Name.Contains(name) || p.Family.Contains(name) || p.Given.Contains(name));
  if (gender is not null) q = q.Where(p => p.Gender == gender);
  if (birthdate is not null) q = q.Where(p => p.BirthDate == birthdate);
  if (address is not null) q = q.Where(p => p.Address.Contains(address));
  if (phone is not null) q = q.Where(p => p.Phone.Contains(phone));

  var cap = Math.Min(_count, 500);
  var total = await q.CountAsync();
  var records = await q.Skip(_offset).Take(cap).Select(p => p.ResourceJson).ToListAsync();
  var selfUrl = $"{BaseUrl}/fhir/Patient?{req.QueryString.ToString().TrimStart('?')}";
  var extra = new List<object>();
  if (_offset + cap < total)
    extra.Add(new { relation = "next", url = $"{BaseUrl}/fhir/Patient?_count={cap}&_offset={_offset + cap}" });

  return SearchSetBundle("Patient", records.Select(J), total, selfUrl, extra);
});

app.MapGet("/fhir/Patient/{id}", async (FhirDbContext db, string id) =>
{
  var json = await db.Patients
      .Where(p => p.Id == id)
      .Select(p => p.ResourceJson)
      .FirstOrDefaultAsync();

  return json is null
      ? Results.Json(new { error = "Patient not found" }, statusCode: 404)
      : Results.Json(J(json), contentType: FhirContentType);
});

// â”€â”€ Routes: /fhir/Encounter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.MapGet("/fhir/Encounter/_types", async (FhirDbContext db) =>
{
  var types = await db.Encounters
      .Where(e => e.TypeText != null)
      .Select(e => e.TypeText!)
      .Distinct()
      .OrderBy(t => t)
      .ToListAsync();
  return Results.Json(types);
});

app.MapGet("/fhir/Encounter/_classes", async (FhirDbContext db) =>
{
  var classes = await db.Encounters
      .Where(e => e.ClassCode != null)
      .Select(e => e.ClassCode!)
      .Distinct()
      .OrderBy(c => c)
      .ToListAsync();
  return Results.Json(classes);
});

app.MapGet("/fhir/Encounter", async (
    FhirDbContext db, HttpRequest req,
    string? patient, string? status, string? date, string? type, string? reason, string? _id,
    int _count = 20, int _offset = 0) =>
{
  var classCode = req.Query["class"].ToString() is { Length: > 0 } c ? c : null;

  var q = db.Encounters.AsNoTracking().AsQueryable();

  if (patient is not null)
  {
    var patId = patient.Replace("Patient/", "").Replace("urn:uuid:", "");
    q = q.Where(e => e.PatientId == patId);
  }
  if (_id is not null) q = q.Where(e => e.Id == _id);
  if (status is not null) q = q.Where(e => e.Status == status);
  if (classCode is not null) q = q.Where(e => e.ClassCode == classCode);
  if (type is not null) q = q.Where(e => e.TypeText != null && e.TypeText.Contains(type));
  if (reason is not null) q = q.Where(e => e.ReasonText != null && e.ReasonText.Contains(reason));

  if (date is not null)
  {
    var m = System.Text.RegularExpressions.Regex.Match(date, @"^(eq|ge|le|gt|lt)?(\d{4}-\d{2}-\d{2})");
    if (m.Success)
    {
      var prefix = m.Groups[1].Value is { Length: > 0 } p ? p : "eq";
      var target = m.Groups[2].Value;
      q = prefix switch
      {
        "ge" => q.Where(e => e.PeriodStart != null && string.Compare(e.PeriodStart, target) >= 0),
        "le" => q.Where(e => e.PeriodStart != null && string.Compare(e.PeriodStart, target) <= 0),
        "gt" => q.Where(e => e.PeriodStart != null && string.Compare(e.PeriodStart, target) > 0),
        "lt" => q.Where(e => e.PeriodStart != null && string.Compare(e.PeriodStart, target) < 0),
        _ => q.Where(e => e.PeriodStart == target),
      };
    }
  }

  var cap = Math.Min(_count, 500);
  var total = await q.CountAsync();
  var records = await q.Skip(_offset).Take(cap).Select(e => e.ResourceJson).ToListAsync();
  var selfUrl = $"{BaseUrl}/fhir/Encounter?{req.QueryString.ToString().TrimStart('?')}";
  var extra = new List<object>();
  if (_offset + cap < total)
    extra.Add(new { relation = "next", url = $"{BaseUrl}/fhir/Encounter?_count={cap}&_offset={_offset + cap}" });

  return SearchSetBundle("Encounter", records.Select(J), total, selfUrl, extra);
});

app.MapGet("/fhir/Encounter/{id}", async (FhirDbContext db, string id) =>
{
  var json = await db.Encounters.Where(e => e.Id == id).Select(e => e.ResourceJson).FirstOrDefaultAsync();
  return json is null
      ? Results.Json(new { error = "Encounter not found" }, statusCode: 404)
      : Results.Json(J(json), contentType: FhirContentType);
});

// â”€â”€ Routes: /fhir/DocumentReference â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Uses DocRefEncounterLinks junction table for the ?encounter= filter.

app.MapGet("/fhir/DocumentReference", async (
    FhirDbContext db, HttpRequest req,
    string? encounter, string? patient, string? _id,
    int _count = 50, int _offset = 0) =>
{
  var cap = Math.Min(_count, 500);
  var self = $"{BaseUrl}/fhir/DocumentReference?{req.QueryString.ToString().TrimStart('?')}";

  var q = db.Resources.Where(r => r.ResourceType == "DocumentReference").AsNoTracking();

  if (encounter is not null)
  {
    var encId = encounter.Replace("Encounter/", "").Replace("urn:uuid:", "");
    var ids = await db.DocRefEncounterLinks
        .Where(l => l.EncounterId == encId).Select(l => l.DocRefId).ToListAsync();
    q = q.Where(r => ids.Contains(r.Id));
  }
  else if (patient is not null)
  {
    var patId = patient.Replace("Patient/", "").Replace("urn:uuid:", "");
    q = q.Where(r => r.PatientId == patId);
  }
  else if (_id is not null)
  {
    q = q.Where(r => r.Id == _id);
  }

  var total = await q.CountAsync();
  var records = await q.Skip(_offset).Take(cap).Select(r => r.ResourceJson).ToListAsync();
  return SearchSetBundle("DocumentReference", records.Select(J), total, self);
});

app.MapGet("/fhir/DocumentReference/{id}", async (FhirDbContext db, string id) =>
{
  var json = await db.Resources
      .Where(r => r.ResourceType == "DocumentReference" && r.Id == id)
      .Select(r => r.ResourceJson).FirstOrDefaultAsync();
  return json is null
      ? Results.Json(new { error = "DocumentReference not found" }, statusCode: 404)
      : Results.Json(J(json), contentType: FhirContentType);
});

// â”€â”€ Routes: simple single-encounter resource types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Condition, DiagnosticReport, Immunization, Procedure, MedicationRequest

foreach (var (path, rt, defaultCount, maxCount) in new[]
{
    ("/fhir/Condition",         "Condition",         50,  500),
    ("/fhir/DiagnosticReport",  "DiagnosticReport",  50,  500),
    ("/fhir/Immunization",      "Immunization",      50,  500),
    ("/fhir/Procedure",         "Procedure",         50,  500),
    ("/fhir/MedicationRequest", "MedicationRequest", 50,  500),
})
{
  var rtCapture = rt;
  var defaultCapture = defaultCount;
  var maxCapture = maxCount;

  app.MapGet(path, async (
      FhirDbContext db, HttpRequest req,
      string? encounter, string? patient, string? _id,
      int _count = 50, int _offset = 0) =>
  {
    var cap = Math.Min(_count == defaultCapture ? defaultCapture : _count, maxCapture);
    var self = $"{BaseUrl}{path}?{req.QueryString.ToString().TrimStart('?')}";
    return await SimpleResourceSearch(db, rtCapture, encounter, patient, _id, cap, _offset, self);
  });

  app.MapGet($"{path}/{{id}}", async (FhirDbContext db, string id) =>
  {
    var json = await db.Resources
          .Where(r => r.ResourceType == rtCapture && r.Id == id)
          .Select(r => r.ResourceJson).FirstOrDefaultAsync();
    return json is null
          ? Results.Json(new { error = $"{rtCapture} not found" }, statusCode: 404)
          : Results.Json(J(json), contentType: FhirContentType);
  });
}

// â”€â”€ Routes: /fhir/Observation (extra ?code= filter) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.MapGet("/fhir/Observation", async (
    FhirDbContext db, HttpRequest req,
    string? encounter, string? patient, string? _id, string? code,
    int _count = 500, int _offset = 0) =>
{
  var cap = Math.Min(_count, 2000);
  var q = db.Resources.Where(r => r.ResourceType == "Observation").AsNoTracking();

  if (encounter is not null)
  {
    var encId = encounter.Replace("Encounter/", "").Replace("urn:uuid:", "");
    q = q.Where(r => r.EncounterId == encId);
  }
  else if (patient is not null)
  {
    var patId = patient.Replace("Patient/", "").Replace("urn:uuid:", "");
    q = q.Where(r => r.PatientId == patId);
    if (code is not null)
      q = q.Where(r => r.Code != null && r.Code.Contains(code));
  }
  else if (_id is not null)
  {
    q = q.Where(r => r.Id == _id);
  }

  var total = await q.CountAsync();
  var records = await q.Skip(_offset).Take(cap).Select(r => r.ResourceJson).ToListAsync();
  var selfUrl = $"{BaseUrl}/fhir/Observation?{req.QueryString.ToString().TrimStart('?')}";
  return SearchSetBundle("Observation", records.Select(J), total, selfUrl);
});

app.MapGet("/fhir/Observation/{id}", async (FhirDbContext db, string id) =>
{
  var json = await db.Resources
      .Where(r => r.ResourceType == "Observation" && r.Id == id)
      .Select(r => r.ResourceJson).FirstOrDefaultAsync();
  return json is null
      ? Results.Json(new { error = "Observation not found" }, statusCode: 404)
      : Results.Json(J(json), contentType: FhirContentType);
});

// â”€â”€ Routes: /fhir/Claim â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.MapGet("/fhir/Claim", async (
    FhirDbContext db, HttpRequest req,
    string? encounter, string? patient, string? _id,
    int _count = 50, int _offset = 0) =>
{
  var cap = Math.Min(_count, 500);
  var self = $"{BaseUrl}/fhir/Claim?{req.QueryString.ToString().TrimStart('?')}";
  var q = db.Resources.Where(r => r.ResourceType == "Claim").AsNoTracking();

  if (encounter is not null)
  {
    var encId = encounter.Replace("Encounter/", "").Replace("urn:uuid:", "");
    var ids = await db.ClaimEncounterLinks
        .Where(l => l.EncounterId == encId).Select(l => l.ClaimId).ToListAsync();
    q = q.Where(r => ids.Contains(r.Id));
  }
  else if (patient is not null)
  {
    var patId = patient.Replace("Patient/", "").Replace("urn:uuid:", "");
    q = q.Where(r => r.PatientId == patId);
  }
  else if (_id is not null) { q = q.Where(r => r.Id == _id); }

  var total = await q.CountAsync();
  var records = await q.Skip(_offset).Take(cap).Select(r => r.ResourceJson).ToListAsync();
  return SearchSetBundle("Claim", records.Select(J), total, self);
});

app.MapGet("/fhir/Claim/{id}", async (FhirDbContext db, string id) =>
{
  var json = await db.Resources
      .Where(r => r.ResourceType == "Claim" && r.Id == id)
      .Select(r => r.ResourceJson).FirstOrDefaultAsync();
  return json is null
      ? Results.Json(new { error = "Claim not found" }, statusCode: 404)
      : Results.Json(J(json), contentType: FhirContentType);
});

// â”€â”€ Routes: /fhir/ExplanationOfBenefit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.MapGet("/fhir/ExplanationOfBenefit", async (
    FhirDbContext db, HttpRequest req,
    string? encounter, string? patient, string? _id,
    int _count = 50, int _offset = 0) =>
{
  var cap = Math.Min(_count, 500);
  var self = $"{BaseUrl}/fhir/ExplanationOfBenefit?{req.QueryString.ToString().TrimStart('?')}";
  var q = db.Resources.Where(r => r.ResourceType == "ExplanationOfBenefit").AsNoTracking();

  if (encounter is not null)
  {
    var encId = encounter.Replace("Encounter/", "").Replace("urn:uuid:", "");
    var ids = await db.EobEncounterLinks
        .Where(l => l.EncounterId == encId).Select(l => l.EobId).ToListAsync();
    q = q.Where(r => ids.Contains(r.Id));
  }
  else if (patient is not null)
  {
    var patId = patient.Replace("Patient/", "").Replace("urn:uuid:", "");
    q = q.Where(r => r.PatientId == patId);
  }
  else if (_id is not null) { q = q.Where(r => r.Id == _id); }

  var total = await q.CountAsync();
  var records = await q.Skip(_offset).Take(cap).Select(r => r.ResourceJson).ToListAsync();
  return SearchSetBundle("ExplanationOfBenefit", records.Select(J), total, self);
});

app.MapGet("/fhir/ExplanationOfBenefit/{id}", async (FhirDbContext db, string id) =>
{
  var json = await db.Resources
      .Where(r => r.ResourceType == "ExplanationOfBenefit" && r.Id == id)
      .Select(r => r.ResourceJson).FirstOrDefaultAsync();
  return json is null
      ? Results.Json(new { error = "ExplanationOfBenefit not found" }, statusCode: 404)
      : Results.Json(J(json), contentType: FhirContentType);
});
// ── Routes: CCD Export (ONC §170.315(b)(6) Data Export) ───────────────────────

app.MapGet("/api/patients/{id}/ccd", async (FhirDbContext db, string id) =>
{
  var patient = await db.Patients
      .Where(p => p.Id == id)
      .Select(p => new { p.ResourceJson })
      .FirstOrDefaultAsync();

  if (patient is null)
    return Results.Json(new { error = "Patient not found" }, statusCode: 404);

  var conditions = await db.Resources
      .Where(r => r.ResourceType == "Condition" && r.PatientId == id)
      .Select(r => r.ResourceJson).ToListAsync();

  var medications = await db.Resources
      .Where(r => r.ResourceType == "MedicationRequest" && r.PatientId == id)
      .Select(r => r.ResourceJson).ToListAsync();

  var observations = await db.Resources
      .Where(r => r.ResourceType == "Observation" && r.PatientId == id)
      .Select(r => r.ResourceJson).ToListAsync();

  var procedures = await db.Resources
      .Where(r => r.ResourceType == "Procedure" && r.PatientId == id)
      .Select(r => r.ResourceJson).ToListAsync();

      Path.Join(AppContext.BaseDirectory, "..", "..", "..", "..", "public", "CDA.xsl"));
      .Where(r => r.ResourceType == "Immunization" && r.PatientId == id)
      .Select(r => r.ResourceJson).ToListAsync();

  var encounters = await db.Encounters
      .Where(e => e.PatientId == id)
      .Select(e => e.ResourceJson).ToListAsync();

  var xml = CcdGenerator.Generate(
      patient.ResourceJson,
      conditions, medications, observations,
      procedures, immunizations, encounters);

  return Results.Content(xml, "application/xml");
});

// Serve CDA.xsl stylesheet so browsers can render CCD exports
app.MapGet("/api/patients/{id}/CDA.xsl", () =>
{
  var xslPath = Path.GetFullPath(
      Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "public", "CDA.xsl"));
  if (!File.Exists(xslPath))
    return Results.NotFound();
  return Results.File(xslPath, "text/xsl");
});

// ── Anthropic Chat Proxy ──────────────────────────────────────────────────────
// app.MapPost("/api/anthropic-chat", async (HttpRequest req) =>
// {
//   var apiKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
//   if (string.IsNullOrWhiteSpace(apiKey))
//     return Results.Json(new { error = "Anthropic API key not configured" }, statusCode: 500);

//   using var reader = new StreamReader(req.Body);
//   var body = await reader.ReadToEndAsync();
//   if (string.IsNullOrWhiteSpace(body))
//     return Results.Json(new { error = "Empty request body" }, statusCode: 400);

//   using var http = new HttpClient();
//   var anthropicReq = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages")
//   {
//     Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json")
//   };
//   anthropicReq.Headers.Add("x-api-key", apiKey);
//   anthropicReq.Headers.Add("anthropic-version", "2023-06-01");

//   try
//   {
//     var resp = await http.SendAsync(anthropicReq);
//     var respContent = await resp.Content.ReadAsStringAsync();
//     return Results.Content(respContent, "application/json");
//   }
//   catch (Exception ex)
//   {
//     return Results.Json(new { error = "Anthropic proxy error", detail = ex.Message }, statusCode: 502);
//   }
// });
app.MapPost("/api/anthropic-chat", async (HttpRequest req, IHttpClientFactory httpClientFactory) =>
{
  var apiKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY")
               ?? app.Configuration["Anthropic:ApiKey"];
  if (string.IsNullOrWhiteSpace(apiKey))
    return Results.Json(new { error = "Anthropic API key not configured" }, statusCode: 500);

  using var reader = new StreamReader(req.Body);
  var body = await reader.ReadToEndAsync();
  if (string.IsNullOrWhiteSpace(body))
    return Results.Json(new { error = "Empty request body" }, statusCode: 400);

  // Use factory instead of new HttpClient()
  var http = httpClientFactory.CreateClient();

  var anthropicReq = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages")
  {
    Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json")
  };
  anthropicReq.Headers.Add("x-api-key", apiKey);
  anthropicReq.Headers.Add("anthropic-version", "2023-06-01");

  try
  {
    var resp = await http.SendAsync(anthropicReq);
    var respContent = await resp.Content.ReadAsStringAsync();

    // Forward Anthropic's actual status code so React can detect errors
    return Results.Content(respContent, "application/json", statusCode: (int)resp.StatusCode);
  }
  catch (Exception ex)
  {
    return Results.Json(new { error = "Anthropic proxy error", detail = ex.Message }, statusCode: 502);
  }
});

// ── Routes: Audit Log (ONC §170.315(d)(2) & (d)(3)) ──────────────────────────

// Query audit events with filtering and pagination
app.MapGet("/api/audit", async (
    FhirDbContext db, HttpRequest req,
    string? userId, string? patientId, string? action,
    string? resourceType, string? startDate, string? endDate,
    string? outcome,
    int _count = 50, int _offset = 0) =>
{
  var q = db.AuditEvents.AsNoTracking().AsQueryable();

  if (userId is not null) q = q.Where(a => a.UserId == userId);
  if (patientId is not null) q = q.Where(a => a.PatientId == patientId);
  if (action is not null) q = q.Where(a => a.Action == action);
  if (resourceType is not null) q = q.Where(a => a.ResourceType == resourceType);
  if (outcome is not null) q = q.Where(a => a.Outcome == outcome);
  if (startDate is not null) q = q.Where(a => string.Compare(a.Timestamp, startDate) >= 0);
  if (endDate is not null) q = q.Where(a => string.Compare(a.Timestamp, endDate) <= 0);

  var total = await q.CountAsync();
  var cap = Math.Min(_count, 500);
  var events = await q
      .OrderByDescending(a => a.Id)
      .Skip(_offset)
      .Take(cap)
      .ToListAsync();

  // Log the audit query itself
  var (auditUserId, auditUserName, auditUserRole) = AuditService.ExtractUser(req);
  var auditEvt = new AuditEvent
  {
    Timestamp = DateTime.UtcNow.ToString("o"),
    Action = "audit_query",
    ResourceType = "AuditEvent",
    UserId = auditUserId,
    UserName = auditUserName,
    UserRole = auditUserRole,
    HttpMethod = "GET",
    RequestPath = "/api/audit",
    QueryString = req.QueryString.ToString().TrimStart('?'),
    StatusCode = 200,
    ClientIp = req.HttpContext.Connection.RemoteIpAddress?.ToString(),
    Outcome = "success",
  };
  _ = Task.Run(async () =>
  {
    using var scope = app.Services.CreateScope();
    var auditDb = scope.ServiceProvider.GetRequiredService<FhirDbContext>();
    try { await AuditService.LogAsync(auditDb, auditEvt); }
    catch { /* best-effort */ }
  });

  return Results.Json(new
  {
    total,
    offset = _offset,
    count = events.Count,
    events,
  });
});

// Log frontend-initiated events (login, logout, navigation)
app.MapPost("/api/audit", async (HttpRequest req, FhirDbContext db) =>
{
  using var reader = new StreamReader(req.Body);
  var body = await reader.ReadToEndAsync();
  if (string.IsNullOrWhiteSpace(body))
    return Results.Json(new { error = "Empty request body" }, statusCode: 400);

  var payload = JsonSerializer.Deserialize<JsonElement>(body);
  var (userId, userName, userRole) = AuditService.ExtractUser(req);

  var evt = new AuditEvent
  {
    Timestamp = DateTime.UtcNow.ToString("o"),
    Action = payload.TryGetProperty("action", out var a) ? a.GetString() ?? "unknown" : "unknown",
    ResourceType = payload.TryGetProperty("resourceType", out var rt) ? rt.GetString() ?? "" : "Session",
    ResourceId = payload.TryGetProperty("resourceId", out var ri) ? ri.GetString() : null,
    PatientId = payload.TryGetProperty("patientId", out var pid) ? pid.GetString() : null,
    UserId = userId,
    UserName = userName,
    UserRole = userRole,
    HttpMethod = "POST",
    RequestPath = payload.TryGetProperty("requestPath", out var rp) ? rp.GetString() ?? "" : "",
    Detail = payload.TryGetProperty("detail", out var d) ? d.GetString() : null,
    StatusCode = 200,
    ClientIp = req.HttpContext.Connection.RemoteIpAddress?.ToString(),
    Outcome = "success",
  };

  await AuditService.LogAsync(db, evt);
  return Results.Json(new { status = "recorded", id = evt.Id });
});

// Verify audit log integrity (tamper detection)
app.MapGet("/api/audit/verify", async (FhirDbContext db) =>
{
  var (isValid, brokenAtId) = await AuditService.VerifyChainAsync(db);
  return Results.Json(new
  {
    integrityValid = isValid,
    chainLength = await db.AuditEvents.CountAsync(),
    brokenAtId,
    verifiedAt = DateTime.UtcNow.ToString("o"),
  });
});

// Summary statistics for audit dashboard
app.MapGet("/api/audit/stats", async (FhirDbContext db) =>
{
  var total = await db.AuditEvents.CountAsync();
  var byAction = await db.AuditEvents
      .GroupBy(a => a.Action)
      .Select(g => new { action = g.Key, count = g.Count() })
      .ToListAsync();
  var byResourceType = await db.AuditEvents
      .GroupBy(a => a.ResourceType)
      .Select(g => new { resourceType = g.Key, count = g.Count() })
      .ToListAsync();
  var byUser = await db.AuditEvents
      .GroupBy(a => a.UserId)
      .Select(g => new { userId = g.Key, count = g.Count() })
      .ToListAsync();
  var failures = await db.AuditEvents.CountAsync(a => a.Outcome == "failure");

  return Results.Json(new { total, failures, byAction, byResourceType, byUser });
});

// ── Run ──────────────────────────────────────────────────────────────────────
Console.WriteLine("🏥 FhirPlace .NET API running on http://localhost:5001");
app.Run();
