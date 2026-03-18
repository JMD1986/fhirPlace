using System.Text.Json;
using System.Xml.Linq;

namespace FhirPlace.Server;

/// <summary>
/// Generates a C-CDA 2.1 Continuity of Care Document (CCD) from FHIR JSON resources.
/// Satisfies 45 CFR 170.315(b)(6) Data Export and (g)(9) All Data Request.
/// </summary>
public static class CcdGenerator
{
  // ── CDA namespaces ─────────────────────────────────────────────────────────
  static readonly XNamespace Hl7 = "urn:hl7-org:v3";
  static readonly XNamespace Xsi = "http://www.w3.org/2001/XMLSchema-instance";
  static readonly XNamespace SdTc = "urn:hl7-org:sdtc";

  // ── OIDs ───────────────────────────────────────────────────────────────────
  const string OidSnomed = "2.16.840.1.113883.6.96";
  const string OidLoinc = "2.16.840.1.113883.6.1";
  const string OidRxNorm = "2.16.840.1.113883.6.88";
  const string OidCpt = "2.16.840.1.113883.6.12";
  const string OidCvx = "2.16.840.1.113883.12.292";

  /// <summary>
  /// Build the full CCD XML document.
  /// </summary>
  public static string Generate(
      string patientJson,
      IReadOnlyList<string> conditionJsons,
      IReadOnlyList<string> medicationJsons,
      IReadOnlyList<string> observationJsons,
      IReadOnlyList<string> procedureJsons,
      IReadOnlyList<string> immunizationJsons,
      IReadOnlyList<string> encounterJsons)
  {
    using var patDoc = JsonDocument.Parse(patientJson);
    var pat = patDoc.RootElement;

    var now = DateTime.UtcNow;
    var docId = Guid.NewGuid().ToString();

    var doc = new XDocument(
        new XProcessingInstruction("xml-stylesheet", "type=\"text/xsl\" href=\"CDA.xsl\""),
        ClinicalDocument(pat, now, docId,
            conditionJsons, medicationJsons, observationJsons,
            procedureJsons, immunizationJsons, encounterJsons));

    return doc.Declaration?.ToString() + Environment.NewLine + doc;
  }

  // ── Root element ───────────────────────────────────────────────────────────
  static XElement ClinicalDocument(
      JsonElement pat, DateTime now, string docId,
      IReadOnlyList<string> conditions, IReadOnlyList<string> medications,
      IReadOnlyList<string> observations, IReadOnlyList<string> procedures,
      IReadOnlyList<string> immunizations, IReadOnlyList<string> encounters)
  {
    return new XElement(Hl7 + "ClinicalDocument",
        new XAttribute(XNamespace.Xmlns + "xsi", Xsi),
        new XAttribute(XNamespace.Xmlns + "sdtc", SdTc),

        // US Realm Header
        new XElement(Hl7 + "realmCode", new XAttribute("code", "US")),
        new XElement(Hl7 + "typeId",
            new XAttribute("root", "2.16.840.1.113883.1.3"),
            new XAttribute("extension", "POCD_HD000040")),
        // CCD templateId
        TemplateId("2.16.840.1.113883.10.20.22.1.1"),  // US Realm Header
        TemplateId("2.16.840.1.113883.10.20.22.1.2"),  // CCD

        new XElement(Hl7 + "id", new XAttribute("root", docId)),
        new XElement(Hl7 + "code",
            new XAttribute("code", "34133-9"),
            new XAttribute("codeSystem", OidLoinc),
            new XAttribute("codeSystemName", "LOINC"),
            new XAttribute("displayName", "Summarization of Episode Note")),
        new XElement(Hl7 + "title", "Continuity of Care Document"),
        new XElement(Hl7 + "effectiveTime", new XAttribute("value", CdaTime(now))),
        new XElement(Hl7 + "confidentialityCode",
            new XAttribute("code", "N"),
            new XAttribute("codeSystem", "2.16.840.1.113883.5.25")),
        new XElement(Hl7 + "languageCode", new XAttribute("code", "en-US")),

        RecordTarget(pat),
        Author(now),
        Custodian(),
        StructuredBody(conditions, medications, observations,
                       procedures, immunizations, encounters));
  }

