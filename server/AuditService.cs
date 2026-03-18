using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace FhirPlace.Server;

/// <summary>
/// ONC §170.315(d)(2) — Auditable Events and Tamper-resistance.
/// Records who accessed EHI, what was accessed, when, and the outcome.
/// Each record is hash-chained (SHA-256) to the previous record for tamper detection.
/// </summary>
public static partial class AuditService
{
  // FHIR resource types in routes that constitute EHI access
  private static readonly HashSet<string> AuditedResourceTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Patient", "Encounter", "Condition", "DiagnosticReport", "DocumentReference",
        "Immunization", "Procedure", "Observation", "MedicationRequest",
        "Claim", "ExplanationOfBenefit",
    };

  // Route patterns that should be audited
  private static readonly Regex FhirRoutePattern = FhirRouteRegex();
  private static readonly Regex PatientApiPattern = PatientApiRegex();
  private static readonly Regex CcdExportPattern = CcdExportRegex();

  [GeneratedRegex(@"^/fhir/(\w+)(?:/([^/?]+))?", RegexOptions.IgnoreCase)]
  private static partial Regex FhirRouteRegex();
  [GeneratedRegex(@"^/api/patients(?:/([^/?]+))?$", RegexOptions.IgnoreCase)]
  private static partial Regex PatientApiRegex();
  [GeneratedRegex(@"^/api/patients/([^/?]+)/ccd$", RegexOptions.IgnoreCase)]
  private static partial Regex CcdExportRegex();

  /// <summary>
  /// Determines whether a request path should be audited.
  /// </summary>
  public static bool ShouldAudit(string path)
  {
    if (CcdExportPattern.IsMatch(path)) return true;
    if (PatientApiPattern.IsMatch(path)) return true;

    var m = FhirRoutePattern.Match(path);
    if (m.Success)
    {
      var rt = m.Groups[1].Value;
      // Skip metadata endpoints like _types, _classes
      if (rt.StartsWith('_')) return false;
      return AuditedResourceTypes.Contains(rt);
    }
    return false;
  }

  /// <summary>
  /// Parses the request path to extract action, resourceType, resourceId, and patientId.
  /// </summary>
  public static (string action, string resourceType, string? resourceId, string? patientId)
      ParseRequest(string path, string queryString)
  {
    // CCD export
    var ccdMatch = CcdExportPattern.Match(path);
    if (ccdMatch.Success)
      return ("export", "Patient", ccdMatch.Groups[1].Value, ccdMatch.Groups[1].Value);

    // FHIR routes
    var fhirMatch = FhirRoutePattern.Match(path);
    if (fhirMatch.Success)
    {
      var rt = fhirMatch.Groups[1].Value;
      var id = fhirMatch.Groups[2].Success ? fhirMatch.Groups[2].Value : null;
      var action = id is not null ? "read" : "search";

      // Try to extract patient context from query params
      string? patientId = null;
      if (rt == "Patient" && id is not null)
        patientId = id;
      else if (!string.IsNullOrEmpty(queryString))
      {
        var qs = System.Web.HttpUtility.ParseQueryString(queryString);
        var patParam = qs["patient"];
        if (patParam is not null)
          patientId = patParam.Replace("Patient/", "").Replace("urn:uuid:", "");
      }

      return (action, rt, id, patientId);
    }

    // Legacy /api/patients
    var patMatch = PatientApiPattern.Match(path);
    if (patMatch.Success)
    {
      var id = patMatch.Groups[1].Success ? patMatch.Groups[1].Value : null;
      return (id is not null ? "read" : "search", "Patient", id, id);
    }

    return ("unknown", "Unknown", null, null);
  }

  /// <summary>
  /// Extract user identity from request headers (set by frontend).
  /// Falls back to "anonymous" for unauthenticated requests.
  /// </summary>
  public static (string userId, string userName, string userRole) ExtractUser(HttpRequest req)
  {
    var userId = req.Headers["X-Audit-User-Id"].FirstOrDefault() ?? "anonymous";
    var userName = req.Headers["X-Audit-User-Name"].FirstOrDefault() ?? "Anonymous";
    var userRole = req.Headers["X-Audit-User-Role"].FirstOrDefault() ?? "system";
    return (userId, userName, userRole);
  }

  /// <summary>
  /// Compute SHA-256 hash of this record's auditable fields chained with the previous hash.
  /// </summary>
  public static string ComputeHash(AuditEvent evt, string previousHash)
  {
    var payload = string.Join("|",
        previousHash,
        evt.Timestamp,
        evt.Action,
        evt.ResourceType,
        evt.ResourceId ?? "",
        evt.PatientId ?? "",
        evt.UserId,
        evt.UserRole,
        evt.HttpMethod,
        evt.RequestPath,
        evt.QueryString ?? "",
        evt.StatusCode.ToString(),
        evt.Outcome);

    var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(payload));
    return Convert.ToHexStringLower(hashBytes);
  }

  /// <summary>
  /// Persist an audit event with hash-chain integrity.
  /// </summary>
  public static async Task LogAsync(FhirDbContext db, AuditEvent evt)
  {
    // Get the last hash for chain continuity
    var previousHash = await db.AuditEvents
        .OrderByDescending(a => a.Id)
        .Select(a => a.IntegrityHash)
        .FirstOrDefaultAsync() ?? "GENESIS";

    evt.IntegrityHash = ComputeHash(evt, previousHash);
    db.AuditEvents.Add(evt);
    await db.SaveChangesAsync();
  }

  /// <summary>
  /// Verify the integrity of the entire audit chain.
  /// Returns (isValid, brokenAtId) — brokenAtId is null when valid.
  /// </summary>
  public static async Task<(bool isValid, long? brokenAtId)> VerifyChainAsync(FhirDbContext db)
  {
    var events = await db.AuditEvents
        .OrderBy(a => a.Id)
        .ToListAsync();

    var previousHash = "GENESIS";
    foreach (var evt in events)
    {
      var expected = ComputeHash(evt, previousHash);
      if (evt.IntegrityHash != expected)
        return (false, evt.Id);
      previousHash = evt.IntegrityHash;
    }

    return (true, null);
  }
}
