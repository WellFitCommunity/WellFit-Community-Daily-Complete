import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// ✅ This is now active and deployable
export const helloWorld = onRequest((_, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase v2!");
});