  // ── Header: recordTarget ───────────────────────────────────────────────────
  static XElement RecordTarget(JsonElement pat)
  {
    var patientRole = new XElement(Hl7 + "patientRole");

    // MRN identifier
    var mrn = FindIdentifier(pat, "Medical Record Number")
           ?? FindIdentifier(pat, "MR");
    if (mrn is not null)
      patientRole.Add(new XElement(Hl7 + "id",
          new XAttribute("root", "2.16.840.1.113883.4.1"),
          new XAttribute("extension", mrn)));
    else
      patientRole.Add(new XElement(Hl7 + "id",
          new XAttribute("root", "2.16.840.1.113883.4.1"),
          new XAttribute("extension", Str(pat, "id"))));

    // Address
    if (pat.TryGetProperty("address", out var addrArr) && addrArr.GetArrayLength() > 0)
    {
      var a = addrArr[0];
      var addr = new XElement(Hl7 + "addr", new XAttribute("use", "HP"));
      if (a.TryGetProperty("line", out var lines))
        foreach (var l in lines.EnumerateArray())
          addr.Add(new XElement(Hl7 + "streetAddressLine", l.GetString()));
      addr.Add(new XElement(Hl7 + "city", Str(a, "city")));
      addr.Add(new XElement(Hl7 + "state", Str(a, "state")));
      addr.Add(new XElement(Hl7 + "postalCode", Str(a, "postalCode")));
      addr.Add(new XElement(Hl7 + "country", Str(a, "country", "US")));
      patientRole.Add(addr);
    }

    // Telecom
    if (pat.TryGetProperty("telecom", out var telArr))
      foreach (var t in telArr.EnumerateArray())
      {
        var val = Str(t, "value");
        if (!string.IsNullOrEmpty(val))
          patientRole.Add(new XElement(Hl7 + "telecom",
              new XAttribute("value", val.StartsWith("tel:") ? val : $"tel:{val}"),
              new XAttribute("use", Str(t, "use", "HP") == "home" ? "HP" : "WP")));
      }

    // Patient sub-element
    var patient = new XElement(Hl7 + "patient");

    // Name
    if (pat.TryGetProperty("name", out var nameArr) && nameArr.GetArrayLength() > 0)
    {
      var n = nameArr[0];
      var name = new XElement(Hl7 + "name");
      if (n.TryGetProperty("given", out var givens))
        foreach (var g in givens.EnumerateArray())
          name.Add(new XElement(Hl7 + "given", g.GetString()));
      name.Add(new XElement(Hl7 + "family", Str(n, "family")));
      if (n.TryGetProperty("prefix", out var prefixes))
        foreach (var p in prefixes.EnumerateArray())
          name.Add(new XElement(Hl7 + "prefix", p.GetString()));
      patient.Add(name);
    }

    // Gender
    var gender = Str(pat, "gender");
    var genderCode = gender switch
    {
      "male" => "M",
      "female" => "F",
      "other" => "UN",
      _ => "UNK"
    };
    patient.Add(new XElement(Hl7 + "administrativeGenderCode",
        new XAttribute("code", genderCode),
        new XAttribute("codeSystem", "2.16.840.1.113883.5.1")));

    // Birth date
    var bd = Str(pat, "birthDate");
    if (!string.IsNullOrEmpty(bd))
      patient.Add(new XElement(Hl7 + "birthTime",
          new XAttribute("value", bd.Replace("-", ""))));

    // Race (US Core extension)
    var race = FindExtension(pat, "omb-race-category");
    if (race is not null)
      patient.Add(new XElement(SdTc + "raceCode",
          new XAttribute("code", race.Value.code),
          new XAttribute("displayName", race.Value.display),
          new XAttribute("codeSystem", "2.16.840.1.113883.6.238")));

    // Ethnicity (US Core extension)
    var eth = FindExtension(pat, "omb-ethnicity-category");
    if (eth is not null)
      patient.Add(new XElement(SdTc + "ethnicGroupCode",
          new XAttribute("code", eth.Value.code),
          new XAttribute("displayName", eth.Value.display),
          new XAttribute("codeSystem", "2.16.840.1.113883.6.238")));

    // Language
    if (pat.TryGetProperty("communication", out var commArr) && commArr.GetArrayLength() > 0)
    {
      var lang = commArr[0];
      if (lang.TryGetProperty("language", out var langObj))
      {
        var langCode = FirstCoding(langObj);
        patient.Add(new XElement(Hl7 + "languageCommunication",
            new XElement(Hl7 + "languageCode",
                new XAttribute("code", langCode.code ?? "en"))));
      }
    }

    patientRole.Add(patient);
    return new XElement(Hl7 + "recordTarget", patientRole);
  }

