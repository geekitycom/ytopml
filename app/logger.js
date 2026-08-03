import winston from 'winston';
import { config } from './config.js';

let format = winston.format.simple();

if (config.oidc.logLevel === 'debug') {
  format = winston.format.combine(
    winston.format.metadata(),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf((info) => {
      return `${info.level}: ${info.message} ${info.stack ?? ''} ${JSON.stringify(info.metadata, null, 2)}`;
    })
  );
}

export const logger = winston.createLogger({
  level: config.oidc.logLevel,
  // 'silent' is not a winston level, so it is handled explicitly. Used by the
  // test suite, which deliberately exercises the paths that log warnings.
  silent: config.oidc.logLevel === 'silent',
  format: format,
  transports: [new winston.transports.Console()]
});