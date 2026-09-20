/** Product version shown on the page and in exported records. */
export const APP_VERSION = "1.2.0";

/** Calendar date this version shipped (Asia/Shanghai). */
export const APP_UPDATED_ON = "2026-09-20";

export const APP_UPDATED_LABEL = "2026年9月20日";

export function formatAppVersionLine(): string {
  return `途账 ${APP_VERSION} · ${APP_UPDATED_LABEL}更新`;
}
