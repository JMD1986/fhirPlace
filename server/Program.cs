using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using FhirPlace.Server;

// ── Builder ───────────────────────────────────────────────────────────────────
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<FhirDataStore>();

// Serialise PatientSummary (PascalCase props) as camelCase to match the
// existing Express API contract.  Anonymous-type props are already camelCase,
// so this policy leaves them unchanged.
builder.Services.ConfigureHttpJsonOptions(opts =>
{
  opts.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
  opts.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
  opts.SerializerOptions.PropertyNameCaseInsensitive = true;
});

builder.Services.AddCors(opts =>
    opts.AddDefaultPolicy(p =>
        p.WithOrigins("http://localhost:5173", "http://localhost:3000")
         .AllowCredentials()
         .AllowAnyHeader()
         .AllowAnyMethod()));

// HTTP only on port 5001 — matches the existing server.js URL used by the Vite
// dev server and the .env.perf performance audit.
builder.WebHost.UseUrls("http://localhost:5001");

// ── App pipeline ──────────────────────────────────────────────────────────────
var app = builder.Build();

app.UseCors();

// Helmet-equivalent security headers
app.Use(async (ctx, next) =>
{
  var h = ctx.Response.Headers;
  h["X-Content-Type-Options"] = "nosniff";
  h["X-Frame-Options"] = "DENY";
  h["Referrer-Policy"] = "strict-origin-when-cross-origin";
  h["Content-Security-Policy"] =
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "connect-src 'self' https:; " +
      "font-src 'self' data:; " +
      "object-src 'none'; " +
      "frame-ancestors 'none'";
  await next();
});

// ── Startup: load FHIR data ───────────────────────────────────────────────────
var store = app.Services.GetRequiredService<FhirDataStore>();
var fhirDir = Path.GetFullPath(
    Path.Combine(builder.Environment.ContentRootPath, "..", "public", "synthea", "fhir"));
await store.LoadPatientsAsync(fhirDir);

// ── Constants ─────────────────────────────────────────────────────────────────
const string FhirContentType = "application/fhir+json";
const string BaseUrl = "http://localhost:5001";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
/// Generic handler for resources that support encounter / patient / _id filtering
/// plus standard _count / _offset pagination.
/// </summary>
static IResult ResourceSearch(
    FhirDataStore store,
    Dictionary<string, ResourceEntry> resourceMap,
    Dictionary<string, List<string>> byEncounter,
    string resourceType,
    string? encounter,
    string? patient,
    string? _id,
    int count,
    int offset,
    string selfUrl)
{
  if (store.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);

  IEnumerable<JsonObject> results;

  if (encounter is not null)
  {
    var encId = encounter.Replace("Encounter/", "").Replace("urn:uuid:", "");
    var ids = byEncounter.TryGetValue(encId, out var list) ? list : [];
    results = ids.Select(i => resourceMap.TryGetValue(i, out var e) ? e.Resource : null)
                   .Where(r => r is not null).Select(r => r!);
  }
  else if (patient is not null)
  {
    var patId = patient.Replace("Patient/", "").Replace("urn:uuid:", "");
    results = resourceMap.Values.Where(e => e.PatientId == patId).Select(e => e.Resource);
  }
  else if (_id is not null)
  {
    results = resourceMap.TryGetValue(_id, out var e) ? [e.Resource] : [];
  }
  else
  {
    results = resourceMap.Values.Select(e => e.Resource);
  }

  var all = results.ToList();
  var total = all.Count;
  var page = all.Skip(offset).Take(count);
  return SearchSetBundle(resourceType, page, total, selfUrl);
}

// ── Routes: simple utility ────────────────────────────────────────────────────

app.MapGet("/", () => Results.Json(new { status = "ok", service = "FhirPlace API" }));

app.MapGet("/api/health", () => Results.Json(new { status = "ok" }));

// ── Routes: /api/patients ─────────────────────────────────────────────────────

app.MapGet("/api/patients-count", (FhirDataStore s) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  return Results.Json(new { count = s.PatientListCache.Count });
});

