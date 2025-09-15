// Narrow shims to unblock strict build for server-only modules.
// These modules are runtime-only on the server and not relied upon by client code paths during preview.

declare module '@/lib/security/*' {
  const mod: any;
  export = mod;
}

declare module '@/lib/services/*' {
  const mod: any;
  export = mod;
}

