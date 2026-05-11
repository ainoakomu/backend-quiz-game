const { defineConfig } = require('vitest/config');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.test for test environment
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

module.exports=defineConfig({
    test:{
        environment:"node",
        globals:true,
        coverage:{
            provider:"v8",
            reporter:["text","html"],
            include:["src/**/*.js"],
            exclude:["src/generated/**","src/index.js"],
        }
    }
});