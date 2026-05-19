namespace FhirPlace.Server;

/// <summary>
/// Single source for authoritative UTC timestamps (audit, CCD, health).
/// Host clock sync (NTP/SNTP) is an infrastructure responsibility.
/// </summary>
public static class Timekeeping
{
  public static DateTime UtcNow() => DateTime.UtcNow;

  public static string UtcNowIso() => UtcNow().ToString("o");
}
