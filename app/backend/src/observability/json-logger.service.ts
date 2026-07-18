import { Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';

import { currentRequestId } from '../http/request-context';
import { redactSensitive } from './redact-sensitive';

type LogLevel = 'debug' | 'error' | 'info' | 'verbose' | 'warn';

@Injectable()
export class JsonLogger implements LoggerService {
  public debug(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('debug', message, optionalParameters);
  }

  public error(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('error', message, optionalParameters);
  }

  public log(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('info', message, optionalParameters);
  }

  public verbose(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('verbose', message, optionalParameters);
  }

  public warn(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('warn', message, optionalParameters);
  }

  private write(level: LogLevel, message: unknown, optionalParameters: unknown[]): void {
    const entry = {
      level,
      message: redactSensitive(message),
      parameters: redactSensitive(optionalParameters),
      requestId: currentRequestId(),
      timestamp: new Date().toISOString(),
    };
    const output = `${JSON.stringify(entry)}\n`;

    if (level === 'error' || level === 'warn') {
      process.stderr.write(output);
      return;
    }

    process.stdout.write(output);
  }
}
