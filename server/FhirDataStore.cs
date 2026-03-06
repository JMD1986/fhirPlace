using System.Collections.Concurrent;
using System.Text.Json.Nodes;

namespace FhirPlace.Server;

// ── Summary object returned by GET /api/patients ─────────────────────────────
public sealed class PatientSummary
{
  public string Id { get; init; } = "";
  public string Name { get; init; } = "";
  public string Family { get; init; } = "";
  public string Given { get; init; } = "";
  public string Gender { get; init; } = "";
  public string BirthDate { get; init; } = "";
  public string MaritalStatus { get; init; } = "";
  public string Phone { get; init; } = "";
  public string Address { get; init; } = "";
  public string Race { get; init; } = "";
  public string Ethnicity { get; init; } = "";
  public string BirthPlace { get; init; } = "";
  public string Language { get; init; } = "";
  public string Ssn { get; init; } = "";
  public string Mrn { get; init; } = "";
  public string Filename { get; init; } = "";
  public string ResourceType { get; init; } = "Patient";
}

// ── Wrapper that couples a FHIR resource to its owning patient ────────────────
public sealed record ResourceEntry(JsonObject Resource, string PatientId);

// ── In-memory FHIR cache (equivalent to the Maps in server.js) ───────────────
public sealed class FhirDataStore
{
  // Patient lists
  public List<PatientSummary>? PatientListCache { get; private set; }
  public Dictionary<string, JsonObject> PatientBundleMap { get; } = new();
  public Dictionary<string, JsonObject> PatientResourceMap { get; } = new();

  // Per-resource maps (keyed by resource UUID)
  public Dictionary<string, ResourceEntry> EncounterResourceMap { get; } = new();
  public Dictionary<string, List<string>> EncountersByPatient { get; } = new();
  public Dictionary<string, ResourceEntry> DocRefResourceMap { get; } = new();
  public Dictionary<string, List<string>> DocRefsByEncounter { get; } = new();
  public Dictionary<string, ResourceEntry> ConditionResourceMap { get; } = new();
  public Dictionary<string, List<string>> ConditionsByEncounter { get; } = new();
  public Dictionary<string, ResourceEntry> DiagReportResourceMap { get; } = new();
  public Dictionary<string, List<string>> DiagReportsByEncounter { get; } = new();
  public Dictionary<string, ResourceEntry> ClaimResourceMap { get; } = new();
  public Dictionary<string, List<string>> ClaimsByEncounter { get; } = new();
  public Dictionary<string, ResourceEntry> EobResourceMap { get; } = new();
  public Dictionary<string, List<string>> EobsByEncounter { get; } = new();
  public Dictionary<string, ResourceEntry> ImmunizationResourceMap { get; } = new();
  public Dictionary<string, List<string>> ImmunizationsByEncounter { get; } = new();
  public Dictionary<string, ResourceEntry> ProcedureResourceMap { get; } = new();
  public Dictionary<string, List<string>> ProceduresByEncounter { get; } = new();
  public Dictionary<string, ResourceEntry> ObservationResourceMap { get; } = new();
  public Dictionary<string, List<string>> ObservationsByEncounter { get; } = new();
  public Dictionary<string, ResourceEntry> MedicationRequestResourceMap { get; } = new();
  public Dictionary<string, List<string>> MedicationRequestsByEncounter { get; } = new();

