using System.Collections.Concurrent;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace FhirPlace.Server;

public static class FhirSeeder
{
  /// <summary>
  /// Seeds the database from Synthea FHIR JSON files.
  /// No-op if the Patients table already has rows (idempotent re-start).
  /// </summary>
  public static async Task SeedAsync(FhirDbContext db, string fhirDir)
  {
    // ── Schema: create tables if they don't exist ─────────────────────────
    await db.Database.EnsureCreatedAsync();

    if (await db.Patients.AnyAsync())
    {
      var patCount = await db.Patients.CountAsync();
      var encCount = await db.Encounters.CountAsync();
      Console.WriteLine($"DB already seeded – {patCount} patients, {encCount} encounters.");
      return;
    }

    if (!Directory.Exists(fhirDir))
      throw new DirectoryNotFoundException($"FHIR directory not found: {fhirDir}");

    var files = Directory.GetFiles(fhirDir, "*.json");
    Console.WriteLine($"Seeding DB from {files.Length} Synthea files …");

    // ── Phase 1: parse all files in parallel ──────────────────────────────
    var patients = new ConcurrentBag<PatientRecord>();
    var encounters = new ConcurrentBag<EncounterRecord>();
    var resources = new ConcurrentBag<FhirResourceRecord>();
    var docRefLinks = new ConcurrentBag<DocRefEncounterLink>();
    var claimLinks = new ConcurrentBag<ClaimEncounterLink>();
    var eobLinks = new ConcurrentBag<EobEncounterLink>();

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

        // ── Find Patient ──────────────────────────────────────────────
        JsonObject? patientRes = null;
        foreach (var e in entries)
        {
          var r = e?["resource"]?.AsObject();
          if (r?["resourceType"]?.GetValue<string>() == "Patient") { patientRes = r; break; }
        }
        if (patientRes is null) return;

        var patientId = patientRes["id"]?.GetValue<string>();
        if (string.IsNullOrEmpty(patientId)) return;

        // ── First pass: collect Claims for EOB → Claim → Encounter ───
        var bundleClaims = new Dictionary<string, JsonObject>();
        foreach (var e in entries)
        {
          var r = e?["resource"]?.AsObject();
          var rt = r?["resourceType"]?.GetValue<string>();
          var id = r?["id"]?.GetValue<string>();
          if (rt == "Claim" && !string.IsNullOrEmpty(id)) bundleClaims[id] = r!;
        }

        // ── Second pass: index all resource types ─────────────────────
        foreach (var e in entries)
        {
          var r = e?["resource"]?.AsObject();
          if (r is null) continue;
          var rt = r["resourceType"]?.GetValue<string>();
          var id = r["id"]?.GetValue<string>();
          if (string.IsNullOrEmpty(id)) continue;

          var rJson = r.ToJsonString();

          // Single encounter ref (most resource types)
          var encRef = r["encounter"]?["reference"]?.GetValue<string>() ?? "";
          var encId = encRef.Replace("urn:uuid:", "").Replace("Encounter/", "").Trim();
          if (encId == encRef) encId = ""; // didn't match either prefix → no link

          switch (rt)
          {
            // ── Patient ───────────────────────────────────────────
            case "Patient":
              patients.Add(BuildPatientRecord(patientRes, patientId,
                                                  Path.GetFileName(file),
                                                  bundle.ToJsonString()));
              break;

            // ── Encounter ─────────────────────────────────────────
            case "Encounter":
              encounters.Add(BuildEncounterRecord(r, id, patientId));
              break;

            // ── DocumentReference (context.encounter[]) ───────────
            case "DocumentReference":
              resources.Add(new FhirResourceRecord
              {
                Id = id,
                ResourceType = "DocumentReference",
                PatientId = patientId,
                ResourceJson = rJson
              });
              var encRefs = r["context"]?["encounter"]?.AsArray();
              if (encRefs is not null)
                foreach (var eRef in encRefs)
                {
                  var eId = (eRef?["reference"]?.GetValue<string>() ?? "")
                                 .Replace("urn:uuid:", "").Replace("Encounter/", "");
                  if (!string.IsNullOrEmpty(eId))
                    docRefLinks.Add(new DocRefEncounterLink { DocRefId = id, EncounterId = eId });
                }
              break;

            // ── Simple single-encounter resources ─────────────────
            case "Condition":
            case "DiagnosticReport":
            case "Immunization":
            case "Procedure":
            case "MedicationRequest":
              resources.Add(new FhirResourceRecord
              {
                Id = id,
                ResourceType = rt,
                PatientId = patientId,
                EncounterId = string.IsNullOrEmpty(encId) ? null : encId,
                ResourceJson = rJson
              });
              break;

            // ── Observation (extra Code column) ───────────────────
            case "Observation":
              {
                var code = string.Join("|",
                        (r["code"]?["coding"]?.AsArray() ?? [])
                            .Select(c => c?["code"]?.GetValue<string>())
                            .Where(c => !string.IsNullOrEmpty(c)));
                resources.Add(new FhirResourceRecord
                {
                  Id = id,
                  ResourceType = "Observation",
                  PatientId = patientId,
                  EncounterId = string.IsNullOrEmpty(encId) ? null : encId,
                  Code = string.IsNullOrEmpty(code) ? null : code,
                  ResourceJson = rJson
                });
                break;
              }

            // ── Claim (item[].encounter[]) ────────────────────────
            case "Claim":
              {
                resources.Add(new FhirResourceRecord
                {
                  Id = id,
                  ResourceType = "Claim",
                  PatientId = patientId,
                  ResourceJson = rJson
                });
                foreach (var cEncId in ExtractItemEncounterIds(r))
                  claimLinks.Add(new ClaimEncounterLink { ClaimId = id, EncounterId = cEncId });
                break;
              }

            // ── ExplanationOfBenefit (via linked Claim) ───────────
            case "ExplanationOfBenefit":
              {
                resources.Add(new FhirResourceRecord
                {
                  Id = id,
                  ResourceType = "ExplanationOfBenefit",
                  PatientId = patientId,
                  ResourceJson = rJson
                });
                var claimId = (r["claim"]?["reference"]?.GetValue<string>() ?? "")
                                   .Replace("urn:uuid:", "").Replace("Claim/", "");
                if (!string.IsNullOrEmpty(claimId) &&
                        bundleClaims.TryGetValue(claimId, out var linkedClaim))
                {
                  foreach (var eobEncId in ExtractItemEncounterIds(linkedClaim))
                    eobLinks.Add(new EobEncounterLink { EobId = id, EncounterId = eobEncId });
                }
                break;
              }
          }
        }
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

    // ── Phase 2: bulk-insert into SQLite in one transaction ───────────────
    Console.WriteLine($"Parsed {patients.Count} patients, {encounters.Count} encounters, " +
                      $"{resources.Count} other resources. Inserting into DB …");

    db.ChangeTracker.AutoDetectChangesEnabled = false;

    await using var tx = await db.Database.BeginTransactionAsync();

    await BulkInsertAsync(db, db.Patients, patients.ToList());
    await BulkInsertAsync(db, db.Encounters, encounters.ToList());
    await BulkInsertAsync(db, db.Resources, resources.ToList());
    await BulkInsertAsync(db, db.DocRefEncounterLinks, docRefLinks.ToList());
    await BulkInsertAsync(db, db.ClaimEncounterLinks, claimLinks.ToList());
    await BulkInsertAsync(db, db.EobEncounterLinks, eobLinks.ToList());

    await tx.CommitAsync();

    db.ChangeTracker.AutoDetectChangesEnabled = true;

    Console.WriteLine("DB seeding complete.");
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private static async Task BulkInsertAsync<T>(
      FhirDbContext db, Microsoft.EntityFrameworkCore.DbSet<T> set, List<T> items,
      int batchSize = 500) where T : class
  {
    foreach (var batch in items.Chunk(batchSize))
    {
      await set.AddRangeAsync(batch);
      await db.SaveChangesAsync();
      db.ChangeTracker.Clear();
    }
    Console.WriteLine($"  Inserted {items.Count} {typeof(T).Name} records.");
  }

  private static HashSet<string> ExtractItemEncounterIds(JsonObject claim)
  {
    var ids = new HashSet<string>();
    var items = claim["item"]?.AsArray();
    if (items is null) return ids;
    foreach (var item in items)
    {
      var encs = item?["encounter"]?.AsArray();
      if (encs is null) continue;
      foreach (var eRef in encs)
      {
        var eId = (eRef?["reference"]?.GetValue<string>() ?? "")
                   .Replace("urn:uuid:", "").Replace("Encounter/", "");
        if (!string.IsNullOrEmpty(eId)) ids.Add(eId);
      }
    }
    return ids;
  }

  private static EncounterRecord BuildEncounterRecord(JsonObject r, string id, string patientId)
  {
    var typeText = r["type"]?.AsArray().FirstOrDefault()?["text"]?.GetValue<string>()
        ?? r["type"]?.AsArray().FirstOrDefault()?["coding"]?.AsArray()
            .FirstOrDefault()?["display"]?.GetValue<string>();

    // Concatenate all reason texts + codes for substring search
    var reasonParts = new List<string>();
    var reasons = r["reason"]?.AsArray();
    if (reasons is not null)
      foreach (var reason in reasons)
      {
        var txt = reason?["text"]?.GetValue<string>();
        if (!string.IsNullOrEmpty(txt)) reasonParts.Add(txt);
        var codings = reason?["coding"]?.AsArray();
        if (codings is not null)
          foreach (var c in codings)
          {
            var code = c?["code"]?.GetValue<string>();
            var disp = c?["display"]?.GetValue<string>();
            if (!string.IsNullOrEmpty(code)) reasonParts.Add(code);
            if (!string.IsNullOrEmpty(disp)) reasonParts.Add(disp);
          }
      }

    var periodStart = r["period"]?["start"]?.GetValue<string>();

    return new EncounterRecord
    {
      Id = id,
      PatientId = patientId,
      Status = r["status"]?.GetValue<string>(),
      ClassCode = r["class"]?["code"]?.GetValue<string>(),
      PeriodStart = periodStart?.Length >= 10 ? periodStart[..10] : periodStart,
      TypeText = typeText,
      ReasonText = reasonParts.Count > 0 ? string.Join(" | ", reasonParts) : null,
      ResourceJson = r.ToJsonString(),
    };
  }

  private static PatientRecord BuildPatientRecord(
      JsonObject pr, string patientId, string filename, string bundleJson)
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
      foreach (var k in new[] { "city", "state", "postalCode", "country" })
      {
        var v = addr0[k]?.GetValue<string>();
        if (!string.IsNullOrEmpty(v)) addrParts.Add(v);
      }
    }
    var address = string.Join(", ", addrParts.Where(p => !string.IsNullOrEmpty(p)));

