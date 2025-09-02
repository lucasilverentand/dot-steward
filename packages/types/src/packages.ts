// Package mapping (abstract name -> provider-specific definitions)
export interface ProviderPackageSpec {
  name: string;
  version?: string;
  repo?: string;
  extras?: Record<string, unknown>;
}

export interface PackageMapping {
  abstractName: string;
  providerDefs: Record<string, string | ProviderPackageSpec>;
}
