// Prisma configuration (CommonJS)
// Compatible with Prisma 6 and future Prisma 7
// Docs: https://pris.ly/prisma-config

/** @type {import('prisma').PrismaConfig} */
module.exports = {
  schema: 'prisma/schema.prisma',
  seed: 'node prisma/seed.js',
}

