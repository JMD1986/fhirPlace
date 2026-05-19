using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace FhirPlace.Server;

/// <summary>
/// FHIR-aligned RBAC for the synthetic API. When the client sends
/// X-Audit-User-Role: patient, requests are limited to the patient in
/// X-Audit-Patient-Context (from SMART launch). Live EHR FHIR calls remain
/// authorized by the EHR; this layer protects the bundled SQLite store.
/// </summary>
public static partial class AccessControlService
{
  private static readonly HashSet<string> PatientScopedResourceTypes = new(StringComparer.OrdinalIgnoreCase)
  {
    "Encounter", "Condition", "DiagnosticReport", "DocumentReference",
    "Immunization", "Procedure", "Observation", "MedicationRequest",
    "Claim", "ExplanationOfBenefit",
  };

  [GeneratedRegex(@"^/api/patients(?:/([^/?]+))?", RegexOptions.IgnoreCase)]
  private static partial Regex PatientApiRegex();

  [GeneratedRegex(@"^/fhir/Patient(?:/([^/?]+))?$", RegexOptions.IgnoreCase)]
  private static partial Regex FhirPatientRegex();

  [GeneratedRegex(@"^/fhir/(\w+)(?:/([^/?]+))?", RegexOptions.IgnoreCase)]
  private static partial Regex FhirResourceRegex();

  public static bool IsPatientRole(HttpRequest req) =>
    string.Equals(
      req.Headers["X-Audit-User-Role"].FirstOrDefault(),
      "patient",
      StringComparison.OrdinalIgnoreCase);

  public static string? PatientContext(HttpRequest req)
  {
    var raw = req.Headers["X-Audit-Patient-Context"].FirstOrDefault();
    return string.IsNullOrWhiteSpace(raw) ? null : NormalizePatientId(raw);
  }

  public static string NormalizePatientId(string id) =>
    id.Replace("Patient/", "", StringComparison.OrdinalIgnoreCase)
      .Replace("urn:uuid:", "", StringComparison.OrdinalIgnoreCase)
      .Trim();

  public static bool PatientIdsMatch(string a, string b) =>
    string.Equals(NormalizePatientId(a), NormalizePatientId(b), StringComparison.OrdinalIgnoreCase);

  /// <summary>
  /// Returns a denial message when the request must not proceed; null if allowed.
  /// </summary>
  public static async Task<string?> GetDenialReasonAsync(
    HttpRequest req,
    FhirDbContext db,
    CancellationToken ct = default)
  {
    if (!IsPatientRole(req)) return null;

    var ctx = PatientContext(req);
    if (ctx is null)
      return "Patient launch context is required for patient-role access.";

    var path = req.Path.Value ?? "";

    if (path.StartsWith("/api/audit", StringComparison.OrdinalIgnoreCase))
      return "Audit log access requires a provider role.";

    if (path.Equals("/api/patients-count", StringComparison.OrdinalIgnoreCase) ||
        path.Equals("/api/patients", StringComparison.OrdinalIgnoreCase))
      return "Patient search is not permitted for patient-role sessions.";

    var patientApi = PatientApiRegex().Match(path);
    if (patientApi.Success && patientApi.Groups[1].Success)
    {
      if (!PatientIdsMatch(ctx, patientApi.Groups[1].Value))
        return "Access to this patient's data is not authorized.";
      return null;
    }

    var fhirPatient = FhirPatientRegex().Match(path);
    if (fhirPatient.Success)
    {
      if (!fhirPatient.Groups[1].Success)
        return "Patient search is not permitted for patient-role sessions.";
      if (!PatientIdsMatch(ctx, fhirPatient.Groups[1].Value))
        return "Access to this patient's data is not authorized.";
      return null;
    }

    var patQuery = req.Query["patient"].FirstOrDefault();
    if (!string.IsNullOrEmpty(patQuery) && !PatientIdsMatch(ctx, patQuery))
      return "Access to this patient's data is not authorized.";

    if (path.Equals("/fhir/Encounter", StringComparison.OrdinalIgnoreCase) &&
        string.IsNullOrEmpty(patQuery))
      return "Patient-scoped encounter search requires a patient parameter.";

    var fhirMatch = FhirResourceRegex().Match(path);
    if (fhirMatch.Success)
    {
      var rt = fhirMatch.Groups[1].Value;
      if (rt.StartsWith("_", StringComparison.Ordinal)) return null;

      if (fhirMatch.Groups[2].Success && PatientScopedResourceTypes.Contains(rt))
      {
        var resourceId = fhirMatch.Groups[2].Value;
        var ownerPatientId = await ResolveResourcePatientIdAsync(db, rt, resourceId, ct);
        if (ownerPatientId is null)
          return null; // 404 handled by route
        if (!PatientIdsMatch(ctx, ownerPatientId))
          return "Access to this resource is not authorized for your patient context.";
        return null;
      }

      if (!fhirMatch.Groups[2].Success && PatientScopedResourceTypes.Contains(rt) &&
          string.IsNullOrEmpty(patQuery))
        return "Patient-scoped search requires a patient parameter.";
    }

    return null;
  }

  private static async Task<string?> ResolveResourcePatientIdAsync(
    FhirDbContext db,
    string resourceType,
    string resourceId,
    CancellationToken ct)
  {
    if (resourceType.Equals("Encounter", StringComparison.OrdinalIgnoreCase))
    {
      return await db.Encounters.AsNoTracking()
        .Where(e => e.Id == resourceId)
        .Select(e => e.PatientId)
        .FirstOrDefaultAsync(ct);
    }

    return await db.Resources.AsNoTracking()
      .Where(r => r.ResourceType == resourceType && r.Id == resourceId)
      .Select(r => r.PatientId)
      .FirstOrDefaultAsync(ct);
  }
}