  // ── Loader ─────────────────────────────────────────────────────────────────
  public async Task LoadPatientsAsync(string fhirDir)
  {
    if (!Directory.Exists(fhirDir))
      throw new DirectoryNotFoundException($"FHIR directory not found: {fhirDir}");

    var files = Directory.GetFiles(fhirDir, "*.json");
    var list = new ConcurrentBag<PatientSummary>();
    var throttle = new SemaphoreSlim(Environment.ProcessorCount * 2);

    await Parallel.ForEachAsync(files, async (file, ct) =>
    {
      await throttle.WaitAsync(ct);
      try
      {
        var json = await File.ReadAllTextAsync(file, ct);
        var bundle = JsonNode.Parse(json)?.AsObject();
        if (bundle is null) return;

        var entries = bundle["entry"]?.AsArray();
        if (entries is null) return;

        // ── Locate Patient resource ──────────────────────────────────
        JsonObject? patientResource = null;
        foreach (var entry in entries)
        {
          var r = entry?["resource"]?.AsObject();
          if (r?["resourceType"]?.GetValue<string>() == "Patient")
          { patientResource = r; break; }
        }
        if (patientResource is null) return;

        var patientId = patientResource["id"]?.GetValue<string>();
        if (string.IsNullOrEmpty(patientId)) return;

        lock (PatientBundleMap) PatientBundleMap[patientId] = bundle;
        lock (PatientResourceMap) PatientResourceMap[patientId] = patientResource;

        // ── First pass: collect Claims for EOB → Claim → Encounter linkage ──
        var bundleClaims = new Dictionary<string, JsonObject>();
        foreach (var entry in entries)
        {
          var r = entry?["resource"]?.AsObject();
          var rt = r?["resourceType"]?.GetValue<string>();
          var id = r?["id"]?.GetValue<string>();
          if (rt == "Claim" && !string.IsNullOrEmpty(id))
            bundleClaims[id] = r!;
        }

        // ── Second pass: index every resource type ───────────────────
        var encounterIds = new List<string>();

        foreach (var entry in entries)
        {
          var r = entry?["resource"]?.AsObject();
          if (r is null) continue;
          var rt = r["resourceType"]?.GetValue<string>();
          var id = r["id"]?.GetValue<string>();
          if (string.IsNullOrEmpty(id)) continue;

          // Single encounter ref shared by most resource types
          var encId = r["encounter"]?["reference"]?.GetValue<string>()?
                           .Replace("urn:uuid:", "")
                           .Replace("Encounter/", "");

          switch (rt)
          {
            // ── Encounter ──────────────────────────────────────
            case "Encounter":
              lock (EncounterResourceMap) EncounterResourceMap[id] = new(r, patientId);
              encounterIds.Add(id);
              break;

            // ── DocumentReference (context.encounter[]) ────────
            case "DocumentReference":
              lock (DocRefResourceMap) DocRefResourceMap[id] = new(r, patientId);
              var encRefs = r["context"]?["encounter"]?.AsArray();
              if (encRefs is not null)
                foreach (var eRef in encRefs)
                {
                  var eId = eRef?["reference"]?.GetValue<string>()?
                                 .Replace("urn:uuid:", "").Replace("Encounter/", "");
                  if (!string.IsNullOrEmpty(eId))
                    AddToIndex(DocRefsByEncounter, eId, id);
                }
              break;

            // ── Simple single-encounter resources ──────────────
            case "Condition":
              lock (ConditionResourceMap) ConditionResourceMap[id] = new(r, patientId);
              if (!string.IsNullOrEmpty(encId)) AddToIndex(ConditionsByEncounter, encId, id);
              break;

            case "DiagnosticReport":
              lock (DiagReportResourceMap) DiagReportResourceMap[id] = new(r, patientId);
              if (!string.IsNullOrEmpty(encId)) AddToIndex(DiagReportsByEncounter, encId, id);
              break;

            case "Immunization":
              lock (ImmunizationResourceMap) ImmunizationResourceMap[id] = new(r, patientId);
              if (!string.IsNullOrEmpty(encId)) AddToIndex(ImmunizationsByEncounter, encId, id);
              break;

            case "Procedure":
              lock (ProcedureResourceMap) ProcedureResourceMap[id] = new(r, patientId);
              if (!string.IsNullOrEmpty(encId)) AddToIndex(ProceduresByEncounter, encId, id);
              break;

            case "Observation":
              lock (ObservationResourceMap) ObservationResourceMap[id] = new(r, patientId);
              if (!string.IsNullOrEmpty(encId)) AddToIndex(ObservationsByEncounter, encId, id);
              break;

            case "MedicationRequest":
              lock (MedicationRequestResourceMap) MedicationRequestResourceMap[id] = new(r, patientId);
              if (!string.IsNullOrEmpty(encId)) AddToIndex(MedicationRequestsByEncounter, encId, id);
              break;

            // ── Claim (item[].encounter[]) ─────────────────────
            case "Claim":
              {
                lock (ClaimResourceMap) ClaimResourceMap[id] = new(r, patientId);
                var encIds = ExtractItemEncounterIds(r);
                foreach (var cEncId in encIds)
                  AddToIndex(ClaimsByEncounter, cEncId, id);
                break;
              }

            // ── ExplanationOfBenefit (via linked Claim) ────────
            case "ExplanationOfBenefit":
              {
                lock (EobResourceMap) EobResourceMap[id] = new(r, patientId);
                var claimId = r["claim"]?["reference"]?.GetValue<string>()?
                                   .Replace("urn:uuid:", "").Replace("Claim/", "");
                if (!string.IsNullOrEmpty(claimId) &&
                        bundleClaims.TryGetValue(claimId, out var linkedClaim))
                {
                  foreach (var eobEncId in ExtractItemEncounterIds(linkedClaim))
                    AddToIndex(EobsByEncounter, eobEncId, id);
                }
                break;
              }
          }
        }

        lock (EncountersByPatient) EncountersByPatient[patientId] = encounterIds;

        list.Add(BuildSummary(patientResource, patientId, Path.GetFileName(file)));
      }
      catch (Exception ex)
      {
        Console.Error.WriteLine($"Failed to parse {file}: {ex.Message}");
      }
      finally
      {
        throttle.Release();
      }
    });

    PatientListCache = [.. list];
    Console.WriteLine($"Loaded {PatientListCache.Count} patients into cache");
    Console.WriteLine($"Loaded {EncounterResourceMap.Count} encounters into cache");
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /// <summary>Thread-safe append to a string-list dictionary.</summary>
  private void AddToIndex(Dictionary<string, List<string>> index, string key, string value)
  {
    lock (index)
    {
      if (!index.TryGetValue(key, out var existing))
        index[key] = existing = [];
      existing.Add(value);
    }
  }

  /// <summary>Collect unique encounter IDs from Claim.item[].encounter[].</summary>
  private static HashSet<string> ExtractItemEncounterIds(JsonObject claim)
  {
    var ids = new HashSet<string>();
    var items = claim["item"]?.AsArray();
    if (items is null) return ids;
    foreach (var item in items)
    {
      var encounters = item?["encounter"]?.AsArray();
      if (encounters is null) continue;
      foreach (var eRef in encounters)
      {
        var eId = eRef?["reference"]?.GetValue<string>()?
                   .Replace("urn:uuid:", "").Replace("Encounter/", "");
        if (!string.IsNullOrEmpty(eId)) ids.Add(eId);
      }
    }
    return ids;
  }

  /// <summary>Build the flat PatientSummary used by GET /api/patients.</summary>
  private static PatientSummary BuildSummary(JsonObject pr, string patientId, string filename)
  {
    var name0 = pr["name"]?.AsArray().FirstOrDefault()?.AsObject();
    var telecom = pr["telecom"]?.AsArray();
    var addr0 = pr["address"]?.AsArray().FirstOrDefault()?.AsObject();
    var extensions = pr["extension"]?.AsArray();

    // Phone
    var phone = telecom?
        .FirstOrDefault(t => t?["system"]?.GetValue<string>() == "phone")?
        ["value"]?.GetValue<string>() ?? "";

    // Address
    var addrParts = new List<string>();
    if (addr0 is not null)
    {
      var line = addr0["line"]?.AsArray();
      if (line is not null)
        addrParts.Add(string.Join(" ", line.Select(l => l?.GetValue<string>()).Where(l => l is not null)));
      foreach (var key in new[] { "city", "state", "postalCode", "country" })
      {
        var v = addr0[key]?.GetValue<string>();
        if (!string.IsNullOrEmpty(v)) addrParts.Add(v);
      }
    }
    var address = string.Join(", ", addrParts.Where(p => !string.IsNullOrEmpty(p)));

    // Race / Ethnicity (US-Core extensions)
    string FindExtText(string urlFragment) =>
        extensions?
            .FirstOrDefault(e => e?["url"]?.GetValue<string>()?.Contains(urlFragment) == true)?
            .AsObject()?["extension"]?.AsArray()
            .FirstOrDefault(e => e?["url"]?.GetValue<string>() == "text")?
            ["valueString"]?.GetValue<string>() ?? "";

    var race = FindExtText("us-core-race");
    var ethnicity = FindExtText("us-core-ethnicity");

    // Birth place
    var bpExt = extensions?
        .FirstOrDefault(e => e?["url"]?.GetValue<string>()?.Contains("birthPlace") == true)?
        .AsObject();
    var bpAddr = bpExt?["valueAddress"]?.AsObject();
    var birthPlace = bpAddr is not null
        ? string.Join(", ",
            new[] { "city", "state", "country" }
                .Select(k => bpAddr[k]?.GetValue<string>())
                .Where(v => !string.IsNullOrEmpty(v)))
        : "";

    // Language
    var comm0 = pr["communication"]?.AsArray().FirstOrDefault()?.AsObject();
    var language = comm0?["language"]?["text"]?.GetValue<string>()
        ?? comm0?["language"]?["coding"]?.AsArray()
            .FirstOrDefault()?["display"]?.GetValue<string>()
        ?? "";

    // Identifiers
    var ids = pr["identifier"]?.AsArray();
    var ssn = ids?
        .FirstOrDefault(i =>
            i?["system"]?.GetValue<string>() == "http://hl7.org/fhir/sid/us-ssn" ||
            i?["type"]?["coding"]?.AsArray()
                .FirstOrDefault()?["code"]?.GetValue<string>() == "SS")?
        ["value"]?.GetValue<string>() ?? "";

    var mrn = ids?
        .FirstOrDefault(i =>
            i?["type"]?["coding"]?.AsArray()
                .FirstOrDefault()?["code"]?.GetValue<string>() == "MR")?
        ["value"]?.GetValue<string>() ?? patientId;

    return new PatientSummary
    {
      Id = patientId,
      Name = name0?["text"]?.GetValue<string>() ?? filename.Replace(".json", ""),
      Family = name0?["family"]?.GetValue<string>() ?? "",
      Given = string.Join(" ",
                           name0?["given"]?.AsArray()
                               .Select(g => g?.GetValue<string>())
                               .Where(g => g is not null) ?? []),
      Gender = pr["gender"]?.GetValue<string>() ?? "",
      BirthDate = pr["birthDate"]?.GetValue<string>() ?? "",
      MaritalStatus = pr["maritalStatus"]?["text"]?.GetValue<string>()
                       ?? pr["maritalStatus"]?["coding"]?.AsArray()
                           .FirstOrDefault()?["display"]?.GetValue<string>()
                       ?? "",
      Phone = phone,
      Address = address,
      Race = race,
      Ethnicity = ethnicity,
      BirthPlace = birthPlace,
      Language = language,
      Ssn = ssn,
      Mrn = mrn,
      Filename = filename,
    };
  }
}
