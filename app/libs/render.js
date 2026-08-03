import nunjucks from 'nunjucks'
import { config } from '../config.js'

// Initialize Nunjucks
const nunjucksEnv = nunjucks.configure('app/views', {
  autoescape: true, // Automatically escape output for security
  // No in-process watcher: nodemon already restarts on .njk changes (see
  // nodemonConfig.ext), and a watcher holds the event loop open, which keeps
  // both the test runner and a stopped server from exiting.
  watch: false
})

nunjucksEnv.addGlobal('config', config);

// Utility function to render templates
export function render(template, context) {
  return nunjucks.render(template, context)
}