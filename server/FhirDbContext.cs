using Microsoft.EntityFrameworkCore;

namespace FhirPlace.Server;

public class FhirDbContext(DbContextOptions<FhirDbContext> options) : DbContext(options)
{
  public DbSet<PatientRecord> Patients { get; set; }
  public DbSet<EncounterRecord> Encounters { get; set; }
  public DbSet<FhirResourceRecord> Resources { get; set; }
  public DbSet<DocRefEncounterLink> DocRefEncounterLinks { get; set; }
  public DbSet<ClaimEncounterLink> ClaimEncounterLinks { get; set; }
  public DbSet<EobEncounterLink> EobEncounterLinks { get; set; }
  public DbSet<AuditEvent> AuditEvents { get; set; }

  protected override void OnModelCreating(ModelBuilder mb)
  {
    // ── Composite PKs for junction tables ─────────────────────────────────
    mb.Entity<DocRefEncounterLink>().HasKey(l => new { l.DocRefId, l.EncounterId });
    mb.Entity<ClaimEncounterLink>().HasKey(l => new { l.ClaimId, l.EncounterId });
    mb.Entity<EobEncounterLink>().HasKey(l => new { l.EobId, l.EncounterId });

    // ── Patient indexes ───────────────────────────────────────────────────
    mb.Entity<PatientRecord>().HasIndex(p => p.Family);
    mb.Entity<PatientRecord>().HasIndex(p => p.Gender);
    mb.Entity<PatientRecord>().HasIndex(p => p.BirthDate);

    // ── Encounter indexes ─────────────────────────────────────────────────
    mb.Entity<EncounterRecord>().HasIndex(e => e.PatientId);
    mb.Entity<EncounterRecord>().HasIndex(e => e.Status);
    mb.Entity<EncounterRecord>().HasIndex(e => e.ClassCode);
    mb.Entity<EncounterRecord>().HasIndex(e => e.PeriodStart);

    // ── Generic resource indexes ──────────────────────────────────────────
    mb.Entity<FhirResourceRecord>().HasIndex(r => new { r.ResourceType, r.PatientId });
    mb.Entity<FhirResourceRecord>().HasIndex(r => new { r.ResourceType, r.EncounterId });

    // ── Junction table indexes (FK side) ──────────────────────────────────
    mb.Entity<DocRefEncounterLink>().HasIndex(l => l.EncounterId);
    mb.Entity<ClaimEncounterLink>().HasIndex(l => l.EncounterId);
    mb.Entity<EobEncounterLink>().HasIndex(l => l.EncounterId);

    // ── Audit event indexes (ONC §170.315(d)(2)) ─────────────────────────
    mb.Entity<AuditEvent>().HasIndex(a => a.Timestamp);
    mb.Entity<AuditEvent>().HasIndex(a => a.UserId);
    mb.Entity<AuditEvent>().HasIndex(a => a.PatientId);
    mb.Entity<AuditEvent>().HasIndex(a => a.Action);
    mb.Entity<AuditEvent>().HasIndex(a => a.ResourceType);
  }
}