app.MapGet("/api/patients", (
    FhirDataStore s,
    string? name, string? family, string? given,
    string? gender, string? birthDate, string? phone, string? address) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);

  IEnumerable<PatientSummary> results = s.PatientListCache;

  if (name is not null) results = results.Where(p => p.Name.Contains(name, StringComparison.OrdinalIgnoreCase));
  if (family is not null) results = results.Where(p => p.Family.Contains(family, StringComparison.OrdinalIgnoreCase));
  if (given is not null) results = results.Where(p => p.Given.Contains(given, StringComparison.OrdinalIgnoreCase));
  if (gender is not null) results = results.Where(p => p.Gender.Contains(gender, StringComparison.OrdinalIgnoreCase));
  if (birthDate is not null) results = results.Where(p => p.BirthDate == birthDate);
  if (phone is not null) results = results.Where(p => p.Phone.Contains(phone, StringComparison.OrdinalIgnoreCase));
  if (address is not null) results = results.Where(p => p.Address.Contains(address, StringComparison.OrdinalIgnoreCase));

  return Results.Json(results.ToList());
});

app.MapGet("/api/patients/{id}", (FhirDataStore s, string id) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  if (!s.PatientBundleMap.TryGetValue(id, out var bundle))
    return Results.Json(new { error = "Patient not found" }, statusCode: 404);
  return Results.Json(bundle);
});

// ── Routes: NPPES proxy ───────────────────────────────────────────────────────

app.MapGet("/api/nppes", async (HttpRequest req) =>
{
  try
  {
    var qs = string.Join("&", req.Query.Select(kv =>
        $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value.ToString())}"));
    var url = $"https://npiregistry.cms.hhs.gov/api/?{qs}";

    using var http = new HttpClient();
    var responseStr = await http.GetStringAsync(url);
    return Results.Text(responseStr, "application/json");
  }
  catch (Exception ex)
  {
    return Results.Json(new { error = "NPPES proxy error", detail = ex.Message }, statusCode: 502);
  }
});

// ── Routes: /fhir/Patient ─────────────────────────────────────────────────────

app.MapGet("/fhir/Patient", (
    FhirDataStore s, HttpRequest req,
    string? family, string? given, string? name, string? gender,
    string? birthdate, string? _id, string? address, string? phone,
    int _count = 20, int _offset = 0) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);

  IEnumerable<JsonObject> results = s.PatientResourceMap.Values;

  if (_id is not null) results = results.Where(p => p["id"]?.GetValue<string>() == _id);
  if (family is not null)
  {
    var q = family;
    results = results.Where(p =>
        p["name"]?.AsArray().FirstOrDefault()?["family"]?.GetValue<string>()
         ?.Contains(q, StringComparison.OrdinalIgnoreCase) == true);
  }
  if (given is not null)
  {
    var q = given;
    results = results.Where(p =>
        string.Join(" ", p["name"]?.AsArray().FirstOrDefault()?["given"]?.AsArray()
            .Select(g => g?.GetValue<string>()) ?? [])
        .Contains(q, StringComparison.OrdinalIgnoreCase));
  }
  if (name is not null)
  {
    var q = name;
    results = results.Where(p =>
    {
      var n = p["name"]?.AsArray().FirstOrDefault();
      return n?["text"]?.GetValue<string>()?.Contains(q, StringComparison.OrdinalIgnoreCase) == true ||
                 n?["family"]?.GetValue<string>()?.Contains(q, StringComparison.OrdinalIgnoreCase) == true ||
                 string.Join(" ", n?["given"]?.AsArray().Select(g => g?.GetValue<string>()) ?? [])
                     .Contains(q, StringComparison.OrdinalIgnoreCase);
    });
  }
  if (gender is not null)
  {
    var q = gender;
    results = results.Where(p =>
        string.Equals(p["gender"]?.GetValue<string>(), q, StringComparison.OrdinalIgnoreCase));
  }
  if (birthdate is not null)
  {
    var q = birthdate;
    results = results.Where(p => p["birthDate"]?.GetValue<string>() == q);
  }
  if (address is not null)
  {
    var q = address;
    results = results.Where(p =>
        p["address"]?.AsArray().Any(a =>
            string.Join(" ", new[]
            {
                    string.Join(" ", a?["line"]?.AsArray().Select(l => l?.GetValue<string>()) ?? []),
                    a?["city"]?.GetValue<string>(),
                    a?["state"]?.GetValue<string>(),
                    a?["postalCode"]?.GetValue<string>(),
                    a?["country"]?.GetValue<string>(),
            }.Where(v => !string.IsNullOrEmpty(v)))
            .Contains(q, StringComparison.OrdinalIgnoreCase)) == true);
  }
  if (phone is not null)
  {
    var q = phone;
    results = results.Where(p =>
        p["telecom"]?.AsArray().Any(t =>
            t?["system"]?.GetValue<string>() == "phone" &&
            t["value"]?.GetValue<string>()?.Contains(q, StringComparison.OrdinalIgnoreCase) == true) == true);
  }

  var all = results.ToList();
  var total = all.Count;
  var page = all.Skip(_offset).Take(_count);
  var selfUrl = $"{BaseUrl}/fhir/Patient?{req.QueryString.ToString().TrimStart('?')}";
  var extra = new List<object>();
  if (_offset + _count < total)
    extra.Add(new { relation = "next", url = $"{BaseUrl}/fhir/Patient?_count={_count}&_offset={_offset + _count}" });

  return SearchSetBundle("Patient", page, total, selfUrl, extra);
});

