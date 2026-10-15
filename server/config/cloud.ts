export function requireCloudConfiguration() {
  if (
    process.env.APP_ENV === "staging" &&
    (!process.env.STAGING_PROJECT_ID ||
      !process.env.PRODUCTION_PROJECT_ID ||
      process.env.STAGING_PROJECT_ID === process.env.PRODUCTION_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT !== process.env.STAGING_PROJECT_ID ||
      !process.env.STAGING_DATABASE_URL ||
      process.env.DATABASE_URL !== process.env.STAGING_DATABASE_URL ||
      !process.env.STAGING_PRIVATE_BUCKET ||
      process.env.PRIVATE_UPLOAD_BUCKET !==
        process.env.STAGING_PRIVATE_BUCKET ||
      process.env.STAGING_FIREBASE_PROJECT_ID !==
        process.env.STAGING_PROJECT_ID)
  )
    throw Error(
      "Staging requires separate, consistently configured project, identity, database and private bucket settings.",
    );
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
