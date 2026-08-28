'use strict';

const { webkit } = require('playwright');
const { installSharedWebKitClient } = require('./browser-test-shared-runtime.cjs');

installSharedWebKitClient(webkit, process.env.BROWSER_TEST_SHARED_WS_ENDPOINT);