app.MapGet("/fhir/Patient/{id}", (FhirDataStore s, string id) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  if (!s.PatientResourceMap.TryGetValue(id, out var resource))
    return Results.Json(new { error = "Patient not found" }, statusCode: 404);
  return Results.Json(resource, contentType: FhirContentType);
});

// ── Routes: /fhir/Encounter ───────────────────────────────────────────────────

app.MapGet("/fhir/Encounter/_types", (FhirDataStore s) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);

  var types = new SortedSet<string>();
  foreach (var enc in s.EncounterResourceMap.Values.Select(e => e.Resource))
  {
    var text = enc["type"]?.AsArray().FirstOrDefault()?["text"]?.GetValue<string>()
        ?? enc["type"]?.AsArray().FirstOrDefault()?["coding"]?.AsArray()
            .FirstOrDefault()?["display"]?.GetValue<string>();
    if (!string.IsNullOrEmpty(text)) types.Add(text);
  }
  return Results.Json(types.ToList());
});

app.MapGet("/fhir/Encounter/_classes", (FhirDataStore s) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);

  var classes = new SortedSet<string>();
  foreach (var enc in s.EncounterResourceMap.Values.Select(e => e.Resource))
  {
    var code = enc["class"]?["code"]?.GetValue<string>();
    if (!string.IsNullOrEmpty(code)) classes.Add(code);
  }
  return Results.Json(classes.ToList());
});