    string FindExtText(string urlFragment) =>
        extensions?
            .FirstOrDefault(e => e?["url"]?.GetValue<string>()?.Contains(urlFragment) == true)?
            .AsObject()?["extension"]?.AsArray()
            .FirstOrDefault(e => e?["url"]?.GetValue<string>() == "text")?
            ["valueString"]?.GetValue<string>() ?? "";

    var race = FindExtText("us-core-race");
    var ethnicity = FindExtText("us-core-ethnicity");

    var bpExt = extensions?
        .FirstOrDefault(e => e?["url"]?.GetValue<string>()?.Contains("birthPlace") == true)?
        .AsObject();
    var bpAddr = bpExt?["valueAddress"]?.AsObject();
    var birthPlace = bpAddr is not null
        ? string.Join(", ", new[] { "city", "state", "country" }
            .Select(k => bpAddr[k]?.GetValue<string>()).Where(v => !string.IsNullOrEmpty(v)))
        : "";

    var comm0 = pr["communication"]?.AsArray().FirstOrDefault()?.AsObject();
    var language = comm0?["language"]?["text"]?.GetValue<string>()
        ?? comm0?["language"]?["coding"]?.AsArray().FirstOrDefault()?["display"]?.GetValue<string>()
        ?? "";

    var ids = pr["identifier"]?.AsArray();
    var ssn = ids?
        .FirstOrDefault(i =>
            i?["system"]?.GetValue<string>() == "http://hl7.org/fhir/sid/us-ssn" ||
            i?["type"]?["coding"]?.AsArray().FirstOrDefault()?["code"]?.GetValue<string>() == "SS")?
        ["value"]?.GetValue<string>() ?? "";
    var mrn = ids?
        .FirstOrDefault(i =>
            i?["type"]?["coding"]?.AsArray().FirstOrDefault()?["code"]?.GetValue<string>() == "MR")?
        ["value"]?.GetValue<string>() ?? patientId;

    return new PatientRecord
    {
      Id = patientId,
      Name = name0?["text"]?.GetValue<string>() ?? filename.Replace(".json", ""),
      Family = name0?["family"]?.GetValue<string>() ?? "",
      Given = string.Join(" ",
                            name0?["given"]?.AsArray().Select(g => g?.GetValue<string>())
                                .Where(g => g is not null) ?? []),
      Gender = pr["gender"]?.GetValue<string>() ?? "",
      BirthDate = pr["birthDate"]?.GetValue<string>() ?? "",
      MaritalStatus = pr["maritalStatus"]?["text"]?.GetValue<string>()
                        ?? pr["maritalStatus"]?["coding"]?.AsArray()
                            .FirstOrDefault()?["display"]?.GetValue<string>() ?? "",
      Phone = phone,
      Address = address,
      Race = race,
      Ethnicity = ethnicity,
      BirthPlace = birthPlace,
      Language = language,
      Ssn = ssn,
      Mrn = mrn,
      Filename = filename,
      BundleJson = bundleJson,
      ResourceJson = pr.ToJsonString(),
    };
  }
}