  // ── Header: author ─────────────────────────────────────────────────────────
  static XElement Author(DateTime now) =>
      new(Hl7 + "author",
          new XElement(Hl7 + "time", new XAttribute("value", CdaTime(now))),
          new XElement(Hl7 + "assignedAuthor",
              new XElement(Hl7 + "id", new XAttribute("root", "2.16.840.1.113883.4.6"),
                                       new XAttribute("nullFlavor", "NA")),
              new XElement(Hl7 + "assignedAuthoringDevice",
                  new XElement(Hl7 + "manufacturerModelName", "fhirPlace"),
                  new XElement(Hl7 + "softwareName", "fhirPlace CCD Generator"))));

  // ── Header: custodian ──────────────────────────────────────────────────────
  static XElement Custodian() =>
      new(Hl7 + "custodian",
          new XElement(Hl7 + "assignedCustodian",
              new XElement(Hl7 + "representedCustodianOrganization",
                  new XElement(Hl7 + "id", new XAttribute("root", "2.16.840.1.113883.4.6"),
                                           new XAttribute("nullFlavor", "NA")),
                  new XElement(Hl7 + "name", "fhirPlace"))));

  // ── Structured body ────────────────────────────────────────────────────────
  static XElement StructuredBody(
      IReadOnlyList<string> conditions, IReadOnlyList<string> medications,
      IReadOnlyList<string> observations, IReadOnlyList<string> procedures,
      IReadOnlyList<string> immunizations, IReadOnlyList<string> encounters)
  {
    // Split observations into labs and vitals
    var labs = new List<string>();
    var vitals = new List<string>();
    foreach (var obsJson in observations)
    {
      using var doc = JsonDocument.Parse(obsJson);
      var cat = GetCategory(doc.RootElement);
      if (cat == "vital-signs") vitals.Add(obsJson);
      else labs.Add(obsJson);
    }

    return new XElement(Hl7 + "component",
        new XElement(Hl7 + "structuredBody",
            ProblemsSection(conditions),
            MedicationsSection(medications),
            ResultsSection(labs),
            VitalSignsSection(vitals),
            ProceduresSection(procedures),
            ImmunizationsSection(immunizations),
            EncountersSection(encounters)));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION BUILDERS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Problems (Conditions) ──────────────────────────────────────────────────
  static XElement ProblemsSection(IReadOnlyList<string> conditions)
  {
    var rows = conditions.Select(json =>
    {
      using var doc = JsonDocument.Parse(json);
      var r = doc.RootElement;
      var coding = CodeableConcept(r, "code");
      var onset = Str(r, "onsetDateTime");
      var abatement = Str(r, "abatementDateTime");
      var status = StrCoding(r, "clinicalStatus") ?? "active";
      return Tr(coding.display, status, FmtDate(onset), FmtDate(abatement));
    }).ToList();

    var entries = conditions.Select(json =>
    {
      using var doc = JsonDocument.Parse(json);
      var r = doc.RootElement;
      var coding = CodeableConcept(r, "code");
      var onset = Str(r, "onsetDateTime");
      var abatement = Str(r, "abatementDateTime");
      var status = StrCoding(r, "clinicalStatus") ?? "active";

      return new XElement(Hl7 + "entry", new XAttribute("typeCode", "DRIV"),
          new XElement(Hl7 + "act",
              new XAttribute("classCode", "ACT"), new XAttribute("moodCode", "EVN"),
              TemplateId("2.16.840.1.113883.10.20.22.4.3"),
              IdElement(),
              new XElement(Hl7 + "code",
                  new XAttribute("code", "CONC"),
                  new XAttribute("codeSystem", "2.16.840.1.113883.5.6")),
              new XElement(Hl7 + "statusCode", new XAttribute("code", "active")),
              EffectiveTime(onset, abatement),
              new XElement(Hl7 + "entryRelationship", new XAttribute("typeCode", "SUBJ"),
                  new XElement(Hl7 + "observation",
                      new XAttribute("classCode", "OBS"), new XAttribute("moodCode", "EVN"),
                      TemplateId("2.16.840.1.113883.10.20.22.4.4"),
                      IdElement(),
                      new XElement(Hl7 + "code",
                          new XAttribute("code", "64572001"),
                          new XAttribute("codeSystem", OidSnomed),
                          new XAttribute("displayName", "Condition")),
                      new XElement(Hl7 + "statusCode", new XAttribute("code", "completed")),
                      EffectiveTime(onset, abatement),
                      CdaCodedValue(coding, OidSnomed)))));
    }).ToList();

    return Section("2.16.840.1.113883.10.20.22.2.5.1",
        "11450-4", "Problem List",
        HtmlTable(new[] { "Condition", "Status", "Onset", "Resolved" }, rows),
        entries, conditions.Count == 0);
  }

    foreach (var med in medications.Select(json =>
             {
               using var doc = JsonDocument.Parse(json);
               return new { Root = doc.RootElement };
             }))
  static XElement MedicationsSection(IReadOnlyList<string> medications)
      var r = med.Root;
    var entries = new List<XElement>();

    foreach (var json in medications)
    {
      using var doc = JsonDocument.Parse(json);
      var r = doc.RootElement;
      var coding = MedicationCoding(r);
      var authored = Str(r, "authoredOn");
      var status = Str(r, "status") ?? "unknown";

      rows.Add(Tr(coding.display, status, FmtDate(authored)));

      entries.Add(new XElement(Hl7 + "entry", new XAttribute("typeCode", "DRIV"),
          new XElement(Hl7 + "substanceAdministration",
              new XAttribute("classCode", "SBADM"), new XAttribute("moodCode", "EVN"),
              TemplateId("2.16.840.1.113883.10.20.22.4.16"),
              IdElement(),
              new XElement(Hl7 + "statusCode", new XAttribute("code", MapMedStatus(status))),
              EffectiveTime(authored, null),
              new XElement(Hl7 + "consumable",
                  new XElement(Hl7 + "manufacturedProduct",
                      new XAttribute("classCode", "MANU"),
                      TemplateId("2.16.840.1.113883.10.20.22.4.23"),
                      new XElement(Hl7 + "manufacturedMaterial",
                          CdaCode(coding, OidRxNorm)))))));
    }

    return Section("2.16.840.1.113883.10.20.22.2.1.1",
        "10160-0", "Medications",
        HtmlTable(new[] { "Medication", "Status", "Date" }, rows),
        entries, medications.Count == 0);
  }