app.MapGet("/fhir/Encounter", (
    FhirDataStore s, HttpRequest req,
    string? patient, string? status, string? date, string? type, string? reason, string? _id,
    int _count = 20, int _offset = 0) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);

  var classCode = req.Query["class"].ToString() is { Length: > 0 } c ? c : null;

  IEnumerable<JsonObject> results;
  if (patient is not null)
  {
    var patId = patient.Replace("Patient/", "").Replace("urn:uuid:", "");
    var ids = s.EncountersByPatient.TryGetValue(patId, out var l) ? l : [];
    results = ids.Select(i => s.EncounterResourceMap.TryGetValue(i, out var e) ? e.Resource : null)
                   .Where(r => r is not null).Select(r => r!);
  }
  else
  {
    results = s.EncounterResourceMap.Values.Select(e => e.Resource);
  }

  if (_id is not null)
  {
    var q = _id;
    results = results.Where(e => e["id"]?.GetValue<string>() == q);
  }
  if (status is not null)
  {
    var q = status;
    results = results.Where(e =>
        string.Equals(e["status"]?.GetValue<string>(), q, StringComparison.OrdinalIgnoreCase));
  }
  if (classCode is not null)
  {
    var q = classCode;
    results = results.Where(e =>
        string.Equals(e["class"]?["code"]?.GetValue<string>(), q, StringComparison.OrdinalIgnoreCase));
  }
  if (type is not null)
  {
    var q = type;
    results = results.Where(e =>
        e["type"]?.AsArray().Any(t =>
            t?["text"]?.GetValue<string>()?.Contains(q, StringComparison.OrdinalIgnoreCase) == true ||
            t?["coding"]?.AsArray().Any(c =>
                c?["display"]?.GetValue<string>()?.Contains(q, StringComparison.OrdinalIgnoreCase) == true) == true) == true);
  }
  if (reason is not null)
  {
    var q = reason;
    results = results.Where(e =>
        e["reason"]?.AsArray().Any(r =>
            r?["text"]?.GetValue<string>()?.Contains(q, StringComparison.OrdinalIgnoreCase) == true ||
            r?["coding"]?.AsArray().Any(c =>
                c?["code"]?.GetValue<string>() == q ||
                c?["display"]?.GetValue<string>()?.Contains(q, StringComparison.OrdinalIgnoreCase) == true) == true) == true);
  }
  if (date is not null)
  {
    var m = System.Text.RegularExpressions.Regex.Match(date, @"^(eq|ge|le|gt|lt)?(\d{4}-\d{2}-\d{2})");
    if (m.Success)
    {
      var prefix = m.Groups[1].Value is { Length: > 0 } p ? p : "eq";
      var target = m.Groups[2].Value;
      results = results.Where(e =>
      {
        var start = e["period"]?["start"]?.GetValue<string>();
        if (start is null || start.Length < 10) return false;
        var startDate = start[..10];
        return prefix switch
        {
          "eq" => startDate == target,
          "ge" => string.Compare(startDate, target, StringComparison.Ordinal) >= 0,
          "le" => string.Compare(startDate, target, StringComparison.Ordinal) <= 0,
          "gt" => string.Compare(startDate, target, StringComparison.Ordinal) > 0,
          "lt" => string.Compare(startDate, target, StringComparison.Ordinal) < 0,
          _ => false,
        };
      });
    }
  }

  var all = results.ToList();
  var total = all.Count;
  var page = all.Skip(_offset).Take(_count);
  var selfUrl = $"{BaseUrl}/fhir/Encounter?{req.QueryString.ToString().TrimStart('?')}";
  var extra = new List<object>();
  if (_offset + _count < total)
    extra.Add(new { relation = "next", url = $"{BaseUrl}/fhir/Encounter?_count={_count}&_offset={_offset + _count}" });

  return SearchSetBundle("Encounter", page, total, selfUrl, extra);
});

app.MapGet("/fhir/Encounter/{id}", (FhirDataStore s, string id) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  if (!s.EncounterResourceMap.TryGetValue(id, out var entry))
    return Results.Json(new { error = "Encounter not found" }, statusCode: 404);
  return Results.Json(entry.Resource, contentType: FhirContentType);
});

// ── Routes: /fhir/DocumentReference ──────────────────────────────────────────

app.MapGet("/fhir/DocumentReference", (
    FhirDataStore s, HttpRequest req,
    string? encounter, string? patient, string? _id,
    int _count = 50, int _offset = 0) =>
{
  var cap = Math.Min(_count, 500);
  var self = $"{BaseUrl}/fhir/DocumentReference?{req.QueryString.ToString().TrimStart('?')}";
  return ResourceSearch(s, s.DocRefResourceMap, s.DocRefsByEncounter,
                        "DocumentReference", encounter, patient, _id, cap, _offset, self);
});

app.MapGet("/fhir/DocumentReference/{id}", (FhirDataStore s, string id) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  if (!s.DocRefResourceMap.TryGetValue(id, out var entry))
    return Results.Json(new { error = "DocumentReference not found" }, statusCode: 404);
  return Results.Json(entry.Resource, contentType: FhirContentType);
});

// ── Routes: /fhir/Condition ───────────────────────────────────────────────────

app.MapGet("/fhir/Condition", (
    FhirDataStore s, HttpRequest req,
    string? encounter, string? patient, string? _id,
    int _count = 50, int _offset = 0) =>
{
  var cap = Math.Min(_count, 500);
  var self = $"{BaseUrl}/fhir/Condition?{req.QueryString.ToString().TrimStart('?')}";
  return ResourceSearch(s, s.ConditionResourceMap, s.ConditionsByEncounter,
                        "Condition", encounter, patient, _id, cap, _offset, self);
});

