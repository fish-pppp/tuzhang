/** Product version shown on the page and in exported records. */
export const APP_VERSION = "1.3.0";

/** Calendar date this version shipped (Asia/Shanghai). */
export const APP_UPDATED_ON = "2026-09-30";

export const APP_UPDATED_LABEL = "2026年9月30日";

export function formatAppVersionLine(): string {
  return `途账 ${APP_VERSION} · ${APP_UPDATED_LABEL}更新`;
}
