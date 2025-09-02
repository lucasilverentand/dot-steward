import type { HostFacts, Matcher } from "@dot-steward/types";

export function evalMatcher(m: Matcher | undefined, facts: HostFacts): boolean {
  if (!m) return true;
  // Composition takes precedence
  if (m.all) {
    if (!m.all.every((mm) => evalMatcher(mm, facts))) return false;
  }
  if (m.any) {
    if (!m.any.some((mm) => evalMatcher(mm, facts))) return false;
  }
  if (m.not) {
    if (evalMatcher(m.not, facts)) return false;
  }
  // Predicates
  if (m.os) {
    const set = Array.isArray(m.os) ? m.os : [m.os];
    if (!set.includes(facts.os)) return false;
  }
  if (m.distro) {
    const set = Array.isArray(m.distro) ? m.distro : [m.distro];
    if (!facts.distro || !set.includes(facts.distro)) return false;
  }
  if (m.arch) {
    const set = Array.isArray(m.arch) ? m.arch : [m.arch];
    if (!set.includes(facts.arch)) return false;
  }
  if (m.user) {
    const set = Array.isArray(m.user) ? m.user : [m.user];
    if (!facts.user || !set.includes(facts.user)) return false;
  }
  if (m.hostname) {
    const set = Array.isArray(m.hostname) ? m.hostname : [m.hostname];
    if (!facts.hostname || !set.includes(facts.hostname)) return false;
  }
  if (m.env) {
    for (const [k, v] of Object.entries(m.env)) {
      if (facts.env[k] !== v) return false;
    }
  }
  if (typeof m.container === "boolean") {
    if (!!facts.container !== m.container) return false;
  }
  if (m.virtualization) {
    const set = Array.isArray(m.virtualization)
      ? m.virtualization
      : [m.virtualization];
    if (!facts.virtualization || !set.includes(facts.virtualization))
      return false;
  }
  return true;
}

export function defaultHostFacts(partial?: Partial<HostFacts>): HostFacts {
  // Provide reasonable defaults so matching can run in tests without probing
  return {
    os: partial?.os ?? "linux",
    arch: partial?.arch ?? "x64",
    env: partial?.env ?? {},
    distro: partial?.distro,
    user: partial?.user,
    hostname: partial?.hostname,
    container: partial?.container,
    virtualization: partial?.virtualization,
  };
}