app.MapGet("/fhir/Condition/{id}", (FhirDataStore s, string id) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  if (!s.ConditionResourceMap.TryGetValue(id, out var entry))
    return Results.Json(new { error = "Condition not found" }, statusCode: 404);
  return Results.Json(entry.Resource, contentType: FhirContentType);
});

// ── Routes: /fhir/DiagnosticReport ───────────────────────────────────────────

app.MapGet("/fhir/DiagnosticReport", (
    FhirDataStore s, HttpRequest req,
    string? encounter, string? patient, string? _id,
    int _count = 50, int _offset = 0) =>
{
  var cap = Math.Min(_count, 500);
  var self = $"{BaseUrl}/fhir/DiagnosticReport?{req.QueryString.ToString().TrimStart('?')}";
  return ResourceSearch(s, s.DiagReportResourceMap, s.DiagReportsByEncounter,
                        "DiagnosticReport", encounter, patient, _id, cap, _offset, self);
});

app.MapGet("/fhir/DiagnosticReport/{id}", (FhirDataStore s, string id) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  if (!s.DiagReportResourceMap.TryGetValue(id, out var entry))
    return Results.Json(new { error = "DiagnosticReport not found" }, statusCode: 404);
  return Results.Json(entry.Resource, contentType: FhirContentType);
});

// ── Routes: /fhir/Immunization ────────────────────────────────────────────────

app.MapGet("/fhir/Immunization", (
    FhirDataStore s, HttpRequest req,
    string? encounter, string? patient, string? _id,
    int _count = 50, int _offset = 0) =>
{
  var cap = Math.Min(_count, 500);
  var self = $"{BaseUrl}/fhir/Immunization?{req.QueryString.ToString().TrimStart('?')}";
  return ResourceSearch(s, s.ImmunizationResourceMap, s.ImmunizationsByEncounter,
                        "Immunization", encounter, patient, _id, cap, _offset, self);
});

app.MapGet("/fhir/Immunization/{id}", (FhirDataStore s, string id) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  if (!s.ImmunizationResourceMap.TryGetValue(id, out var entry))
    return Results.Json(new { error = "Immunization not found" }, statusCode: 404);
  return Results.Json(entry.Resource, contentType: FhirContentType);
});

// ── Routes: /fhir/Procedure ───────────────────────────────────────────────────

app.MapGet("/fhir/Procedure", (
    FhirDataStore s, HttpRequest req,
    string? encounter, string? patient, string? _id,
    int _count = 50, int _offset = 0) =>
{
  var cap = Math.Min(_count, 500);
  var self = $"{BaseUrl}/fhir/Procedure?{req.QueryString.ToString().TrimStart('?')}";
  return ResourceSearch(s, s.ProcedureResourceMap, s.ProceduresByEncounter,
                        "Procedure", encounter, patient, _id, cap, _offset, self);
});

app.MapGet("/fhir/Procedure/{id}", (FhirDataStore s, string id) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  if (!s.ProcedureResourceMap.TryGetValue(id, out var entry))
    return Results.Json(new { error = "Procedure not found" }, statusCode: 404);
  return Results.Json(entry.Resource, contentType: FhirContentType);
});

// ── Routes: /fhir/Observation (has extra ?code= filter) ───────────────────────

app.MapGet("/fhir/Observation", (
    FhirDataStore s, HttpRequest req,
    string? encounter, string? patient, string? _id, string? code,
    int _count = 500, int _offset = 0) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);

  var cap = Math.Min(_count, 2000);
  IEnumerable<JsonObject> results;

  if (encounter is not null)
  {
    var encId = encounter.Replace("Encounter/", "").Replace("urn:uuid:", "");
    var ids = s.ObservationsByEncounter.TryGetValue(encId, out var l) ? l : [];
    results = ids.Select(i => s.ObservationResourceMap.TryGetValue(i, out var e) ? e.Resource : null)
                   .Where(r => r is not null).Select(r => r!);
  }
  else if (patient is not null)
  {
    var patId = patient.Replace("Patient/", "").Replace("urn:uuid:", "");
    results = s.ObservationResourceMap.Values
                 .Where(e => e.PatientId == patId).Select(e => e.Resource);

    if (code is not null)
    {
      var codeStr = code;
      results = results.Where(r =>
          r["code"]?["coding"]?.AsArray().Any(c =>
              c?["code"]?.GetValue<string>() == codeStr) == true ||
          r["code"]?["text"]?.GetValue<string>() == codeStr);
    }
  }
  else if (_id is not null)
  {
    results = s.ObservationResourceMap.TryGetValue(_id, out var e) ? [e.Resource] : [];
  }
  else
  {
    results = s.ObservationResourceMap.Values.Select(e => e.Resource);
  }

  var all = results.ToList();
  var total = all.Count;
  var page = all.Skip(_offset).Take(cap);
  var selfUrl = $"{BaseUrl}/fhir/Observation?{req.QueryString.ToString().TrimStart('?')}";
  return SearchSetBundle("Observation", page, total, selfUrl);
});

