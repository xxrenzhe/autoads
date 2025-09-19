// Prisma configuration file
// This replaces the deprecated package.json#prisma config.
// Docs: https://pris.ly/prisma-config

export default {
  // Path to Prisma schema
  schema: 'prisma/schema.prisma',
  // Seed command (Node ESM script)
  seed: 'node prisma/seed.js',
};

