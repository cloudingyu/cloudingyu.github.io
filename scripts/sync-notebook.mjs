#!/usr/bin/env node
// Keep the existing command name, but publish only reviewed website notes.
import { runCli } from '../course-notes/workflow.mjs';

runCli(['publish', ...process.argv.slice(2)]).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
