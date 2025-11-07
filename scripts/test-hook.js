#!/usr/bin/env node
// Test file to verify pre-commit hook allows console.log in scripts/

console.log('This should be allowed in scripts/ directory');
console.log('Testing pre-commit hook fix');

process.exit(0);
