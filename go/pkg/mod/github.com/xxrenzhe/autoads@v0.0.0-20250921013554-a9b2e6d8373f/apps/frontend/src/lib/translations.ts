export async function getTranslations(locale: string): Promise<Record<string, unknown>> {
  switch (locale) {
    case "zh":
      return (await import("./locales/zh.json")).default;
    default:
      return (await import("./locales/en.json")).default;
  }
}