app.MapGet("/fhir/Observation/{id}", (FhirDataStore s, string id) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  if (!s.ObservationResourceMap.TryGetValue(id, out var entry))
    return Results.Json(new { error = "Observation not found" }, statusCode: 404);
  return Results.Json(entry.Resource, contentType: FhirContentType);
});

// ── Routes: /fhir/MedicationRequest ──────────────────────────────────────────

app.MapGet("/fhir/MedicationRequest", (
    FhirDataStore s, HttpRequest req,
    string? encounter, string? patient, string? _id,
    int _count = 50, int _offset = 0) =>
{
  var cap = Math.Min(_count, 500);
  var self = $"{BaseUrl}/fhir/MedicationRequest?{req.QueryString.ToString().TrimStart('?')}";
  return ResourceSearch(s, s.MedicationRequestResourceMap, s.MedicationRequestsByEncounter,
                        "MedicationRequest", encounter, patient, _id, cap, _offset, self);
});

app.MapGet("/fhir/MedicationRequest/{id}", (FhirDataStore s, string id) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  if (!s.MedicationRequestResourceMap.TryGetValue(id, out var entry))
    return Results.Json(new { error = "MedicationRequest not found" }, statusCode: 404);
  return Results.Json(entry.Resource, contentType: FhirContentType);
});

// ── Routes: /fhir/Claim ───────────────────────────────────────────────────────

app.MapGet("/fhir/Claim", (
    FhirDataStore s, HttpRequest req,
    string? encounter, string? patient, string? _id,
    int _count = 50, int _offset = 0) =>
{
  var cap = Math.Min(_count, 500);
  var self = $"{BaseUrl}/fhir/Claim?{req.QueryString.ToString().TrimStart('?')}";
  return ResourceSearch(s, s.ClaimResourceMap, s.ClaimsByEncounter,
                        "Claim", encounter, patient, _id, cap, _offset, self);
});

app.MapGet("/fhir/Claim/{id}", (FhirDataStore s, string id) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  if (!s.ClaimResourceMap.TryGetValue(id, out var entry))
    return Results.Json(new { error = "Claim not found" }, statusCode: 404);
  return Results.Json(entry.Resource, contentType: FhirContentType);
});

// ── Routes: /fhir/ExplanationOfBenefit ───────────────────────────────────────

app.MapGet("/fhir/ExplanationOfBenefit", (
    FhirDataStore s, HttpRequest req,
    string? encounter, string? patient, string? _id,
    int _count = 50, int _offset = 0) =>
{
  var cap = Math.Min(_count, 500);
  var self = $"{BaseUrl}/fhir/ExplanationOfBenefit?{req.QueryString.ToString().TrimStart('?')}";
  return ResourceSearch(s, s.EobResourceMap, s.EobsByEncounter,
                        "ExplanationOfBenefit", encounter, patient, _id, cap, _offset, self);
});

app.MapGet("/fhir/ExplanationOfBenefit/{id}", (FhirDataStore s, string id) =>
{
  if (s.PatientListCache is null)
    return Results.Json(new { error = "Cache not ready" }, statusCode: 503);
  if (!s.EobResourceMap.TryGetValue(id, out var entry))
    return Results.Json(new { error = "ExplanationOfBenefit not found" }, statusCode: 404);
  return Results.Json(entry.Resource, contentType: FhirContentType);
});

// ── Run ───────────────────────────────────────────────────────────────────────
Console.WriteLine("🏥 FhirPlace .NET API running on http://localhost:5001");
app.Run();