  // ── Results (Lab Observations) ─────────────────────────────────────────────
  static XElement ResultsSection(IReadOnlyList<string> labs)
  {
    var rows = new List<XElement>();
    var entries = new List<XElement>();

    foreach (var json in labs)
    {
      using var doc = JsonDocument.Parse(json);
      var r = doc.RootElement;
      var coding = CodeableConcept(r, "code");
      var effDate = Str(r, "effectiveDateTime");
      var (val, unit) = ObservationValue(r);

      rows.Add(Tr(coding.display, $"{val} {unit}".Trim(), FmtDate(effDate)));

      entries.Add(new XElement(Hl7 + "entry", new XAttribute("typeCode", "DRIV"),
          new XElement(Hl7 + "organizer",
              new XAttribute("classCode", "CLUSTER"), new XAttribute("moodCode", "EVN"),
              TemplateId("2.16.840.1.113883.10.20.22.4.1"),
              IdElement(),
              new XElement(Hl7 + "code", CdaCodeAttrs(coding, OidLoinc)),
              new XElement(Hl7 + "statusCode", new XAttribute("code", "completed")),
              new XElement(Hl7 + "component",
                  ObservationEntry(r, coding, effDate, val, unit)))));
    }

    return Section("2.16.840.1.113883.10.20.22.2.3.1",
        "30954-2", "Results",
        HtmlTable(new[] { "Test", "Result", "Date" }, rows),
        entries, labs.Count == 0);
  }

  // ── Vital Signs ────────────────────────────────────────────────────────────
  static XElement VitalSignsSection(IReadOnlyList<string> vitals)
  {
    var rows = new List<XElement>();
    var entries = new List<XElement>();

    foreach (var json in vitals)
    {
      using var doc = JsonDocument.Parse(json);
      var r = doc.RootElement;
      var coding = CodeableConcept(r, "code");
      var effDate = Str(r, "effectiveDateTime");
      var (val, unit) = ObservationValue(r);

      rows.Add(Tr(coding.display, $"{val} {unit}".Trim(), FmtDate(effDate)));

      entries.Add(new XElement(Hl7 + "entry", new XAttribute("typeCode", "DRIV"),
          new XElement(Hl7 + "organizer",
              new XAttribute("classCode", "CLUSTER"), new XAttribute("moodCode", "EVN"),
              TemplateId("2.16.840.1.113883.10.20.22.4.26"),
              IdElement(),
              new XElement(Hl7 + "code",
                  new XAttribute("code", "46680005"),
                  new XAttribute("codeSystem", OidSnomed),
                  new XAttribute("displayName", "Vital Signs")),
              new XElement(Hl7 + "statusCode", new XAttribute("code", "completed")),
              EffectiveTime(effDate, null),
              new XElement(Hl7 + "component",
                  ObservationEntry(r, coding, effDate, val, unit)))));
    }

    return Section("2.16.840.1.113883.10.20.22.2.4.1",
        "8716-3", "Vital Signs",
        HtmlTable(new[] { "Vital Sign", "Result", "Date" }, rows),
        entries, vitals.Count == 0);
  }

