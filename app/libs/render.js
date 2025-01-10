import nunjucks from 'nunjucks'
import { config } from '../config.js'

// Initialize Nunjucks
const nunjucksEnv = nunjucks.configure('app/views', {
  autoescape: true, // Automatically escape output for security
  watch: true       // Watch for changes in templates during development
})

nunjucksEnv.addGlobal('config', config);

// Utility function to render templates
export function render(template, context) {
  return nunjucks.render(template, context)
}