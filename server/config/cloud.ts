export function requireCloudConfiguration() {
  if (
    !process.env.DATABASE_URL ||
    !process.env.GOOGLE_CLOUD_PROJECT ||
    !process.env.FIREBASE_AUTH_DOMAIN ||
    !process.env.FIREBASE_WEB_API_KEY
  )
    throw Error(
      "Cloud mode requires database, project and Firebase public web configuration.",
    );
}