  // ── Procedures ─────────────────────────────────────────────────────────────
  static XElement ProceduresSection(IReadOnlyList<string> procedures)
  {
    var rows = new List<XElement>();
    var entries = new List<XElement>();

    foreach (var json in procedures)
    {
      using var doc = JsonDocument.Parse(json);
      var r = doc.RootElement;
      var coding = CodeableConcept(r, "code");
      var performed = Str(r, "performedDateTime")
                   ?? NestedStr(r, "performedPeriod", "start");
      var status = Str(r, "status") ?? "completed";

      rows.Add(Tr(coding.display, status, FmtDate(performed)));

      entries.Add(new XElement(Hl7 + "entry", new XAttribute("typeCode", "DRIV"),
          new XElement(Hl7 + "procedure",
              new XAttribute("classCode", "PROC"), new XAttribute("moodCode", "EVN"),
              TemplateId("2.16.840.1.113883.10.20.22.4.14"),
              IdElement(),
              CdaCode(coding, OidSnomed),
              new XElement(Hl7 + "statusCode", new XAttribute("code", "completed")),
              EffectiveTime(performed, null))));
    }

    return Section("2.16.840.1.113883.10.20.22.2.7.1",
        "47519-4", "Procedures",
        HtmlTable(new[] { "Procedure", "Status", "Date" }, rows),
        entries, procedures.Count == 0);
  }

  // ── Immunizations ──────────────────────────────────────────────────────────
  static XElement ImmunizationsSection(IReadOnlyList<string> immunizations)
  {
    var rows = new List<XElement>();
    var entries = new List<XElement>();

    foreach (var json in immunizations)
    {
      using var doc = JsonDocument.Parse(json);
      var r = doc.RootElement;
      var coding = CodeableConcept(r, "vaccineCode");
      var occurrence = Str(r, "occurrenceDateTime");
      var status = Str(r, "status") ?? "completed";

      rows.Add(Tr(coding.display, status, FmtDate(occurrence)));

      entries.Add(new XElement(Hl7 + "entry", new XAttribute("typeCode", "DRIV"),
          new XElement(Hl7 + "substanceAdministration",
              new XAttribute("classCode", "SBADM"), new XAttribute("moodCode", "EVN"),
              new XAttribute("negationInd", status == "not-done" ? "true" : "false"),
              TemplateId("2.16.840.1.113883.10.20.22.4.52"),
              IdElement(),
              new XElement(Hl7 + "statusCode", new XAttribute("code", "completed")),
              EffectiveTime(occurrence, null),
              new XElement(Hl7 + "consumable",
                  new XElement(Hl7 + "manufacturedProduct",
                      new XAttribute("classCode", "MANU"),
                      TemplateId("2.16.840.1.113883.10.20.22.4.54"),
                      new XElement(Hl7 + "manufacturedMaterial",
                          CdaCode(coding, OidCvx)))))));
    }

    return Section("2.16.840.1.113883.10.20.22.2.2.1",
        "11369-6", "Immunizations",
        HtmlTable(new[] { "Vaccine", "Status", "Date" }, rows),
        entries, immunizations.Count == 0);
  }

