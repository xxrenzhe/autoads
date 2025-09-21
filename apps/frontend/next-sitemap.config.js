/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://autoads.com',
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
      { userAgent: '*', disallow: '/dashboard' },
      { userAgent: '*', disallow: '/offers' },
      { userAgent: '*', disallow: '/workflows' },
      { userAgent: '*', disallow: '/billing' },
    ],
  },
};
