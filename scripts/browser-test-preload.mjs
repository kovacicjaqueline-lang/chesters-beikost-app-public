import { webkit } from "playwright";
import { installSharedWebKitClient } from "./browser-test-shared-runtime.mjs";

installSharedWebKitClient(webkit, process.env.BROWSER_TEST_SHARED_WS_ENDPOINT);