  // ── Encounters ─────────────────────────────────────────────────────────────
  static XElement EncountersSection(IReadOnlyList<string> encounters)
  {
    var rows = new List<XElement>();
    var entries = new List<XElement>();

    foreach (var json in encounters)
    {
      using var doc = JsonDocument.Parse(json);
      var r = doc.RootElement;

      var typeCoding = EncounterTypeCoding(r);
      var periodStart = NestedStr(r, "period", "start");
      var periodEnd = NestedStr(r, "period", "end");
      var status = Str(r, "status") ?? "finished";

      rows.Add(Tr(typeCoding.display, status, FmtDate(periodStart), FmtDate(periodEnd)));

      entries.Add(new XElement(Hl7 + "entry", new XAttribute("typeCode", "DRIV"),
          new XElement(Hl7 + "encounter",
              new XAttribute("classCode", "ENC"), new XAttribute("moodCode", "EVN"),
              TemplateId("2.16.840.1.113883.10.20.22.4.49"),
              IdElement(),
              CdaCode(typeCoding, OidSnomed),
              EffectiveTime(periodStart, periodEnd))));
    }

    return Section("2.16.840.1.113883.10.20.22.2.22.1",
        "46240-8", "Encounters",
        HtmlTable(new[] { "Type", "Status", "Start", "End" }, rows),
        entries, encounters.Count == 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SHARED HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  static XElement Section(string templateOid, string loincCode, string title,
                          XElement htmlTable, List<XElement> entries, bool empty)
  {
    var section = new XElement(Hl7 + "component",
        new XElement(Hl7 + "section",
            TemplateId(templateOid),
            new XElement(Hl7 + "code",
                new XAttribute("code", loincCode),
                new XAttribute("codeSystem", OidLoinc),
                new XAttribute("codeSystemName", "LOINC"),
                new XAttribute("displayName", title)),
            new XElement(Hl7 + "title", title)));

    var sec = section.Element(Hl7 + "section")!;

    if (empty)
    {
      sec.Add(new XElement(Hl7 + "text",
          new XElement(Hl7 + "paragraph", "No data available")));
    }
    else
    {
      sec.Add(new XElement(Hl7 + "text", htmlTable));
      foreach (var e in entries) sec.Add(e);
    }

    return section;
  }

  static XElement TemplateId(string oid) =>
      new(Hl7 + "templateId", new XAttribute("root", oid));

  static XElement IdElement() =>
      new(Hl7 + "id", new XAttribute("root", Guid.NewGuid().ToString()));

  static XElement EffectiveTime(string? low, string? high)
  {
    var et = new XElement(Hl7 + "effectiveTime");
    et.Add(new XElement(Hl7 + "low",
        string.IsNullOrEmpty(low)
            ? new XAttribute("nullFlavor", "UNK")
            : new XAttribute("value", CdaDate(low))));
    if (high is not null)
      et.Add(new XElement(Hl7 + "high",
          string.IsNullOrEmpty(high)
              ? new XAttribute("nullFlavor", "UNK")
              : new XAttribute("value", CdaDate(high))));
    return et;
  }

  // ── Code helpers ─────────────────────────────────────────────────────
  static XElement CdaCode(CodingInfo c, string defaultSystem)
  {
    var el = new XElement(Hl7 + "code");
    el.Add(CdaCodeAttrs(c, defaultSystem));
    return el;
  }

  static IEnumerable<XAttribute> CdaCodeAttrs(CodingInfo c, string defaultSystem)
  {
    yield return new XAttribute("code", c.code ?? "UNK");
    yield return new XAttribute("codeSystem", MapSystem(c.system, defaultSystem));
    if (c.display is not null)
      yield return new XAttribute("displayName", c.display);
  }

  static XElement CdaCodedValue(CodingInfo c, string defaultSystem)
  {
    var el = new XElement(Hl7 + "value");
    el.Add(new XAttribute(Xsi + "type", "CD"));
    el.Add(new XAttribute("code", c.code ?? "UNK"));
    el.Add(new XAttribute("codeSystem", MapSystem(c.system, defaultSystem)));
    if (c.display is not null) el.Add(new XAttribute("displayName", c.display));
    return el;
  }

  static string MapSystem(string? fhirSystem, string defaultOid) => fhirSystem switch
  {
    "http://snomed.info/sct" => OidSnomed,
    "http://loinc.org" => OidLoinc,
    "http://www.nlm.nih.gov/research/umls/rxnorm" => OidRxNorm,
    "http://hl7.org/fhir/sid/cvx" => OidCvx,
    "http://www.ama-assn.org/go/cpt" => OidCpt,
    _ => defaultOid
  };

  // ── Observation value extraction ─────────────────────────────────────
  static XElement ObservationEntry(JsonElement r, CodingInfo coding,
                                   string? effDate, string val, string unit)
  {
    var obs = new XElement(Hl7 + "observation",
        new XAttribute("classCode", "OBS"), new XAttribute("moodCode", "EVN"),
        TemplateId("2.16.840.1.113883.10.20.22.4.2"),
        IdElement(),
        CdaCode(coding, OidLoinc),
        new XElement(Hl7 + "statusCode", new XAttribute("code", "completed")),
        EffectiveTime(effDate, null));

    if (!string.IsNullOrEmpty(val) && decimal.TryParse(val, out _))
    {
      obs.Add(new XElement(Hl7 + "value",
          new XAttribute(Xsi + "type", "PQ"),
          new XAttribute("value", val),
          new XAttribute("unit", unit ?? "1")));
    }
    else if (!string.IsNullOrEmpty(val))
    {
      obs.Add(new XElement(Hl7 + "value",
          new XAttribute(Xsi + "type", "ST"), val));
    }

    return obs;
  }

  static (string val, string unit) ObservationValue(JsonElement r)
  {
    if (r.TryGetProperty("valueQuantity", out var vq))
      return (Str(vq, "value"), Str(vq, "unit"));

    if (r.TryGetProperty("valueString", out var vs))
      return (vs.GetString() ?? "", "");

    if (r.TryGetProperty("valueCodeableConcept", out var vcc))
    {
      var c = CodeableConceptDirect(vcc);
      return (c.display ?? "", "");
    }

    // Component-based observations (e.g., blood pressure)
    if (r.TryGetProperty("component", out var comp) && comp.GetArrayLength() > 0)
    {
      var parts = new List<string>();
      foreach (var c in comp.EnumerateArray())
      {
        var cc = CodeableConceptDirect(c.TryGetProperty("code", out var cCode) ? cCode : default);
        var (v, u) = c.TryGetProperty("valueQuantity", out var cvq)
            ? (Str(cvq, "value"), Str(cvq, "unit"))
            : ("", "");
        if (!string.IsNullOrEmpty(v))
          parts.Add($"{cc.display}: {v} {u}".Trim());
      }
      return (string.Join("; ", parts), "");
    }

    return ("", "");
  }

  static string GetCategory(JsonElement r)
  {
    if (!r.TryGetProperty("category", out var catArr)) return "laboratory";
    foreach (var cat in catArr.EnumerateArray())
      if (cat.TryGetProperty("coding", out var codings))
        foreach (var c in codings.EnumerateArray())
        {
          var code = c.TryGetProperty("code", out var cProp) ? cProp.GetString() : null;
          if (code is "vital-signs") return "vital-signs";
        }
    return "laboratory";
  }

  static string MapMedStatus(string fhirStatus) => fhirStatus switch
  {
    "active" => "active",
    "completed" => "completed",
    "stopped" => "aborted",
    "cancelled" => "cancelled",
    _ => "completed"
  };

  // ── HTML table for narrative text block ─────────────────────────────
  static XElement HtmlTable(string[] headers, List<XElement> rows)
  {
    var thead = new XElement(Hl7 + "thead",
        new XElement(Hl7 + "tr",
            headers.Select(h => new XElement(Hl7 + "th", h))));

    var tbody = new XElement(Hl7 + "tbody");
    foreach (var row in rows) tbody.Add(row);

    return new XElement(Hl7 + "table",
        new XAttribute("border", "1"), new XAttribute("width", "100%"),
        thead, tbody);
  }

  static XElement Tr(params string[] cells) =>
      new(Hl7 + "tr", cells.Select(c => new XElement(Hl7 + "td", c ?? "")));

  // ── JSON traversal helpers ──────────────────────────────────────────
  record struct CodingInfo(string? code, string? system, string? display);

  static CodingInfo CodeableConcept(JsonElement r, string property)
  {
    if (!r.TryGetProperty(property, out var cc)) return new("UNK", null, "Unknown");
    return CodeableConceptDirect(cc);
  }

  static CodingInfo CodeableConceptDirect(JsonElement cc)
  {
    if (cc.ValueKind == JsonValueKind.Undefined)
      return new("UNK", null, "Unknown");

    var text = cc.TryGetProperty("text", out var t) ? t.GetString() : null;
    if (cc.TryGetProperty("coding", out var codings) && codings.GetArrayLength() > 0)
    {
      var first = codings[0];
      return new(
          first.TryGetProperty("code", out var c) ? c.GetString() : "UNK",
          first.TryGetProperty("system", out var s) ? s.GetString() : null,
          first.TryGetProperty("display", out var d) ? d.GetString() : text ?? "Unknown");
    }
    return new("UNK", null, text ?? "Unknown");
  }

  static CodingInfo FirstCoding(JsonElement cc)
  {
    if (cc.TryGetProperty("coding", out var codings) && codings.GetArrayLength() > 0)
    {
      var first = codings[0];
      return new(
          first.TryGetProperty("code", out var c) ? c.GetString() : null,
          first.TryGetProperty("system", out var s) ? s.GetString() : null,
          first.TryGetProperty("display", out var d) ? d.GetString() : null);
    }
    return new(null, null, null);
  }

  static CodingInfo MedicationCoding(JsonElement r)
  {
    // medicationCodeableConcept
    if (r.TryGetProperty("medicationCodeableConcept", out var mcc))
      return CodeableConceptDirect(mcc);
    // Fallback to code if present
    return CodeableConcept(r, "code");
  }

  static CodingInfo EncounterTypeCoding(JsonElement r)
  {
    if (r.TryGetProperty("type", out var types) && types.GetArrayLength() > 0)
      return CodeableConceptDirect(types[0]);
    return new("UNK", null, "Encounter");
  }

  static string Str(JsonElement el, string prop, string fallback = "")
  {
    if (el.TryGetProperty(prop, out var v))
    {
      return v.ValueKind switch
      {
        JsonValueKind.String => v.GetString() ?? fallback,
        JsonValueKind.Number => v.ToString(),
        _ => fallback
      };
    }
    return fallback;
  }

  /// <summary>Extract coding[0].code from a nested codeable concept like clinicalStatus.coding[0].code</summary>
  static string? StrCoding(JsonElement el, string prop)
  {
    if (!el.TryGetProperty(prop, out var sub)) return null;
    if (sub.TryGetProperty("coding", out var arr) && arr.GetArrayLength() > 0)
      return arr[0].TryGetProperty("code", out var c) ? c.GetString() : null;
    return sub.TryGetProperty("text", out var t) ? t.GetString() : null;
  }

  static string NestedStr(JsonElement el, string prop1, string prop2)
  {
    if (el.TryGetProperty(prop1, out var sub))
      return Str(sub, prop2);
    return "";
  }

  static string? FindIdentifier(JsonElement pat, string typeText)
  {
    if (!pat.TryGetProperty("identifier", out var ids)) return null;
    foreach (var id in ids.EnumerateArray())
    {
      if (id.TryGetProperty("type", out var typeObj) &&
          typeObj.TryGetProperty("text", out var tt) &&
          (tt.GetString()?.Contains(typeText, StringComparison.OrdinalIgnoreCase) ?? false))
        return id.TryGetProperty("value", out var v) ? v.GetString() : null;

      // Also match by system
      if (id.TryGetProperty("system", out var sys) &&
          (sys.GetString()?.Contains(typeText, StringComparison.OrdinalIgnoreCase) ?? false))
        return id.TryGetProperty("value", out var sv) ? sv.GetString() : null;
    }
    return null;
  }

  static (string code, string display)? FindExtension(JsonElement pat, string urlFragment)
  {
    if (!pat.TryGetProperty("extension", out var exts)) return null;
    foreach (var ext in exts.EnumerateArray())
    {
      var url = ext.TryGetProperty("url", out var u) ? u.GetString() : null;
      if (url is null || !url.Contains(urlFragment, StringComparison.OrdinalIgnoreCase))
        continue;

      // Look inside nested extension for ombCategory
      if (ext.TryGetProperty("extension", out var nested))
      {
        foreach (var sub in nested.EnumerateArray())
        {
          var subUrl = sub.TryGetProperty("url", out var su) ? su.GetString() : null;
          if (subUrl == "ombCategory" && sub.TryGetProperty("valueCoding", out var vc))
          {
            var code = vc.TryGetProperty("code", out var c) ? c.GetString() : null;
            var display = vc.TryGetProperty("display", out var d) ? d.GetString() : null;
            if (code is not null && display is not null)
              return (code, display);
          }
        }
      }
    }
    return null;
  }

  // ── Date formatting ────────────────────────────────────────────────────
  static string CdaTime(DateTime dt) => dt.ToString("yyyyMMddHHmmsszzz").Replace(":", "");
  static string CdaDate(string isoDate)
  {
    // "2020-03-15T10:30:00Z" → "20200315103000+0000"
    // "2020-03-15" → "20200315"
    var cleaned = isoDate.Replace("-", "").Replace(":", "").Replace("T", "");
    // Remove trailing Z and fractional seconds
    var zIdx = cleaned.IndexOf('Z');
    if (zIdx >= 0) cleaned = cleaned[..zIdx] + "+0000";
    var dotIdx = cleaned.IndexOf('.');
    if (dotIdx >= 0)
    {
      var rest = cleaned[(dotIdx + 1)..];
      var plusIdx = rest.IndexOfAny(new[] { '+', '-' });
      cleaned = plusIdx >= 0
          ? cleaned[..dotIdx] + rest[plusIdx..]
          : cleaned[..dotIdx];
    }
    return cleaned;
  }

  static string FmtDate(string? iso) =>
      string.IsNullOrEmpty(iso) ? "" :
      DateTime.TryParse(iso, out var dt) ? dt.ToString("yyyy-MM-dd") : iso;
}
